/**
 * Network Manager for ESP32 robot communication via UDP.
 * Handles discovery protocol and command transmission.
 */

const dgram = require('dgram');
const os = require('os');

class NetworkManager {
    // ESP32 Communication Constants
    static DISCOVERY_PORT = 12345;
    static ESP32_UDP_PORT = 2367;
    static EXPECTED_WIFI_NETWORK = "WATCHTOWER";
    static BROADCAST_ADDRESS = "255.255.255.255";

    constructor() {
        this.udpSocket = null;
        this.discoverySocket = null;
        this.isConnectedToNetwork = false;
        this.currentSsid = "";

        this._initializeUdpSocket();
        this._initializeDiscoverySocket();
        this._checkCurrentNetworkStatus();
    }

    _initializeUdpSocket() {
        try {
            this.udpSocket = dgram.createSocket('udp4');
            this.udpSocket.bind(() => {
                this.udpSocket.setBroadcast(true);
                console.log('[NetworkManager] UDP socket initialized for ESP32 communication');
            });
        } catch (error) {
            console.error(`[NetworkManager] Failed to initialize UDP socket: ${error.message}`);
        }
    }

    _initializeDiscoverySocket() {
        try {
            this.discoverySocket = dgram.createSocket('udp4');
            this.discoverySocket.bind(NetworkManager.DISCOVERY_PORT, () => {
                console.log(`[NetworkManager] Discovery socket initialized on port ${NetworkManager.DISCOVERY_PORT}`);
            });
        } catch (error) {
            console.error(`[NetworkManager] Failed to initialize discovery socket: ${error.message}`);
        }
    }

    _checkCurrentNetworkStatus() {
        try {
            const interfaces = os.networkInterfaces();
            for (const [name, addrs] of Object.entries(interfaces)) {
                for (const addr of addrs) {
                    if (addr.family === 'IPv4' && !addr.internal && addr.address.startsWith('192.168')) {
                        this.isConnectedToNetwork = true;
                        console.log(`[NetworkManager] Connected to network on ${name}: ${addr.address}`);
                        return;
                    }
                }
            }
            console.warn('[NetworkManager] Not connected to any network');
        } catch (error) {
            console.error(`[NetworkManager] Failed to check network status: ${error.message}`);
        }
    }

    /**
     * Send binary command data to ESP32 robot.
     * Format: 6 axes bytes + 2 button bytes = 8 bytes total
     * This matches the ESP32 firmware expectation in minibot.cpp
     */
    sendRobotCommand(robotName, targetIp, leftX, leftY, rightX, rightY, cross = false, circle = false, square = false, triangle = false) {
        if (!this.udpSocket) {
            console.error('[NetworkManager] UDP socket not initialized');
            return;
        }

        try {
            // Create 8-byte packet to match ESP32 firmware
            const packet = Buffer.alloc(8);

            // Helper function to clamp values to 0-255 range
            const clampToByte = (value) => Math.max(0, Math.min(255, value));

            // Axes data (6 bytes) - values 0-255
            packet[0] = clampToByte(leftX);
            packet[1] = clampToByte(leftY);
            packet[2] = clampToByte(rightX);
            packet[3] = clampToByte(rightY);
            packet[4] = 127; // unused axis (fifth axis)
            packet[5] = 127; // unused axis (sixth axis)

            // Button data (2 bytes)
            let button1 = 0;
            if (cross) button1 |= 0x01;
            if (circle) button1 |= 0x02;
            if (square) button1 |= 0x04;
            if (triangle) button1 |= 0x08;

            packet[6] = button1;
            packet[7] = 0; // unused buttons

            // Send UDP packet
            this.udpSocket.send(packet, NetworkManager.ESP32_UDP_PORT, targetIp, (err) => {
                if (err) {
                    console.error(`[NetworkManager] Failed to send command to ${targetIp}: ${err.message}`);
                }
            });
        } catch (error) {
            console.error(`[NetworkManager] Failed to send robot command to ${targetIp}: ${error.message}`);
        }
    }

    /**
     * Send game status command to ESP32 robot.
     * Format: "robotName:status" (text)
     */
    sendGameStatus(robotName, targetIp, status) {
        if (!this.udpSocket) {
            console.error('[NetworkManager] UDP socket not initialized');
            return;
        }

        try {
            const message = `${robotName}:${status}`;
            const data = Buffer.from(message, 'utf-8');

            this.udpSocket.send(data, NetworkManager.ESP32_UDP_PORT, targetIp, (err) => {
                if (err) {
                    console.error(`[NetworkManager] Failed to send game status to ${targetIp}: ${err.message}`);
                } else {
                    console.log(`[NetworkManager] Sent game status '${status}' to robot '${robotName}' at ${targetIp}`);
                }
            });
        } catch (error) {
            console.error(`[NetworkManager] Failed to send game status to ${targetIp}: ${error.message}`);
        }
    }

    /**
     * Send discovery ping to broadcast address
     * ESP32 responds with "pong:<robotName>"
     */
    sendDiscoveryPing() {
        if (!this.udpSocket) {
            console.error('[NetworkManager] UDP socket not initialized');
            return;
        }

        try {
            const message = "ping";
            const data = Buffer.from(message, 'utf-8');

            // Send to broadcast address on ESP32_UDP_PORT
            this.udpSocket.send(data, NetworkManager.ESP32_UDP_PORT, NetworkManager.BROADCAST_ADDRESS, (err) => {
                if (err) {
                    console.error(`[NetworkManager] Failed to send discovery ping: ${err.message}`);
                }
            });
        } catch (error) {
            console.error(`[NetworkManager] Failed to send discovery ping: ${error.message}`);
        }
    }

    /**
     * Broadcast emergency stop to all robots on discovery port
     */
    broadcastEmergencyStop(activate = true) {
        if (!this.udpSocket) {
            console.error('[NetworkManager] UDP socket not initialized');
            return;
        }

        try {
            const message = activate ? "ESTOP" : "ESTOP_OFF";
            const data = Buffer.from(message, 'utf-8');

            // Send to broadcast address on discovery port (always monitored by robots)
            this.udpSocket.send(data, NetworkManager.DISCOVERY_PORT, NetworkManager.BROADCAST_ADDRESS, (err) => {
                if (err) {
                    console.error(`[NetworkManager] Failed to broadcast emergency stop: ${err.message}`);
                } else {
                    console.log(`[NetworkManager] Broadcast emergency stop: ${message}`);
                }
            });
        } catch (error) {
            console.error(`[NetworkManager] Failed to broadcast emergency stop: ${error.message}`);
        }
    }

    /**
     * Register callback for discovery messages on UDP socket (not discovery socket)
     * ESP32 responds to "ping" with "pong:<robotName>" on port 2367
     */
    onDiscoveryMessage(callback) {
        if (!this.udpSocket) {
            console.error('[NetworkManager] UDP socket not initialized');
            return;
        }

        this.udpSocket.on('message', (msg, rinfo) => {
            try {
                const message = msg.toString('utf-8');
                callback(message, rinfo);
            } catch (error) {
                console.error(`[NetworkManager] Error processing discovery message: ${error.message}`);
            }
        });
    }

    /**
     * Get current network subnet (e.g., '192.168.1')
     */
    getNetworkSubnet() {
        try {
            const interfaces = os.networkInterfaces();
            for (const addrs of Object.values(interfaces)) {
                for (const addr of addrs) {
                    if (addr.family === 'IPv4' && !addr.internal && addr.address.startsWith('192.168')) {
                        const parts = addr.address.split('.');
                        if (parts.length >= 3) {
                            return `${parts[0]}.${parts[1]}.${parts[2]}`;
                        }
                    }
                }
            }
            return null;
        } catch (error) {
            console.error(`[NetworkManager] Failed to get network subnet: ${error.message}`);
            return null;
        }
    }

    /**
     * Cleanup network resources
     */
    shutdown() {
        if (this.udpSocket) {
            this.udpSocket.close();
        }
        if (this.discoverySocket) {
            this.discoverySocket.close();
        }
        console.log('[NetworkManager] Network manager shutdown complete');
    }
}

module.exports = NetworkManager;
