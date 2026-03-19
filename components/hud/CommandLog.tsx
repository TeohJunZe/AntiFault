"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import { Terminal } from "lucide-react";

export default function CommandLog() {
  const { commandLogs, isHUDVisible } = useNeoHUD();
  if (!isHUDVisible) return null;

  return (
    <div className="absolute bottom-6 left-6 w-[400px] p-4 text-cyan-100 font-mono text-xs max-h-48 overflow-hidden flex flex-col justify-end">
      {/* Widget Header */}
      <div className="flex items-center gap-3 mb-4 relative">
        <div className="absolute -left-4 top-1/2 w-3 border-t-2 border-cyan-500/50"></div>
        <Terminal className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]" />
        <span className="text-cyan-400 text-sm font-bold tracking-[0.2em] font-orbitron drop-shadow-[0_0_5px_#22d3ee] uppercase">
          EVENT LOG
        </span>
        <div className="flex-1 border-t border-cyan-500/30"></div>
      </div>

      <div className="space-y-1 overflow-hidden">
        {commandLogs.length === 0 ? (
          <div className="text-blue-500/50 italic">System monitoring active...</div>
        ) : (
          commandLogs.map((log, i) => (
            <div 
              key={i} 
              className={`truncate transition-opacity duration-300 ${i === 0 ? "text-blue-200" : "text-blue-500/60"}`}
              style={{ opacity: 1 - (i * 0.15) }}
            >
              <span className="text-blue-400/50 mr-2">{">"}</span>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
