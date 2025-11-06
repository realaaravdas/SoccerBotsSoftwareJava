/**
 * API Server with REST endpoints and WebSocket support.
 * Provides HTTP REST API and real-time WebSocket updates.
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

class ApiServer {
    constructor(robotManager, controllerManager, networkManager) {
        this.robotManager = robotManager;
        this.controllerManager = controllerManager;
        this.networkManager = networkManager;
        this.robotManager.apiServer = this; // Pass self to robot manager

        // Match timer state
        this.matchDurationMs = 120000; // Default: 2 minutes
        this.matchStartTime = 0;
        this.matchRunning = false;
        this.lastControllerCount = 0;

        // Express app setup
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.text());

        // HTTP server
        this.server = http.createServer(this.app);

        // Socket.IO setup
        this.io = new Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Register disconnect callback
        this.robotManager.registerDisconnectCallback((robotId) => {
            this._onRobotDisconnected(robotId);
        });

        this._setupRoutes();
        this._setupSocketIO();
        this._startBackgroundTasks();
    }

    _onRobotDisconnected(robotId) {
        console.log(`[ApiServer] Robot disconnected via timeout: ${robotId}`);
        this.broadcastUpdate('robot_disconnected', { id: robotId });
    }

    _setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'online',
                timestamp: Date.now()
            });
        });

        // Get all robots
        this.app.get('/api/robots', (req, res) => {
            const robotsList = [];
            const addedRobots = new Set();

            // Add connected robots first
            for (const robot of this.robotManager.getConnectedRobots()) {
                robotsList.push(robot.toDict());
                addedRobots.add(robot.id);
            }

            // Add discovered robots that aren't already in the list
            for (const robot of this.robotManager.getDiscoveredRobots()) {
                if (!addedRobots.has(robot.id)) {
                    robotsList.push(robot.toDict());
                }
            }

            res.json(robotsList);
        });

        // Get robot by ID
        this.app.get('/api/robots/:robotId', (req, res) => {
            const robot = this.robotManager.getRobot(req.params.robotId);
            if (robot) {
                res.json(robot.toDict());
            } else {
                res.status(404).json({ error: 'Robot not found' });
            }
        });

        // Connect to robot
        this.app.post('/api/robots/:robotId/connect', (req, res) => {
            const robot = this.robotManager.connectDiscoveredRobot(req.params.robotId);
            if (robot) {
                this.broadcastUpdate('robot_connected', robot.toDict());
                res.json({
                    success: true,
                    message: 'Robot connected',
                    robot: robot.toDict()
                });
            } else {
                res.status(404).json({ error: 'Robot not found' });
            }
        });

        // Disconnect from robot
        this.app.post('/api/robots/:robotId/disconnect', (req, res) => {
            this.robotManager.removeRobot(req.params.robotId);
            this.broadcastUpdate('robot_disconnected', { id: req.params.robotId });
            res.json({ success: true });
        });

        // Enable robot
        this.app.post('/api/robots/:robotId/enable', (req, res) => {
            const robot = this.robotManager.getRobot(req.params.robotId);
            if (robot) {
                robot.disabled = false;
                this.robotManager.startTeleop();
                this.broadcastUpdate('robot_enabled', { id: req.params.robotId });
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Robot not found' });
            }
        });

        // Disable robot
        this.app.post('/api/robots/:robotId/disable', (req, res) => {
            const robot = this.robotManager.getRobot(req.params.robotId);
            if (robot) {
                robot.disabled = true;
                this.robotManager.stopTeleop();
                this.broadcastUpdate('robot_disabled', { id: req.params.robotId });
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Robot not found' });
            }
        });

        // Refresh robots
        this.app.post('/api/robots/refresh', (req, res) => {
            this.robotManager.scanForRobots();
            this.broadcastUpdate('robots_refreshing', {});
            res.json({ success: true });
        });

        // Get all controllers
        this.app.get('/api/controllers', (req, res) => {
            const controllers = this.controllerManager.getConnectedControllers();
            res.json(controllers);
        });

        // Pair controller with robot
        this.app.post('/api/controllers/:controllerId/pair/:robotId', (req, res) => {
            this.controllerManager.pairControllerWithRobot(req.params.controllerId, req.params.robotId);
            res.json({ success: true });
        });

        // Unpair controller
        this.app.post('/api/controllers/:controllerId/unpair', (req, res) => {
            this.controllerManager.unpairController(req.params.controllerId);
            res.json({ success: true });
        });

        // Enable controller
        this.app.post('/api/controllers/:controllerId/enable', (req, res) => {
            this.controllerManager.enableController(req.params.controllerId);
            res.json({ success: true });
        });

        // Disable controller
        this.app.post('/api/controllers/:controllerId/disable', (req, res) => {
            this.controllerManager.disableController(req.params.controllerId);
            res.json({ success: true });
        });

        // Hide controller
        this.app.post('/api/controllers/:controllerId/hide', (req, res) => {
            this.controllerManager.hideController(req.params.controllerId);
            this.broadcastUpdate('controllers_updated', {});
            res.json({ success: true });
        });

        // Unhide controller
        this.app.post('/api/controllers/:controllerId/unhide', (req, res) => {
            this.controllerManager.unhideController(req.params.controllerId);
            this.broadcastUpdate('controllers_updated', {});
            res.json({ success: true });
        });

        // Refresh controllers
        this.app.post('/api/controllers/refresh', (req, res) => {
            this.controllerManager.refreshControllers();
            this.broadcastUpdate('controllers_updated', {});
            res.json({ success: true });
        });

        // Update gamepad state (called from frontend)
        this.app.post('/api/controllers/gamepad-update', (req, res) => {
            const { controllerId, gamepadData } = req.body;
            if (controllerId && gamepadData) {
                this.controllerManager.updateGamepadState(controllerId, gamepadData);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Invalid gamepad data' });
            }
        });

        // Remove gamepad (called from frontend)
        this.app.post('/api/controllers/gamepad-remove', (req, res) => {
            const { controllerId } = req.body;
            if (controllerId) {
                this.controllerManager.removeGamepad(controllerId);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Invalid controller ID' });
            }
        });

        // Activate emergency stop
        this.app.post('/api/emergency-stop', (req, res) => {
            this.controllerManager.activateEmergencyStop();
            this.broadcastUpdate('emergency_stop', { active: true });
            res.json({ success: true });
        });

        // Deactivate emergency stop
        this.app.post('/api/emergency-stop/deactivate', (req, res) => {
            this.controllerManager.deactivateEmergencyStop();
            this.broadcastUpdate('emergency_stop', { active: false });
            res.json({ success: true });
        });

        // Get network statistics
        this.app.get('/api/network/stats', (req, res) => {
            const stats = this.networkManager.getNetworkStats();
            res.json({
                timestamp: Date.now(),
                downloadSpeed: stats.downloadSpeed,
                uploadSpeed: stats.uploadSpeed,
                activeConnections: this.robotManager.getConnectedRobots().length
            });
        });

        // Match timer endpoints
        this.app.get('/api/match/timer', (req, res) => {
            const timeRemaining = this.matchRunning
                ? Math.max(0, this.matchDurationMs - (Date.now() - this.matchStartTime))
                : this.matchDurationMs;

            res.json({
                running: this.matchRunning,
                timeRemainingMs: timeRemaining,
                durationMs: this.matchDurationMs,
                timeRemainingSeconds: Math.floor(timeRemaining / 1000)
            });
        });

        this.app.post('/api/match/start', (req, res) => {
            this.matchRunning = true;
            this.matchStartTime = Date.now();
            this.robotManager.startTeleop();
            res.json({ success: true });
        });

        this.app.post('/api/match/stop', (req, res) => {
            this.matchRunning = false;
            this.robotManager.stopTeleop();
            res.json({ success: true });
        });

        this.app.post('/api/match/reset', (req, res) => {
            this.matchRunning = false;
            this.matchStartTime = 0;
            res.json({ success: true });
        });

        this.app.post('/api/match/duration', (req, res) => {
            const durationSeconds = parseInt(req.body);
            if (!isNaN(durationSeconds)) {
                this.matchDurationMs = durationSeconds * 1000;
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Invalid duration' });
            }
        });
    }

    _setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.log('[ApiServer] Client connected via Socket.IO');

            socket.on('disconnect', () => {
                console.log('[ApiServer] Client disconnected');
            });
        });
    }

    _startBackgroundTasks() {
        // Periodic updates for controllers
        setInterval(() => {
            const currentCount = this.controllerManager.getConnectedControllerCount();
            if (currentCount !== this.lastControllerCount) {
                this.lastControllerCount = currentCount;
                this.broadcastUpdate('controllers_updated', {
                    count: currentCount
                });
            }
        }, 1000);
    }

    broadcastUpdate(type, data) {
        this.io.emit('update', { type, data });
    }

    broadcastRobotReceivingCommand(robotId, receiving) {
        const robot = this.robotManager.getRobot(robotId);
        if (robot) {
            robot.setReceiving(receiving);
            this.broadcastUpdate('robot_receiving', { id: robotId, receiving });
        }
    }

    start(port = 8080) {
        this.server.listen(port, () => {
            console.log(`[ApiServer] API server running on http://localhost:${port}`);
            console.log(`[ApiServer] WebSocket endpoint: ws://localhost:${port}/`);
        });
    }
}

module.exports = ApiServer;
