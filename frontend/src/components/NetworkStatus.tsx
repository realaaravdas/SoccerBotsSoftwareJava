import { Wifi, WifiOff, Signal, SignalLow } from "lucide-react";
import { Badge } from "./ui/badge";

interface NetworkStatusProps {
  download: number; // MB/s
  upload: number;   // MB/s
  connected: boolean;
}

// Network quality threshold in MB/s
const NETWORK_QUALITY_THRESHOLD = 0.1;

export function NetworkStatus({ download, upload, connected }: NetworkStatusProps) {
  // Determine overall status based on bandwidth (download/upload speeds)
  // Good: both download and upload above threshold
  // Poor: either download or upload below threshold or disconnected
  const isGood = connected && download > NETWORK_QUALITY_THRESHOLD && upload > NETWORK_QUALITY_THRESHOLD;
  
  const getStatusConfig = () => {
    if (!connected) {
      return {
        icon: WifiOff,
        color: "text-red-400",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/50",
        dotColor: "bg-red-400",
        label: "Not Connected",
        description: "Network unavailable",
      };
    } else if (isGood) {
      return {
        icon: Signal,
        color: "text-green-400",
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/50",
        dotColor: "bg-green-400",
        label: "Connected - Good",
        description: "Network optimal",
      };
    } else {
      return {
        icon: SignalLow,
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20",
        borderColor: "border-yellow-500/50",
        dotColor: "bg-yellow-400",
        label: "Connected - Poor",
        description: "Network degraded",
      };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-3">
      <h2 className="text-cyan-400 mb-2 text-xs font-semibold">Network Status</h2>
      
      <div className="flex flex-col gap-2">
        {/* Compact status indicator */}
        <div className={`flex items-center gap-2 p-2 rounded-md ${config.bgColor} border ${config.borderColor}`}>
          <StatusIcon className={`h-4 w-4 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold ${config.color} truncate`}>{config.label}</div>
          </div>
          <div className={`h-1.5 w-1.5 rounded-full ${config.dotColor} ${connected ? 'animate-pulse' : ''}`} />
        </div>

        {/* Compact network metrics */}
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-sm p-1.5">
            <div className="text-xs text-cyan-400 font-bold">{download.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400">DL MB/s</div>
          </div>
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-sm p-1.5">
            <div className="text-xs text-purple-400 font-bold">{upload.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400">UL MB/s</div>
          </div>
        </div>
      </div>
    </div>
  );
}
