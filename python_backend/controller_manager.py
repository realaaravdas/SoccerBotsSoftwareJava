"""
Controller Manager for PlayStation and other game controller support.
Uses pygame for cross-platform controller detection and input.
"""

import logging
import threading
import time
from typing import Dict, List, Optional
import pygame
from controller_input import ControllerInput, GameController

logger = logging.getLogger(__name__)


class ControllerManager:
    """Manages game controller detection, polling, and input processing"""
    
    def __init__(self, robot_manager):
        self.robot_manager = robot_manager
        self.connected_controllers: Dict[str, GameController] = {}
        self.controller_robot_pairings: Dict[str, str] = {}
        self.controller_enabled: Dict[str, bool] = {}
        self.controller_joysticks: Dict[str, pygame.joystick.Joystick] = {}
        self._running = False
        self._lock = threading.Lock()
        self._detection_thread: Optional[threading.Thread] = None
        self._polling_thread: Optional[threading.Thread] = None
        self.emergency_stop_active = False
        # Debounce transient disconnects: require missing 3 scans (~6s) before removal
        self._missing_counts: Dict[str, int] = {}
        
        # Initialize pygame for controller support
        try:
            pygame.init()
            pygame.joystick.init()
            logger.info("Pygame initialized for controller support")
        except Exception as e:
            logger.error(f"Failed to initialize pygame: {e}")
        
        self._start_controller_detection()
        self._start_input_polling()
    
    def _start_controller_detection(self):
        """Start controller detection thread"""
        if self._detection_thread and self._detection_thread.is_alive():
            logger.warn("Controller detection already running")
            return
        
        self._running = True
        self._detection_thread = threading.Thread(target=self._detection_loop, daemon=True)
        self._detection_thread.start()
        logger.info("Controller detection started")
    
    def _detection_loop(self):
        """Main controller detection loop"""
        while self._running:
            try:
                self._detect_controllers()
            except Exception as e:
                logger.error(f"Error detecting controllers: {e}")
            
            time.sleep(2)  # Scan every 2 seconds
    
    def _detect_controllers(self):
        """Detect connected game controllers"""
        try:
            # Process pygame events to update joystick state without reinitializing
            pygame.event.pump()
            
            joystick_count = pygame.joystick.get_count()
            logger.debug(f"Found {joystick_count} joystick(s)")
            
            current_controller_ids = set()
            
            for i in range(joystick_count):
                try:
                    # Try to reuse existing joystick or create new one
                    joystick = None
                    with self._lock:
                        # Check if we already have this joystick by index
                        for cid, js in self.controller_joysticks.items():
                            if js.get_id() == i:
                                joystick = js
                                controller_id = cid
                                current_controller_ids.add(controller_id)
                                break
                    
                    # If not found, create new joystick
                    if joystick is None:
                        joystick = pygame.joystick.Joystick(i)
                        if not joystick.get_init():
                            joystick.init()
                        
                        controller_id = self._generate_controller_id(joystick)
                        current_controller_ids.add(controller_id)
                        
                        with self._lock:
                            if controller_id not in self.connected_controllers:
                                # Determine controller type
                                controller_type = self._identify_controller_type(joystick)
                                
                                game_controller = GameController(
                                    controller_id,
                                    controller_type,
                                    joystick.get_name()
                                )
                                
                                self.connected_controllers[controller_id] = game_controller
                                self.controller_joysticks[controller_id] = joystick
                                self.controller_enabled[controller_id] = True  # Enable by default
                                
                                logger.info(f"Detected new controller: {joystick.get_name()} ({controller_type})")
                
                except Exception as e:
                    logger.error(f"Error initializing joystick {i}: {e}")
            
            # Remove disconnected controllers (only remove if truly gone)
            with self._lock:
                disconnected = set(self.connected_controllers.keys()) - current_controller_ids
                for controller_id in disconnected:
                    # Double-check by trying to find the joystick
                    joystick = self.controller_joysticks.get(controller_id)
                    if joystick and joystick.get_init():
                        # Controller still exists, don't remove it
                        current_controller_ids.add(controller_id)
                        self._missing_counts.pop(controller_id, None)
                        continue

                    # Increment missing count and only remove after threshold (3 scans ~6s)
                    miss = self._missing_counts.get(controller_id, 0) + 1
                    self._missing_counts[controller_id] = miss
                    if miss < 3:
                        # Keep it for now to avoid flicker; skip removal this cycle
                        continue

                    # Proceed with removal after confirmed missing
                    self._missing_counts.pop(controller_id, None)

                    # If it was paired, unpair from robot first
                    if controller_id in self.controller_robot_pairings:
                        robot_id = self.controller_robot_pairings[controller_id]
                        robot = self.robot_manager.get_robot(robot_id)
                        if robot:
                            robot.set_paired_controller(None)
                        del self.controller_robot_pairings[controller_id]

                    logger.info(f"Controller disconnected: {controller_id}")
                    del self.connected_controllers[controller_id]
                    if controller_id in self.controller_joysticks:
                        try:
                            self.controller_joysticks[controller_id].quit()
                        except Exception:
                            pass
                        del self.controller_joysticks[controller_id]
                    if controller_id in self.controller_enabled:
                        del self.controller_enabled[controller_id]
        
        except Exception as e:
            logger.error(f"Controller detection error: {e}")
    
    def _generate_controller_id(self, joystick: pygame.joystick.Joystick) -> str:
        """Generate unique controller ID"""
        name = joystick.get_name().replace(' ', '_').replace('-', '_')
        return f"{name}_{joystick.get_instance_id()}"
    
    def _identify_controller_type(self, joystick: pygame.joystick.Joystick) -> str:
        """Identify controller type from name"""
        name_lower = joystick.get_name().lower()
        
        if 'playstation' in name_lower or 'ps4' in name_lower or 'ps5' in name_lower or 'dualsense' in name_lower or 'dualshock' in name_lower:
            return 'PlayStation'
        elif 'xbox' in name_lower:
            return 'Xbox'
        elif 'nintendo' in name_lower or 'switch' in name_lower:
            return 'Nintendo'
        else:
            return 'Generic'
    
    def _start_input_polling(self):
        """Start input polling thread"""
        if self._polling_thread and self._polling_thread.is_alive():
            logger.warn("Input polling already running")
            return
        
        self._polling_thread = threading.Thread(target=self._polling_loop, daemon=True)
        self._polling_thread.start()
        logger.info("Input polling started")
    
    def _polling_loop(self):
        """Main input polling loop (60Hz / ~16ms)"""
        while self._running:
            try:
                self._poll_controller_inputs()
            except Exception as e:
                logger.error(f"Error polling controller input: {e}")
            
            time.sleep(0.016)  # ~60Hz polling
    
    def _poll_controller_inputs(self):
        """Poll all connected controllers for input"""
        # Process pygame events (required for joystick updates)
        pygame.event.pump()
        
        with self._lock:
            for controller_id, game_controller in list(self.connected_controllers.items()):
                try:
                    # Check if controller is enabled
                    if not self.controller_enabled.get(controller_id, False):
                        continue
                    
                    joystick = self.controller_joysticks.get(controller_id)
                    if not joystick:
                        continue
                    
                    # Read controller input
                    input_data = self._read_controller_input(joystick)
                    game_controller.update_input(input_data)
                    
                    # Send to paired robot if not in emergency stop
                    paired_robot_id = self.controller_robot_pairings.get(controller_id)
                    if paired_robot_id and not self.emergency_stop_active:
                        if input_data.has_movement():
                            self.robot_manager.send_movement_command(
                                paired_robot_id,
                                input_data.get_left_stick_x(),
                                input_data.get_left_stick_y(),
                                input_data.get_right_stick_x(),
                                input_data.get_right_stick_y()
                            )
                        elif input_data.is_stop_command():
                            self.robot_manager.send_stop_command(paired_robot_id)
                
                except Exception as e:
                    logger.error(f"Error polling controller {controller_id}: {e}")
    
    def _read_controller_input(self, joystick: pygame.joystick.Joystick) -> ControllerInput:
        """Read input from pygame joystick"""
        input_data = ControllerInput()
        
        # Read axes (sticks and triggers)
        num_axes = joystick.get_numaxes()
        
        # Standard mapping for PlayStation controllers:
        # Axis 0: Left stick X
        # Axis 1: Left stick Y
        # Axis 2: Right stick X (or L2 trigger on some)
        # Axis 3: Right stick Y (or R2 trigger on some)
        # Axis 4: L2 trigger (on DualSense)
        # Axis 5: R2 trigger (on DualSense)
        
        if num_axes >= 2:
            input_data.set_left_stick_x(joystick.get_axis(0))
            input_data.set_left_stick_y(joystick.get_axis(1))
        
        if num_axes >= 4:
            # Try standard mapping first
            input_data.set_right_stick_x(joystick.get_axis(2))
            input_data.set_right_stick_y(joystick.get_axis(3))
        
        if num_axes >= 6:
            # DualSense/DS4 triggers
            input_data.set_left_trigger((joystick.get_axis(4) + 1) / 2)
            input_data.set_right_trigger((joystick.get_axis(5) + 1) / 2)
        
        # Read buttons
        num_buttons = joystick.get_numbuttons()
        for i in range(min(num_buttons, 16)):
            input_data.set_button(i, joystick.get_button(i))
        
        # Read D-pad (hat)
        num_hats = joystick.get_numhats()
        if num_hats > 0:
            hat = joystick.get_hat(0)
            input_data.set_dpad(hat[0] + hat[1] * 2)
        
        return input_data
    
    def get_connected_controllers(self) -> List[GameController]:
        """Get list of connected controllers"""
        with self._lock:
            return list(self.connected_controllers.values())
    
    def get_connected_controller_count(self) -> int:
        """Get count of connected controllers"""
        with self._lock:
            return len(self.connected_controllers)
    
    def pair_controller_with_robot(self, controller_id: str, robot_id: str):
        """Pair controller with robot"""
        with self._lock:
            if controller_id in self.connected_controllers:
                game_controller = self.connected_controllers[controller_id]
                game_controller.set_paired_robot_id(robot_id)
                self.controller_robot_pairings[controller_id] = robot_id

                # Update robot's pairedControllerId
                robot = self.robot_manager.get_robot(robot_id)
                if robot:
                    robot.set_paired_controller(controller_id)

                logger.info(f"Paired controller {controller_id} with robot {robot_id}")
            else:
                logger.warn(f"Cannot pair - controller not found: {controller_id}")
    
    def unpair_controller(self, controller_id: str):
        """Unpair controller from robot"""
        with self._lock:
            if controller_id in self.controller_robot_pairings:
                robot_id = self.controller_robot_pairings[controller_id]
                game_controller = self.connected_controllers.get(controller_id)
                if game_controller:
                    game_controller.set_paired_robot_id(None)

                # Clear robot's pairedControllerId
                robot = self.robot_manager.get_robot(robot_id)
                if robot:
                    robot.set_paired_controller(None)

                del self.controller_robot_pairings[controller_id]
                logger.info(f"Unpaired controller {controller_id}")
    
    def get_paired_robot_id(self, controller_id: str) -> Optional[str]:
        """Get robot ID paired with controller"""
        with self._lock:
            return self.controller_robot_pairings.get(controller_id)
    
    def enable_controller(self, controller_id: str):
        """Enable controller"""
        with self._lock:
            self.controller_enabled[controller_id] = True
            logger.info(f"Enabled controller {controller_id}")
    
    def disable_controller(self, controller_id: str):
        """Disable controller"""
        with self._lock:
            self.controller_enabled[controller_id] = False
            logger.info(f"Disabled controller {controller_id}")
    
    def is_controller_enabled(self, controller_id: str) -> bool:
        """Check if controller is enabled"""
        with self._lock:
            return self.controller_enabled.get(controller_id, False)
    
    def refresh_controllers(self):
        """Manually trigger controller detection"""
        logger.info("Manual controller refresh requested")
        self._detect_controllers()
    
    def activate_emergency_stop(self):
        """Activate emergency stop"""
        self.emergency_stop_active = True
        self.robot_manager.emergency_stop_all()
        logger.warn("Emergency stop activated")
    
    def deactivate_emergency_stop(self):
        """Deactivate emergency stop"""
        self.emergency_stop_active = False
        self.robot_manager.deactivate_emergency_stop()
        logger.info("Emergency stop deactivated")
    
    def shutdown(self):
        """Shutdown controller manager"""
        self._running = False
        
        if self._detection_thread:
            self._detection_thread.join(timeout=2)
        if self._polling_thread:
            self._polling_thread.join(timeout=2)
        
        # Cleanup pygame
        try:
            pygame.joystick.quit()
            pygame.quit()
        except:
            pass
        
        logger.info("Controller manager shutdown complete")
