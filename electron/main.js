const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;
let backendServer = null;

const API_PORT = 8080;

function startNodeBackend() {
  // Only start Node.js backend in production mode
  // In dev mode, it's already started by npm run dev
  if (isDev) {
    console.log('[Node.js Backend] Development mode - backend should already be running via npm run dev');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      console.log('[Node.js Backend] Starting backend...');
      
      // Determine backend path based on environment
      const backendPath = isDev
        ? path.join(__dirname, '..', 'nodejs_backend', 'src')
        : path.join(process.resourcesPath, 'nodejs_backend', 'src');
      
      // Load backend modules directly (no subprocess needed!)
      const NetworkManager = require(path.join(backendPath, 'NetworkManager'));
      const RobotManager = require(path.join(backendPath, 'RobotManager'));
      const ControllerManager = require(path.join(backendPath, 'ControllerManager'));
      const ApiServer = require(path.join(backendPath, 'ApiServer'));

      // Initialize managers
      const networkManager = new NetworkManager();
      const robotManager = new RobotManager(networkManager);
      robotManager.startDiscovery();
      const controllerManager = new ControllerManager(robotManager);
      const apiServer = new ApiServer(robotManager, controllerManager, networkManager);

      // Start API server
      apiServer.start(API_PORT);
      backendServer = { apiServer, controllerManager, robotManager, networkManager };

      console.log('[Node.js Backend] Backend ready!');
      resolve();
    } catch (error) {
      console.error('[Node.js Backend] Failed to start:', error);
      reject(error);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    frame: true,
    icon: path.join(__dirname, 'build', 'icon.png')
  });

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);

  const frontendPath = isDev
    ? 'http://localhost:5173' // Vite dev server
    : `file://${path.join(__dirname, '..', 'frontend', 'dist', 'index.html')}`;

  mainWindow.loadURL(frontendPath);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log('[Electron] App ready...');

  try {
    await startNodeBackend();
    console.log('[Electron] Creating window...');
    createWindow();
  } catch (error) {
    console.error('[Electron] Failed to start backend:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  console.log('[Electron] Stopping Node.js backend...');
  if (backendServer) {
    backendServer.controllerManager.shutdown();
    backendServer.robotManager.shutdown();
    backendServer.networkManager.shutdown();
  }
});

// Handle process cleanup
process.on('exit', () => {
  if (backendServer) {
    backendServer.controllerManager.shutdown();
    backendServer.robotManager.shutdown();
    backendServer.networkManager.shutdown();
  }
});
