import { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Trash2, Terminal, FileText } from "lucide-react";
import { useEffect, useRef } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
}

interface MonitorTabsProps {
  terminalLines: string[];
  logs: LogEntry[];
  onClearLogs: () => void;
}

export function MonitorTabs({ terminalLines, logs, onClearLogs }: MonitorTabsProps) {
  const [activeTab, setActiveTab] = useState<"terminal" | "logs">("terminal");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when content changes
    if (activeTab === "terminal" && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (activeTab === "logs" && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLines, logs, activeTab]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "success":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
    }
  };

  return (
    <div className="h-full backdrop-blur-md bg-black/30 border border-white/10 rounded-lg p-4 flex flex-col overflow-hidden">
      {/* Tab buttons and header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === "terminal"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-medium">Terminal</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === "logs"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Service Log</span>
            {logs.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-cyan-500/30 text-cyan-300">
                {logs.length}
              </span>
            )}
          </button>
        </div>
        {activeTab === "logs" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearLogs}
            className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "terminal" ? (
          <div className="h-full backdrop-blur-sm bg-black/40 border border-white/10 rounded-md p-4 font-mono text-sm overflow-hidden">
            <ScrollArea className="h-full terminal-scroll">
              <div className="space-y-1">
                {terminalLines.map((line, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-cyan-500/50 select-none">{index + 1}</span>
                    <span className="text-green-400">{line}</span>
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div ref={scrollContainerRef} className="space-y-2 pr-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-md p-3 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <Badge variant="outline" className={getLevelColor(log.level)}>
                      {log.level}
                    </Badge>
                    <span className="text-xs text-gray-400">{log.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-200">{log.message}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
