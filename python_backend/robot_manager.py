"""
Robot Manager for ESP32 robot lifecycle and communication management.
"""

import logging
import threading
import time
from typing import Dict, List, Optional
from robot import Robot, ESP32Command
from network_manager import NetworkManager

logger = logging.getLogger(__name__)


class RobotManager:
    """Manages ESP32 robot discovery, connection, and command transmission"""

    ROBOT_TIMEOUT_SECONDS = 60.0  # Mark robot as disconnected after 60 seconds of no pings

    def __init__(self, network_manager: NetworkManager, api_server=None): # Add api_server parameter
        self.network_manager = network_manager
        self.api_server = api_server # Store api_server instance
        self.connected_robots: Dict[str, Robot] = {}
        self.discovered_robots: Dict[str, Robot] = {}
        self.current_game_state = "standby"  # "standby" or "teleop"
        self.emergency_stop_active = False
        self._discovery_thread: Optional[threading.Thread] = None
        self._timeout_thread: Optional[threading.Thread] = None
        self._running = False
        self._lock = threading.Lock()
        self._disconnect_callbacks = []

        logger.info("ESP32 Robot Manager initialized with discovery protocol")
    
    def register_disconnect_callback(self, callback):
        """Register a callback to be called when a robot disconnects"""
        self._disconnect_callbacks.append(callback)

    def start_discovery(self):
        """Start discovery service - listens for robot discovery pings"""
        if self._running:
            logger.warn("Discovery already running")
            return

        self._running = True
        self._discovery_thread = threading.Thread(target=self._discovery_loop, daemon=True)
        self._discovery_thread.start()
        self._timeout_thread = threading.Thread(target=self._timeout_check_loop, daemon=True)
        self._timeout_thread.start()
        logger.info(f"Discovery service started on port {NetworkManager.DISCOVERY_PORT}")
    
    def _discovery_loop(self):
        """Main discovery loop - listens for robot pings"""
        while self._running:
            try:
                message = self.network_manager.receive_discovery_message()
                if message and message.startswith("DISCOVER:"):
                    self._handle_discovery_ping(message)
            except Exception as e:
                logger.debug(f"Discovery listening error: {e}")
            
            time.sleep(0.5)  # Check every 500ms
    
    def _handle_discovery_ping(self, message: str):
        """
        Handle discovery ping from robot: "DISCOVER:<robotId>:<IP>"
        """
        parts = message.split(':')
        if len(parts) >= 3:
            robot_id = parts[1]
            ip_address = parts[2]

            with self._lock:
                # Check if robot is in connected list
                robot = self.connected_robots.get(robot_id)
                if robot:
                    # Update connected robot's last seen time
                    robot.set_ip_address(ip_address)
                    robot.update_last_seen_time()
                else:
                    # Add/update discovered robot
                    robot = self.discovered_robots.get(robot_id)
                    if robot is None:
                        robot = Robot(robot_id, robot_id, ip_address, "discovered")
                        self.discovered_robots[robot_id] = robot
                        logger.info(f"Discovered new robot: {robot_id} at {ip_address}")
                    else:
                        robot.set_ip_address(ip_address)
                        robot.update_last_seen_time()



    def send_stop_command(self, robot_name: str):
        """Send stop command to specific robot"""
        robot = self.get_robot(robot_name)
        if not robot:
            logger.warn(f"Robot not found: {robot_name}")
            return

        stop_command = ESP32Command.create_stop_command(robot_name)
        self._send_esp32_command(robot, stop_command)
        if self.api_server:
            self.api_server.broadcast_robot_receiving_command(robot.id, False)

    def _timeout_check_loop(self):
        """Check for robots that have timed out and mark them as disconnected"""
        while self._running:
            try:
                current_time = time.time()
                disconnected_robots = []
                robots_to_remove = []

                with self._lock:
                    # Check connected robots for timeout
                    for robot_id, robot in list(self.connected_robots.items()):
                        time_since_seen = current_time - robot.last_seen_time
                        if time_since_seen > self.ROBOT_TIMEOUT_SECONDS:
                            logger.warn(f"Robot {robot_id} timed out (no ping for {time_since_seen:.1f}s). Paired controller: {robot.paired_controller_id}")
                            # Broadcast receiving: False before removing
                            if self.api_server:
                                self.api_server.broadcast_robot_receiving_command(robot_id, False)
                            # Remove immediately from connected list - don't keep disconnected robots
                            del self.connected_robots[robot_id]
                            disconnected_robots.append(robot_id)
                            robots_to_remove.append(robot_id)

                    # Also remove from discovered list - robots should completely disappear after timeout
                    for robot_id, robot in list(self.discovered_robots.items()):
                        time_since_seen = current_time - robot.last_seen_time
                        if time_since_seen > self.ROBOT_TIMEOUT_SECONDS:
                            logger.info(f"Removing stale robot {robot_id} from discovered list (offline for {time_since_seen:.1f}s)")
                            del self.discovered_robots[robot_id]
                            if robot_id not in robots_to_remove:
                                robots_to_remove.append(robot_id)

                # Call disconnect callbacks outside of lock to avoid deadlock
                for robot_id in disconnected_robots:
                    for callback in self._disconnect_callbacks:
                        try:
                            callback(robot_id)
                        except Exception as e:
                            logger.error(f"Error in disconnect callback: {e}")

            except Exception as e:
                logger.error(f"Error in timeout check loop: {e}")

            time.sleep(2.0)  # Check every 2 seconds

    def stop_teleop(self):
        """Disable teleop mode - robots stop moving"""
        self.current_game_state = "standby"
        logger.info("Teleop mode stopped")

        # Send standby status to all connected robots
        with self._lock:
            for robot in self.connected_robots.values():
                self.network_manager.send_game_status(robot.name, robot.ip_address, "standby")
                self.send_stop_command(robot.id)
                if self.api_server:
                    self.api_server.broadcast_robot_receiving_command(robot.id, False)

    def emergency_stop_all(self):
        """Activate emergency stop for all robots"""
        self.emergency_stop_active = True
        self.network_manager.broadcast_emergency_stop(activate=True)
        logger.warn("Emergency stop activated for all robots")
        if self.api_server:
            for robot_id in self.connected_robots.keys():
                self.api_server.broadcast_robot_receiving_command(robot_id, False)

    def deactivate_emergency_stop(self):
        """Deactivate emergency stop"""
        self.emergency_stop_active = False
        self.network_manager.broadcast_emergency_stop(activate=False)
        logger.info("Emergency stop deactivated")
        # No need to broadcast receiving: True here, as robots will only start receiving
        # commands again if a controller is actively sending them.

    
    def shutdown(self):
        """Shutdown robot manager"""
        self._running = False
        if self._discovery_thread:
            self._discovery_thread.join(timeout=2)
        
        # Send stop commands to all robots
        with self._lock:
            for robot in self.connected_robots.values():
                self.send_stop_command(robot.id)
        
        logger.info("Robot manager shutdown complete")
