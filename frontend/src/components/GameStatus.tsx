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
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-4">
      <h2 className="text-cyan-400 mb-4">Game Status</h2>
      
      <div className="flex flex-col gap-4 h-[calc(100%-3rem)]">
        {/* Status indicator */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
          <StatusIcon className={`h-8 w-8 ${config.color}`} />
          <div className="flex-1">
            <div className={`text-lg font-semibold ${config.color}`}>{config.label}</div>
            <div className="text-xs text-gray-400">{config.description}</div>
          </div>
          <div className={`h-3 w-3 rounded-full ${config.color.replace('text-', 'bg-')} animate-pulse`} />
        </div>

        {/* Robot statistics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-3">
            <div className="text-2xl font-bold text-cyan-400">{robotCount}</div>
            <div className="text-xs text-gray-400">Total Robots</div>
          </div>
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-3">
            <div className="text-2xl font-bold text-green-400">{activeRobots}</div>
            <div className="text-xs text-gray-400">Active</div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className={`${config.bgColor} ${config.color} ${config.borderColor} px-4 py-2 text-sm`}
          >
            System {config.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
