'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Info, TrendingDown, TrendingUp, Brain, Activity, Loader2 } from 'lucide-react'

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

**1. Overall Assessment**
• State the predicted RUL and what it implies about degradation level.

**2. Key Drivers of Degradation**
For each feature:
• Identify the sensor and its impact percentage.
• Explain what physical issue is likely occurring.

**3. Engineering Interpretation**
• Combine the signals into a coherent diagnosis.
• Explain what is likely happening inside the system.

CRITICAL INSTRUCTIONS:
- Use **double asterisks** to bold important terms, metrics, and key points in your response.
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
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-primary" />
        <h4 className="text-lg font-semibold">Explainable AI Analysis</h4>
      </div>

      {/* RUL Summary */}
      <div className="mb-4 p-3 bg-background/50 rounded-lg">
        <p className="text-sm text-muted-foreground mb-1">Model Prediction</p>
        <p className="text-base">
          Predicted RUL:{' '}
          <span className={cn(
            'font-bold font-mono',
            predicted_rul <= 30 ? 'text-destructive' :
            predicted_rul <= 60 ? 'text-warning' :
            'text-success'
          )}>{Math.round(predicted_rul)} days</span>
        </p>
      </div>

      {/* Top Sensor Contributors */}
      <div className="space-y-3 mb-4">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Activity className="w-4 h-4" />
          Top Sensor Contributors (Integrated Gradients)
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

      {/* Ollama Expert Analysis */}
      <div className="pt-3 border-t border-border">
        <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Brain className="w-4 h-4" />
          AI Expert Analysis
          {isLoadingExpert && <Loader2 className="w-4 h-4 animate-spin text-primary ml-1" />}
        </p>
        <div className="bg-background/50 rounded-lg p-3">
          {expertAnalysis ? (
            <p className="text-base leading-relaxed whitespace-pre-wrap">{formatText(expertAnalysis)}</p>
          ) : isLoadingExpert ? (
            <p className="text-sm text-muted-foreground italic">Generating expert analysis via Ollama...</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Enable Ollama with llama2 to see AI expert analysis.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
