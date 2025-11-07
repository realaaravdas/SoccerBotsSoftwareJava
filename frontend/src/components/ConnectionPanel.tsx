import { RefreshCw, Wifi, WifiOff, Ban, Power, Circle } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Checkbox } from "./ui/checkbox";

interface Controller {
  id: string;
  name: string;
  type?: string;
  number?: number;
}

interface Robot {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "connecting" | "discovered";
  ipAddress: string;
  signal?: number;
  disabled?: boolean;
  pairedControllerId?: string;
  receiving?: boolean;
}

interface ConnectionPanelProps {
  robots: Robot[];
  controllers?: Controller[];
  selectedRobots: string[];
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onRefresh: () => void;
  onDisable: (id: string) => void;
  onToggleSelection: (id: string) => void;
}

export function ConnectionPanel({ robots, controllers = [], selectedRobots, onConnect, onDisconnect, onRefresh, onDisable, onToggleSelection }: ConnectionPanelProps) {
  const getControllerName = (controllerId?: string) => {
    if (!controllerId) return null;
    const controller = controllers.find(c => c.id === controllerId);
    if (!controller) return controllerId;
    
    // Format name with number if available
    if (controller.number !== undefined && controller.number > 0) {
      return `${controller.type || "Controller"} #${controller.number}`;
    }
    return controller.name;
  };

  return (
    <div className="h-full flex flex-col backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-cyan-400">Robot Connections</h2>
          <p className="text-xs text-gray-400">{selectedRobots.length} selected</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          className="h-8 w-8 p-0 hover:bg-cyan-500/20 hover:text-cyan-400"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2">
          {robots.map((robot) => (
            <div
              key={robot.id}
              className={`backdrop-blur-sm bg-white/5 border rounded-md p-3 hover:bg-white/10 transition-all ${
                robot.disabled ? "opacity-50 border-gray-500/30" : "border-white/10"
              } ${selectedRobots.includes(robot.id) ? "ring-2 ring-cyan-500/50" : ""}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedRobots.includes(robot.id)}
                    onCheckedChange={() => onToggleSelection(robot.id)}
                    className="border-cyan-500/50"
                  />
                  {robot.disabled ? (
                    <Ban className="h-4 w-4 text-gray-400" />
                  ) : robot.status === "connected" ? (
                    <Wifi className="h-4 w-4 text-green-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-sm text-white">{robot.name}</span>
                  {robot.receiving && !robot.disabled && (
                    <Circle className="h-2 w-2 text-green-400 fill-green-400 animate-pulse" />
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    robot.disabled
                      ? "bg-gray-500/20 text-gray-300 border-gray-500/50"
                      : robot.status === "connected"
                      ? "bg-green-500/20 text-green-300 border-green-500/50"
                      : robot.status === "connecting"
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50"
                      : robot.status === "discovered"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                      : "bg-red-500/20 text-red-300 border-red-500/50"
                  }
                >
                  {robot.disabled ? "disabled" : robot.status}
                </Badge>
              </div>
              <div className="text-xs text-gray-300 mb-2">
                {robot.ipAddress}
                {robot.pairedControllerId && (
                  <span className="ml-2 text-cyan-400">
                    🎮 {getControllerName(robot.pairedControllerId)}
                  </span>
                )}
              </div>
              {robot.signal && !robot.disabled && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${robot.signal}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-300">{robot.signal}%</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => (robot.status === "connected" ? onDisconnect(robot.id) : onConnect(robot.id))}
                  disabled={robot.status === "connecting"}
                  className="flex-1 h-7 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 disabled:opacity-50"
                >
                  {robot.status === "connected" ? "Disconnect" : "Connect"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onDisable(robot.id)}
                  className={`h-7 w-7 p-0 ${
                    robot.disabled
                      ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50"
                      : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/50"
                  }`}
                >
                  {robot.disabled ? <Power className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
