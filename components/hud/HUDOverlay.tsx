'use client'

import React, { useEffect, useState } from 'react';
import { useNeoHUD } from './NeoHUDContext';
import { HUDBackground } from './HUDBackground';
import { AICore } from './AICore';
import { PANEL_MAP } from './DynamicPanels';
import { X, Mic, Activity, AlertCircle, Cpu, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function HUDOverlay() {
  const { isHUDVisible, setIsHUDVisible, activeUIModules, activeContextData, neoState } = useNeoHUD();
  const [logs, setLogs] = useState<string[]>(['System monitoring active...']);

  // Simulate incoming logs
  useEffect(() => {
    if (!isHUDVisible) return;
    const interval = setInterval(() => {
        setLogs(prev => {
           let n = [...prev, `[${new Date().toISOString().split('T')[1].slice(0, 8)}] Checking telemetry stream...`];
           if (n.length > 5) n.shift();
           return n;
        });
    }, 4000);
    return () => clearInterval(interval);
  }, [isHUDVisible]);

  if (!isHUDVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 font-mono text-cyan-400 overflow-hidden flex flex-col">
      <HUDBackground />
      <AICore />

      {/* Top Left: System Overview */}
      <div className="absolute top-8 left-8 z-30 w-[450px] space-y-6">
        <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-cyan-400">System Overview</h2>
            <div className="flex-1 h-[1px] bg-cyan-400/50 relative">
               <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full" />
            </div>
        </div>

        <div className="flex gap-8 pl-2">
            {/* Stacked Gauges */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-full border border-cyan-800/50 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.15)] bg-[#020617]/40 flex-shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-cyan-950" />
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="251" strokeDashoffset="220" className="text-cyan-400 transition-all duration-1000 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                        </svg>
                        <div className="text-center text-cyan-400">
                            <div className="text-xl font-bold">12%</div>
                            <div className="text-[9px] tracking-widest mt-1 uppercase">CPU Load</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-full border border-fuchsia-800/50 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.15)] bg-[#020617]/40 flex-shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-fuchsia-950" />
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="251" strokeDashoffset="138" className="text-fuchsia-500 transition-all duration-1000 filter drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                        </svg>
                        <div className="text-center text-fuchsia-500">
                            <div className="text-lg font-bold">45%</div>
                            <div className="text-[8px] tracking-widest mt-0.5 uppercase">RAM Alloc</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Status Box */}
            <div className="flex-1 space-y-6 flex flex-col justify-center border-l border-cyan-900/40 pl-6">
                <div>
                    <div className="text-[10px] uppercase tracking-widest text-cyan-600 mb-1">Anomaly Status</div>
                    <div className={`font-mono font-bold tracking-widest text-sm ${neoState === 'alert' ? 'text-red-500 animate-pulse' : 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`}>
                        {neoState === 'alert' ? 'CRITICAL ALERT' : 'ALL SYSTEMS NOMINAL'}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-widest text-cyan-600 mb-1">Active Alerts</div>
                    <div className="font-mono font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] tracking-widest text-xl">
                       {neoState === 'alert' ? '01' : '00'}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-widest text-cyan-600 mb-1">Predictive Maintenance</div>
                    <div className="text-xs text-white/60 leading-relaxed font-sans mt-0.5">
                       No immediate actions required.
                    </div>
                </div>
            </div>
        </div>

        {/* Dynamic Context Panels List */}
        <div className="mt-8 space-y-4 max-w-sm pl-4 relative">
             <AnimatePresence>
                 {activeUIModules.map((moduleName, index) => {
                     const Panel = PANEL_MAP[moduleName];
                     if (!Panel) return null;
                     return (
                         <motion.div
                           key={`${moduleName}-${index}`}
                           initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                           animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                           exit={{ opacity: 0, scale: 0.95, filter: 'blur(5px)' }}
                           transition={{ duration: 0.3, delay: index * 0.1 }}
                         >
                            <Panel data={activeContextData} />
                         </motion.div>
                     );
                 })}
             </AnimatePresence>
        </div>
      </div>

      {/* Top Right: Close Button */}
      <div className="absolute top-8 right-8 z-30">
         <button 
           onClick={() => setIsHUDVisible(false)}
           className="w-12 h-12 rounded-full border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all bg-[#0f172a]/80 backdrop-blur-md relative group"
         >
             <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
             {/* Diagonal corner hashes */}
             <div className="absolute top-1 right-1 w-2 h-[1px] bg-red-500/50 rotate-45" />
             <div className="absolute bottom-1 left-1 w-2 h-[1px] bg-red-500/50 rotate-45" />
         </button>
      </div>

      {/* Bottom Left: Event Log */}
      <div className="absolute bottom-8 left-8 z-30 w-96 space-y-4">
        <div className="flex items-center gap-2 mb-2">
            <h2 className="text-[12px] font-bold tracking-[0.3em] text-cyan-400 uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
               &gt;_ EVENT LOG
            </h2>
            <div className="flex-[0.5] h-[1px] bg-cyan-500/50" />
        </div>
        <div className="space-y-1.5 pl-6 border-l border-cyan-900/40 relative h-32 overflow-hidden flex flex-col justify-end">
             {/* Small circular 'N' icon at bottom left of the border */}
             <div className="w-4 h-4 rounded-full bg-slate-950 border border-cyan-400 flex items-center justify-center absolute -left-[8px] bottom-0 shadow-[0_0_8px_rgba(34,211,238,0.8)] text-[8px] font-bold text-cyan-400">
                 N
             </div>
             {logs.map((log, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, x: -5 }}
                   animate={{ opacity: i === logs.length - 1 ? 1 : Math.max(0.3, 1 - (logs.length - i) * 0.2), x: 0 }}
                   className={`text-[11px] font-mono ${i === logs.length - 1 ? 'text-cyan-300' : 'text-cyan-700'} tracking-wider`}
                 >
                     {log}
                 </motion.div>
             ))}
        </div>
      </div>

      {/* Bottom Right: Voice Engine */}
      <div className="absolute bottom-8 right-12 z-30 w-80">
        <div className="flex items-center justify-end gap-3 mb-4">
            <div className="flex-[0.8] h-[1px] bg-fuchsia-500/50" />
            <h2 className="text-[12px] font-bold tracking-[0.3em] text-cyan-400 uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                Voice Engine
            </h2>
            <Mic className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
        </div>
        
        <div className="space-y-4 bg-slate-950/40 backdrop-blur-sm p-4 rounded-xl border border-white/5">
            <div>
                <div className="text-[10px] uppercase tracking-widest text-fuchsia-500 mb-2 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]">
                   <div className="w-1.5 h-3 bg-fuchsia-400 animate-pulse" /> User Input 
                </div>
                <div className="text-[12px] text-fuchsia-300/70 tracking-widest border-l-2 border-fuchsia-500/30 pl-3 ml-0.5">
                   Awaiting input...
                </div>
            </div>
            
            <div className="w-full border-t border-dashed border-white/10 my-3" />

            <div>
                <div className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                   <Volume2 className="w-3 h-3 text-cyan-400" /> Neo Response Streaming 
                </div>
                <div className="text-[12px] text-cyan-300/70 tracking-widest flex items-center gap-1 border-l-2 border-cyan-400/30 pl-3 ml-0.5">
                   {Array.from({ length: 25 }).map((_, i) => (
                       <div key={i} className="w-0.5 h-2 bg-cyan-400/40 rounded-full" />
                   ))}
                </div>
            </div>
        </div>
      </div>

    </div>
  );
}
