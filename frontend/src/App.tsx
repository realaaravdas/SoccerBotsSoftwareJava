import { useState, useEffect, useRef } from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ControllersPanel } from "./components/ControllersPanel";
import { NetworkAnalysis } from "./components/NetworkAnalysis";
import { ControlPanel } from "./components/ControlPanel";
import { ServiceLog } from "./components/ServiceLog";
import { TerminalMonitor } from "./components/TerminalMonitor";
import { Activity } from "lucide-react";
import { toast, Toaster } from "sonner";
import { apiService, Robot, Controller, LogEntry } from "./services/api";

export default function App() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [selectedRobots, setSelectedRobots] = useState<string[]>([]);
  const [networkData, setNetworkData] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "$ Robot Control System v3.2.1 initialized",
    "$ Loading driver modules...",
    "$ Network interface configured",
    "$ Connecting to backend API...",
  ]);
  const [emergencyActive, setEmergencyActive] = useState(false);

  // Store pairing UI state in parent to survive child re-renders
  const [pairingControllerId, setPairingControllerId] = useState<string | null>(null);

  // Use ref to track pairing state in interval callbacks (avoids closure issues)
  const pairingControllerIdRef = useRef<string | null>(null);

  // Debug: Track when pairing state changes
  useEffect(() => {
    console.log("[App] ===== PAIRING STATE CHANGED =====");
    console.log("[App] pairingControllerId:", pairingControllerId);
    console.trace("[App] Stack trace of state change");

    // Update ref whenever state changes
    pairingControllerIdRef.current = pairingControllerId;
  }, [pairingControllerId]);

  // Initialize API connection
  useEffect(() => {
    console.log("[App] Initializing API connection...");
    apiService.connectWebSocket();

    // Subscribe to logs
    const unsubscribe = apiService.subscribeToLogs((newLogs) => {
      setLogs(newLogs);
    });

    // Set up real-time event listeners
    const unsubRobotConnected = apiService.on("robot_connected", (data) => {
      console.log("[WebSocket] Robot connected:", data);
      fetchRobots();
    });

    const unsubRobotDisconnected = apiService.on("robot_disconnected", (data) => {
      console.log("[WebSocket] Robot disconnected:", data);
      fetchRobots();
      addTerminalLine(`$ Robot ${data.id} disconnected`);
    });

    const unsubControllerEvent = apiService.on("controller_paired", (data) => {
      console.log("[WebSocket] Controller event:", data);
      fetchControllers();
    });

    const unsubControllerUnpaired = apiService.on("controller_unpaired", (data) => {
      console.log("[WebSocket] Controller unpaired:", data);
      fetchControllers();
    });

    const unsubControllersUpdated = apiService.on("controllers_updated", (data) => {
      console.log("[WebSocket] Controllers updated:", data);
      fetchControllers();
    });

    const unsubEmergency = apiService.on("emergency_stop", (data) => {
      console.log("[WebSocket] Emergency stop:", data);
      setEmergencyActive(data.active);
    });

    const unsubRobotReceiving = apiService.on("robot_receiving_command", (data) => {
      console.log("[WebSocket] Robot receiving command:", data);
      setRobots((prevRobots) =>
        prevRobots.map((robot) =>
          robot.id === data.id ? { ...robot, receiving: data.receiving } : robot
        )
      );
    });

    addTerminalLine("$ WebSocket connection established");
    addTerminalLine("$ System ready");

    // Initial data fetch
    fetchRobots();
    fetchControllers();
    startNetworkPolling();
    startControllerPolling();

    return () => {
      unsubscribe();
      unsubRobotConnected();
      unsubRobotDisconnected();
      unsubControllerEvent();
      unsubControllerUnpaired();
      unsubControllersUpdated();
      unsubEmergency();
      unsubRobotReceiving();
    };
  }, []);

  const addTerminalLine = (line: string) => {
    setTerminalLines((prev) => [...prev, line]);
  };

  const fetchRobots = async () => {
    try {
      const robotsData = await apiService.getRobots();
      console.log("[App] Raw robots data from API:", robotsData);
      // Strict filtering - only show robots that are actually online
      const currentTime = Date.now() / 1000; // Current time in seconds
      const filteredRobots = robotsData.filter((robot: Robot) => {
        // Only keep connected or discovered robots
        if (robot.status !== "connected" && robot.status !== "discovered") {
          return false;
        }

        // Additional check: if robot has lastSeenTime, verify it's recent (within 15 seconds)
        if (robot.lastSeenTime) {
          const timeSinceLastSeen = currentTime - robot.lastSeenTime;
          if (timeSinceLastSeen > 15) {
            console.log(`[App] Filtering out stale robot ${robot.name} (last seen ${timeSinceLastSeen.toFixed(1)}s ago)`);
            return false;
          }
        }

        return true;
      });
      console.log("[App] Filtered robots data:", filteredRobots);

      setRobots(filteredRobots);
    } catch (error) {
      console.error("[App] Failed to fetch robots:", error);
      addTerminalLine("$ Error: Failed to fetch robot list");
    }
  };

  const fetchControllers = async () => {
    try {
      const controllersData = await apiService.getControllers();
      console.log("[App] Raw controllers data from API:", controllersData);

      // Only update if there's an actual change - prevents unnecessary re-renders
      setControllers(controllersData);
    } catch (error) {
      console.error("[App] Failed to fetch controllers:", error);
      addTerminalLine("$ Error: Failed to fetch controller list");
    }
  };

  const startNetworkPolling = () => {
    // Initial network data
    const initialData = Array.from({ length: 6 }, (_, i) => ({
      time: `${i * 5}s`,
      latency: Math.floor(Math.random() * 10) + 10,
      bandwidth: Math.floor(Math.random() * 10) + 45,
    }));
    setNetworkData(initialData);

    // Poll network stats every 5 seconds
    const interval = setInterval(async () => {
      try {
        const stats = await apiService.getNetworkStats();
        setNetworkData((prev) => {
          const newData = [...prev.slice(1)];
          const lastTime = parseInt(prev[prev.length - 1].time);
          newData.push({
            time: `${lastTime + 5}s`,
            latency: stats.latency,
            bandwidth: stats.bandwidth,
          });
          return newData;
        });
      } catch (error) {
        console.error("[App] Failed to fetch network stats:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  };

  const startControllerPolling = () => {
    // Poll controllers every 10 seconds (reduced from 2s to prevent UI disruption)
    // WebSocket events handle real-time updates, this is just a fallback
    const interval = setInterval(async () => {
      try {
        // DO NOT poll if pairing UI is open - prevents state disruption
        // Use ref to avoid closure issues with setInterval
        if (pairingControllerIdRef.current !== null) {
          console.log("[App] Skipping controller poll - pairing UI is open for:", pairingControllerIdRef.current);
          return;
        }
        await fetchControllers();
      } catch (error) {
        console.error("[App] Failed to poll controllers:", error);
      }
    }, 10000); // Increased to 10 seconds to reduce interference

    return () => clearInterval(interval);
  };

  const handleConnect = async (id: string) => {
    try {
      const robot = robots.find((r) => r.id === id);
      if (!robot) return;

      await apiService.connectRobot(id);
      toast.success(`${robot.name} connected successfully`);
      addTerminalLine(`$ Connecting to ${robot.name}...`);
      addTerminalLine(`$ ${robot.name} connected successfully`);

      // Force refresh robot list after a short delay
      setTimeout(async () => {
        await fetchRobots();
      }, 100);
    } catch (error) {
      console.error("[App] Failed to connect:", error);
      toast.error("Failed to connect");
      // Refresh anyway to show current state
      fetchRobots();
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      const robot = robots.find((r) => r.id === id);
      if (!robot) return;

      await apiService.disconnectRobot(id);
      toast.success(`${robot.name} disconnected`);
      addTerminalLine(`$ Disconnecting from ${robot.name}...`);
      addTerminalLine(`$ ${robot.name} disconnected`);

      // Force refresh robot list after a short delay
      setTimeout(async () => {
        await fetchRobots();
      }, 100);
    } catch (error) {
      console.error("[App] Failed to disconnect:", error);
      toast.error("Failed to disconnect");
      // Refresh anyway to show current state
      fetchRobots();
    }
  };

  const handleRefresh = async () => {
    try {
      toast.info("Scanning for robots...");
      addTerminalLine("$ Refreshing robot list...");
      await apiService.refreshRobots();

      // Wait a bit for discovery, then fetch
      setTimeout(async () => {
        await fetchRobots();
        addTerminalLine("$ Scan complete");
      }, 2000);
    } catch (error) {
      console.error("[App] Failed to refresh robots:", error);
      toast.error("Failed to refresh robots");
    }
  };

  const handleEmergencyStop = async () => {
    try {
      if (!emergencyActive) {
        await apiService.activateEmergencyStop();
        setEmergencyActive(true);
        toast.error("EMERGENCY STOP ACTIVATED");
        addTerminalLine("$ !!! EMERGENCY STOP ACTIVATED !!!");
        addTerminalLine("$ All robot operations halted");
      } else {
        await apiService.deactivateEmergencyStop();
        setEmergencyActive(false);
        toast.success("Emergency stop deactivated");
        addTerminalLine("$ Emergency stop deactivated");
        addTerminalLine("$ Systems resuming normal operation");
      }
    } catch (error) {
      console.error("[App] Failed to toggle emergency stop:", error);
      toast.error("Failed to toggle emergency stop");
    }
  };

  const handleDisable = async (id: string) => {
    try {
      const robot = robots.find((r) => r.id === id);
      if (!robot) return;

      const isEnabling = robot.disabled;

      if (isEnabling) {
        await apiService.enableRobot(id);
        toast.success(`${robot.name} has been enabled`);
        addTerminalLine(`$ Enabling ${robot.name}...`);
        addTerminalLine(`$ ${robot.name} has been enabled`);
      } else {
        await apiService.disableRobot(id);
        toast.info(`${robot.name} has been disabled`);
        addTerminalLine(`$ Disabling ${robot.name}...`);
        addTerminalLine(`$ ${robot.name} has been disabled`);
      }

      // Refresh robot list
      await fetchRobots();
    } catch (error) {
      console.error("[App] Failed to toggle robot state:", error);
      toast.error("Failed to toggle robot state");
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    toast.success("Service log cleared");
    setTerminalLines((prev) => [...prev, "$ Service log cleared"]);
  };

  const handleToggleRobotSelection = (id: string) => {
    setSelectedRobots((prev) =>
      prev.includes(id) ? prev.filter((robotId) => robotId !== id) : [...prev, id]
    );
  };

  const handlePairController = async (controllerId: string, robotId: string) => {
    try {
      await apiService.pairController(controllerId, robotId);
      toast.success("Controller paired successfully");
      addTerminalLine(`$ Paired controller to robot`);
      setPairingControllerId(null); // Close pairing UI after successful pair
      setTimeout(async () => {
        await fetchControllers();
        await fetchRobots();
      }, 200); // Add a small delay to allow backend to update
    } catch (error) {
      console.error("[App] Failed to pair controller:", error);
      toast.error("Failed to pair controller");
    }
  };

  const handleStartPairing = (controllerId: string) => {
    console.log("[App] START PAIRING - Opening pairing UI for:", controllerId);
    setPairingControllerId(controllerId);
  };

  const handleCancelPairing = () => {
    console.log("[App] CANCEL PAIRING - Closing pairing UI");
    setPairingControllerId(null);
  };

  const handleUnpairController = async (controllerId: string) => {
    try {
      await apiService.unpairController(controllerId);
      toast.success("Controller unpaired");
      addTerminalLine(`$ Unpaired controller`);
      setTimeout(async () => {
        await fetchControllers();
        await fetchRobots();
      }, 200); // Add a small delay to allow backend to update
    } catch (error) {
      console.error("[App] Failed to unpair controller:", error);
      toast.error("Failed to unpair controller");
    }
  };

  const handleEnableController = async (controllerId: string) => {
    try {
      await apiService.enableController(controllerId);
      toast.success("Controller enabled");
      addTerminalLine(`$ Controller enabled`);
      await fetchControllers();
    } catch (error) {
      console.error("[App] Failed to enable controller:", error);
      toast.error("Failed to enable controller");
    }
  };

  const handleDisableController = async (controllerId: string) => {
    try {
      await apiService.disableController(controllerId);
      toast.info("Controller disabled");
      addTerminalLine(`$ Controller disabled`);
      await fetchControllers();
    } catch (error) {
      console.error("[App] Failed to disable controller:", error);
      toast.error("Failed to disable controller");
    }
  };

  const handleRefreshControllers = async () => {
    try {
      toast.info("Scanning for controllers...");
      addTerminalLine("$ Refreshing controller list...");
      await apiService.refreshControllers();

      // Wait a bit for detection, then fetch
      setTimeout(async () => {
        await fetchControllers();
        addTerminalLine("$ Controller scan complete");
      }, 1000);
    } catch (error) {
      console.error("[App] Failed to refresh controllers:", error);
      toast.error("Failed to refresh controllers");
    }
  };

  return (
    <div className="min-h-screen p-6">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <div className="mb-6 backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/50">
              <Activity className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-cyan-400">Robot Control Station</h1>
              <p className="text-sm text-gray-300">Advanced Driver Interface v3.2.1</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-gray-300">System Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Robots & Controllers */}
        <div className="col-span-3 h-[calc(100vh-180px)] min-h-0 flex flex-col gap-6">
          <div className="flex-1 min-h-0">
            <ConnectionPanel
              robots={robots}
              selectedRobots={selectedRobots}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onRefresh={handleRefresh}
              onDisable={handleDisable}
              onToggleSelection={handleToggleRobotSelection}
            />
          </div>
          <div className="h-64 min-h-0">
            <ControllersPanel
              controllers={controllers}
              robots={robots.map((r) => ({ id: r.id, name: r.name }))}
              onPair={handlePairController}
              onUnpair={handleUnpairController}
              onEnable={handleEnableController}
              onDisable={handleDisableController}
              onRefresh={handleRefreshControllers}
              pairingControllerId={pairingControllerId}
              onStartPairing={handleStartPairing}
              onCancelPairing={handleCancelPairing}
            />
          </div>
        </div>

        {/* Center Column */}
        <div className="col-span-6 flex flex-col gap-6 h-[calc(100vh-180px)] min-h-0">
          {/* Network Analysis */}
          <div className="h-64 min-h-0 shrink-0">
            <NetworkAnalysis data={networkData} />
          </div>

          {/* Terminal Monitor */}
          <div className="flex-1 min-h-0">
            <TerminalMonitor lines={terminalLines} />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-3 flex flex-col gap-6 h-[calc(100vh-180px)] min-h-0">
          {/* Control Panel */}
          <div className="shrink-0">
            <ControlPanel onEmergencyStop={handleEmergencyStop} emergencyActive={emergencyActive} />
          </div>

          {/* Service Log */}
          <div className="flex-1 min-h-0">
            <ServiceLog logs={logs} onClear={handleClearLogs} />
          </div>
        </div>
      </div>
    </div>
  );
}
