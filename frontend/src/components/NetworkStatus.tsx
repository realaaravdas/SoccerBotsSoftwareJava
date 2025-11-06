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
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-4">
      <h2 className="text-cyan-400 mb-3 text-sm">Network Status</h2>
      
      <div className="flex flex-col gap-3 h-[calc(100%-2rem)]">
        {/* Status indicator */}
        <div className={`flex items-center gap-2 p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
          <StatusIcon className={`h-6 w-6 ${config.color}`} />
          <div className="flex-1">
            <div className={`text-sm font-semibold ${config.color}`}>{config.label}</div>
            <div className="text-xs text-gray-400">{config.description}</div>
          </div>
          <div className={`h-2 w-2 rounded-full ${config.dotColor} ${connected ? 'animate-pulse' : ''}`} />
        </div>

        {/* Network metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-2">
            <div className="text-xs text-gray-400 mb-1">Download</div>
            <div className="text-lg font-bold text-cyan-400">{download.toFixed(1)}</div>
            <div className="text-xs text-gray-500">MB/s</div>
          </div>
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-2">
            <div className="text-xs text-gray-400 mb-1">Upload</div>
            <div className="text-lg font-bold text-purple-400">{upload.toFixed(1)}</div>
            <div className="text-xs text-gray-500">MB/s</div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className={`${config.bgColor} ${config.color} ${config.borderColor} px-3 py-1 text-xs`}
          >
            {connected ? (isGood ? "Optimal" : "Degraded") : "Offline"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
