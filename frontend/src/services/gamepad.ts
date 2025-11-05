/**
 * Gamepad polling service for browser Gamepad API
 * Sends gamepad state to Node.js backend for processing
 */

const API_BASE_URL = (window as any).electron?.apiUrl || 'http://localhost:8080';

class GamepadService {
    private gamepads: Map<number, Gamepad> = new Map();
    private pollingInterval: number | null = null;
    private isPolling: boolean = false;
    private errorCount: number = 0;
    private lastErrorLog: number = 0;

    start() {
        if (this.isPolling) {
            console.warn('[GamepadService] Already polling');
            return;
        }

        this.isPolling = true;
        console.log('[GamepadService] Starting gamepad polling');

        // Listen for gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('[GamepadService] Gamepad connected:', e.gamepad.id);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('[GamepadService] Gamepad disconnected:', e.gamepad.id);
            this.removeGamepad(e.gamepad.index);
        });

        // Start polling loop
        this.pollingInterval = window.setInterval(() => {
            this.pollGamepads();
        }, 16); // ~60Hz
    }

    stop() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        console.log('[GamepadService] Stopped gamepad polling');
    }

    private pollGamepads() {
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                // Send gamepad state to backend
                this.sendGamepadState(gamepad);
                this.gamepads.set(gamepad.index, gamepad);
            }
        }
    }

    private sendGamepadState(gamepad: Gamepad) {
        // Prepare gamepad data
        const gamepadData = {
            id: gamepad.id,
            index: gamepad.index,
            axes: Array.from(gamepad.axes),
            buttons: gamepad.buttons.map(b => ({
                pressed: b.pressed,
                value: b.value
            })),
            timestamp: gamepad.timestamp
        };

        // Send to backend
        fetch(`${API_BASE_URL}/api/controllers/gamepad-update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                controllerId: `gamepad_${gamepad.index}`,
                gamepadData
            })
        }).catch(err => {
            // Track errors but don't flood console
            this.errorCount++;
            const now = Date.now();
            // Log only once per 5 seconds
            if (now - this.lastErrorLog > 5000) {
                console.warn(`[GamepadService] Failed to send gamepad state (${this.errorCount} errors):`, err.message);
                this.lastErrorLog = now;
                this.errorCount = 0;
            }
        });
    }

    private removeGamepad(index: number) {
        this.gamepads.delete(index);

        // Notify backend
        fetch(`${API_BASE_URL}/api/controllers/gamepad-remove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                controllerId: `gamepad_${index}`
            })
        }).catch(err => {
            console.error('[GamepadService] Failed to remove gamepad:', err);
        });
    }
}

export const gamepadService = new GamepadService();
