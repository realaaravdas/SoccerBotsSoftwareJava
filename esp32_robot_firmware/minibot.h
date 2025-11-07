#ifndef MINIBOT_H
#define MINIBOT_H

#include <driver/ledc.h>
#include <WiFi.h>
#include <WiFiUdp.h>

// PWM Channel Definitions
const int freq = 50;
const int resolution = 10;

// WiFi Configuration
#define WIFI_SSID "WATCHTOWER"
#define WIFI_PASSWORD "lancerrobotics"
#define UDP_PORT 2367
#define DISCOVERY_PORT 12345
#define COMMAND_PORT_BASE 12346
#define MOTOR_SPEED_MULTIPLYER 20

class Minibot {
private:
    const char* robotId;
    int leftMotorPin;
    int rightMotorPin;
    int dcMotorPin;
    int servoMotorPin;

    int leftMotorPwmOffset;
    int rightMotorPwmOffset;
    int dcMotorPwmOffset;

    int leftX = 127;
    int leftY = 127;
    int rightX = 127;
    int rightY = 127;

    bool cross = false;
    bool circle = false;
    bool square = false;
    bool triangle = false;

    bool emergencyStop = false;
    bool connected = false;
    unsigned int assignedPort = 0;
    unsigned long lastPingTime = 0;
    unsigned long lastCommandTime = 0;

    WiFiUDP udp;
    char incomingPacket[256];


public:
    enum Status
    {
        Standby,
        Teleop,
        Unknown,
    };

    Status gameStatus = Status::Standby;
    
    // Constructor
    Minibot(const char* robotId,
          int leftMotorPin = 16, int rightMotorPin = 17,
          int dcMotorPin = 18, int servoMotorPin = 19,
          int leftMotorPwmOffset = 90, int rightMotorPwmOffset = 90,
          int dcMotorPwmOffset = 90);

    void begin();

    // Update controller state from UDP packets
    void updateController();

    // Getter methods for joystick axes
    int getLeftX();
    int getLeftY();
    int getRightX();
    int getRightY();

    // Getter methods for buttons
    bool getCross();
    bool getCircle();
    bool getSquare();
    bool getTriangle();

    // Get game status
    Status getGameStatus();
    Status stringToGameStatus(String string);

    // Motor control methods
    bool driveDCMotor(float value);      // value: -1.0 to 1.0
    bool driveLeftMotor(float value);         // value: -1.0 to 1.0
    bool driveRightMotor(float value);        // value: -1.0 to 1.0
    bool driveServoMotor(int angle);     // angle: -50 to 50 degrees
    void stopAllMotors(); // Stops all motors including manipulator motors
};

#endif // MINIBOT_H
