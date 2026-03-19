import React from "react";
import SystemOverviewWidget from "./SystemOverviewWidget";
import MotorAnalysisWidget from "./MotorAnalysisWidget";
import BearingAnalysisWidget from "./BearingAnalysisWidget";
import CommandLog from "./CommandLog";
import VoiceStatus from "./VoiceStatus";
import AIAnalysisPanel from "./AIAnalysisPanel";
import AICore from "./AICore";
import { useNeoHUD } from "./NeoHUDContext";
import { X } from "lucide-react";

export function HUDOverlay() {
  const { isHUDVisible, setHUDVisible, isChatOpen, setChatOpen, activeUIModules } = useNeoHUD();

  if (!isHUDVisible) return null;

  // Derive which data widgets to show from the intent-mapped modules
  const showMotor = activeUIModules.includes("STATUS_PANEL") || activeUIModules.includes("COMPARE_VIEW");
  const showBearing = activeUIModules.includes("TREND_GRAPH") || activeUIModules.includes("PREDICTION_PANEL") || activeUIModules.includes("COMPARE_VIEW");
  const showSystem = activeUIModules.includes("SYSTEM_OVERVIEW") || activeUIModules.includes("ALERT_PANEL") || (!showMotor && !showBearing);

  return (
    <>
      {/* Background Dimming for "Jarvis Mode" */}
      <div className="fixed inset-0 bg-[#020817]/80 backdrop-blur-md z-40 pointer-events-none transition-all duration-700"></div>
      
      {/* HUD Container - Full Screen Overlay */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        
        {/* HUD Exit Button */}
        <button 
          onClick={() => {
            setHUDVisible(false);
            setChatOpen(false);
          }}
          className={`absolute top-6 transition-all duration-500 ease-in-out ${isChatOpen ? 'right-[424px]' : 'right-6'} p-3 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 rounded-full text-red-200 pointer-events-auto shadow-[0_0_15px_rgba(239,68,68,0.3)] backdrop-blur-md`}
          title="Exit HUD"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Master AI Core */}
        <AICore />

        {/* Dynamic Context-Aware Widgets — driven by activeUIModules */}
        {showSystem && <SystemOverviewWidget />}
        {showMotor && <MotorAnalysisWidget />}
        {showBearing && <BearingAnalysisWidget />}

        {/* Static HUD Elements */}
        <AIAnalysisPanel />
        <CommandLog />
        <VoiceStatus />
      </div>
    </>
  );
}

