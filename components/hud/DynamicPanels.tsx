"use client";

import React from "react";
import { useNeoHUD } from "./NeoHUDContext";
import { AlertTriangle, Activity, Zap, ActivitySquare } from "lucide-react";

export function StatusPanel({ data }: { data: any }) {
  if (!data || !data.data) return null;
  const { name, temperature, vibration, healthScore, status } = data.data;

  return (
    <div className="glass-card bg-slate-900/60 p-5 rounded-2xl border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-xl w-80">
      <div className="flex items-center justify-between mb-4 border-b border-cyan-500/20 pb-2">
        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent uppercase tracking-wider">{name}</h2>
        <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
          status === 'Critical' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 
          status === 'Warning' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 
          'bg-cyan-500/20 text-cyan-500 border border-cyan-500/50'
        }`}>
          {status}
        </span>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-500"/> Temperature</span>
          <span className="text-slate-100 font-mono font-medium">{temperature?.toFixed(1) || 0}°C</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400 flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-500"/> Vibration</span>
          <span className="text-slate-100 font-mono font-medium">{vibration?.toFixed(2) || 0} mm/s</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400 flex items-center gap-2"><ActivitySquare className="w-4 h-4 text-cyan-500"/> Health</span>
          <span className="text-slate-100 font-mono font-medium">{healthScore}%</span>
        </div>
      </div>
    </div>
  );
}

export function TrendGraph({ data }: { data: any }) {
  // Simplistic representation if recharts is missing, using CSS for the wow factor
  // In a real app we'd load Recharts here
  return (
    <div className="glass-card bg-slate-900/60 p-5 rounded-2xl border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-xl w-[400px]">
       <h3 className="text-sm font-semibold text-cyan-400 mb-4 uppercase tracking-widest border-b border-cyan-500/20 pb-2">Diagnostic Trend Waveform</h3>
       <div className="h-32 flex items-end justify-between gap-1">
          {[40, 65, 50, 78, 85, 60, 90, 70, 80, 50].map((val, i) => (
             <div 
               key={i} 
               className="w-full bg-gradient-to-t from-cyan-600 to-cyan-300 rounded-t-sm"
               style={{ height: `${val}%`, opacity: 0.5 + (0.5 * (i/10)) }}
             />
          ))}
       </div>
    </div>
  );
}

export function AlertPanel({ data }: { data: any }) {
  if (!data || !data.data) return null;
  const { name, status } = data.data;

  return (
    <div className="glass-card bg-red-950/60 p-5 rounded-2xl border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] backdrop-blur-xl w-96 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-red-500/20 rounded-full">
           <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div>
           <h3 className="text-base font-bold text-red-500 uppercase tracking-widest mb-1">Critical Anomaly</h3>
           <p className="text-sm text-red-200">System <span className="font-bold text-white">{name}</span> is currently in <span className="font-bold text-white">{status}</span> status. Immediate action required to prevent catastrophic failure.</p>
        </div>
      </div>
    </div>
  );
}

export function PredictionPanel({ data }: { data: any }) {
  if (!data || !data.data) return null;
  // Compute risk score or dummy prediction
  const tempRisk = Math.max(0, data.data.temperature - 60) * 2;
  const vibRisk = Math.max(0, data.data.vibration - 2.0) * 10;
  const days = Math.max(1, Math.floor(10 - ((tempRisk + vibRisk) / 10)));
  
  return (
    <div className="glass-card bg-fuchsia-950/40 p-5 rounded-2xl border border-fuchsia-500/50 shadow-[0_0_25px_rgba(217,70,239,0.2)] backdrop-blur-xl w-80">
      <h3 className="text-sm font-semibold text-fuchsia-400 mb-2 uppercase tracking-widest border-b border-fuchsia-500/20 pb-2">Predictive Analysis</h3>
      <div className="flex flex-col gap-2">
         <span className="text-3xl font-bold bg-gradient-to-br from-fuchsia-400 to-purple-600 bg-clip-text text-transparent">~{days} Days</span>
         <span className="text-xs text-fuchsia-200 uppercase tracking-wider">Estimated Time to Failure</span>
      </div>
      <div className="mt-4 w-full h-1 bg-fuchsia-950 rounded overflow-hidden">
         <div className="h-full bg-fuchsia-500" style={{ width: `${100 - (days * 10)}%` }} />
      </div>
    </div>
  );
}

export function CompareView({ data }: { data: any }) {
  if (!data || !Array.isArray(data.data)) return null;

  return (
    <div className="flex gap-6 w-full max-w-4xl justify-center">
      {data.data.map((machine: any) => (
        <StatusPanel key={machine.id} data={{ data: machine }} />
      ))}
    </div>
  );
}

export function ErrorPanel() {
  return (
    <div className="glass-card bg-yellow-950/60 p-5 rounded-2xl border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] backdrop-blur-xl flex items-center gap-3">
       <AlertTriangle className="w-5 h-5 text-yellow-500 animate-pulse" />
       <span className="text-sm font-medium text-yellow-200 tracking-wide">⚠ Unable to retrieve matching machine data or parameters in current context.</span>
    </div>
  );
}

export function AIExplanationPanel() {
  const { analysis } = useNeoHUD();
  if (!analysis) return null;

  return (
    <div className="glass-card bg-slate-900/40 p-4 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] backdrop-blur-md w-72">
      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2 border-b border-blue-500/20 pb-1">AI Reasoning</h3>
      <div className="text-sm text-slate-300">
         Detected Intent: <span className="font-mono text-cyan-300">{analysis.intent}</span>
         <ul className="mt-2 text-xs text-slate-400 space-y-1 list-disc list-inside">
            {analysis.actionPlan.map((step, i) => (
               <li key={i}>{step}</li>
            ))}
         </ul>
      </div>
    </div>
  );
}
