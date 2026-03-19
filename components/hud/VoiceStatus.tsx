"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import { Mic, Volume2 } from "lucide-react";

export default function VoiceStatus() {
  const { neoState, isHUDVisible, currentResponseToken, isChatOpen } = useNeoHUD();
  if (!isHUDVisible) return null;

  return (
    <div className={`absolute bottom-6 transition-all duration-500 ease-in-out ${isChatOpen ? 'right-[26rem]' : 'right-28'} w-[350px] p-4 text-fuchsia-100 font-mono text-xs`}>
      {/* Widget Header */}
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="flex-1 border-t border-fuchsia-500/30"></div>
        <span className="text-fuchsia-400 text-sm font-bold tracking-[0.2em] font-orbitron drop-shadow-[0_0_5px_#e879f9] uppercase">
          VOICE ENGINE
        </span>
        {neoState === "speaking" ? (
          <Volume2 className="w-5 h-5 text-fuchsia-400 animate-pulse drop-shadow-[0_0_8px_#e879f9]" />
        ) : (
          <Mic className="w-5 h-5 text-fuchsia-400 drop-shadow-[0_0_8px_#e879f9]" />
        )}
        <div className="absolute right-[-16px] top-1/2 w-3 border-t-2 border-fuchsia-500/50"></div>
      </div>

      <div className="space-y-4">
        {/* User Voice Waveform */}
        <div>
          <span className={`text-[10px] uppercase font-bold tracking-widest ${neoState === "listening" ? "text-fuchsia-300 animate-pulse" : "text-fuchsia-500/50"}`}>
            🎤 USER INPUT
          </span>
          <div className="h-6 flex items-end gap-1 mt-1 opacity-70">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className={`w-1 bg-fuchsia-400 rounded-t-sm transition-all duration-300 ${neoState === "listening" ? "animate-[bounce_1s_infinite]" : "h-1 opacity-30"}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              ></div>
            ))}
          </div>
        </div>

        {/* Neo Output Waveform */}
        <div>
          <span className={`text-[10px] uppercase font-bold tracking-widest flex justify-between ${neoState === "speaking" ? "text-cyan-300 animate-pulse" : "text-cyan-500/50"}`}>
            <span>🔊 NEO RESPONSE STREAMING</span>
            {neoState === "speaking" && <span className="text-cyan-200 truncate ml-2 max-w-[120px]">"{currentResponseToken}"</span>}
          </span>
          <div className="h-8 flex items-end gap-1 mt-1 opacity-80">
            {[...Array(25)].map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 bg-cyan-400 rounded-t-sm transition-all duration-[50ms] ${neoState === "speaking" ? "animate-[pulse_0.4s_infinite]" : "h-1 opacity-30"}`}
                style={{ 
                  height: neoState === "speaking" ? `${Math.random() * 100 + 20}%` : "4px",
                  animationDelay: `${Math.random() * 0.5}s` 
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
