# Migration Guide: Python to Node.js Backend

## Overview

Version 2.0.0 introduces a major architectural change: the Python backend has been replaced with a Node.js backend. This guide will help you migrate from the Python-based system to the new Node.js-based system.

## Why the Change?

### Benefits of Node.js Backend

1. **Single Runtime** - Only Node.js required (no Python dependency)
2. **Faster Startup** - ~500ms vs ~2-3s for Python subprocess
3. **Lower Memory** - ~50-80MB vs ~100-150MB for Python
4. **No Subprocess** - Backend runs in Electron main process (better state management)
5. **Simpler Deployment** - One packaged application, fewer dependencies
6. **Controller Support** - Browser Gamepad API (no native pygame dependencies)

### What Stays the Same

- ✅ All REST API endpoints (100% compatible)
- ✅ WebSocket event system
- ✅ UDP communication protocol with ESP32 robots
- ✅ Robot discovery mechanism
- ✅ Emergency stop behavior
- ✅ Network timeout handling
- ✅ ESP32 firmware (no changes needed!)

## Migration Steps

### For Users

#### 1. Uninstall (Optional)

If you want to remove Python dependencies:
```bash
# Optional: Remove Python backend dependencies
pip3 uninstall -r python_backend/requirements.txt -y

# Optional: Uninstall Python (if not used for other projects)
# This step depends on your operating system
```

#### 2. Install New Dependencies

```bash
# From repository root
npm run install:all
```

This will install:
- Frontend dependencies (React, Vite, etc.)
- Electron dependencies
- **Node.js backend dependencies** (Express, Socket.IO, etc.)

#### 3. Run the New Backend

```bash
# Development mode (one command)
npm run dev

# Or separately
npm run dev:backend      # Node.js backend
npm run dev:frontend     # React frontend
npm run dev:electron     # Electron window
```

#### 4. Verify Everything Works

- ✅ Backend starts on port 8080
- ✅ Frontend loads in Electron window
- ✅ WebSocket connects successfully
- ✅ Controllers detected (plug in USB controller, press any button)
- ✅ Robots discovered (power on ESP32 robot)
- ✅ Emergency stop works

### For Developers

#### Key Changes

**Before (Python):**
```python
# python_backend/main.py
from network_manager import NetworkManager
from robot_manager import RobotManager
from controller_manager import ControllerManager
from api_server import ApiServer

# Managers use threading for concurrent operations
# pygame for USB controller support
```

**After (Node.js):**
```javascript
// nodejs_backend/src/main.js
const NetworkManager = require('./NetworkManager');
const RobotManager = require('./RobotManager');
const ControllerManager = require('./ControllerManager');
const ApiServer = require('./ApiServer');

// Managers use native async/await
// Browser Gamepad API for controller support
```

#### Controller Input

**Before:**
- pygame library for USB controllers
- Native Python extension (platform-specific builds)
- Requires `/dev/input` access on Linux

**After:**
- Browser Gamepad API (HTML5)
- Frontend polls gamepads and sends state to backend
- No native dependencies
- Works in Electron/Chromium automatically

#### API Changes

**REST API** - No changes! All endpoints remain the same:
- `GET /api/health`
- `GET /api/robots`
- `POST /api/robots/:id/connect`
- `GET /api/controllers`
- `POST /api/emergency-stop`
- etc.

**WebSocket** - No changes! All events remain the same:
- `robot_connected`
- `robot_disconnected`
- `emergency_stop`
- etc.

**New Endpoints:**
- `POST /api/controllers/gamepad-update` - Update gamepad state (from frontend)
- `POST /api/controllers/gamepad-remove` - Remove disconnected gamepad

#### Backend Architecture

**Before (Python):**
```
Electron Main Process
  └─> Spawns Python subprocess
       └─> Flask server (port 8080)
            └─> Threading for concurrent operations
```

**After (Node.js):**
```
Electron Main Process
  └─> Loads Node.js backend (same process!)
       └─> Express server (port 8080)
            └─> Native async/await for concurrent operations
```

## Troubleshooting

### Port 8080 Already in Use

Kill any running Python backend processes:
```bash
# Linux/macOS
pkill -f "python3 main.py"

# Windows
taskkill /F /IM python.exe
```

### Controllers Not Detected

1. **Plug in controller before starting app**
2. **Press any button** to activate the controller
3. Check browser console (Ctrl+Shift+I) for gamepad detection
4. Try unplugging and replugging the controller

### Backend Won't Start

1. Check Node.js version: `node --version` (should be 18+)
2. Install dependencies: `cd nodejs_backend && npm install`
3. View logs in Electron DevTools console
4. Try running backend standalone: `cd nodejs_backend && npm start`

## Rollback (If Needed)

If you encounter issues with the Node.js backend, you can temporarily use the Python backend:

```bash
# Run Python backend (deprecated but functional)
npm run dev:backend:python

# Or directly
cd python_backend
python3 main.py
```

**Note:** The Python backend is deprecated and will be removed in a future version.

## Performance Comparison

| Metric | Python Backend | Node.js Backend | Improvement |
|--------|---------------|-----------------|-------------|
| Startup Time | ~2-3s | ~500ms | **4-6x faster** |
| Memory Usage | ~100-150MB | ~50-80MB | **~40% less** |
| Process Count | 2 (Electron + Python) | 1 (Electron only) | **50% reduction** |
| Dependencies | Python + pip packages | Node.js only | **Simpler** |
| Controller Support | pygame (native) | Gamepad API (web) | **No native deps** |

## FAQ

### Q: Do I need to update ESP32 firmware?
**A:** No! The ESP32 firmware remains 100% compatible. No changes needed.

### Q: Will my controller still work?
**A:** Yes! Controllers now use the browser Gamepad API. Plug in your controller and press any button to activate it.

### Q: Can I still use the Python backend?
**A:** Yes, but it's deprecated. Use `npm run dev:backend:python` to run it.

### Q: What about the Java backend?
**A:** The legacy Java backend is still available in the `legacy/` directory but is deprecated.

### Q: Do I need to change my robot names?
**A:** No changes needed to robot names or configuration.

### Q: Will network discovery still work?
**A:** Yes! The UDP discovery protocol is identical.

## Support

If you encounter issues during migration:

1. Check the [README.md](README.md) for updated documentation
2. Review the [nodejs_backend/README.md](nodejs_backend/README.md) for backend details
3. Open an issue on GitHub with:
   - Your operating system
   - Node.js version (`node --version`)
   - Error messages from console
   - Steps to reproduce

## Summary

The migration to Node.js brings significant performance improvements and simplifies deployment. The core functionality remains identical, with the same API, WebSocket events, and robot protocol. Your ESP32 robots will work without any firmware changes!

**Welcome to SoccerBots Control Station v2.0!** 🚀
