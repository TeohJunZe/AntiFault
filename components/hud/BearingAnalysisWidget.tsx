"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import CircularProgress from "./CircularProgress";
import { ActivitySquare } from "lucide-react";

export default function BearingAnalysisWidget() {
  const { neoState, isHUDVisible, currentIntent } = useNeoHUD();
  
  if (!isHUDVisible || currentIntent !== "vibration_analysis") return null;

  return (
    <div className="absolute top-6 left-6 w-[400px] p-4 text-cyan-50 font-mono text-xs">
      
      {/* Widget Header */}
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="absolute -left-4 top-1/2 w-3 border-t-2 border-purple-500/50"></div>
        <ActivitySquare className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_#c084fc]" />
        <span className="text-purple-400 text-sm font-bold tracking-[0.2em] font-orbitron drop-shadow-[0_0_5px_#c084fc]">
          VIBRATION ANALYSIS
        </span>
        <div className="flex-1 border-t border-purple-500/30"></div>
      </div>

      <div className="flex gap-8 items-start">
        
        {/* Circular Gauges */}
        <div className="flex flex-col gap-6 relative">
          <div className="absolute left-1/2 top-10 bottom-10 w-[1px] bg-purple-500/20 -z-10"></div>
          
          <CircularProgress 
            value={92} 
            size={100} 
            label="FREQ RANGE" 
            color="text-purple-400" 
            trackColor="text-purple-900/40"
          />
          <CircularProgress 
            value={60} 
            size={80} 
            label="RISK LEVEL" 
            color="text-pink-400" 
            trackColor="text-pink-900/40"
          />
        </div>

        {/* Floating Data Readouts */}
        <div className="flex-1 space-y-4 pt-2">
          
          <div className="border-l-2 border-purple-500/50 pl-3">
            <div className="text-[10px] text-purple-500/80 tracking-widest mb-1 uppercase">Target Component</div>
            <div className="text-lg font-bold text-purple-100 drop-shadow-[0_0_5px_currentColor]">
              Lathe-03 Bearings
            </div>
          </div>

          <div className="border-l-2 border-purple-500/50 pl-3">
            <div className="text-[10px] text-purple-500/80 tracking-widest mb-1 uppercase">Spectrum Harmonics</div>
            <div className="h-10 mt-2 relative w-full overflow-hidden flex items-end">
              <svg className="w-full h-full stroke-purple-400/80 fill-purple-900/20" preserveAspectRatio="none" viewBox="0 0 100 100">
                 <path d="M0,80 Q10,20 20,80 T40,60 T60,90 T80,10 T100,80 L100,100 L0,100 Z" />
              </svg>
            </div>
          </div>

          <div className="border-l-2 border-pink-500/50 pl-3">
            <div className="text-[10px] text-pink-500/80 tracking-widest mb-1 uppercase">Prediction Risk</div>
            <div className="text-sm text-pink-200">
              High-frequency harmonics detected. Potential outer race defect forming. 14 days estimated to failure.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
