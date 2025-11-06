import { Activity, AlertTriangle, Pause } from "lucide-react";
import { Badge } from "./ui/badge";

interface GameStatusProps {
  status: "standby" | "active" | "e-stop";
  robotCount?: number;
  activeRobots?: number;
}

export function GameStatus({ status, robotCount = 0, activeRobots = 0 }: GameStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "active":
        return {
          icon: Activity,
          color: "text-green-400",
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/50",
          label: "Active",
          description: "System operational",
        };
      case "e-stop":
        return {
          icon: AlertTriangle,
          color: "text-red-400",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/50",
          label: "Emergency Stop",
          description: "All operations halted",
        };
      default: // standby
        return {
          icon: Pause,
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/50",
          label: "Standby",
          description: "Waiting for activation",
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-3">
      <h2 className="text-cyan-400 mb-2 text-xs font-semibold">Game Status</h2>
      
      <div className="flex flex-col gap-2">
        {/* Compact status indicator */}
        <div className={`flex items-center gap-2 p-2 rounded-md ${config.bgColor} border ${config.borderColor}`}>
          <StatusIcon className={`h-4 w-4 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold ${config.color} truncate`}>{config.label}</div>
          </div>
          <div className={`h-1.5 w-1.5 rounded-full ${config.color.replace('text-', 'bg-')} animate-pulse`} />
        </div>

        {/* Compact robot statistics */}
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-sm p-1.5">
            <div className="text-xs font-bold text-cyan-400">{robotCount}</div>
            <div className="text-[10px] text-gray-400">Total</div>
          </div>
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-sm p-1.5">
            <div className="text-xs font-bold text-green-400">{activeRobots}</div>
            <div className="text-[10px] text-gray-400">Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
