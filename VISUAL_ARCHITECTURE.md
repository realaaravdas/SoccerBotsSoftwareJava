# Visual System Architecture

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DRIVER STATION (Node.js)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐│
│  │   Controller    │      │   Robot Manager  │      │   Network       ││
│  │    Manager      │◄────►│                  │◄────►│   Manager       ││
│  │  (50ms poll)    │      │  - Discovery     │      │  - UDP Socket   ││
│  └─────────────────┘      │  - Game Status   │      │  - Broadcast    ││
│         ▲                 └──────────────────┘      └─────────────────┘│
│         │                          ▲                         ▲          │
│         │                          │                         │          │
│  ┌──────┴──────┐                  │                         │          │
│  │  Frontend   │                  │                         │          │
│  │  (React UI) │──────────────────┘                         │          │
│  │  - Gamepad  │                                            │          │
│  └─────────────┘                                            │          │
│                                                              │          │
└──────────────────────────────────────────────────────────────┼──────────┘
                                                               │
                                   UDP                         │
                              Port 2367                        │
                                                               │
                                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ESP32 ROBOT (Firmware)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐│
│  │   UDP Listener  │      │   Minibot Class  │      │   Motor Control ││
│  │   (Port 2367)   │─────►│  - updateController│────►│  - Left Motor   ││
│  │                 │      │  - Game Status   │      │  - Right Motor  ││
│  └─────────────────┘      │  - Emergency Stop│      │  - DC Motor     ││
│                            └──────────────────┘      │  - Servo Motor  ││
│                                                      └─────────────────┘│
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Communication Timeline

```
Time →  0ms    50ms   100ms  150ms  200ms  ...  1000ms  1050ms
        │      │      │      │      │            │       │
        ├──────┴──────┴──────┴──────┴────────────┴───────┴──────────
Driver  │
Station │ ping   ping   ping   ping   ping  ...  ping    ping
        │                                         game
        │                                         status
        ├──────────────────────────────────────────────────────────
ESP32   │
Robot   │ pong          command       command    command
        │               received      received   received
        └──────────────────────────────────────────────────────────
```

## Packet Structure Comparison

### Discovery Protocol
```
Driver Station → ESP32:
┌──────┐
│ ping │  (4 bytes, text)
└──────┘

ESP32 → Driver Station:
┌──────┬──────────────┐
│ pong │ : RobotName  │  (variable length, text)
└──────┴──────────────┘
Example: "pong:ENTER ROBOT NAME HERE"
```

### Command Protocol
```
Driver Station → ESP32:
┌─────┬─────┬─────┬─────┬─────┬─────┬────────┬────────┐
│leftX│leftY│rightX│rightY│axis5│axis6│buttons1│buttons2│
└─────┴─────┴─────┴─────┴─────┴─────┴────────┴────────┘
  0-255 0-255 0-255 0-255  127   127   0-255    0-255
  (8 bytes total)
```

### Game Status Protocol
```
Driver Station → ESP32:
┌──────────────┬───┬────────┐
│  RobotName   │ : │ status │  (variable length, text)
└──────────────┴───┴────────┘
Examples: 
- "ENTER ROBOT NAME HERE:teleop"
- "ENTER ROBOT NAME HERE:standby"
```

## State Machine Diagram

```
                    ┌─────────────┐
                    │   STARTUP   │
                    └──────┬──────┘
                           │
                    Backend starts,
                    begins sending pings
                           │
                           ▼
                    ┌─────────────┐
         ┌─────────►│ DISCOVERING │◄──────────┐
         │          └──────┬──────┘           │
         │                 │                   │
    Timeout            Receives pong      Lost connection
         │                 │                   │
         │                 ▼                   │
         │          ┌─────────────┐           │
         └──────────┤ DISCOVERED  │           │
                    └──────┬──────┘           │
                           │                   │
                    User clicks connect        │
                           │                   │
                           ▼                   │
                    ┌─────────────┐           │
         ┌─────────►│  CONNECTED  │───────────┘
         │          └──────┬──────┘
         │                 │
    User stops       User starts match
    match                  │
         │                 ▼
         │          ┌─────────────┐
         └──────────┤   TELEOP    │
                    └──────┬──────┘
                           │
                    Motors respond
                    to controller
```

## Module Interaction Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         main.js                              │
│                    (Entry Point)                             │
└───────────┬──────────────────────────────────┬───────────────┘
            │                                  │
            │ initializes                      │ initializes
            │                                  │
            ▼                                  ▼
┌───────────────────────┐          ┌─────────────────────────┐
│   NetworkManager      │          │    ApiServer            │
│   - UDP socket        │◄────────►│    - REST API           │
│   - Broadcast         │          │    - WebSocket          │
└───────────┬───────────┘          └──────────┬──────────────┘
            │                                  │
            │ used by                          │ broadcasts
            │                                  │
            ▼                                  ▼
┌───────────────────────┐          ┌─────────────────────────┐
│   RobotManager        │          │    Frontend (React)     │
│   - Discovery         │◄────────►│    - UI                 │
│   - Game status       │          │    - Gamepad polling    │
└───────────┬───────────┘          └─────────────────────────┘
            │
            │ used by
            │
            ▼
┌───────────────────────┐
│   ControllerManager   │
│   - Input polling     │
│   - Command sending   │
└───────────────────────┘
```

## Timing Configuration Summary

```
╔═══════════════════════════════════════════════════════════════════╗
║                    TIMING CONFIGURATION                           ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Discovery Pings:          50ms  (20 Hz) ┌─────┬─────┬─────┐   ║
║                                           │ ping│ ping│ ping│   ║
║                                           └─────┴─────┴─────┘   ║
║                                                                   ║
║  Controller Commands:      50ms  (20 Hz) ┌─────┬─────┬─────┐   ║
║                                           │ cmd │ cmd │ cmd │   ║
║                                           └─────┴─────┴─────┘   ║
║                                                                   ║
║  Game Status Broadcast:  1000ms  (1 Hz)  ┌───────────────┐     ║
║                                           │   status      │     ║
║                                           └───────────────┘     ║
║                                                                   ║
║  Timeout Check:          2000ms  (0.5Hz)   ┌─────────────────┐ ║
║                                             │   check         │ ║
║                                             └─────────────────┘ ║
║                                                                   ║
║  Robot Timeout:         10000ms (10 sec)                         ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

## Network Port Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK PORT MAPPING                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Port 2367  (UDP)                                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • Discovery (ping/pong)                               │     │
│  │  • Binary commands (8 bytes)                           │     │
│  │  • Game status (text)                                  │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Port 12345 (UDP) - Legacy                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • Emergency stop broadcast only                       │     │
│  │  • ESTOP / ESTOP_OFF messages                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Port 8080  (HTTP/WebSocket)                                     │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • REST API                                            │     │
│  │  • WebSocket updates                                   │     │
│  │  • Frontend communication                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Port 5173  (HTTP) - Development                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • Vite dev server                                     │     │
│  │  • React frontend                                      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Button Encoding

```
Button Byte Structure (1 byte):
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ 7 │ 6 │ 5 │ 4 │ 3 │ 2 │ 1 │ 0 │  Bit position
└───┴───┴───┴───┴───┴───┴───┴───┘
  │   │   │   │   │   │   │   │
  │   │   │   │   │   │   │   └─── Cross (X)      - 0x01
  │   │   │   │   │   │   └──────── Circle (O)    - 0x02
  │   │   │   │   │   └──────────── Square (□)    - 0x04
  │   │   │   │   └──────────────── Triangle (△)  - 0x08
  │   │   │   └──────────────────── Unused
  │   │   └──────────────────────── Unused
  │   └──────────────────────────── Unused
  └──────────────────────────────── Unused

Example: Cross + Triangle pressed = 0x01 | 0x08 = 0x09
```

## Axis Value Mapping

```
Controller Axis Range: -1.0 to +1.0 (floating point)
                       │
                       │ Convert to byte
                       ▼
Binary Packet Range:  0 to 255 (unsigned byte)

Conversion Formula:
  byteValue = floor((floatValue + 1.0) * 127.5)

Examples:
  -1.0 → 0     (full left/backward)
   0.0 → 127   (center/neutral)
  +1.0 → 255   (full right/forward)
```

## Complete Message Types

```
╔═══════════════════════════════════════════════════════════════════╗
║                       MESSAGE CATALOG                             ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Type          │ Direction │ Port │ Format   │ Example           ║
║  ─────────────────────────────────────────────────────────────── ║
║  ping          │ DS → ESP  │ 2367 │ Text     │ "ping"            ║
║  pong          │ ESP → DS  │ 2367 │ Text     │ "pong:Robot1"     ║
║  command       │ DS → ESP  │ 2367 │ Binary   │ [127,127,127...]  ║
║  game_status   │ DS → ESP  │ 2367 │ Text     │ "Robot1:teleop"   ║
║  estop         │ DS → ESP  │12345 │ Text     │ "ESTOP"           ║
║  estop_off     │ DS → ESP  │12345 │ Text     │ "ESTOP_OFF"       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

## Recommended Testing Sequence

```
Step  Action                     Expected Result
────  ────────────────────────   ──────────────────────────────
1.    Power on ESP32            Connects to WiFi
                                 Starts listening on port 2367

2.    Start Node.js backend     Sends ping every 50ms
                                 Listens for pong responses

3.    Observe discovery          Backend logs "Discovered robot"
                                 Robot appears in UI

4.    Connect to robot           Robot moves to connected list
                                 Game status sent (standby)

5.    Plug in controller         Controller appears in UI
                                 Ready for pairing

6.    Pair controller/robot      Commands start flowing (50ms)
                                 Robot ready to respond

7.    Start match (teleop)       Game status broadcast (teleop)
                                 Motors enabled

8.    Move controller sticks     Robot motors respond
                                 Commands at 50ms rate

9.    Release sticks              Motors stop (sticks centered)
                                 Commands still sent (127,127...)

10.   Emergency stop             All motors stop immediately
                                 Commands blocked

11.   Release E-stop             Motors respond again
                                 Commands resume

12.   Stop match (standby)       Game status broadcast (standby)
                                 Motors disabled
```
