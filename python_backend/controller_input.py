"""
Controller input data structure for normalized controller values.
"""

from typing import Optional

class ControllerInput:
    """Normalized controller input data (-1.0 to 1.0 for sticks)"""

    DEADZONE = 0.1  # 10% deadzone
    MOVEMENT_THRESHOLD = 0.05  # 5% movement threshold

    def __init__(self):
        self.left_stick_x = 0.0
        self.left_stick_y = 0.0
        self.right_stick_x = 0.0
        self.right_stick_y = 0.0
        self.left_trigger = 0.0
        self.right_trigger = 0.0
        self.dpad = 0.0
        self.buttons = [False] * 16  # Support up to 16 buttons

    def apply_deadzone(self, value: float) -> float:
        """Apply deadzone to stick value"""
        if abs(value) < self.DEADZONE:
            return 0.0
        return value

    def set_left_stick_x(self, value: float):
        self.left_stick_x = self.apply_deadzone(value)

    def set_left_stick_y(self, value: float):
        self.left_stick_y = self.apply_deadzone(value)

    def set_right_stick_x(self, value: float):
        self.right_stick_x = self.apply_deadzone(value)

    def set_right_stick_y(self, value: float):
        self.right_stick_y = self.apply_deadzone(value)

    def set_left_trigger(self, value: float):
        self.left_trigger = max(0.0, min(1.0, value))

    def set_right_trigger(self, value: float):
        self.right_trigger = max(0.0, min(1.0, value))

    def set_dpad(self, value: float):
        self.dpad = value

    def set_button(self, index: int, pressed: bool):
        if 0 <= index < len(self.buttons):
            self.buttons[index] = pressed

    def get_button(self, index: int) -> bool:
        if 0 <= index < len(self.buttons):
            return self.buttons[index]
        return False

    def has_movement(self) -> bool:
        """Check if there's significant movement"""
        return (abs(self.left_stick_x) > self.MOVEMENT_THRESHOLD or
                abs(self.left_stick_y) > self.MOVEMENT_THRESHOLD or
                abs(self.right_stick_x) > self.MOVEMENT_THRESHOLD or
                abs(self.right_stick_y) > self.MOVEMENT_THRESHOLD)

    def is_stop_command(self) -> bool:
        """Check if this is effectively a stop command (no movement)"""
        return not self.has_movement()

    def get_left_stick_x(self) -> float:
        return self.left_stick_x

    def get_left_stick_y(self) -> float:
        return self.left_stick_y

    def get_right_stick_x(self) -> float:
        return self.right_stick_x

    def get_right_stick_y(self) -> float:
        return self.right_stick_y


class GameController:
    """Represents a game controller"""

    def __init__(self, controller_id: str, controller_type: str, name: str):
        self.id = controller_id
        self.type = controller_type
        self.name = name
        self.connected = True
        self.current_input = ControllerInput()
        self.paired_robot_id: Optional[str] = None # Store paired robot ID internally

    def update_input(self, input_data: ControllerInput):
        """Update current input state"""
        self.current_input = input_data

    def set_connected(self, connected: bool):
        """Set connection status"""
        self.connected = connected

    def set_paired_robot_id(self, robot_id: Optional[str]):
        """Set the ID of the robot this controller is paired with"""
        self.paired_robot_id = robot_id

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'connected': self.connected,
            'pairedRobotId': self.paired_robot_id # Include paired robot ID
        }