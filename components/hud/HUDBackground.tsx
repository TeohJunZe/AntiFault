"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useNeoHUD } from "./NeoHUDContext";

export default function HUDBackground() {
  const { isHUDVisible } = useNeoHUD();
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isHUDVisible) return;
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.2) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isHUDVisible]);

  if (!isHUDVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-40 mix-blend-screen">
      {/* Massive subtle background ring */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] border-[1px] border-cyan-500/10 rounded-full"
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
          <div className="absolute top-0 left-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
          <div className="absolute left-0 top-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]"></div>

      {/* Scanning scanning line (Radar effect) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-[scan_8s_linear_infinite]"></div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-10vh); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
      `}} />
    </div>
  );
}
