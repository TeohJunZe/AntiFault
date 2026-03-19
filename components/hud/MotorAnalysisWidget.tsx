"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import CircularProgress from "./CircularProgress";
import { Zap } from "lucide-react";

export default function MotorAnalysisWidget() {
  const { neoState, isHUDVisible, currentIntent } = useNeoHUD();
  
  if (!isHUDVisible || currentIntent !== "motor_analysis") return null;

  return (
    <div className="absolute top-6 left-6 w-[400px] p-4 text-cyan-50 font-mono text-xs">
      
      {/* Widget Header */}
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="absolute -left-4 top-1/2 w-3 border-t-2 border-yellow-500/50"></div>
        <Zap className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_#facc15]" />
        <span className="text-yellow-400 text-sm font-bold tracking-[0.2em] font-orbitron drop-shadow-[0_0_5px_#facc15]">
          MOTOR ANALYSIS
        </span>
        <div className="flex-1 border-t border-yellow-500/30"></div>
      </div>

      <div className="flex gap-8 items-start">
        
        {/* Circular Gauges */}
        <div className="flex flex-col gap-6 relative">
          <div className="absolute left-1/2 top-10 bottom-10 w-[1px] bg-yellow-500/20 -z-10"></div>
          
          <CircularProgress 
            value={85} 
            size={100} 
            label="TORQUE LOAD" 
            color="text-yellow-400" 
            trackColor="text-yellow-900/40"
          />
          <CircularProgress 
            value={72} 
            size={80} 
            label="TEMP (C)" 
            color="text-orange-400" 
            trackColor="text-orange-900/40"
          />
        </div>

        {/* Floating Data Readouts */}
        <div className="flex-1 space-y-4 pt-2">
          
          <div className="border-l-2 border-yellow-500/50 pl-3">
            <div className="text-[10px] text-yellow-500/80 tracking-widest mb-1 uppercase">Target Component</div>
            <div className="text-lg font-bold text-yellow-100 drop-shadow-[0_0_5px_currentColor]">
              Press-02 Main Drive
            </div>
          </div>

          <div className="border-l-2 border-yellow-500/50 pl-3">
            <div className="text-[10px] text-yellow-500/80 tracking-widest mb-1 uppercase">Performance Trend</div>
            <div className="flex items-end gap-1 h-8 mt-2">
              {[40, 45, 60, 55, 70, 85].map((val, i) => (
                <div 
                  key={i} 
                  className={`w-2 ${i === 5 ? 'bg-orange-400 drop-shadow-[0_0_4px_#fb923c]' : 'bg-yellow-500/40'}`}
                  style={{ height: `${val}%` }}
                ></div>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-orange-500/50 pl-3">
            <div className="text-[10px] text-orange-500/80 tracking-widest mb-1 uppercase">AI Insight</div>
            <div className="text-sm text-orange-200">
              Torque load spike detected. Recommend checking lubrication parameters.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
