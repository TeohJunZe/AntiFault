"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ContextMemory } from "@/lib/neo-engine";

export type NeoState = "idle" | "listening" | "processing" | "speaking" | "alert";

export interface SystemHealth {
  cpu: number;
  ram: number;
  disk: number;
  network: string;
}

export interface Telemetry {
  model: string;
  inferenceMode: string;
  tokensGenerated: number;
  tokensPerSec: number;
  latencyMs: number;
  confidence: number;
}

export interface AIAnalysis {
  intent: string;
  actionPlan: string[];
}

interface NeoHUDContextType {
  neoState: NeoState;
  setNeoState: (state: NeoState) => void;
  systemHealth: SystemHealth;
  setSystemHealth: (health: SystemHealth) => void;
  telemetry: Telemetry;
  setTelemetry: (t: Telemetry) => void;
  analysis: AIAnalysis | null;
  setAnalysis: (a: AIAnalysis | null) => void;
  commandLogs: string[];
  addLog: (log: string) => void;
  currentResponseToken: string;
  setCurrentResponseToken: (token: string) => void;
  isHUDVisible: boolean;
  setHUDVisible: (v: boolean) => void;
  isChatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  currentIntent: string;
  setCurrentIntent: (intent: string) => void;
  activeUIModules: string[];
  setActiveUIModules: (modules: string[]) => void;
  activeContextData: any;
  setActiveContextData: (data: any) => void;
  contextMemory: ContextMemory;
  setContextMemory: (memory: ContextMemory) => void;
  focusedMachine: string | null;
  setFocusedMachine: (m: string | null) => void;
  highlightedKeyword: string | null;
  setHighlightedKeyword: (k: string | null) => void;
}

const defaultTelemetry: Telemetry = {
  model: "llama2",
  inferenceMode: "Local",
  tokensGenerated: 0,
  tokensPerSec: 0,
  latencyMs: 0,
  confidence: 0,
};

const defaultSystemHealth: SystemHealth = {
  cpu: 12,
  ram: 45,
  disk: 55,
  network: "Stable",
};

const NeoHUDContext = createContext<NeoHUDContextType | undefined>(undefined);

export function NeoHUDProvider({ children }: { children: ReactNode }) {
  const [neoState, setNeoState] = useState<NeoState>("idle");
  const [systemHealth, setSystemHealth] = useState<SystemHealth>(defaultSystemHealth);
  const [telemetry, setTelemetry] = useState<Telemetry>(defaultTelemetry);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [commandLogs, setCommandLogs] = useState<string[]>([]);
  const [currentResponseToken, setCurrentResponseToken] = useState<string>("");
  const [isHUDVisible, setHUDVisible] = useState(false);
  const [isChatOpen, setChatOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<string>("system_overview");
  const [activeUIModules, setActiveUIModules] = useState<string[]>(["SYSTEM_OVERVIEW"]);
  const [activeContextData, setActiveContextData] = useState<any>(null);
  const [contextMemory, setContextMemory] = useState<ContextMemory>({ history: [] });
  const [focusedMachine, setFocusedMachine] = useState<string | null>(null);
  const [highlightedKeyword, setHighlightedKeyword] = useState<string | null>(null);

  const addLog = useCallback((log: string) => {
    setCommandLogs((prev) => [log, ...prev].slice(0, 10));
  }, []);

  return (
    <NeoHUDContext.Provider
      value={{
        neoState,
        setNeoState,
        systemHealth,
        setSystemHealth,
        telemetry,
        setTelemetry,
        analysis,
        setAnalysis,
        commandLogs,
        addLog,
        currentResponseToken,
        setCurrentResponseToken,
        isHUDVisible,
        setHUDVisible,
        isChatOpen,
        setChatOpen,
        currentIntent,
        setCurrentIntent,
        activeUIModules,
        setActiveUIModules,
        activeContextData,
        setActiveContextData,
        contextMemory,
        setContextMemory,
        focusedMachine,
        setFocusedMachine,
        highlightedKeyword,
        setHighlightedKeyword,
      }}
    >
      {children}
    </NeoHUDContext.Provider>
  );
}

export function useNeoHUD() {
  const context = useContext(NeoHUDContext);
  if (context === undefined) {
    throw new Error("useNeoHUD must be used within a NeoHUDProvider");
  }
  return context;
}
