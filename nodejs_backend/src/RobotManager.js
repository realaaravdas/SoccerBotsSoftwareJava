/**
 * Robot Manager for ESP32 robot lifecycle and communication management.
 */

const Robot = require('./Robot');
const NetworkManager = require('./NetworkManager');

class RobotManager {
    static ROBOT_TIMEOUT_SECONDS = 60.0; // Mark robot as disconnected after 60 seconds (matches Python behavior of no timeout)
    static DISCOVERY_PORT = NetworkManager.DISCOVERY_PORT; // Import from NetworkManager

    constructor(networkManager, apiServer = null) {
        this.networkManager = networkManager;
        this.apiServer = apiServer;
        this.connectedRobots = new Map();
        this.discoveredRobots = new Map();
        this.currentGameState = "standby"; // "standby" or "teleop"
        this.emergencyStopActive = false;
        this.running = false;
        this.discoveryInterval = null;
        this.timeoutInterval = null;
        this.gameStatusInterval = null;
        this.disconnectCallbacks = [];

        console.log('[RobotManager] ESP32 Robot Manager initialized with discovery protocol');
    }

    registerDisconnectCallback(callback) {
        this.disconnectCallbacks.push(callback);
    }

    startDiscovery() {
        if (this.running) {
            console.warn('[RobotManager] Discovery already running');
            return;
        }

        this.running = true;

        // Listen for discovery messages (pong responses)
        this.networkManager.onDiscoveryMessage((message, rinfo) => {
            this._handleDiscoveryResponse(message, rinfo);
        });

        // Send discovery pings periodically
        this.discoveryInterval = setInterval(() => {
            this.networkManager.sendDiscoveryPing();
        }, 50); // Send ping every 50ms like the Python code

        // Start timeout check loop
        this.timeoutInterval = setInterval(() => {
            this._timeoutCheckLoop();
        }, 2000); // Check every 2 seconds

        // Start game status broadcast loop
        this.gameStatusInterval = setInterval(() => {
            this._broadcastGameStatus();
        }, 1000); // Broadcast every second like Python code

        console.log(`[RobotManager] Discovery service started - sending pings on port ${NetworkManager.ESP32_UDP_PORT}`);
    }

    _handleDiscoveryResponse(message, rinfo) {
        // Handle discovery pong from robot: "pong:<robotId>"
        if (message.startsWith("pong:")) {
            const robotId = message.substring(5).trim();
            const ipAddress = rinfo.address;

            // Check if robot is in connected list
            let robot = this.connectedRobots.get(robotId);
            if (robot) {
                // Update connected robot's last seen time
                robot.setIpAddress(ipAddress);
                robot.updateLastSeenTime();
            } else {
                // Add/update discovered robot
                robot = this.discoveredRobots.get(robotId);
                if (!robot) {
                    robot = new Robot(robotId, robotId, ipAddress, "discovered");
                    this.discoveredRobots.set(robotId, robot);
                    console.log(`[RobotManager] Discovered new robot: ${robotId} at ${ipAddress}`);
                } else {
                    robot.setIpAddress(ipAddress);
                    robot.updateLastSeenTime();
                }
            }
        }
    }

    getRobot(robotId) {
        let robot = this.connectedRobots.get(robotId);
        if (robot) return robot;
        return this.discoveredRobots.get(robotId);
    }

    getConnectedRobots() {
        return Array.from(this.connectedRobots.values());
    }

    getDiscoveredRobots() {
        return Array.from(this.discoveredRobots.values());
    }

    connectDiscoveredRobot(robotId) {
        const robot = this.discoveredRobots.get(robotId);
        if (robot) {
            // Move from discovered to connected
            this.discoveredRobots.delete(robotId);
            robot.setConnected(true);
            robot.status = "connected";
            this.connectedRobots.set(robotId, robot);
            console.log(`[RobotManager] Connected to robot: ${robotId}`);

            // Send current game status
            this.networkManager.sendGameStatus(robot.name, robot.ipAddress, this.currentGameState);

            return robot;
        }
        return null;
    }

    removeRobot(robotId) {
        if (this.connectedRobots.has(robotId)) {
            const robot = this.connectedRobots.get(robotId);
            // Send stop command before removing
            this.networkManager.sendRobotCommand(robot.name, robot.ipAddress, 127, 127, 127, 127);
            this.connectedRobots.delete(robotId);
            console.log(`[RobotManager] Removed robot: ${robotId}`);
        }
    }

    scanForRobots() {
        console.log('[RobotManager] Robot scan requested - discovery is automatic via broadcast');
    }

    startTeleop() {
        this.currentGameState = "teleop";
        console.log('[RobotManager] Teleop mode started');

        // Send teleop status to all connected robots
        for (const robot of this.connectedRobots.values()) {
            this.networkManager.sendGameStatus(robot.name, robot.ipAddress, "teleop");
        }
    }

    sendMovementCommand(robotId, leftX, leftY, rightX, rightY) {
        const robot = this.getRobot(robotId);
        if (!robot) {
            console.warn(`[RobotManager] Cannot send command - robot not found: ${robotId}`);
            return;
        }

        // Convert from -1.0 to 1.0 range to 0-255 range (127 = center)
        const leftXInt = Math.max(0, Math.min(255, Math.floor((leftX + 1.0) * 127.5)));
        const leftYInt = Math.max(0, Math.min(255, Math.floor((leftY + 1.0) * 127.5)));
        const rightXInt = Math.max(0, Math.min(255, Math.floor((rightX + 1.0) * 127.5)));
        const rightYInt = Math.max(0, Math.min(255, Math.floor((rightY + 1.0) * 127.5)));

        // Send command via network manager
        this.networkManager.sendRobotCommand(
            robot.name, robot.ipAddress,
            leftXInt, leftYInt, rightXInt, rightYInt
        );

        // Update last command time
        robot.updateLastCommandTime();

        // Broadcast that robot is receiving commands
        if (this.apiServer) {
            this.apiServer.broadcastRobotReceivingCommand(robotId, true);
        }
    }

    sendStopCommand(robotName) {
        const robot = this.getRobot(robotName);
        if (!robot) {
            console.warn(`[RobotManager] Robot not found: ${robotName}`);
            return;
        }

        // Send centered command (all axes at 127 = stopped)
        this.networkManager.sendRobotCommand(robot.name, robot.ipAddress, 127, 127, 127, 127);
        if (this.apiServer) {
            this.apiServer.broadcastRobotReceivingCommand(robot.id, false);
        }
    }

    _timeoutCheckLoop() {
        try {
            const currentTime = Date.now();
            const robotsToRemove = [];

            // Only remove from discovered list after very long timeout (for truly offline robots)
            // Connected robots are never auto-disconnected (matches Python behavior)
            for (const [robotId, robot] of this.discoveredRobots.entries()) {
                const timeSinceSeen = (currentTime - robot.lastSeenTime) / 1000;
                if (timeSinceSeen > RobotManager.ROBOT_TIMEOUT_SECONDS) {
                    console.log(`[RobotManager] Removing stale robot ${robotId} from discovered list (offline for ${timeSinceSeen.toFixed(1)}s)`);
                    this.discoveredRobots.delete(robotId);
                    robotsToRemove.push(robotId);
                }
            }
        } catch (error) {
            console.error(`[RobotManager] Error in timeout check loop: ${error.message}`);
        }
    }

    _broadcastGameStatus() {
        // Send game status to all connected robots periodically
        for (const robot of this.connectedRobots.values()) {
            this.networkManager.sendGameStatus(robot.name, robot.ipAddress, this.currentGameState);
        }
    }

    stopTeleop() {
        this.currentGameState = "standby";
        console.log('[RobotManager] Teleop mode stopped');

        // Send standby status to all connected robots
        for (const robot of this.connectedRobots.values()) {
            this.networkManager.sendGameStatus(robot.name, robot.ipAddress, "standby");
            this.sendStopCommand(robot.id);
            if (this.apiServer) {
                this.apiServer.broadcastRobotReceivingCommand(robot.id, false);
            }
        }
    }

    emergencyStopAll() {
        this.emergencyStopActive = true;
        this.networkManager.broadcastEmergencyStop(true);
        console.warn('[RobotManager] Emergency stop activated for all robots');
        if (this.apiServer) {
            for (const robotId of this.connectedRobots.keys()) {
                this.apiServer.broadcastRobotReceivingCommand(robotId, false);
            }
        }
    }

    deactivateEmergencyStop() {
        this.emergencyStopActive = false;
        this.networkManager.broadcastEmergencyStop(false);
        console.log('[RobotManager] Emergency stop deactivated');
    }

    shutdown() {
        this.running = false;
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
        }
        if (this.timeoutInterval) {
            clearInterval(this.timeoutInterval);
        }
        if (this.gameStatusInterval) {
            clearInterval(this.gameStatusInterval);
        }

        // Send stop commands to all robots
        for (const robot of this.connectedRobots.values()) {
            this.sendStopCommand(robot.id);
        }

        console.log('[RobotManager] Robot manager shutdown complete');
    }
}

module.exports = RobotManager;
