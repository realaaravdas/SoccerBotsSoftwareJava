# Node.js Backend Protocol Update

## Overview

The Node.js backend has been updated to match the ESP32 firmware protocol as defined in `esp32_robot_firmware/minibot.cpp` and reference Python implementation.

## Changes Made

### 1. Binary Command Format (NetworkManager.js)

**Before (24 bytes):**
```
Bytes 0-15:  Robot name (null-padded string)
Bytes 16-19: Stick axes (leftX, leftY, rightX, rightY) [0-255]
Bytes 20-21: Unused axes
Bytes 22:    Button data (cross, circle, square, triangle)
Bytes 23:    Unused buttons
```

**After (8 bytes):**
```
Bytes 0-3:   Stick axes (leftX, leftY, rightX, rightY) [0-255]
Bytes 4-5:   Unused axes (set to 127)
Byte 6:      Button data (cross, circle, square, triangle)
Byte 7:      Unused buttons (set to 0)
```

This matches the ESP32 firmware expectation in `minibot.cpp` line 60-66:
```cpp
if (len == 8) {
    uint8_t axes[6];
    uint8_t buttons[2];
    memcpy(axes, incomingPacket, 6);
    memcpy(buttons, incomingPacket + 6, 2);
    // ...
}
```

### 2. Discovery Protocol (NetworkManager.js & RobotManager.js)

**Before:**
- Passively listened for `DISCOVER:robotId:IP` messages on port 12345
- Responded with port assignment

**After:**
- Actively sends "ping" broadcasts on port 2367 every 50ms
- Listens for "pong:robotName" responses on the same port
- No port assignment needed (ESP32 always uses port 2367)

This matches the ESP32 firmware in `minibot.cpp` lines 86-92:
```cpp
if (packetStr == "ping" && !connected) {
    String reply = "pong:" + String(robotId);
    udp.beginPacket(udp.remoteIP(), udp.remotePort());
    udp.write((const uint8_t*)reply.c_str(), reply.length());
    udp.endPacket();
    connected = true;
    return;
}
```

### 3. Continuous Command Sending (ControllerManager.js)

**Before:**
- Only sent commands when controller movement detected
- Sent stop commands when no movement

**After:**
- Sends commands continuously at 50ms intervals
- Always sends current stick positions (even if zero)

This matches the Python reference implementation:
```python
def send_controller_data():
    while True:
        pygame.event.pump()
        for robot in robots:
            controller = robot["controller"]
            if controller and "addr" in robot:
                data = encode_controller_data(controller)
                comm_socket.sendto(data, robot["addr"])
        time.sleep(0.05)  # 50ms
```

### 4. Game Status Broadcasting (RobotManager.js)

**Added:**
- Periodic broadcast of game status every 1 second
- Sends `"robotName:teleop"` or `"robotName:standby"` to all connected robots
- Ensures robots stay in correct game state

This matches the Python reference implementation:
```python
def broadcast_game_status():
    while True:
        for robot in robots:
            if "addr" in robot:
                packet = f"{robot['name']}:{game_status}".encode()
                comm_socket.sendto(packet, robot["addr"])
        time.sleep(1)
```

And matches the ESP32 firmware in `minibot.cpp` lines 96-102:
```cpp
if (packetStr.startsWith(robotId)) {
    int sepIndex = packetStr.indexOf(':');
    if (sepIndex != -1) {
        gameStatus = stringToGameStatus(packetStr.substring(sepIndex + 1));
        return;
    }
}
```

## Technical Details

### Port Configuration

- **Discovery & Commands:** Port 2367 (static, no dynamic assignment)
- **Emergency Stop:** Port 12345 (broadcast only)

### Timing Configuration

- **Discovery Pings:** 50ms interval (20Hz)
- **Controller Commands:** 50ms interval (20Hz)
- **Game Status Broadcast:** 1000ms interval (1Hz)
- **Robot Timeout Check:** 2000ms interval (0.5Hz)
- **Robot Timeout:** 10 seconds

### Data Flow

1. **Startup:**
   - Backend sends "ping" broadcasts every 50ms
   - ESP32 responds with "pong:robotName"
   - Robot added to discovered list

2. **Connection:**
   - User connects to robot via UI
   - Robot moved to connected list
   - Backend sends current game status

3. **Operation:**
   - Controller input polled at 50ms
   - Commands sent to paired robot continuously
   - Game status broadcast every 1 second
   - Robot sends discovery pings periodically

4. **Teleop Mode:**
   - Backend broadcasts "robotName:teleop" to all robots
   - ESP32 processes controller commands
   - Motors respond to stick positions

5. **Standby Mode:**
   - Backend broadcasts "robotName:standby" to all robots
   - ESP32 ignores controller commands
   - Motors stop

## Compatibility

### ESP32 Firmware Requirements

The backend now matches the protocol defined in:
- `esp32_robot_firmware/minibot.h` (port definitions, constants)
- `esp32_robot_firmware/minibot.cpp` (protocol implementation)

### Python Reference Implementation

The backend now matches the behavior of the reference Python driver station provided in the problem statement.

## Testing

### Expected Behavior

1. **Discovery:**
   - Backend sends "ping" every 50ms
   - Robot responds with "pong:RobotName"
   - Robot appears in discovered list

2. **Connection:**
   - User clicks "Connect" in UI
   - Robot moves to connected list
   - Game status sent immediately

3. **Controller Pairing:**
   - User pairs controller with robot
   - Commands start flowing at 50ms intervals
   - Robot responds to stick movements

4. **Teleop/Standby:**
   - User starts/stops match
   - All robots receive status update
   - Robots enable/disable motor control

### Verification Steps

1. Power on ESP32 robot with updated firmware
2. Start Node.js backend: `npm run dev:backend`
3. Check logs for discovery pings
4. Watch for "pong" responses from robot
5. Connect to robot via UI
6. Pair controller with robot
7. Move controller sticks
8. Verify robot motors respond
9. Stop match, verify motors stop
10. Start match, verify motors respond again

## Migration Notes

### From Old Protocol

If you have ESP32 firmware using the old protocol:
1. Flash new firmware from `esp32_robot_firmware/`
2. Restart backend (no changes needed on backend side)
3. Discovery will work automatically

### From Python Implementation

The Node.js backend is now functionally equivalent to the Python implementation:
- Same binary packet format (8 bytes)
- Same discovery protocol (ping/pong)
- Same command frequency (50ms)
- Same game status broadcast (1 second)

## Files Changed

1. **nodejs_backend/src/NetworkManager.js**
   - Changed binary packet from 24 to 8 bytes
   - Added `sendDiscoveryPing()` method
   - Changed discovery message listener from discoverySocket to udpSocket

2. **nodejs_backend/src/RobotManager.js**
   - Changed from passive to active discovery
   - Renamed `_handleDiscoveryPing()` to `_handleDiscoveryResponse()`
   - Added periodic ping sending (50ms)
   - Added game status broadcast loop (1 second)
   - Updated cleanup to clear all intervals

3. **nodejs_backend/src/ControllerManager.js**
   - Changed polling interval from 16ms to 50ms
   - Removed conditional command sending (always send now)
   - Simplified controller polling logic

## Future Improvements

1. **Performance Optimization:**
   - Consider batching commands for multiple robots
   - Implement priority queue for time-critical messages

2. **Reliability:**
   - Add command acknowledgment system
   - Implement retry logic for failed sends

3. **Monitoring:**
   - Add packet loss tracking
   - Add latency measurement
   - Add bandwidth monitoring

4. **Configuration:**
   - Make timing intervals configurable
   - Support multiple WiFi networks
   - Support custom port assignments
