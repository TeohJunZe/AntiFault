'use client'

import React from 'react';

export function HUDBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#020617]">
      {/* Radial Gradient overlay to fade edges to dark */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#020617_80%)] mix-blend-multiply z-10" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 z-0 opacity-10" 
           style={{
             backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }} 
      />

      {/* Scanning Line Animation */}
      <div className="absolute inset-x-0 h-1 bg-cyan-500/30 z-20 animate-[scan_4s_linear_infinite] shadow-[0_0_20px_theme(colors.cyan.500)]" />

      {/* Internal CSS for the scan animation since Tailwind arbitrary keyframes are sometimes tricky without config */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: -10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
      `}} />
    </div>
  );
}
