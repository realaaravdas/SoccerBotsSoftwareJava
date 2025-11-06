// API service for communicating with Python backend
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = (window as any).electron?.apiUrl || 'http://localhost:8080';

export interface Robot {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "connecting" | "discovered";
  ipAddress: string;
  signal?: number;
  disabled?: boolean;
  pairedControllerId?: string;
  lastCommandTime?: number;
  lastSeenTime?: number; // Timestamp when robot was last seen (for timeout detection)
  receiving?: boolean; // Real-time activity indicator
}

export interface Controller {
  id: string;
  name: string;
  connected: boolean;
  pairedRobotId?: string;
  enabled?: boolean;
  type?: string; // "ps4", "ps5", "xbox", etc.
}

export interface NetworkStats {
  timestamp: number;
  latency: number;
  bandwidth: number;
  activeConnections: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "success" | "info" | "warning" | "error";
  message: string;
}

export interface MatchTimer {
  running: boolean;
  timeRemainingMs: number;
  durationMs: number;
  timeRemainingSeconds: number;
}

class ApiService {
  private socket: Socket | null = null;
  private wsCallbacks: Map<string, Set<(data: any) => void>> = new Map();
  private logBuffer: LogEntry[] = [];
  private logListeners: Set<(logs: LogEntry[]) => void> = new Set();

  // Initialize Socket.IO connection
  connectWebSocket() {
    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend');
    });

    this.socket.on('update', (message) => {
      try {
        if (!message || typeof message !== 'object' || !message.type) {
          console.warn('[Socket.IO] Received invalid message format:', message);
          return;
        }

        const { type, data } = message;

        // Handle log events (data may be undefined for some event types)
        if (type.includes('robot_') || type.includes('emergency') || type.includes('controller')) {
          this.addLog(this.createLogFromEvent(type, data || {}));
        }

        // Notify listeners
        const callbacks = this.wsCallbacks.get(type);
        if (callbacks) {
          callbacks.forEach(cb => cb(data || {}));
        }
      } catch (error) {
        console.error('[Socket.IO] Failed to handle message:', error);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error);
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected, will reconnect automatically');
    });
  }

  // Disconnect Socket.IO connection
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket.IO] Connection closed');
    }
  }

  private createLogFromEvent(type: string, data: any): LogEntry {
    const timestamp = new Date().toLocaleTimeString();
    let level: LogEntry['level'] = 'info';
    let message = '';

    switch (type) {
      case 'robot_connected':
        level = 'success';
        message = `Robot ${data.name || data.id} connected successfully`;
        break;
      case 'robot_disconnected':
        level = 'info';
        message = `Robot ${data.id} disconnected`;
        break;
      case 'robot_enabled':
        level = 'info';
        message = `Robot ${data.id} enabled`;
        break;
      case 'robot_disabled':
        level = 'warning';
        message = `Robot ${data.id} disabled`;
        break;
      case 'emergency_stop':
        level = data.active ? 'error' : 'success';
        message = data.active
          ? 'EMERGENCY STOP ACTIVATED - All operations halted'
          : 'Emergency stop deactivated - Systems operational';
        break;
      case 'robots_refreshing':
        level = 'info';
        message = 'Scanning for robots...';
        break;
      default:
        level = 'info';
        message = `Event: ${type}`;
    }

    return {
      id: Date.now().toString() + Math.random(),
      timestamp,
      level,
      message
    };
  }

  private addLog(log: LogEntry) {
    this.logBuffer.push(log);
    // Keep only last 100 logs
    if (this.logBuffer.length > 100) {
      this.logBuffer.shift();
    }
    // Notify all log listeners
    this.logListeners.forEach(listener => listener([...this.logBuffer]));
  }

  subscribeToLogs(callback: (logs: LogEntry[]) => void) {
    this.logListeners.add(callback);
    // Send current logs immediately
    callback([...this.logBuffer]);
    return () => this.logListeners.delete(callback);
  }

  on(eventType: string, callback: (data: any) => void) {
    if (!this.wsCallbacks.has(eventType)) {
      this.wsCallbacks.set(eventType, new Set());
    }
    this.wsCallbacks.get(eventType)!.add(callback);

    return () => {
      const callbacks = this.wsCallbacks.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  // REST API methods
  async getRobots(): Promise<Robot[]> {
    const response = await fetch(`${API_BASE_URL}/api/robots`);
    return response.json();
  }

  async getRobotById(id: string): Promise<Robot> {
    const response = await fetch(`${API_BASE_URL}/api/robots/${id}`);
    return response.json();
  }

  async connectRobot(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/robots/${id}/connect`, {
      method: 'POST'
    });
  }

  async disconnectRobot(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/robots/${id}/disconnect`, {
      method: 'POST'
    });
  }

  async enableRobot(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/robots/${id}/enable`, {
      method: 'POST'
    });
  }

  async disableRobot(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/robots/${id}/disable`, {
      method: 'POST'
    });
  }

  async refreshRobots(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/robots/refresh`, {
      method: 'POST'
    });
  }

  async getControllers(): Promise<Controller[]> {
    const response = await fetch(`${API_BASE_URL}/api/controllers`);
    return response.json();
  }

  async activateEmergencyStop(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/emergency-stop`, {
      method: 'POST'
    });
  }

  async deactivateEmergencyStop(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/emergency-stop/deactivate`, {
      method: 'POST'
    });
  }

  async getNetworkStats(): Promise<NetworkStats> {
    const response = await fetch(`${API_BASE_URL}/api/network/stats`);
    return response.json();
  }

  // Match timer methods
  async getMatchTimer(): Promise<MatchTimer> {
    const response = await fetch(`${API_BASE_URL}/api/match/timer`);
    return response.json();
  }

  async startMatch(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/match/start`, {
      method: 'POST'
    });
  }

  async stopMatch(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/match/stop`, {
      method: 'POST'
    });
  }

  async resetMatch(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/match/reset`, {
      method: 'POST'
    });
  }

  async setMatchDuration(durationSeconds: number): Promise<void> {
    await fetch(`${API_BASE_URL}/api/match/duration`, {
      method: 'POST',
      body: durationSeconds.toString()
    });
  }

  // Controller pairing methods
  async pairController(controllerId: string, robotId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/controllers/${controllerId}/pair/${robotId}`, {
      method: 'POST'
    });
  }

  async unpairController(controllerId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/controllers/${controllerId}/unpair`, {
      method: 'POST'
    });
  }

  async enableController(controllerId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/controllers/${controllerId}/enable`, {
      method: 'POST'
    });
  }

  async disableController(controllerId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/controllers/${controllerId}/disable`, {
      method: 'POST'
    });
  }

  async hideController(controllerId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/controllers/${controllerId}/hide`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Failed to hide controller: ${response.statusText}`);
    }
  }

  async unhideController(controllerId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/controllers/${controllerId}/unhide`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Failed to unhide controller: ${response.statusText}`);
    }
  }

  async refreshControllers(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/controllers/refresh`, {
      method: 'POST'
    });
  }
}

export const apiService = new ApiService();
