import { AlertTriangle, Play, Pause, RotateCcw, Plus, Minus, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { toast } from "sonner";

interface ControlPanelProps {
  onEmergencyStop: () => void;
  emergencyActive: boolean;
}

export function ControlPanel({ onEmergencyStop, emergencyActive }: ControlPanelProps) {
  const [matchDuration, setMatchDuration] = useState(120); // Match duration in seconds
  const [timeRemaining, setTimeRemaining] = useState(matchDuration);
  const [isRunning, setIsRunning] = useState(false);

  // Local timer countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (isRunning && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
      toast.error("⏱️ TIME EXPIRED! Emergency stop activated. Press E-STOP button to release.", {
        duration: 10000, // Show for 10 seconds
      });
      apiService.activateEmergencyStop(); // Activate emergency stop when timer runs out
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isRunning, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartStop = () => {
    if (isRunning) {
      setIsRunning(false);
      toast.info("Match stopped");
    } else {
      setIsRunning(true);
      toast.success("Match started!");
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeRemaining(matchDuration);
    toast.info("Match reset");
  };

  const adjustDuration = (seconds: number) => {
    if (isRunning) {
      toast.warning("Cannot adjust duration while match is running");
      return;
    }

    const newDuration = Math.max(1, matchDuration + seconds);
    setMatchDuration(newDuration);
    toast.success(`Duration set to ${formatTime(newDuration)}`);
  };

  return (
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-3 flex flex-col overflow-hidden">
      <h2 className="text-cyan-400 mb-2 text-xs font-semibold shrink-0">Control Panel</h2>
      
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
      {/* Compact Timer */}
      <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-2">
        <div className="text-center">
          <div className="text-[10px] text-gray-300 mb-1">Match Timer</div>
          <div className="text-xl font-mono text-cyan-400 mb-1">{formatTime(timeRemaining)}</div>
        </div>

        {/* Compact Timer Controls */}
        <div className="flex gap-1 mb-2">
          <Button
            size="sm"
            onClick={handleStartStop}
            className="flex-1 h-7 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 p-0"
          >
            {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            onClick={handleReset}
            className="h-7 w-7 p-0 bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        {/* Compact Duration Adjustment */}
        {!isRunning && (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 mb-1">
              <Clock className="h-2.5 w-2.5" />
              <span>Adjust</span>
            </div>

            {/* Minutes adjustment */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 w-8">Min:</span>
              <Button
                size="sm"
                onClick={() => adjustDuration(-60)}
                disabled={matchDuration <= 60}
                className="flex-1 h-6 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 disabled:opacity-30 p-0"
              >
                <Minus className="h-2.5 w-2.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => adjustDuration(60)}
                className="flex-1 h-6 text-[10px] bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 p-0"
              >
                <Plus className="h-2.5 w-2.5" />
              </Button>
            </div>

            {/* Seconds adjustment */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 w-8">Sec:</span>
              <Button
                size="sm"
                onClick={() => adjustDuration(-10)}
                disabled={matchDuration <= 10}
                className="flex-1 h-6 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 disabled:opacity-30 p-0"
              >
                <Minus className="h-2.5 w-2.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => adjustDuration(10)}
                className="flex-1 h-6 text-[10px] bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 p-0"
              >
                <Plus className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Compact Emergency Stop */}
      <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-2">
        <div className="text-center mb-1">
          <div className="text-[10px] text-gray-300">Emergency</div>
        </div>
        <Button
          size="sm"
          onClick={onEmergencyStop}
          className={`w-full h-12 transition-all text-xs ${
            emergencyActive
              ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/50 animate-pulse"
              : "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-2 border-red-500/50"
          }`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] font-semibold">E-STOP</span>
          </div>
        </Button>
        {emergencyActive && (
          <div className="mt-1 text-center text-red-400 text-[10px] animate-pulse">
            ⚠️ Active
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
