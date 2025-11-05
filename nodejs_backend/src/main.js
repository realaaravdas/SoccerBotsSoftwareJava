/**
 * Main entry point for the Node.js robot control system with HTTP API.
 * Used when running with Electron frontend or standalone.
 */

const NetworkManager = require('./NetworkManager');
const RobotManager = require('./RobotManager');
const ControllerManager = require('./ControllerManager');
const ApiServer = require('./ApiServer');

// Parse port from args if provided
const apiPort = process.argv[2] ? parseInt(process.argv[2]) : 8080;

console.log('Starting SoccerBots Control System (Node.js Backend)');

try {
    // Initialize network manager
    const networkManager = new NetworkManager();

    // Initialize robot manager
    const robotManager = new RobotManager(networkManager);
    robotManager.startDiscovery();

    // Initialize controller manager
    const controllerManager = new ControllerManager(robotManager);

    // Create API server
    const apiServer = new ApiServer(robotManager, controllerManager, networkManager);

    // Setup shutdown handler
    const shutdownHandler = () => {
        console.log('Shutting down...');
        controllerManager.shutdown();
        robotManager.shutdown();
        networkManager.shutdown();
        console.log('Shutdown complete');
        process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);

    console.log('System initialized successfully');

    // Start API server (blocking)
    apiServer.start(apiPort);

} catch (error) {
    console.error(`Failed to start backend: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
}
