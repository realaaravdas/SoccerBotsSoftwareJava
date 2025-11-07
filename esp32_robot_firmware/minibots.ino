#include "minibot.h"

// Create your robot (put your name here!)
Minibot bot("ENTER ROBOT NAME HERE", 16, 17, 18, 19, 90, 90);

float left = 0.0;
float right = 0.0;

void setup() {
  // Initialize the robot - runs once at startup
  bot.begin();
}

void loop() {
  // Update controller values - ALWAYS FIRST!
  bot.updateController(); 

  if (bot.getGameStatus() == Minibot::Status::Standby || bot.getGameStatus() == Minibot::Status::Unknown) {
    bot.stopAllMotors();
  }
  else {
    left = (bot.getLeftY() < 130 && bot.getLeftY() > 125) ? 0.0 : -1*(bot.getLeftY()) / 128.0 + 1;
    right = (bot.getRightY() < 130 && bot.getRightY() > 125) ? 0.0 : -1*(bot.getRightY()) / 128.0 + 1;
    bot.driveLeftMotor(left);
    bot.driveRightMotor(right);
  }
}
