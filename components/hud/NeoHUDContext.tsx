'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ContextMemory } from '@/lib/neo-engine';

export type NeoState = "idle" | "listening" | "processing" | "speaking" | "alert";

interface NeoHUDContextType {
  neoState: NeoState;
  setNeoState: (state: NeoState) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  activeUIModules: string[];
  setActiveUIModules: (modules: string[]) => void;
  activeContextData: any;
  setActiveContextData: (data: any) => void;
  contextMemory: ContextMemory;
  setContextMemory: React.Dispatch<React.SetStateAction<ContextMemory>>;
  focusedMachine: string | null;
  setFocusedMachine: (machine: string | null) => void;
  highlightedKeyword: string | null;
  setHighlightedKeyword: (keyword: string | null) => void;
  analysis: { intent: string, actionPlan: string[] } | null;
  setAnalysis: (analysis: any) => void;
}

const defaultContextMemory: ContextMemory = { history: [] };

const NeoHUDContext = createContext<NeoHUDContextType | undefined>(undefined);

export function NeoHUDProvider({ children }: { children: ReactNode }) {
  const [neoState, setNeoState] = useState<NeoState>("idle");
  const [isHUDVisible, setIsHUDVisible] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeUIModules, setActiveUIModules] = useState<string[]>([]);
  const [activeContextData, setActiveContextData] = useState<any>(null);
  const [contextMemory, setContextMemory] = useState<ContextMemory>(defaultContextMemory);
  const [focusedMachine, setFocusedMachine] = useState<string | null>(null);
  const [highlightedKeyword, setHighlightedKeyword] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  return (
    <NeoHUDContext.Provider
      value={{
        neoState, setNeoState,
        isHUDVisible, setIsHUDVisible,
        isChatOpen, setIsChatOpen,
        activeUIModules, setActiveUIModules,
        activeContextData, setActiveContextData,
        contextMemory, setContextMemory,
        focusedMachine, setFocusedMachine,
        highlightedKeyword, setHighlightedKeyword,
        analysis, setAnalysis
      }}
    >
      {children}
    </NeoHUDContext.Provider>
  );
}

export function useNeoHUD() {
  const context = useContext(NeoHUDContext);
  if (context === undefined) {
    throw new Error('useNeoHUD must be used within a NeoHUDProvider');
  }
  return context;
}
