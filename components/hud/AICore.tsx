'use client'

import React from 'react';
import { useNeoHUD } from './NeoHUDContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function AICore() {
  const { neoState } = useNeoHUD();
  
  // State-based visual configurations
  const config = {
    idle: {
      color: 'border-cyan-800 shadow-cyan-900/40',
      spinOuter: 'animate-[spin_20s_linear_infinite]',
      spinInner: 'animate-[spin_15s_linear_infinite_reverse]',
      glow: 'shadow-[0_0_20px_theme(colors.cyan.800)]',
      pulse: ''
    },
    listening: {
      color: 'border-cyan-400 shadow-cyan-400/80',
      spinOuter: 'animate-[spin_10s_linear_infinite]',
      spinInner: 'animate-[spin_8s_linear_infinite_reverse]',
      glow: 'shadow-[0_0_50px_theme(colors.cyan.400)] text-cyan-500',
      pulse: 'animate-pulse'
    },
    processing: {
      color: 'border-fuchsia-500 shadow-fuchsia-500/80',
      spinOuter: 'animate-[spin_4s_linear_infinite]',
      spinInner: 'animate-[spin_3s_linear_infinite_reverse]',
      glow: 'shadow-[0_0_60px_theme(colors.fuchsia.500)] text-fuchsia-500',
      pulse: 'animate-pulse'
    },
    speaking: {
      color: 'border-blue-500 shadow-blue-500/80',
      spinOuter: 'animate-[spin_12s_linear_infinite]',
      spinInner: 'animate-[spin_10s_linear_infinite_reverse]',
      glow: 'shadow-[0_0_40px_theme(colors.blue.500)] text-blue-500',
      pulse: ''
    },
    alert: {
      color: 'border-red-600 shadow-red-600/80',
      spinOuter: 'animate-[spin_8s_linear_infinite]',
      spinInner: 'animate-[spin_6s_linear_infinite_reverse]',
      glow: 'shadow-[0_0_70px_theme(colors.red.600)] text-red-600',
      pulse: 'animate-ping'
    }
  };

  const current = config[neoState] || config.idle;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 overflow-hidden">
      
      {/* Central Core */}
      <div className={cn("relative w-[600px] h-[600px] flex items-center justify-center opacity-60 transition-all duration-1000", current.glow)}>
        
        {/* Navigation Markers & Compass Scale */}
        <div className="absolute inset-0">
           {/* N and E Labels */}
           <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-cyan-600 font-mono tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
              N-00.0
           </div>
           <div className="absolute top-1/2 -right-12 -translate-y-1/2 text-[10px] text-cyan-600 font-mono tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.5)] rotate-90 origin-left">
              E-90.0
           </div>

           {/* Compass Tick Marks Ring */}
           <svg className="absolute inset-0 w-full h-full animate-[spin_60s_linear_infinite]" viewBox="0 0 600 600">
               <circle cx="300" cy="300" r="290" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-cyan-800/40" />
               {Array.from({ length: 72 }).map((_, i) => {
                   const angle = (i * 5 * Math.PI) / 180;
                   const isMajor = i % 18 === 0;
                   const rInner = isMajor ? 280 : 285;
                   const x1 = 300 + 290 * Math.cos(angle);
                   const y1 = 300 + 290 * Math.sin(angle);
                   const x2 = 300 + rInner * Math.cos(angle);
                   const y2 = 300 + rInner * Math.sin(angle);
                   return (
                       <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={isMajor ? 1.5 : 0.5} className="text-cyan-500/60" />
                   );
               })}
           </svg>
        </div>

        {/* Outer segmented ring */}
        <div className={cn("absolute inset-4 rounded-full border-[2px] border-dashed opacity-50 transition-colors duration-700", current.color, current.spinOuter)}></div>
        
        {/* Middle continuous thin ring */}
        <div className={cn("absolute inset-12 rounded-full border-[1px] opacity-30 transition-colors duration-700", current.color, current.spinInner)}></div>

        {/* Inner solid ring */}
        <div className={cn("absolute inset-24 rounded-full border-[6px] opacity-20 transition-colors duration-700", current.color, current.spinOuter)}></div>
        
        {/* Innermost pulsing core */}
        <div className={cn("absolute w-32 h-32 rounded-full blur-xl opacity-60 transition-all duration-700 delay-100 bg-current", current.color, current.pulse)}></div>
        <div className={cn("absolute w-12 h-12 rounded-full bg-current opacity-90 transition-all duration-700 shadow-2xl", current.color)}></div>
        
        {/* Crosshair lines interacting at true center */}
        <div className="absolute inset-[-100px] flex items-center justify-center opacity-40">
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyan-500/50 -translate-x-1/2"></div>
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-cyan-500/50 -translate-y-1/2"></div>
          {/* Center reticle target */}
          <div className="absolute w-20 h-20 border border-cyan-400/30 rounded-full" />
          <div className="absolute w-3 h-3 border border-cyan-300 rotate-45" />
        </div>

      </div>

    </div>
  );
}
