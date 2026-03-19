"use client";

import React, { useEffect, useState } from "react";
import { useNeoHUD } from "./NeoHUDContext";
import { cn } from "@/lib/utils";

export default function AICore() {
  const { neoState, isHUDVisible } = useNeoHUD();
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isHUDVisible) return;
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isHUDVisible]);

  if (!isHUDVisible) return null;

  // Derive visual states from NeoState
  const isListening = neoState === "listening";
  const isProcessing = neoState === "processing";
  const isSpeaking = neoState === "speaking";
  const isAlert = neoState === "alert";

  const coreColorClass = isAlert
    ? "text-red-500 stroke-red-500 drop-shadow-[0_0_15px_#ef4444]"
    : isListening
    ? "text-cyan-400 stroke-cyan-400 drop-shadow-[0_0_20px_#22d3ee]"
    : isProcessing
    ? "text-fuchsia-400 stroke-fuchsia-400 drop-shadow-[0_0_15px_#e879f9]"
    : isSpeaking
    ? "text-blue-400 stroke-blue-400 drop-shadow-[0_0_25px_#60a5fa]"
    : "text-cyan-600 stroke-cyan-600 drop-shadow-[0_0_5px_#0891b2]"; // Idle

  const pulseAnimation = isSpeaking || isAlert ? "animate-pulse" : "";
  const spinSpeed = isProcessing ? 3 : isSpeaking ? 1.5 : 0.5;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      
      {/* Central Concentric Ring Container (Stark Aesthetic) */}
      <div 
        className={cn("relative transition-all duration-1000", coreColorClass)}
        style={{ width: "800px", height: "800px", transform: `rotate(${rotation * spinSpeed}deg)` }}
      >
        
        {/* Massive Outer HUD Ring */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 800 800">
          <circle cx="400" cy="400" r="390" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="10 30" />
          <circle cx="400" cy="400" r="380" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="4 8" />
        </svg>

        {/* Segmented Data Ring */}
        <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 800 800" style={{ transform: `rotate(${-rotation * spinSpeed * 1.5}deg)` }}>
          <circle cx="400" cy="400" r="300" stroke="currentColor" strokeWidth="15" fill="none" strokeDasharray="50 100 200 50" />
          <circle cx="400" cy="400" r="280" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>

        {/* Medium Navigational Ring */}
        <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 800 800" style={{ transform: `rotate(${rotation * spinSpeed * 2}deg)` }}>
          <circle cx="400" cy="400" r="200" stroke="currentColor" strokeWidth="5" fill="none" strokeDasharray="1 10" />
          <path d="M 200 400 A 200 200 0 0 1 600 400" stroke="currentColor" strokeWidth="10" fill="none" />
        </svg>

        {/* Inner Active Core Ring */}
        <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 800 800" style={{ transform: `rotate(${-rotation * spinSpeed * 3}deg)` }}>
          <circle cx="400" cy="400" r="120" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray="20 40" />
          <circle cx="400" cy="400" r="100" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="100 20" />
        </svg>

        {/* The Absolute Center "Eye" */}
        <div className="absolute inset-0 flex items-center justify-center">
             <div className={cn("w-32 h-32 rounded-full border-4 border-current bg-current/20 backdrop-blur-md flex items-center justify-center", pulseAnimation)}>
                <div className="w-16 h-16 rounded-full bg-current shadow-[0_0_30px_currentColor]"></div>
             </div>
        </div>

      </div>

      {/* Floating UI Elements (Crosshairs, Tech Lines) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-30 font-mono text-cyan-500 text-xs">
        <div className="absolute w-[1px] h-[600px] bg-cyan-500/30"></div>
        <div className="absolute w-[600px] h-[1px] bg-cyan-500/30"></div>
        
        {/* Reticles */}
        <div className="absolute flex flex-col items-center gap-1" style={{ top: 'calc(50% - 320px)' }}>
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-cyan-500/80"></div>
          <span>N-00.0</span>
        </div>
        
        <div className="absolute flex items-center gap-1" style={{ right: 'calc(50% - 340px)' }}>
          <div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-t-transparent border-b-transparent border-cyan-500/80"></div>
          <span>E-90.0</span>
        </div>
      </div>

    </div>
  );
}
