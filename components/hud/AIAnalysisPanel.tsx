"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import { Network, ArrowRight } from "lucide-react";

export default function AIAnalysisPanel() {
  const { analysis, isHUDVisible, neoState, isChatOpen } = useNeoHUD();
  
  if (!isHUDVisible) return null;
  // If there's no analysis to show and it's not processing, we can hide it or show "Standby"
  if (!analysis && neoState === "idle") return null;

  return (
    <div className={`absolute top-6 transition-all duration-500 ease-in-out ${isChatOpen ? 'right-[26rem]' : 'right-28'} w-[350px] p-4 text-indigo-100 font-mono text-xs`}>
      {/* Widget Header */}
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="flex-1 border-t border-indigo-500/30"></div>
        <span className="text-indigo-400 text-sm font-bold tracking-[0.2em] font-orbitron drop-shadow-[0_0_5px_#818cf8]">
          INTENT ANALYSIS
        </span>
        <Network className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_#818cf8]" />
        <div className="absolute right-[-16px] top-1/2 w-3 border-t-2 border-indigo-500/50"></div>
      </div>

      {neoState === "processing" && !analysis ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-indigo-500/20 rounded w-3/4"></div>
          <div className="h-4 bg-indigo-500/20 rounded w-1/2"></div>
          <div className="h-4 bg-indigo-500/20 rounded w-5/6"></div>
          <span className="text-indigo-500 mt-2 block">Extracting context...</span>
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          <div>
            <div className="text-indigo-500/70 mb-1 uppercase text-[10px] tracking-widest">Detected Intent</div>
            <div className="text-indigo-200 font-bold border border-indigo-500/30 bg-indigo-500/10 p-2 rounded">
              {analysis.intent}
            </div>
          </div>
          
          <div>
            <div className="text-indigo-500/70 mb-1 uppercase text-[10px] tracking-widest">Execution Plan</div>
            <div className="space-y-1">
              {analysis.actionPlan.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start text-indigo-300">
                  <ArrowRight className="w-3 h-3 text-indigo-500 mt-0.5 shrink-0" />
                  <span className="leading-tight">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
