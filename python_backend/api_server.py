"""
API Server with REST endpoints and WebSocket support.
Provides HTTP REST API and real-time WebSocket updates.
"""

import logging
import time
import threading
from typing import Dict, Set
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit

logger = logging.getLogger(__name__)


class ApiServer:
    """Flask-based API server with WebSocket support"""
    
    def __init__(self, robot_manager, controller_manager, network_manager):
        self.robot_manager = robot_manager
        self.controller_manager = controller_manager
        self.network_manager = network_manager
        self.robot_manager.api_server = self # Pass self to robot_manager

        # Match timer state
        self.match_duration_ms = 120000  # Default: 2 minutes
        self.match_start_time = 0
        self.match_running = False
        self.last_controller_count = 0

        # Flask app setup
        self.app = Flask(__name__)
        CORS(self.app)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")

        # Register disconnect callback
        self.robot_manager.register_disconnect_callback(self._on_robot_disconnected)

        self._setup_routes()
        self._start_background_tasks()

    def _on_robot_disconnected(self, robot_id: str):
        """Called when a robot times out and disconnects"""
        logger.info(f"Robot disconnected via timeout: {robot_id}")
        self.broadcast_update('robot_disconnected', {'id': robot_id})
    
    def _setup_routes(self):
        """Setup REST API routes"""
        
        # Health check
        @self.app.route('/api/health', methods=['GET'])
        def health():
            return jsonify({
                'status': 'online',
                'timestamp': int(time.time() * 1000)
            })
        
        # Get all robots
        @self.app.route('/api/robots', methods=['GET'])
        def get_robots():
            robots_list = []
            added_robots = set()
            
            # Add connected robots first
            for robot in self.robot_manager.get_connected_robots():
                robots_list.append(robot.to_dict())
                added_robots.add(robot.id)
            
            # Add discovered robots that aren't already in the list
            for robot in self.robot_manager.get_discovered_robots():
                if robot.id not in added_robots:
                    robots_list.append(robot.to_dict())
            
            return jsonify(robots_list)
        
        # Get robot by ID
        @self.app.route('/api/robots/<robot_id>', methods=['GET'])
        def get_robot(robot_id):
            robot = self.robot_manager.get_robot(robot_id)
            if robot:
                return jsonify(robot.to_dict())
            return jsonify({'error': 'Robot not found'}), 404
        
        # Connect to robot
        @self.app.route('/api/robots/<robot_id>/connect', methods=['POST'])
        def connect_robot(robot_id):
            robot = self.robot_manager.connect_discovered_robot(robot_id)
            if robot:
                self.broadcast_update('robot_connected', robot.to_dict())
                return jsonify({
                    'success': True,
                    'message': 'Robot connected',
                    'robot': robot.to_dict()
                })
            return jsonify({'error': 'Robot not found'}), 404
        
        # Disconnect from robot
        @self.app.route('/api/robots/<robot_id>/disconnect', methods=['POST'])
        def disconnect_robot(robot_id):
            robot = self.robot_manager.get_robot(robot_id)
            if robot:
                self.robot_manager.send_stop_command(robot_id)
                self.robot_manager.remove_robot(robot_id)
                self.broadcast_update('robot_disconnected', {'id': robot_id})
                return jsonify({
                    'success': True,
                    'message': 'Robot disconnected'
                })
            return jsonify({'error': 'Robot not found'}), 404
        
        # Enable robot
        @self.app.route('/api/robots/<robot_id>/enable', methods=['POST'])
        def enable_robot(robot_id):
            self.broadcast_update('robot_enabled', {'id': robot_id})
            return jsonify({'success': True, 'message': 'Robot enabled'})
        
        # Disable robot
        @self.app.route('/api/robots/<robot_id>/disable', methods=['POST'])
        def disable_robot(robot_id):
            robot = self.robot_manager.get_robot(robot_id)
            if robot:
                self.robot_manager.send_stop_command(robot_id)
            self.broadcast_update('robot_disabled', {'id': robot_id})
            return jsonify({'success': True, 'message': 'Robot disabled'})
        
        # Refresh robot list
        @self.app.route('/api/robots/refresh', methods=['POST'])
        def refresh_robots():
            self.robot_manager.scan_for_robots()
            self.broadcast_update('robots_refreshing', {'timestamp': int(time.time() * 1000)})
            return jsonify({
                'success': True,
                'message': 'Scanning for robots'
            })
        
        # Get all controllers
        @self.app.route('/api/controllers', methods=['GET'])
        def get_controllers():
            controllers_list = []
            for controller in self.controller_manager.get_connected_controllers():
                controller_data = controller.to_dict()
                controller_data['enabled'] = self.controller_manager.is_controller_enabled(controller.id)
                controllers_list.append(controller_data)
            return jsonify(controllers_list)
        
        # Pair controller with robot
        @self.app.route('/api/controllers/<controller_id>/pair/<robot_id>', methods=['POST'])
        def pair_controller(controller_id, robot_id):
            self.controller_manager.pair_controller_with_robot(controller_id, robot_id)
            self.broadcast_update('controller_paired', {
                'controllerId': controller_id,
                'robotId': robot_id
            })
            return jsonify({
                'success': True,
                'message': 'Controller paired with robot'
            })
        
        # Unpair controller
        @self.app.route('/api/controllers/<controller_id>/unpair', methods=['POST'])
        def unpair_controller(controller_id):
            self.controller_manager.unpair_controller(controller_id)
            self.broadcast_update('controller_unpaired', {'controllerId': controller_id})
            return jsonify({
                'success': True,
                'message': 'Controller unpaired'
            })
        
        # Enable controller
        @self.app.route('/api/controllers/<controller_id>/enable', methods=['POST'])
        def enable_controller(controller_id):
            self.controller_manager.enable_controller(controller_id)
            self.broadcast_update('controller_enabled', {'controllerId': controller_id})
            return jsonify({
                'success': True,
                'message': 'Controller enabled'
            })
        
        # Disable controller
        @self.app.route('/api/controllers/<controller_id>/disable', methods=['POST'])
        def disable_controller(controller_id):
            self.controller_manager.disable_controller(controller_id)
            self.broadcast_update('controller_disabled', {'controllerId': controller_id})
            return jsonify({
                'success': True,
                'message': 'Controller disabled'
            })
        
        # Refresh controllers
        @self.app.route('/api/controllers/refresh', methods=['POST'])
        def refresh_controllers():
            self.controller_manager.refresh_controllers()
            self.broadcast_update('controllers_refreshing', {'timestamp': int(time.time() * 1000)})
            return jsonify({
                'success': True,
                'message': 'Scanning for controllers'
            })
        
        # Emergency stop
        @self.app.route('/api/emergency-stop', methods=['POST'])
        def emergency_stop():
            self.controller_manager.activate_emergency_stop()
            self.broadcast_update('emergency_stop', {'active': True})
            return jsonify({
                'success': True,
                'message': 'Emergency stop activated'
            })
        
        # Deactivate emergency stop
        @self.app.route('/api/emergency-stop/deactivate', methods=['POST'])
        def deactivate_emergency_stop():
            self.controller_manager.deactivate_emergency_stop()
            self.broadcast_update('emergency_stop', {'active': False})
            return jsonify({
                'success': True,
                'message': 'Emergency stop deactivated'
            })
        
        # Network statistics
        @self.app.route('/api/network/stats', methods=['GET'])
        def get_network_stats():
            import random
            return jsonify({
                'timestamp': int(time.time() * 1000),
                'latency': random.random() * 10 + 10,  # Mock data
                'bandwidth': random.random() * 10 + 45,  # Mock data
                'activeConnections': len(self.robot_manager.get_discovered_robots())
            })
        
        # Match timer endpoints
        @self.app.route('/api/match/timer', methods=['GET'])
        def get_match_timer():
            now = int(time.time() * 1000)
            time_remaining_ms = self.match_duration_ms
            if self.match_running:
                time_remaining_ms = max(0, self.match_duration_ms - (now - self.match_start_time))
            
            return jsonify({
                'running': self.match_running,
                'timeRemainingMs': time_remaining_ms,
                'durationMs': self.match_duration_ms,
                'timeRemainingSeconds': time_remaining_ms // 1000
            })
        
        @self.app.route('/api/match/start', methods=['POST'])
        def start_match():
            if not self.match_running:
                self.match_start_time = int(time.time() * 1000)
                self.match_running = True
                self.robot_manager.start_teleop()
                logger.info(f"Match started - {self.match_duration_ms // 1000} seconds")
                self.broadcast_update('match_start', {
                    'durationMs': self.match_duration_ms,
                    'timestamp': self.match_start_time
                })
            return jsonify({'success': True, 'message': 'Match started'})
        
        @self.app.route('/api/match/stop', methods=['POST'])
        def stop_match():
            if self.match_running:
                self.match_running = False
                self.robot_manager.stop_teleop()
                logger.info("Match stopped")
                self.broadcast_update('match_stop', {'timestamp': int(time.time() * 1000)})
            return jsonify({'success': True, 'message': 'Match stopped'})
        
        @self.app.route('/api/match/reset', methods=['POST'])
        def reset_match():
            self.match_running = False
            self.match_start_time = 0
            self.robot_manager.stop_teleop()
            logger.info("Match reset")
            self.broadcast_update('match_reset', {'timestamp': int(time.time() * 1000)})
            return jsonify({'success': True, 'message': 'Match reset'})
        
        @self.app.route('/api/match/duration', methods=['POST'])
        def set_match_duration():
            try:
                duration_seconds = int(request.get_data(as_text=True))
                self.match_duration_ms = duration_seconds * 1000
                
                if not self.match_running:
                    self.match_start_time = 0
                
                logger.info(f"Match duration set to {duration_seconds} seconds")
                self.broadcast_update('match_duration_changed', {'durationMs': self.match_duration_ms})
                self.broadcast_update('timer_update', {
                    'timeRemainingMs': self.match_duration_ms,
                    'timeRemainingSeconds': duration_seconds,
                    'running': self.match_running
                })
                
                return jsonify({'success': True, 'durationMs': self.match_duration_ms})
            except ValueError:
                return jsonify({'error': 'Invalid duration format'}), 400
    
    def broadcast_robot_receiving_command(self, robot_id: str, receiving: bool):
        """Broadcast update via WebSocket when a robot is receiving commands"""
        self.broadcast_update('robot_receiving_command', {'id': robot_id, 'receiving': receiving})

    def broadcast_update(self, event_type: str, data: dict):
        """Broadcast update via WebSocket"""
        message = {
            'type': event_type,
            'data': data,
            'timestamp': int(time.time() * 1000)
        }
        self.socketio.emit('update', message, namespace='/')
        logger.debug(f"Broadcast: {event_type}")
    
    def _start_background_tasks(self):
        """Start background tasks for timer and monitoring"""
        # Timer broadcast task
        def timer_broadcast():
            while True:
                time.sleep(1)  # Every second
                if self.match_running:
                    now = int(time.time() * 1000)
                    time_remaining_ms = max(0, self.match_duration_ms - (now - self.match_start_time))
                    
                    # Auto-stop when time expires - activate emergency stop
                    if time_remaining_ms == 0 and self.match_running:
                        self.match_running = False
                        self.robot_manager.stop_teleop()
                        # Activate emergency stop when timer expires
                        self.controller_manager.activate_emergency_stop()
                        self.broadcast_update('match_end', {'timestamp': now})
                        self.broadcast_update('emergency_stop', {'active': True})
                        logger.warn("Match ended - time expired - EMERGENCY STOP ACTIVATED")
                    
                    self.broadcast_update('timer_update', {
                        'timeRemainingMs': time_remaining_ms,
                        'timeRemainingSeconds': time_remaining_ms // 1000,
                        'running': self.match_running
                    })
        
        # Controller monitoring task
        def controller_monitoring():
            while True:
                time.sleep(2)  # Every 2 seconds
                try:
                    current_count = self.controller_manager.get_connected_controller_count()
                    if current_count != self.last_controller_count:
                        logger.debug(f"Controller count changed: {self.last_controller_count} -> {current_count}")
                        self.last_controller_count = current_count
                        self.broadcast_update('controllers_updated', {
                            'count': current_count,
                            'timestamp': int(time.time() * 1000)
                        })
                except Exception as e:
                    logger.error(f"Error monitoring controllers: {e}")
        
        # Start background threads
        timer_thread = threading.Thread(target=timer_broadcast, daemon=True)
        timer_thread.start()
        
        monitor_thread = threading.Thread(target=controller_monitoring, daemon=True)
        monitor_thread.start()
    
    def start(self, port=8080):
        """Start the API server"""
        logger.info(f"Starting API server on port {port}")
        self.socketio.run(self.app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
    
    def stop(self):
        """Stop the API server"""
        # Flask-SocketIO doesn't have a clean stop method, rely on process termination
        logger.info("API server stopped")
