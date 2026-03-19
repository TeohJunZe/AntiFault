'use client'

import React from 'react';
import { useNeoHUD } from './NeoHUDContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Activity, AlertCircle, TrendingDown, Server, Cpu, HardDrive } from 'lucide-react';
import { Machine } from '@/lib/data';

// --- Base Panel Wrapper ---
function HUDPanel({ title, children, className = '', highlight = false }: { title: string, children: React.ReactNode, className?: string, highlight?: boolean }) {
  return (
    <div className={`bg-[#020617]/70 backdrop-blur-xl border ${highlight ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-cyan-900/50 shadow-[0_0_20px_rgba(6,182,212,0.1)]'} rounded-xl p-5 relative overflow-hidden ${className}`}>
      {/* Decorative corners */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t-[2px] border-l-[2px] ${highlight ? 'border-red-500' : 'border-cyan-500'}`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t-[2px] border-r-[2px] ${highlight ? 'border-red-500' : 'border-cyan-500'}`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-[2px] border-l-[2px] ${highlight ? 'border-red-500' : 'border-cyan-500'}`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-[2px] border-r-[2px] ${highlight ? 'border-red-500' : 'border-cyan-500'}`} />
      
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-4">
        <h3 className={`text-xs font-bold uppercase tracking-widest ${highlight ? 'text-red-400' : 'text-cyan-400'}`}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

// --- Specific Panels ---

export function StatusPanel({ data }: { data: any }) {
  if (!data) return null;
  const healthColor = data.healthIndex > 80 ? 'text-green-400' : data.healthIndex > 50 ? 'text-yellow-400' : 'text-red-500';

  return (
    <HUDPanel title="Machine Status">
      <div className="space-y-4">
        <div>
          <div className="text-[10px] text-cyan-600 uppercase tracking-widest">Target ID</div>
          <div className="text-xl font-mono text-white tracking-widest">{data.name}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0f172a]/50 p-3 rounded-lg border border-cyan-950/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">Health Index</div>
              <div className={`text-2xl font-bold font-mono ${healthColor}`}>{data.healthIndex}%</div>
            </div>
            <div className="bg-[#0f172a]/50 p-3 rounded-lg border border-cyan-950/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">RUL (Days)</div>
              <div className="text-2xl font-bold font-mono text-white">{data.rul}</div>
            </div>
        </div>

        {data.sensorHistory && data.sensorHistory.length > 0 && (
          <div className="mt-2 text-xs font-mono text-cyan-200">
             Temp: {data.sensorHistory[data.sensorHistory.length - 1].temperature.toFixed(1)}°C <br/>
             Vib: {data.sensorHistory[data.sensorHistory.length - 1].vibration.toFixed(2)} mm/s
          </div>
        )}
      </div>
    </HUDPanel>
  );
}

export function AlertPanel({ data }: { data: any }) {
  return (
    <HUDPanel title="CRITICAL ALERT" highlight>
       <div className="flex items-start gap-4 animate-pulse">
         <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
         <div>
           <div className="text-red-400 font-bold tracking-widest uppercase mb-1">Anomaly Detected</div>
           <div className="text-sm text-red-200/70 font-mono">
             {data?.name || "Unknown"} is exhibiting critical failure patterns. Immediate maintenance required.
           </div>
         </div>
       </div>
    </HUDPanel>
  );
}

export function PredictionPanel({ data }: { data: any }) {
  return (
    <HUDPanel title="Predictive Analysis">
       <div className="flex items-center gap-4">
         <TrendingDown className="w-8 h-8 text-fuchsia-400 opacity-70" />
         <div>
            <div className="text-fuchsia-400 font-mono text-2xl font-bold">{data?.rul || '--'} DAYS</div>
            <div className="text-xs text-fuchsia-200/50 uppercase tracking-widest">Estimated Time to Failure</div>
         </div>
       </div>
    </HUDPanel>
  );
}

export function ErrorPanel() {
  return (
    <HUDPanel title="System Error">
       <div className="flex items-center gap-3 text-yellow-500">
         <AlertCircle className="w-5 h-5" />
         <span className="font-mono text-sm">Unable to resolve target parameters. Please specify machine.</span>
       </div>
    </HUDPanel>
  );
}

export function TrendGraph({ data }: { data: any }) {
    return (
        <HUDPanel title="Telemetry Stream">
            <div className="h-24 flex items-end gap-1 opacity-80">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-full bg-cyan-500/50 rounded-t-sm transition-all duration-300"
                      style={{ height: `${Math.random() * 100}%` }}
                    />
                ))}
            </div>
        </HUDPanel>
    );
}

// Map strings to actual components
export const PANEL_MAP: Record<string, React.FC<{ data: any }>> = {
  STATUS_PANEL: StatusPanel,
  ALERT_PANEL: AlertPanel,
  PREDICTION_PANEL: PredictionPanel,
  ERROR_PANEL: ErrorPanel,
  TREND_GRAPH: TrendGraph,
  // others like COMPARE_VIEW can map to a combination
};
