/**
 * Robot Manager for ESP32 robot lifecycle and communication management.
 */

const Robot = require('./Robot');
const NetworkManager = require('./NetworkManager');

class RobotManager {
    static ROBOT_TIMEOUT_SECONDS = 10.0; // Mark robot as disconnected after 10 seconds
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

        // Listen for discovery messages
        this.networkManager.onDiscoveryMessage((message, rinfo) => {
            this._handleDiscoveryPing(message, rinfo);
        });

        // Start timeout check loop
        this.timeoutInterval = setInterval(() => {
            this._timeoutCheckLoop();
        }, 2000); // Check every 2 seconds

        console.log(`[RobotManager] Discovery service started on port ${RobotManager.DISCOVERY_PORT}`);
    }

    _handleDiscoveryPing(message, rinfo) {
        // Handle discovery ping from robot: "DISCOVER:<robotId>:<IP>"
        if (message.startsWith("DISCOVER:")) {
            const parts = message.split(':');
            if (parts.length >= 3) {
                const robotId = parts[1];
                const ipAddress = parts[2];

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

            // Send teleop status if match is running
            if (this.currentGameState === "teleop") {
                this.networkManager.sendGameStatus(robot.name, robot.ipAddress, "teleop");
            }

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
            const disconnectedRobots = [];
            const robotsToRemove = [];

            // Check connected robots for timeout
            for (const [robotId, robot] of this.connectedRobots.entries()) {
                const timeSinceSeen = (currentTime - robot.lastSeenTime) / 1000;
                if (timeSinceSeen > RobotManager.ROBOT_TIMEOUT_SECONDS) {
                    console.warn(`[RobotManager] Robot ${robotId} timed out (no ping for ${timeSinceSeen.toFixed(1)}s)`);
                    // Broadcast receiving: false before removing
                    if (this.apiServer) {
                        this.apiServer.broadcastRobotReceivingCommand(robotId, false);
                    }
                    // Remove from connected list
                    this.connectedRobots.delete(robotId);
                    disconnectedRobots.push(robotId);
                    robotsToRemove.push(robotId);
                }
            }

            // Also remove from discovered list - robots should completely disappear after timeout
            for (const [robotId, robot] of this.discoveredRobots.entries()) {
                const timeSinceSeen = (currentTime - robot.lastSeenTime) / 1000;
                if (timeSinceSeen > RobotManager.ROBOT_TIMEOUT_SECONDS) {
                    console.log(`[RobotManager] Removing stale robot ${robotId} from discovered list (offline for ${timeSinceSeen.toFixed(1)}s)`);
                    this.discoveredRobots.delete(robotId);
                    if (!robotsToRemove.includes(robotId)) {
                        robotsToRemove.push(robotId);
                    }
                }
            }

            // Call disconnect callbacks
            for (const robotId of disconnectedRobots) {
                for (const callback of this.disconnectCallbacks) {
                    try {
                        callback(robotId);
                    } catch (error) {
                        console.error(`[RobotManager] Error in disconnect callback: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error(`[RobotManager] Error in timeout check loop: ${error.message}`);
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
        if (this.timeoutInterval) {
            clearInterval(this.timeoutInterval);
        }

        // Send stop commands to all robots
        for (const robot of this.connectedRobots.values()) {
            this.sendStopCommand(robot.id);
        }

        console.log('[RobotManager] Robot manager shutdown complete');
    }
}

module.exports = RobotManager;
