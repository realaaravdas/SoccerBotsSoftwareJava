/**
 * Controller Manager for game controller support.
 * Note: This implementation is designed to work with Electron's built-in gamepad support.
 * For standalone Node.js, alternative libraries like node-hid can be used.
 */

const { ControllerInput, GameController } = require('./ControllerInput');

class ControllerManager {
    // Polling interval constant
    static POLLING_INTERVAL_MS = 16; // ~60Hz

    constructor(robotManager) {
        this.robotManager = robotManager;
        this.connectedControllers = new Map();
        this.controllerRobotPairings = new Map();
        this.controllerEnabled = new Map();
        this.hiddenControllers = new Set(); // Track hidden controllers
        this.running = false;
        this.pollingInterval = null;
        this.emergencyStopActive = false;
        
        // Store for external gamepad state (will be updated from Electron renderer)
        this.externalGamepadStates = new Map();

        console.log('[ControllerManager] Controller Manager initialized');
        this._startInputPolling();
    }

    /**
     * Update gamepad state from external source (e.g., Electron renderer)
     * This is called when gamepad data is received from the frontend
     */
    updateGamepadState(controllerId, gamepadData) {
        // Store the gamepad state
        this.externalGamepadStates.set(controllerId, gamepadData);

        // If controller is not registered yet, register it
        if (!this.connectedControllers.has(controllerId)) {
            const type = this._identifyControllerType(gamepadData.id || 'Unknown');
            const gameController = new GameController(
                controllerId,
                type,
                gamepadData.id || `Controller ${controllerId}`
            );
            this.connectedControllers.set(controllerId, gameController);
            this.controllerEnabled.set(controllerId, true);
            console.log(`[ControllerManager] Detected new controller: ${gamepadData.id} (${type})`);
        }
    }

    /**
     * Remove gamepad that was disconnected
     */
    removeGamepad(controllerId) {
        this.externalGamepadStates.delete(controllerId);
        if (this.connectedControllers.has(controllerId)) {
            console.log(`[ControllerManager] Controller disconnected: ${controllerId}`);
            this.connectedControllers.delete(controllerId);
            this.controllerRobotPairings.delete(controllerId);
            this.controllerEnabled.delete(controllerId);
        }
    }

    _identifyControllerType(name) {
        const nameLower = name.toLowerCase();
        
        if (nameLower.includes('playstation') || nameLower.includes('ps4') || 
            nameLower.includes('ps5') || nameLower.includes('dualsense') || 
            nameLower.includes('dualshock')) {
            return 'PlayStation';
        } else if (nameLower.includes('xbox')) {
            return 'Xbox';
        } else if (nameLower.includes('nintendo') || nameLower.includes('switch')) {
            return 'Nintendo';
        } else {
            return 'Generic';
        }
    }

    _startInputPolling() {
        if (this.pollingInterval) {
            console.warn('[ControllerManager] Input polling already running');
            return;
        }

        this.running = true;
        this.pollingInterval = setInterval(() => {
            this._pollControllerInputs();
        }, ControllerManager.POLLING_INTERVAL_MS);

        console.log('[ControllerManager] Input polling started');
    }

    _pollControllerInputs() {
        for (const [controllerId, gameController] of this.connectedControllers.entries()) {
            try {
                // Check if controller is enabled
                if (!this.controllerEnabled.get(controllerId)) {
                    continue;
                }

                // Get gamepad state from external source
                const gamepadData = this.externalGamepadStates.get(controllerId);
                if (!gamepadData) {
                    continue;
                }

                // Read controller input
                const inputData = this._readControllerInput(gamepadData);
                gameController.updateInput(inputData);

                // Send to paired robot if not in emergency stop
                const pairedRobotId = this.controllerRobotPairings.get(controllerId);
                if (pairedRobotId && !this.emergencyStopActive) {
                    if (inputData.hasMovement()) {
                        this.robotManager.sendMovementCommand(
                            pairedRobotId,
                            inputData.getLeftStickX(),
                            inputData.getLeftStickY(),
                            inputData.getRightStickX(),
                            inputData.getRightStickY()
                        );
                    } else if (inputData.isStopCommand()) {
                        this.robotManager.sendStopCommand(pairedRobotId);
                    }
                }
            } catch (error) {
                console.error(`[ControllerManager] Error polling controller ${controllerId}: ${error.message}`);
            }
        }
    }

    _readControllerInput(gamepadData) {
        const inputData = new ControllerInput();

        // Read axes (sticks and triggers)
        const axes = gamepadData.axes || [];
        
        // Standard mapping for gamepads:
        // Axis 0: Left stick X
        // Axis 1: Left stick Y
        // Axis 2: Right stick X
        // Axis 3: Right stick Y
        
        if (axes.length >= 2) {
            inputData.setLeftStickX(axes[0]);
            inputData.setLeftStickY(axes[1]);
        }
        
        if (axes.length >= 4) {
            inputData.setRightStickX(axes[2]);
            inputData.setRightStickY(axes[3]);
        }

        // Read buttons
        const buttons = gamepadData.buttons || [];
        for (let i = 0; i < Math.min(buttons.length, 16); i++) {
            const buttonValue = typeof buttons[i] === 'object' ? buttons[i].pressed : buttons[i];
            inputData.setButton(i, buttonValue);
        }

        return inputData;
    }

    getConnectedControllers() {
        // Filter out hidden controllers from the list
        return Array.from(this.connectedControllers.values())
            .filter(c => !this.hiddenControllers.has(c.id))
            .map(c => c.toDict());
    }

    getConnectedControllerCount() {
        return this.connectedControllers.size;
    }

    pairControllerWithRobot(controllerId, robotId) {
        if (this.connectedControllers.has(controllerId)) {
            this.controllerRobotPairings.set(controllerId, robotId);

            // Update robot's pairedControllerId
            const robot = this.robotManager.getRobot(robotId);
            if (robot) {
                robot.setPairedController(controllerId);
            }

            console.log(`[ControllerManager] Paired controller ${controllerId} with robot ${robotId}`);
        } else {
            console.warn(`[ControllerManager] Cannot pair - controller not found: ${controllerId}`);
        }
    }

    unpairController(controllerId) {
        if (this.controllerRobotPairings.has(controllerId)) {
            const robotId = this.controllerRobotPairings.get(controllerId);

            // Clear robot's pairedControllerId
            const robot = this.robotManager.getRobot(robotId);
            if (robot) {
                robot.setPairedController(null);
            }

            this.controllerRobotPairings.delete(controllerId);
            console.log(`[ControllerManager] Unpaired controller ${controllerId}`);
        }
    }

    getPairedRobotId(controllerId) {
        return this.controllerRobotPairings.get(controllerId) || null;
    }

    enableController(controllerId) {
        this.controllerEnabled.set(controllerId, true);
        console.log(`[ControllerManager] Enabled controller ${controllerId}`);
    }

    disableController(controllerId) {
        this.controllerEnabled.set(controllerId, false);
        console.log(`[ControllerManager] Disabled controller ${controllerId}`);
    }

    isControllerEnabled(controllerId) {
        return this.controllerEnabled.get(controllerId) || false;
    }

    refreshControllers() {
        console.log('[ControllerManager] Manual controller refresh requested');
        // Clear hidden controllers on refresh so they can reappear
        this.hiddenControllers.clear();
        console.log('[ControllerManager] Cleared hidden controllers list');
        // In this implementation, controllers are updated externally via updateGamepadState
        // So refresh is a no-op
    }

    hideController(controllerId) {
        if (this.connectedControllers.has(controllerId)) {
            this.hiddenControllers.add(controllerId);
            console.log(`[ControllerManager] Hidden controller ${controllerId}`);
            return true;
        } else {
            console.warn(`[ControllerManager] Cannot hide - controller not found: ${controllerId}`);
            return false;
        }
    }

    unhideController(controllerId) {
        const wasHidden = this.hiddenControllers.has(controllerId);
        this.hiddenControllers.delete(controllerId);
        if (wasHidden) {
            console.log(`[ControllerManager] Unhidden controller ${controllerId}`);
        }
        return wasHidden;
    }

    isControllerHidden(controllerId) {
        return this.hiddenControllers.has(controllerId);
    }

    activateEmergencyStop() {
        this.emergencyStopActive = true;
        this.robotManager.emergencyStopAll();
        console.warn('[ControllerManager] Emergency stop activated');
    }

    deactivateEmergencyStop() {
        this.emergencyStopActive = false;
        this.robotManager.deactivateEmergencyStop();
        console.log('[ControllerManager] Emergency stop deactivated');
    }

    shutdown() {
        this.running = false;
        
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        console.log('[ControllerManager] Controller manager shutdown complete');
    }
}

module.exports = ControllerManager;
