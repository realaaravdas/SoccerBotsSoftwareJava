import { useEffect, useState } from "react";

interface NetworkSpeedometerProps {
  download: number; // MB/s
  upload: number;   // MB/s
}

export function NetworkSpeedometer({ download, upload }: NetworkSpeedometerProps) {
  const [downloadAngle, setDownloadAngle] = useState(0);
  const [uploadAngle, setUploadAngle] = useState(0);

  useEffect(() => {
    // Convert speed (0-100 MB/s) to angle (-90 to 90 degrees)
    // -90 = 0 MB/s, 90 = 100 MB/s
    const speedToAngle = (speed: number) => {
      const clampedSpeed = Math.max(0, Math.min(100, speed));
      return (clampedSpeed / 100) * 180 - 90;
    };

    setDownloadAngle(speedToAngle(download));
    setUploadAngle(speedToAngle(upload));
  }, [download, upload]);

  const Speedometer = ({ value, angle, label, color }: { value: number; angle: number; label: string; color: string }) => (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-20 mb-2">
        {/* Arc background */}
        <svg className="absolute inset-0" viewBox="0 0 100 60" preserveAspectRatio="xMidYMax meet">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="126"
            strokeDashoffset={126 - (126 * (angle + 90)) / 180}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        
        {/* Needle */}
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <div
            className="absolute w-1 h-10 origin-bottom"
            style={{
              background: `linear-gradient(to top, ${color}, transparent)`,
              transform: `rotate(${angle}deg)`,
              transition: 'transform 0.5s ease-out',
            }}
          />
          <div className={`absolute w-3 h-3 rounded-full`} style={{ backgroundColor: color }} />
        </div>
      </div>
      
      {/* Value display */}
      <div className="text-center">
        <div className={`text-2xl font-bold`} style={{ color }}>
          {value.toFixed(1)}
        </div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-4">
      <h2 className="text-cyan-400 mb-4">Network Speed</h2>
      <div className="flex justify-around items-center h-[calc(100%-3rem)]">
        <Speedometer value={download} angle={downloadAngle} label="Download (MB/s)" color="#06b6d4" />
        <Speedometer value={upload} angle={uploadAngle} label="Upload (MB/s)" color="#8b5cf6" />
      </div>
    </div>
  );
}
