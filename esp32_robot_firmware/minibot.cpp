#include "minibot.h"

// Constructor
Minibot::Minibot(const char* robotId,
                 int leftMotorPin, int rightMotorPin,
                 int dcMotorPin, int servoMotorPin,
                 int leftMotorPwmOffset, int rightMotorPwmOffset,
                 int dcMotorPwmOffset)
                  : robotId(robotId),
                      leftMotorPin(leftMotorPin), rightMotorPin(rightMotorPin),
                      dcMotorPin(dcMotorPin), servoMotorPin(servoMotorPin),
                      leftMotorPwmOffset(leftMotorPwmOffset),
                      rightMotorPwmOffset(rightMotorPwmOffset),
                      dcMotorPwmOffset(dcMotorPwmOffset)
{
  
}

void Minibot::begin()
{
  Serial.begin(115200);
  ledcAttach(leftMotorPin, freq, resolution);
  ledcAttach(rightMotorPin, freq, resolution);
  ledcAttach(dcMotorPin, freq, resolution);
  ledcAttach(servoMotorPin, freq, resolution);

  // Wi-Fi connection
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());

  // Start UDP
  udp.begin(UDP_PORT);
  Serial.println("Listening on UDP port " + String(UDP_PORT));

  // Stop all motors initially
  stopAllMotors();
}

void Minibot::stopAllMotors() {
  driveLeftMotor(0);
  driveRightMotor(0);
  driveDCMotor(0);
  driveServoMotor(0);
}

void Minibot::updateController() {
  int packetSize = udp.parsePacket();
  if (!packetSize) return;

  int len = udp.read(incomingPacket, 255);
  if (len <= 0) return;
  incomingPacket[len] = '\0';

  // Check if packet is binary controller data (8 bytes) or text command
  if (len == 8) {
    // This is binary controller data
    uint8_t axes[6];
    uint8_t buttons[2];

    memcpy(axes, incomingPacket, 6);
    memcpy(buttons, incomingPacket + 6, 2);

    if (gameStatus == Status::Teleop) {
      leftX = axes[0];
      leftY = axes[1];
      rightX = axes[2];
      rightY = axes[3];

      cross = buttons[0] & 0x01;
      circle = buttons[0] & 0x02;
      square = buttons[0] & 0x04;
      triangle = buttons[0] & 0x08;
    }
    return;
  }

  // Otherwise, treat as text command
  String packetStr = String(incomingPacket);

  // --- respond to PC discovery ping ---
  if (packetStr == "ping" && !connected) {
    String reply = "pong:" + String(robotId);
    udp.beginPacket(udp.remoteIP(), udp.remotePort());
    udp.write((const uint8_t*)reply.c_str(), reply.length());
    udp.endPacket();
    connected = true;
    return;
  }

  // --- handle game status or control data ---
  if (packetStr.startsWith(robotId)) {
    int sepIndex = packetStr.indexOf(':');
    if (sepIndex != -1) {
      gameStatus = stringToGameStatus(packetStr.substring(sepIndex + 1));
      return;
    }
  }
}

int Minibot::getLeftX() { return leftX; }
int Minibot::getLeftY() { return leftY; }
int Minibot::getRightX() { return rightX; }
int Minibot::getRightY() { return rightY; }

bool Minibot::getCross() { return cross; }
bool Minibot::getCircle() { return circle; }
bool Minibot::getSquare() { return square; }
bool Minibot::getTriangle() { return triangle; }

Minibot::Status Minibot::getGameStatus() { return gameStatus; }

Minibot::Status Minibot::stringToGameStatus(String string)
{
    if (string == "standby")
    {
      return Status::Standby;
    }
    else if (string == "teleop")
    {
      return Status::Teleop;
    }
    return Status::Unknown;
}

bool Minibot::driveDCMotor(float value) {
  float clampedVal = std::clamp(value*MOTOR_SPEED_MULTIPLYER, -20.0f, 20.0f);
  return ledcWrite(dcMotorPin, round(clampedVal + dcMotorPwmOffset));
}

bool Minibot::driveLeftMotor(float value) {
  float clampedVal = std::clamp(value*MOTOR_SPEED_MULTIPLYER, -20.0f, 20.0f);
  return ledcWrite(leftMotorPin, round(clampedVal+leftMotorPwmOffset));
}

bool Minibot::driveRightMotor(float value) {
  float clampedVal = std::clamp(value*MOTOR_SPEED_MULTIPLYER, -20.0f, 20.0f);
  return ledcWrite(rightMotorPin, round(clampedVal+rightMotorPwmOffset));
}

bool Minibot::driveServoMotor(int angle) {
  if (angle < -50 || angle > 50) {
    return false;
  }
  float pulseWidthMs = 0.01 * angle + 1.5;
  int dutyCycle = (pulseWidthMs / 10.0) * 65535;
  ledcWrite(servoMotorPin, dutyCycle);
  return true;
}
