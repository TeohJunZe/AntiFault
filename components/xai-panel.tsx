'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Info, TrendingDown, TrendingUp, Brain, Activity, Loader2, Bot, ShieldCheck, Zap, AlertTriangle, Cpu } from 'lucide-react'

interface SensorExplain {
  sensor: string
  importance: number
  direction: string
  plain_english: string
}

interface ExplainData {
  top_sensors: SensorExplain[]
  attn_peak_cycle: number
  status: string
  predicted_rul: number
}

interface XAIPanelProps {
  machineId: string
}

export function XAIPanel({ machineId }: XAIPanelProps) {
  const [explainData, setExplainData] = useState<ExplainData | null>(null)
  const [expertAnalysis, setExpertAnalysis] = useState<string>('')
  const [isLoadingExpert, setIsLoadingExpert] = useState(false)

  // Read explainability data from localStorage when machineId changes
  useEffect(() => {
    function loadExplain() {
      try {
        const stored = localStorage.getItem('engineExplainability')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed[machineId]) {
            setExplainData(parsed[machineId])
          } else {
            setExplainData(null)
          }
        } else {
          setExplainData(null)
        }
      } catch {
        setExplainData(null)
      }
    }

    loadExplain()
    // Also listen for prediction updates
    window.addEventListener('predictionsUpdated', loadExplain)
    return () => window.removeEventListener('predictionsUpdated', loadExplain)
  }, [machineId])

  // When explainData changes, stream an expert analysis from Ollama
  useEffect(() => {
    if (!explainData || explainData.top_sensors.length === 0) {
      setExpertAnalysis('')
      return
    }

    let cancelled = false
    setIsLoadingExpert(true)
    setExpertAnalysis('')

    async function fetchExpert() {
      const { top_sensors, status, predicted_rul } = explainData!
      
      const sensorLines = top_sensors.map((s, i) => {
        const name = i === 0 ? "Temperature 2" : i === 1 ? "Vibration 2" : s.sensor;
        const impact = s.direction === 'lowers_rul' ? "Degrading" : "Healthy";
        const pct = (s.importance * 100).toFixed(1);
        const plainText = s.plain_english.replace(s.sensor, name);
        return `Sensor: ${name}
Impact: ${pct}% (${impact})
Details: ${plainText}`
      }).join('\n\n')

      const prompt = `You are a predictive maintenance expert analyzing turbofan engine sensor data from a deep learning model.

Given this data:
- Predicted RUL: ${Math.round(predicted_rul)} days
- Status: ${status}

Top contributing sensors:
${sensorLines}

CRITICAL: Do NOT include ANY introductions, filler, or pleasantries like 'Of course' or 'Here is the analysis'. Start immediately with the first heading.
Format your response EXACTLY according to this structure:

**1. Overall System Health Assessment**
• State the predicted RUL and what it implies about degradation level.

**2. Critical Component Drivers**
For each feature:
• Identify the sensor and its impact percentage.
• Explain what physical issue is likely occurring.

**3. Strategic Engineering Diagnosis**
• Combine the signals into a coherent diagnosis.
• Explain what is likely happening inside the system.

CRITICAL INSTRUCTIONS:
- Use **double asterisks** to bold important terms, metrics, and key points in your response.
- Use the bullet character • for points.
- Keep the explanations short, highly precise, and directly to the point. Use minimal words.`

      try {
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama2',
            prompt,
            stream: true,
            options: { temperature: 0.5, num_predict: 800 },
          }),
        })

        if (!response.ok || !response.body) {
          if (!cancelled) {
            setExpertAnalysis('Ollama is not reachable. Make sure it is running with llama2 loaded.')
            setIsLoadingExpert(false)
          }
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || cancelled) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const json = JSON.parse(line)
              if (json.response) {
                accumulated += json.response
                // Aggressive strip of conversational filler at the start
                const cleaned = accumulated.replace(/^(Of course!|Here is|Based on|Sure|Absolutely).*?\n+/gi, '').trimStart();
                if (!cancelled) setExpertAnalysis(cleaned)
              }
            } catch { /* skip partial lines */ }
          }
        }
      } catch {
        if (!cancelled) {
          setExpertAnalysis('Could not connect to Ollama. Ensure it is running locally.')
        }
      } finally {
        if (!cancelled) setIsLoadingExpert(false)
      }
    }

    fetchExpert()
    return () => { cancelled = true }
  }, [explainData])

  // No data yet
  if (!explainData || explainData.top_sensors.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-medium">Explainable AI Analysis</h4>
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Waiting for prediction data from the backend...
          <br />
          Start the FastAPI server to see Integrated Gradients analysis.
        </div>
      </div>
    )
  }

  const { top_sensors, predicted_rul, status } = explainData

  // Auto-bold parser
  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const trimmed = line.trim();
      
      // Check if line is a header like "**1. Overall Assessment**"
      if (trimmed.startsWith('**') && /^\*\*\d\./.test(trimmed)) {
        const title = trimmed.replace(/\*\*/g, '');
        return (
          <div key={lineIdx} className="mt-8 first:mt-2 mb-4">
            <h5 className="text-xs font-black uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-[length:200%_auto] animate-gradient-x bg-clip-text text-transparent flex items-center gap-3">
              <div className="w-2 h-2 rounded-sm bg-indigo-500 rotate-45 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
              {title}
            </h5>
            <div className="h-px w-full bg-gradient-to-r from-indigo-500/40 via-purple-500/20 to-transparent mt-2" />
          </div>
        );
      }

      // Check if line is a bullet point "• ..."
      if (trimmed.startsWith('•')) {
        const content = trimmed.substring(1).trim();
        const icon = lineIdx < 10 ? <ShieldCheck className="w-4 h-4 text-success/80" /> : 
                     lineIdx < 20 ? <Zap className="w-4 h-4 text-indigo-400/80" /> : 
                     <Activity className="w-4 h-4 text-purple-400/80" />;

        return (
          <div key={lineIdx} className="flex gap-3 mb-4 last:mb-0 p-3 bg-indigo-500/[0.03] border border-indigo-500/10 rounded-xl hover:bg-indigo-500/[0.06] transition-colors group">
            <div className="shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
              {icon}
            </div>
            <div className="text-sm leading-relaxed text-foreground/90">
              {parseBold(content)}
            </div>
          </div>
        );
      }

      if (!trimmed) return <div key={lineIdx} className="h-2" />;

      return (
        <div key={lineIdx} className="mb-2 text-sm text-foreground/80 pl-7">
          {parseBold(trimmed)}
        </div>
      );
    });
  }

  const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-indigo-400 bg-indigo-500/10 px-1 rounded mx-0.5 shadow-[0_0_8px_rgba(129,140,248,0.15)] tracking-tight">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="bg-muted/30 rounded-xl p-5 border border-border/50 shadow-sm relative overflow-hidden">
      <div className="absolute -top-6 -right-6 opacity-5 pointer-events-none">
        <Brain className="w-32 h-32 text-primary" />
      </div>

      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <h4 className="text-lg font-black tracking-tight uppercase tracking-widest text-primary/80">AI Expert Analysis</h4>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-[10px] font-bold text-success">
          <Activity className="w-3 h-3" />
          ACTIVE ANALYSIS
        </div>
      </div>

      {/* RUL Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 relative z-10">
        <div className="p-3 bg-background/40 rounded-xl border border-border/50">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Current Status</p>
          <div className={cn(
            "inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
            status === 'healthy' ? "bg-success/10 text-success border border-success/20" : "bg-warning/10 text-warning border border-warning/20"
          )}>
            {status}
          </div>
        </div>
        <div className="p-3 bg-background/40 rounded-xl border border-border/50">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Predicted RUL</p>
          <div className={cn(
            'text-lg font-black font-mono tracking-tighter',
            predicted_rul <= 30 ? 'text-destructive' :
            predicted_rul <= 60 ? 'text-warning' :
            'text-success'
          )}>
            {Math.round(predicted_rul)} <span className="text-[10px] font-medium text-muted-foreground uppercase ml-1">Days</span>
          </div>
        </div>
      </div>

      {/* Top Sensor Contributors */}
      <div className="space-y-3 mb-4">
        <p className="text-xs font-bold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-[0.1em]">
          <Activity className="w-4 h-4 text-indigo-400" />
          Primary Feature Contribution Indices
        </p>

        {top_sensors.map((sensor, idx) => {
          const pct = Math.round(sensor.importance * 100)
          const isDegrading = sensor.direction === 'lowers_rul'
          const name = idx === 0 ? "Temperature 2" : idx === 1 ? "Vibration 2" : sensor.sensor;
          const plainText = sensor.plain_english.replace(sensor.sensor, name);

          return (
            <div key={idx} className="space-y-1.5 p-3 bg-background/40 rounded-md border border-border/50">
              <div className="flex items-center justify-between text-base">
                <span className="font-medium text-foreground">
                  {name}
                </span>
                <span className={cn(
                  'font-mono text-base font-bold flex items-center gap-1',
                  isDegrading ? 'text-destructive' : 'text-success'
                )}>
                  {isDegrading ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {pct}%
                </span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                {plainText}
              </p>
            </div>
          )
        })}
      </div>

      <div className="pt-5 border-t border-border/50 relative z-10">
        <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2 uppercase tracking-widest">
          <Bot className="w-4 h-4 text-primary" />
          Neural Expert Synthesis
          {isLoadingExpert && <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />}
        </p>
        <div className="bg-background/60 rounded-xl p-5 border border-border/50 shadow-inner min-h-[120px]">
          {expertAnalysis ? (
            <div className="text-sm leading-relaxed text-foreground/90">{formatText(expertAnalysis)}</div>
          ) : isLoadingExpert ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground italic gap-3">
               <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
               <p className="text-xs">Synthesizing sensor patterns via LLM...</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Ollama instance not detected. Please verify local host connection.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
