'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Bot,
  Mic,
  Send,
  X,
  MessageSquare,
  AlertTriangle,
  FileText,
  Sparkles
} from 'lucide-react'
import { Machine, Alert, MaintenanceTask } from '@/lib/data'
import { Switch } from '@/components/ui/switch'
import { useNeoHUD } from '@/components/hud/NeoHUDContext'

interface AIAssistantProps {
  machines: Machine[]
  alerts: Alert[]
  tasks: MaintenanceTask[]
  selectedMachine: Machine | null
  onClose: () => void
}

export function AIAssistant({
  machines,
  alerts,
  tasks,
  selectedMachine,
  onClose
}: AIAssistantProps) {
  const { 
    setNeoState, 
    contextMemory, 
    setContextMemory,
    setActiveContextData,
    setActiveUIModules 
  } = useNeoHUD();

  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<'qa' | 'alerts' | 'reports'>('qa')
  const [heyNeoEnabled, setHeyNeoEnabled] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  type Message = { role: 'user'|'assistant', content: string };
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent | null, textOverride?: string) => {
    if (e) e.preventDefault();
    const submitText = textOverride || input;
    if (!submitText.trim() || isProcessing) return;
    
    setInput('');
    setIsProcessing(true);
    setNeoState('processing');

    // 1. Add User Msg
    setMessages(prev => [...prev, { role: 'user', content: submitText }]);

    try {
      // 2. Intent Parsing pipeline
      const { parseIntent, updateContext, resolveData, mapIntentToUI } = await import('@/lib/neo-engine');
      const intentOutput = await parseIntent(submitText, contextMemory);
      const newMemory = updateContext(intentOutput, contextMemory);
      setContextMemory(newMemory);

      // 3. Resolve Data & Map UI
      const resolvedData = resolveData(intentOutput, machines);
      setActiveContextData(resolvedData);
      
      const uiModules = mapIntentToUI(intentOutput, resolvedData);
      setActiveUIModules(uiModules);
      
      // Update core state based on findings
      if (uiModules.includes('ERROR_PANEL')) {
         setNeoState('idle');
      } else if (uiModules.includes('ALERT_PANEL')) {
         setNeoState('alert');
      } else {
         setNeoState('idle'); // or 'speaking' once voice starts
      }

      // 4. Stream Response from API
      const res = await fetch('/api/neo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: submitText, currentContext: newMemory.history.map(m => m.machine).join(', ') })
      });

      if (!res.body || !res.ok) throw new Error("Failed connecting to Neo API");
      
      setNeoState('speaking');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      // Start an empty message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let sentenceBuffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        assistantContent += chunk;
        sentenceBuffer += chunk;
        
        // Update UI
        setMessages(prev => {
          const newArr = [...prev];
          newArr[newArr.length - 1].content = assistantContent;
          return newArr;
        });

        // Speech Synthesis by sentences
        if (sentenceBuffer.includes('.') || sentenceBuffer.includes('!') || sentenceBuffer.includes('?')) {
            const ends = sentenceBuffer.match(/.*?[.!?](\s|$)/);
            if (ends && ends[0] && 'speechSynthesis' in window) {
               const utterance = new SpeechSynthesisUtterance(ends[0].trim());
               window.speechSynthesis.speak(utterance);
               sentenceBuffer = sentenceBuffer.replace(ends[0], '');
            }
        }
      }

      // Speak remaining buffer
      if (sentenceBuffer.trim() && 'speechSynthesis' in window) {
         window.speechSynthesis.speak(new SpeechSynthesisUtterance(sentenceBuffer.trim()));
      }
      
      // Cleanup visual state if not permanently alert
      if (uiModules.includes('ALERT_PANEL')) {
          setNeoState('alert');
      } else {
          setNeoState('idle');
      }

    } catch(err) {
       console.error(err);
       setMessages(prev => [...prev, { role: 'assistant', content: "I encountered a processing error. Please check system logs." }]);
       setNeoState('idle');
    } finally {
       setIsProcessing(false);
    }
  }

  const suggestedQueries = [
    "Show urgent issues",
    "Why is Press-02 at risk?",
    "Summarize report"
  ]

  return (
    <div className="flex flex-col h-full bg-[#0A101D] text-slate-200 overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#0F172A]/80">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center relative z-10">
              <Bot className="w-6 h-6 text-white" />
            </div>
            {/* Status dot */}
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-red-500 border-2 border-[#0F172A] z-20"></div>
          </div>
          <div>
            <h3 className="font-bold text-xl text-white tracking-tight">Neo</h3>
            <p className="text-xs text-cyan-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Factory AI Assistant
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#1E293B]/80 px-3 py-1.5 rounded-full border border-white/5">
            <span className="text-xs font-bold text-slate-300 tracking-wider">HEY NEO</span>
            <Switch 
              checked={heyNeoEnabled} 
              onCheckedChange={setHeyNeoEnabled}
              className="data-[state=checked]:bg-cyan-500 scale-75 origin-right"
            />
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 py-3 border-b border-white/5">
        <div className="flex bg-transparent rounded-lg">
          <button 
            onClick={() => setActiveTab('qa')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all",
              activeTab === 'qa' ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 shadow-[0_4px_12px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Bot className="w-4 h-4" /> Q&A
          </button>
          <button 
            onClick={() => setActiveTab('alerts')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all relative",
              activeTab === 'alerts' ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <AlertTriangle className="w-4 h-4" /> Alerts
            {alerts.filter(a => !a.acknowledged).length > 0 && (
               <div className="w-2 h-2 rounded-full bg-red-500 absolute top-2 right-4"></div>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all",
              activeTab === 'reports' ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <FileText className="w-4 h-4" /> Reports
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gradient-to-b from-[#0A101D] to-[#05080f] relative">
        <div className="absolute left-2 top-20 bottom-20 w-[2px] opacity-20 bg-gradient-to-b from-transparent via-red-500 to-transparent flex flex-col justify-between py-10 items-center">
            <div className="h-2 w-[2px] bg-red-500"></div>
            <div className="h-4 w-[2px] bg-red-500"></div>
            <div className="h-6 w-[2px] bg-red-500"></div>
            <div className="h-3 w-[2px] bg-red-500"></div>
            <div className="h-5 w-[2px] bg-red-500"></div>
            <div className="h-2 w-[2px] bg-red-500"></div>
        </div>

        {activeTab === 'qa' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="max-w-[85%] bg-[#1E293B] border border-white/5 rounded-2xl rounded-tl-sm p-4 shadow-lg z-10 ml-4">
                <div className="flex items-center gap-2 mb-2 text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
                <p className="text-[15px] leading-relaxed text-slate-200">
                  Hello! I'm Neo, your AI factory assistant. I'm monitoring equipment health in real-time.
                </p>
              </div>
            </div>

            {messages.map((m, idx) => (
               <div key={idx} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="max-w-[85%] bg-[#1E293B] border border-white/5 rounded-2xl rounded-tl-sm p-4 shadow-lg z-10 ml-4">
                        <div className="flex items-center gap-2 mb-2 text-cyan-400">
                          <Bot className="w-4 h-4" />
                        </div>
                        <p className="text-[15px] leading-relaxed text-slate-200">
                          {m.content}
                        </p>
                    </div>
                  )}
                  {m.role === 'user' && (
                     <div className="max-w-[85%] bg-cyan-600 border border-cyan-500/50 rounded-2xl rounded-tr-sm p-4 shadow-lg z-10 mr-4">
                        <div className="flex items-center justify-end gap-2 mb-2 text-cyan-100">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <p className="text-[15px] leading-relaxed text-white">
                          {m.content}
                        </p>
                     </div>
                  )}
               </div>
            ))}
            
            {isProcessing && (
              <div className="flex gap-4">
                <div className="bg-[#1E293B] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 shadow-lg z-10 ml-4">
                    <div className="flex gap-1.5 items-center justify-center">
                       <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                       <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                       <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-5 border-t border-white/5 bg-[#0F172A]/80">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Neo about equipment..."
              className="w-full bg-[#1E293B] border border-white/10 rounded-xl px-5 py-4 text-[15px] text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all pr-12"
            />
            <button 
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
          
          <button
            type="submit"
            disabled={!input.trim()}
            className="h-[54px] w-[54px] bg-cyan-600 hover:bg-cyan-500 focus:bg-cyan-500 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:shadow-none"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>

        {/* Suggested Queries */}
        <div className="mt-5">
          <p className="text-[11px] font-bold text-slate-500 tracking-widest text-center uppercase mb-3">
            Suggested Queries
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestedQueries.map((query, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(null, query);
                }}
                className="px-4 py-2 rounded-full border border-white/10 bg-[#1E293B]/50 text-[13px] text-slate-300 hover:bg-[#1E293B] hover:text-white hover:border-white/20 transition-all"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
