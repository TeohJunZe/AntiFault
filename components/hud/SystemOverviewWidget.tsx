"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import CircularProgress from "./CircularProgress";
import { Activity } from "lucide-react";

export default function SystemOverviewWidget() {
  const { systemHealth, neoState, isHUDVisible, currentIntent } = useNeoHUD();
  
  if (!isHUDVisible || currentIntent !== "system_overview") return null;

  return (
    <div className="absolute top-6 left-6 w-[400px] p-4 text-cyan-50 font-mono text-xs">
      
      {/* Widget Header - Raw Vector Line Style */}
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="absolute -left-4 top-1/2 w-3 border-t-2 border-cyan-500/50"></div>
        <Activity className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]" />
        <span className="text-cyan-400 text-sm font-bold tracking-[0.2em] font-orbitron drop-shadow-[0_0_5px_#22d3ee]">
          SYSTEM OVERVIEW
        </span>
        <div className="flex-1 border-t border-cyan-500/30"></div>
      </div>

      <div className="flex gap-8 items-start">
        
        {/* Circular Gauges */}
        <div className="flex flex-col gap-6 relative">
          {/* Vertical connecting line */}
          <div className="absolute left-1/2 top-10 bottom-10 w-[1px] bg-cyan-500/20 -z-10"></div>
          
          <CircularProgress 
            value={systemHealth.cpu} 
            size={100} 
            label="CPU LOAD" 
            color="text-cyan-400" 
            trackColor="text-cyan-900/40"
          />
          <CircularProgress 
            value={systemHealth.ram} 
            size={80} 
            label="RAM ALLOC" 
            color="text-indigo-400" 
            trackColor="text-indigo-900/40"
          />
        </div>

        {/* Floating Data Readouts */}
        <div className="flex-1 space-y-4 pt-2">
          
          <div className="border-l-2 border-cyan-500/50 pl-3">
            <div className="text-[10px] text-cyan-500/80 tracking-widest mb-1 uppercase">Anomaly Status</div>
            <div className={`text-lg font-bold ${neoState === "alert" ? "text-red-400 animate-pulse" : "text-green-400 drop-shadow-[0_0_5px_currentColor]"}`}>
              {neoState === "alert" ? "CRITICAL DETECTED" : "ALL SYSTEMS NOMINAL"}
            </div>
          </div>

          <div className="border-l-2 border-cyan-500/50 pl-3">
            <div className="text-[10px] text-cyan-500/80 tracking-widest mb-1 uppercase">Active Alerts</div>
            <div className={`text-2xl font-orbitron ${neoState === "alert" ? "text-red-400" : "text-cyan-50"}`}>
              {neoState === "alert" ? "01" : "00"}
            </div>
          </div>

          <div className="border-l-2 border-cyan-500/50 pl-3">
            <div className="text-[10px] text-cyan-500/80 tracking-widest mb-1 uppercase">Predictive Maintenance</div>
            <div className="text-sm text-cyan-200">No immediate actions required.</div>
          </div>

        </div>
      </div>
    </div>
  );
}
