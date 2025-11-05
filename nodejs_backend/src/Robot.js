/**
 * Robot data model
 */

class Robot {
    constructor(id, name, ipAddress, status = "discovered") {
        this.id = id;
        this.name = name;
        this.ipAddress = ipAddress;
        this.status = status; // "discovered", "connected", "disconnected"
        this.disabled = false;
        this.pairedControllerId = null;
        this.lastCommandTime = 0;
        this.lastSeenTime = Date.now();
        this.receiving = false;
    }

    setConnected(connected) {
        this.status = connected ? "connected" : "discovered";
    }

    setIpAddress(ipAddress) {
        this.ipAddress = ipAddress;
    }

    updateLastSeenTime() {
        this.lastSeenTime = Date.now();
    }

    updateLastCommandTime() {
        this.lastCommandTime = Date.now();
    }

    setPairedController(controllerId) {
        this.pairedControllerId = controllerId;
    }

    setReceiving(receiving) {
        this.receiving = receiving;
    }

    toDict() {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            ipAddress: this.ipAddress,
            disabled: this.disabled,
            pairedControllerId: this.pairedControllerId,
            lastCommandTime: this.lastCommandTime,
            lastSeenTime: this.lastSeenTime,
            receiving: this.receiving
        };
    }
}

module.exports = Robot;
