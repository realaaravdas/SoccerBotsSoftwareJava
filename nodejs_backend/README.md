# SoccerBots Node.js Backend

Modern Node.js backend for the SoccerBots Control System, replacing the Python backend for better performance and integration.

## Overview

This is a complete rewrite of the Python backend in Node.js, providing:
- **Same functionality** - All features from the Python backend
- **Better performance** - No subprocess spawning, faster startup
- **Simplified deployment** - Single Node.js runtime
- **Improved state management** - Shared memory space with Electron
- **Native async/await** - Better for network operations

## Architecture

### Components

- **NetworkManager.js** - UDP communication with ESP32 robots
  - Robot discovery (port 12345)
  - Command transmission (port 2367)
  - Emergency stop broadcasting
  
- **RobotManager.js** - Robot lifecycle management
  - Automatic robot discovery via UDP broadcasts
  - Connection management
  - Command sending and timeouts
  - Emergency stop coordination

- **ControllerManager.js** - Game controller support
  - Uses browser Gamepad API (via frontend)
  - Controller-robot pairing
  - Input processing and normalization
  - Emergency stop triggering

- **ApiServer.js** - REST API + WebSocket server
  - Express.js for HTTP endpoints
  - Socket.IO for real-time updates
  - CORS enabled for development

- **Robot.js** - Robot data model
- **ControllerInput.js** - Controller input data structures
- **main.js** - Entry point and initialization

## Installation

```bash
npm install
```

## Running

### Standalone Mode
```bash
npm start              # Port 8080 (default)
node src/main.js 9090  # Custom port
```

### Development Mode
```bash
npm run dev  # Uses nodemon for auto-reload
```

### Integrated with Electron
The backend is loaded directly into the Electron main process (no subprocess).

## API Endpoints

See parent README for complete API documentation. Key endpoints:

- `GET /api/health` - Health check
- `GET /api/robots` - List all robots
- `POST /api/robots/:id/connect` - Connect to robot
- `GET /api/controllers` - List controllers
- `POST /api/controllers/gamepad-update` - Update gamepad state (from frontend)
- `POST /api/emergency-stop` - Activate emergency stop
- `GET /api/network/stats` - Network statistics

## WebSocket Events

- `robot_connected` - Robot connected
- `robot_disconnected` - Robot disconnected
- `robot_receiving` - Robot receiving commands
- `emergency_stop` - Emergency stop state changed
- `controllers_updated` - Controller list changed

## Controller Support

Unlike the Python backend which used pygame for USB controllers, this backend receives controller input from the **browser Gamepad API** running in the Electron renderer process.

The frontend polls the Gamepad API and sends controller state to the backend via REST API (`/api/controllers/gamepad-update`). This approach:
- Works in both Electron and web browsers
- Eliminates native dependencies
- Provides better cross-platform support
- Allows controller visualization in the UI

## Differences from Python Backend

### What's the Same
- All REST API endpoints
- WebSocket event system
- UDP communication protocol
- Robot discovery mechanism
- Emergency stop behavior
- Network timeout handling

### What's Different
- **Controller input**: Uses browser Gamepad API instead of pygame
- **Async model**: Native async/await instead of threading
- **Process model**: Runs in Electron main process instead of subprocess
- **Startup time**: ~500ms vs ~2-3s for Python
- **Memory usage**: ~50-80MB vs ~100-150MB for Python

## Dependencies

- **express** - REST API framework
- **cors** - Cross-Origin Resource Sharing
- **socket.io** - WebSocket communication
- **dgram** (built-in) - UDP networking
- **os** (built-in) - Network interface detection

## Development

### Testing
```bash
# Test backend startup
node src/main.js

# Should see:
# Starting SoccerBots Control System (Node.js Backend)
# [NetworkManager] UDP socket initialized...
# [RobotManager] Discovery service started on port 12345
# [ApiServer] API server running on http://localhost:8080
```

### Debugging
Enable verbose logging by setting `DEBUG=*` environment variable:
```bash
DEBUG=* npm start
```

## ESP32 Compatibility

The Node.js backend is **fully compatible** with existing ESP32 firmware. No changes required to:
- Discovery protocol
- Command format (24-byte binary packets)
- Game state commands (text format)
- Emergency stop messages
- UDP ports (12345 for discovery, 2367 for commands)

## License

MIT - Same as parent project
