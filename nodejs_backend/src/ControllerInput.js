/**
 * Controller Input data structures
 */

class ControllerInput {
    constructor() {
        this.leftStickX = 0.0;
        this.leftStickY = 0.0;
        this.rightStickX = 0.0;
        this.rightStickY = 0.0;
        this.leftTrigger = 0.0;
        this.rightTrigger = 0.0;
        this.buttons = new Array(16).fill(false);
        this.dpad = 0;
    }

    setLeftStickX(value) {
        this.leftStickX = value;
    }

    setLeftStickY(value) {
        this.leftStickY = value;
    }

    setRightStickX(value) {
        this.rightStickX = value;
    }

    setRightStickY(value) {
        this.rightStickY = value;
    }

    setLeftTrigger(value) {
        this.leftTrigger = value;
    }

    setRightTrigger(value) {
        this.rightTrigger = value;
    }

    setButton(index, pressed) {
        if (index >= 0 && index < this.buttons.length) {
            this.buttons[index] = pressed;
        }
    }

    setDpad(value) {
        this.dpad = value;
    }

    getLeftStickX() {
        return this.leftStickX;
    }

    getLeftStickY() {
        return this.leftStickY;
    }

    getRightStickX() {
        return this.rightStickX;
    }

    getRightStickY() {
        return this.rightStickY;
    }

    hasMovement() {
        const deadzone = 0.1;
        return (
            Math.abs(this.leftStickX) > deadzone ||
            Math.abs(this.leftStickY) > deadzone ||
            Math.abs(this.rightStickX) > deadzone ||
            Math.abs(this.rightStickY) > deadzone
        );
    }

    isStopCommand() {
        const deadzone = 0.1;
        return (
            Math.abs(this.leftStickX) <= deadzone &&
            Math.abs(this.leftStickY) <= deadzone &&
            Math.abs(this.rightStickX) <= deadzone &&
            Math.abs(this.rightStickY) <= deadzone
        );
    }
}

class GameController {
    constructor(id, type, name, number = 1) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.number = number;
        this.connected = true;
        this.pairedRobotId = null;
        this.enabled = true;
        this.currentInput = new ControllerInput();
        this.hasActivity = false;
        this.lastActivityTime = 0;
    }

    updateInput(inputData) {
        this.currentInput = inputData;
        
        // Check if there's any meaningful input (movement or button press)
        const hasInput = this._hasAnyInput(inputData);
        if (hasInput) {
            this.hasActivity = true;
            this.lastActivityTime = Date.now();
        }
    }

    _hasAnyInput(inputData) {
        const deadzone = 0.1;
        
        // Check stick movements
        if (Math.abs(inputData.leftStickX) > deadzone ||
            Math.abs(inputData.leftStickY) > deadzone ||
            Math.abs(inputData.rightStickX) > deadzone ||
            Math.abs(inputData.rightStickY) > deadzone) {
            return true;
        }
        
        // Check triggers
        if (inputData.leftTrigger > deadzone || inputData.rightTrigger > deadzone) {
            return true;
        }
        
        // Check buttons
        if (inputData.buttons.some(button => button)) {
            return true;
        }
        
        return false;
    }

    clearActivityIfStale() {
        // Clear activity flag if no input for 500ms
        if (this.hasActivity && (Date.now() - this.lastActivityTime) > 500) {
            this.hasActivity = false;
        }
    }

    toDict() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            number: this.number,
            connected: this.connected,
            pairedRobotId: this.pairedRobotId,
            enabled: this.enabled,
            hasActivity: this.hasActivity
        };
    }
}

module.exports = { ControllerInput, GameController };
