"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot,
    X,
    Send,
    Sparkles,
    AlertTriangle,
    FileText,
    Volume2,
    Mic,
    Activity,
    ChevronLeft,
    Zap,
    MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNeoHUD } from "./hud/NeoHUDContext";
import { Machine, Alert, MaintenanceTask } from '@/lib/data';
import { streamNeoRequest } from "@/lib/ai-request-manager";

// ─── TTS Helpers ────────────────────────────────────────────────
function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.name.includes('Google US English')) ||
    voices.find(v => v.lang === 'en-US' && !v.localService) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null
  );
}

function speakSentence(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
  // Many browsers need a resume() before speak() to avoid stalled state
  window.speechSynthesis.resume();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  const voice = getPreferredVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ─── Picovoice Access Key ───────────────────────────────────────
const PICOVOICE_ACCESS_KEY = 
  process.env.NEXT_PUBLIC_PORCUPINE_ACCESS_KEY || 
  process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY || 
  '';

interface AIAssistantProps {
  machines: Machine[];
  alerts: Alert[];
  tasks: MaintenanceTask[];
  selectedMachine: Machine | null;
  // These are now handled primarily via context in the new UI
  onClose?: () => void;
  onMinimize?: () => void;
}

export function AIAssistant({
  machines,
  alerts,
  tasks,
  selectedMachine,
  onClose,
  onMinimize
}: AIAssistantProps) {
    const { 
        neoState, setNeoState, 
        addLog, setHUDVisible, 
        setCurrentResponseToken, 
        setTelemetry, 
        setAnalysis,
        isChatOpen, setChatOpen,
        setActiveUIModules,
        setActiveContextData,
        contextMemory, setContextMemory,
        setFocusedMachine,
        setHighlightedKeyword
    } = useNeoHUD();
    
    const [activeTab, setActiveTab] = useState<"alerts" | "reports" | "qa">("qa");
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
        {
            role: "assistant",
            content: "Hello! I'm Neo, your AI factory assistant. I'm monitoring equipment health in real-time.",
        },
    ]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListeningSTT, setIsListeningSTT] = useState(false);
    const [wakeWordEnabled, setWakeWordEnabled] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const porcupineRef = useRef<any>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load voices
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
    }, []);

    // ─── Core Streaming + TTS Handler ─────────────────────────────
    const streamAndSpeak = useCallback(async (
        promptText: string,
        contextOverride?: string,
        addUserMsg = true
    ) => {
        if (isProcessing) return;
        setIsProcessing(true);

        // Cancel ongoing speech
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
        setNeoState('processing');

        if (addUserMsg) {
            setMessages(prev => [...prev, { role: 'user', content: promptText }]);
        }

        try {
            const { parseIntent, updateContext, resolveData, mapIntentToUI } = await import('@/lib/neo-engine');
            const intentOutput = await parseIntent(promptText, contextMemory);
            const newMemory = updateContext(intentOutput, contextMemory);
            setContextMemory(newMemory);

            const resolvedData = resolveData(intentOutput, machines);
            setActiveContextData(resolvedData);
            const uiModules = mapIntentToUI(intentOutput, resolvedData);
            setActiveUIModules(uiModules);

            // Set Analysis state for HUD
            setAnalysis({
                intent: intentOutput.intents.map(i => i.intent).join(", "),
                actionPlan: [
                    "Parsed intent successfully",
                    `Resolved ${resolvedData ? "machine telemetry" : "fleet data"}`,
                    `Mapped to ${uiModules.length} UI panels`
                ]
            });

            // Focus Mode
            const lastMachine = intentOutput.intents.find(i => i.machine)?.machine || null;
            setFocusedMachine(lastMachine);

            // Highlight Visual Sync
            if (promptText.toLowerCase().includes("temperature")) setHighlightedKeyword("temperature");
            else if (promptText.toLowerCase().includes("vibration")) setHighlightedKeyword("vibration");
            else setHighlightedKeyword(null);

            // Build context for LLM
            const machinesSummary = machines.map(m =>
                `${m.name}: status=${m.status}, health=${m.healthIndex}%, RUL=${m.rul}d`
            ).join('; ');

            const contextStr = contextOverride ||
                `Machines: [${machinesSummary}]. Active alerts: ${alerts.filter(a => !a.acknowledged).length}.` +
                (selectedMachine ? ` Viewing: ${selectedMachine.name}.` : '');

            setNeoState('speaking');
            let assistantContent = '';
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            let sentenceBuffer = '';

            await streamNeoRequest({
                query: promptText,
                machineData: machines,
                conversationHistory: messages
            }, (token: string) => {
                assistantContent += token;
                sentenceBuffer += token;

                setMessages(prev => {
                    const newArr = [...prev];
                    newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: assistantContent };
                    return newArr;
                });

                setCurrentResponseToken(token);

                // Sentence-by-sentence TTS
                const sentenceMatch = sentenceBuffer.match(/^(.*?[.!?])(\s|$)/);
                if (sentenceMatch) {
                    speakSentence(sentenceMatch[1]);
                    sentenceBuffer = sentenceBuffer.slice(sentenceMatch[0].length);
                }
            });

            if (sentenceBuffer.trim()) speakSentence(sentenceBuffer);

            if (uiModules.includes('ALERT_PANEL')) {
                setNeoState('alert');
            } else {
                setNeoState('idle');
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Processing error. Check if Ollama is running.' }]);
            setNeoState('idle');
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, contextMemory, machines, alerts, selectedMachine, setNeoState, setContextMemory, setActiveContextData, setActiveUIModules, setAnalysis, setFocusedMachine, setHighlightedKeyword, setTelemetry, setCurrentResponseToken]);

    const handleSubmit = async (e: React.FormEvent | null, textOverride?: string) => {
        if (e) e.preventDefault();
        const submitText = textOverride || input;
        if (!submitText.trim()) return;
        setInput('');
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
        await streamAndSpeak(submitText);
    };

    // ─── SpeechRecognition (STT) ──────────────────────────────────
    const startSTT = useCallback(() => {
        if (typeof window === 'undefined') return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch {}
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.onstart = () => {
            setIsListeningSTT(true);
            setNeoState('listening');
        };
        recognition.onresult = (event: any) => {
            const transcript = event.results[0]?.[0]?.transcript;
            if (transcript) {
                setIsListeningSTT(false);
                streamAndSpeak(transcript);
            }
        };
        recognition.onerror = () => {
            setIsListeningSTT(false);
            setNeoState('idle');
        };
        recognition.onend = () => {
            setIsListeningSTT(false);
            if (neoState === 'listening') setNeoState('idle');
        };
        recognitionRef.current = recognition;
        recognition.start();
    }, [setNeoState, neoState, streamAndSpeak]);

    // ─── Web Speech Wake Word Spotter ─────────────────────────────
    const wakeRecognitionRef = useRef<any>(null);
    const wakeActiveRef = useRef(false);
    const startSTTRef = useRef(startSTT);
    useEffect(() => { startSTTRef.current = startSTT; }, [startSTT]);

    // Assign function to a ref every render so onend always calls the freshest version
    const runWakeSession = useRef<() => void>(() => {});
    runWakeSession.current = () => {
        if (typeof window === 'undefined' || !wakeActiveRef.current) return;
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { console.warn('[Neo] SpeechRecognition not supported.'); return; }

        const rec = new SR();
        rec.lang = 'en-US';
        rec.continuous = false;
        rec.interimResults = true;

        rec.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript.toLowerCase().trim();
                console.log('[Neo Wake] heard:', t);
                if (t.includes('hey neo') || t.includes('a neo') || t.includes('hey, neo') || t.includes('heyneo') || t.includes('hey new') || t.includes('a new') || t.includes('hey, new')) {
                    wakeActiveRef.current = false;
                    rec.abort();
                    addLog("Wake: Hey Neo detected");
                    setChatOpen(true);
                    setHUDVisible(true);
                    setNeoState('listening');
                    speakSentence("Yes I'm here.");
                    setTimeout(() => startSTTRef.current(), 1500);
                    return;
                }
            }
        };

        rec.onerror = (e: any) => {
            console.log('[Neo Wake] error:', e.error);
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                wakeActiveRef.current = false;
            }
        };

        rec.onend = () => {
            // Always calls the latest runWakeSession via ref — no stale closure
            if (wakeActiveRef.current) {
                setTimeout(() => runWakeSession.current(), 150);
            }
        };

        wakeRecognitionRef.current = rec;
        console.log('[Neo Wake] Session starting…');
        try { rec.start(); } catch (err) {
            console.error('[Neo Wake] start() threw:', err);
            setTimeout(() => { if (wakeActiveRef.current) runWakeSession.current(); }, 500);
        }
    };

    useEffect(() => {
        if (!wakeWordEnabled) {
            wakeActiveRef.current = false;
            try { wakeRecognitionRef.current?.abort(); } catch {}
            return;
        }
        wakeActiveRef.current = true;
        runWakeSession.current();
        addLog("Wake word active.");
        return () => {
            wakeActiveRef.current = false;
            try { wakeRecognitionRef.current?.abort(); } catch {}
        };
    }, [wakeWordEnabled]); // only fires when the toggle changes

    // ─── Simulate Alert ───────────────────────────────────────────
    const handleSimulateAlert = useCallback(async () => {
        if (isProcessing) return;
        const randomMachine = machines[Math.floor(Math.random() * machines.length)];
        setNeoState('alert');

        const alertPrompt = `URGENT ALERT: ${randomMachine.name} (ID: ${randomMachine.id}) has just gone CRITICAL. Health index dropped significantly. Recommend immediate action.`;
        setMessages(prev => [...prev, {
            role: 'user',
            content: `🚨 [ALERT SIMULATION] ${randomMachine.name} went critical!`
        }]);

        await streamAndSpeak(alertPrompt, `Emergency alert simulation. Machine ${randomMachine.name} is in critical failure.`, false);
    }, [isProcessing, machines, streamAndSpeak, setNeoState]);

    // ─── Daily Report ─────────────────────────────────────────────
    const handleDailyReport = useCallback(async () => {
        if (isProcessing) return;
        setNeoState('processing');

        const reportPrompt = `Give me a daily factory status report. Current fleet size is ${machines.length}. Provide a brief spoken summary.`;
        setMessages(prev => [...prev, {
            role: 'user',
            content: `📊 [DAILY REPORT] Requested fleet status summary`
        }]);

        await streamAndSpeak(reportPrompt, undefined, false);
    }, [isProcessing, machines, streamAndSpeak, setNeoState]);

    const suggestedQueries = [
        "Show urgent issues",
        "What machines need attention?",
        "Give me a prediction overview"
    ];

    return (
        <>
            {/* Floating Button */}
            <AnimatePresence>
                {!isChatOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            setChatOpen(true);
                            setHUDVisible(true);
                        }}
                        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg z-[120] transition-shadow duration-500"
                        style={{
                            boxShadow: neoState === "alert"
                                ? "0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.4)"
                                : neoState === "listening"
                                ? "0 0 25px rgba(56, 189, 248, 0.8)"
                                : neoState === "speaking"
                                ? "0 0 20px rgba(139, 92, 246, 0.6)"
                                : "0 0 20px rgba(6, 182, 212, 0.5)"
                        }}
                    >
                        <AnimatePresence mode="wait">
                            {neoState === "speaking" ? (
                                <motion.div key="speaking" className="flex items-center justify-center gap-1">
                                    {[1, 2, 3].map((i) => (
                                        <motion.div
                                            key={i}
                                            className="w-1.5 bg-white rounded-full bg-blue-100"
                                            animate={{ height: ["8px", "20px", "8px"] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                        />
                                    ))}
                                </motion.div>
                            ) : neoState === "listening" ? (
                                <motion.div
                                    key="listening"
                                    className="absolute inset-0 rounded-full border-2 border-white/50 animate-pulse"
                                />
                            ) : (
                                <Bot className="w-8 h-8 text-white" />
                            )}
                        </AnimatePresence>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Panel */}
            <AnimatePresence>
                {isChatOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 400 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 400 }}
                        className="fixed right-0 top-0 h-screen w-full lg:w-[400px] border-l border-cyan-500/20 flex flex-col z-[130] bg-[#030712]/95 backdrop-blur-xl shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-cyan-500/20 bg-[#0F172A]/40">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setChatOpen(false)}
                                    className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-full hover:bg-white/5 lg:hidden"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center">
                                        <Bot className="w-6 h-6 text-white" />
                                    </div>
                                    <div className={cn(
                                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#030712]",
                                        neoState === 'alert' ? "bg-red-500 animate-pulse" : "bg-green-500"
                                    )} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white tracking-tight leading-none">Neo</h3>
                                    <p className="text-[11px] text-cyan-400 font-medium flex items-center gap-1 mt-1 uppercase tracking-wider">
                                        <Sparkles className="w-3 h-3" />
                                        {isListeningSTT ? 'Listening...' : neoState === 'speaking' ? 'Speaking...' : 'Ollama Assistant'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hey Neo</span>
                                    <button
                                        onClick={() => {
                                            if (!wakeWordEnabled && !PICOVOICE_ACCESS_KEY) {
                                                alert('Set NEXT_PUBLIC_PORCUPINE_ACCESS_KEY in .env.local to enable wake word.');
                                                return;
                                            }
                                            setWakeWordEnabled(!wakeWordEnabled);
                                        }}
                                        className={cn(
                                            "w-7 h-4 rounded-full relative transition-colors duration-300 focus:outline-none",
                                            wakeWordEnabled ? "bg-cyan-500" : "bg-slate-700"
                                        )}
                                    >
                                        <motion.div
                                            className="w-3 h-3 bg-white rounded-full absolute top-0.5"
                                            animate={{ x: wakeWordEnabled ? 14 : 2 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </button>
                                </div>
                                <button 
                                    onClick={() => {
                                        setChatOpen(false);
                                        if (onClose) onClose();
                                    }} 
                                    className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-full hover:bg-white/5"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-800/80 p-2 gap-2 bg-[#0F172A]/20">
                            {[
                                { id: 'qa', label: 'Q&A', icon: Bot },
                                { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
                                { id: 'reports', label: 'Reports', icon: FileText }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all",
                                        activeTab === tab.id ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20" : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gradient-to-b from-[#030712] to-[#010204]">
                            {activeTab === 'alerts' && (
                                <div className="space-y-4">
                                    <button
                                        onClick={handleSimulateAlert}
                                        disabled={isProcessing}
                                        className="w-full flex items-center gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl hover:bg-red-950/60 transition-all disabled:opacity-50 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-red-400 text-sm">Simulate Alert</div>
                                            <div className="text-xs text-red-300/50">Trigger a random critical anomaly</div>
                                        </div>
                                    </button>
                                    {alerts.filter(a => !a.acknowledged).map((alert) => (
                                        <div key={alert.id} className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
                                            <div className="text-xs text-red-400 font-bold mb-1 uppercase tracking-tighter">🚨 {alert.severity}</div>
                                            <div className="text-sm text-slate-300">{alert.message}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'reports' && (
                                <div className="space-y-4">
                                    <button
                                        onClick={handleDailyReport}
                                        disabled={isProcessing}
                                        className="w-full flex items-center gap-3 p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-xl hover:bg-cyan-950/60 transition-all disabled:opacity-50 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                            <Volume2 className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-cyan-400 text-sm">Daily Report</div>
                                            <div className="text-xs text-cyan-300/50">Synthesize current fleet health</div>
                                        </div>
                                    </button>
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Fleet</div>
                                            <div className="text-2xl font-bold text-white">{machines.length}</div>
                                        </div>
                                        <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                                            <div className="text-xs text-green-500 uppercase font-bold mb-1">Optimal</div>
                                            <div className="text-2xl font-bold text-green-400">{machines.filter(m => m.status === 'optimal').length}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'qa' && (
                                <div className="space-y-5">
                                    {messages.map((m, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}
                                        >
                                            <div className={cn(
                                                "max-w-[85%] rounded-2xl p-4 shadow-lg",
                                                m.role === 'user' 
                                                    ? "bg-cyan-600/30 text-cyan-50 border border-cyan-500/30 rounded-tr-sm" 
                                                    : "bg-slate-800/80 text-slate-200 border border-white/5 rounded-tl-sm"
                                            )}>
                                                {m.role === 'assistant' && (
                                                    <div className="flex items-center gap-2 mb-2 text-cyan-400 opacity-60">
                                                        <Bot className="w-4 h-4" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">Neo</span>
                                                    </div>
                                                )}
                                                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {isProcessing && (
                                        <div className="flex gap-2 p-4 bg-slate-800/40 rounded-2xl w-24 justify-center">
                                            {[0, 150, 300].map(delay => (
                                                <div key={delay} className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        {activeTab === 'qa' && (
                            <div className="p-5 border-t border-cyan-500/20 bg-[#0F172A]/80 backdrop-blur-md">
                                <form onSubmit={handleSubmit} className="flex gap-3 items-center">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={isListeningSTT ? 'Listening...' : 'Ask Neo...'}
                                            className="w-full bg-[#1E293B]/80 border border-white/10 rounded-xl pl-5 pr-12 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner"
                                        />
                                        <button
                                            type="button"
                                            onClick={startSTT}
                                            disabled={isListeningSTT || isProcessing}
                                            className={cn(
                                                "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                                                isListeningSTT ? "text-cyan-400 animate-pulse" : "text-slate-400 hover:text-cyan-400"
                                            )}
                                        >
                                            <Mic className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isProcessing}
                                        className="h-[48px] w-[48px] bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 shadow-lg shadow-cyan-900/20"
                                    >
                                        <Send className="w-5 h-5 ml-0.5" />
                                    </button>
                                </form>
                                <div className="mt-4 flex flex-wrap gap-2 justify-center opacity-60">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest w-full text-center mb-1">Suggestions</span>
                                    {suggestedQueries.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSubmit(null, q)}
                                            className="px-2.5 py-1.5 bg-slate-800/50 border border-white/5 rounded-lg text-[11px] text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-all"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
