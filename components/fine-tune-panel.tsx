'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  RefreshCcw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const REGISTERED_SENSORS = [
  'sensor_2',
  'sensor_3',
  'sensor_4',
  'sensor_7',
  'sensor_8',
  'sensor_9',
  'sensor_11',
  'sensor_12',
  'sensor_13',
  'sensor_14',
  'sensor_15',
  'sensor_17',
  'sensor_20',
  'sensor_21',
]

const REQUIRED_COLUMNS = ['engine_id', 'cycle', 'rul']
const OPTIONAL_NUMERIC_COLUMNS = ['setting_1', 'setting_2', 'setting_3', 'op_setting_1', 'op_setting_2', 'op_setting_3']

interface Metrics {
  rmse: number
  mae: number
  accuracy_within_20: number
}

interface FineTuneResult {
  machine_id: string
  accepted: boolean
  has_custom_model: boolean
  before_metrics: Metrics
  after_metrics: Metrics
  artifact_id: string | null
  trained_at: string
  coverage?: {
    coverage_status: 'ok' | 'warn' | 'reject'
    missing_sensor_count: number
    missing_sensor_ratio: number
  }
  tuning_strategy?: {
    adapter_head_parameter_share_pct?: number
  }
}

interface FineTuneStatus {
  machine_id: string
  has_custom_model: boolean
  trained_at: string | null
  before_metrics: Metrics | null
  after_metrics: Metrics | null
  artifact_id: string | null
  coverage?: {
    coverage_status: 'ok' | 'warn' | 'reject'
    missing_sensor_count: number
    missing_sensor_ratio: number
  }
  tuning_strategy?: {
    adapter_head_parameter_share_pct?: number
  }
}

interface FineTunePanelProps {
  machineId: string
  machineName: string
  onTuned?: (machineId: string) => void
}

function parseCsvRows(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(',').map(cell => cell.trim()))
}

function formatMetric(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return value.toFixed(digits)
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not tuned yet'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MetricComparisonChart({
  beforeMetrics,
  afterMetrics,
}: {
  beforeMetrics?: Metrics | null
  afterMetrics?: Metrics | null
}) {
  const entries = [
    { label: 'RMSE', before: beforeMetrics?.rmse, after: afterMetrics?.rmse },
    { label: 'MAE', before: beforeMetrics?.mae, after: afterMetrics?.mae },
  ]

  const maxValue = Math.max(
    1,
    ...entries.flatMap(entry => [entry.before ?? 0, entry.after ?? 0])
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Metric Comparison</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Lower values are better. The chart compares the base ensemble against the latest tuning result.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80" />
            Before
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            After
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {entries.map(entry => {
          const delta =
            entry.before !== null &&
            entry.before !== undefined &&
            entry.after !== null &&
            entry.after !== undefined
              ? entry.after - entry.before
              : null
          const improved = delta !== null ? delta <= 0 : null

          return (
            <div key={entry.label} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">{entry.label}</div>
                <div
                  className={cn(
                    'text-sm font-medium',
                    improved === null && 'text-muted-foreground',
                    improved === true && 'text-emerald-400',
                    improved === false && 'text-amber-400'
                  )}
                >
                  {delta === null
                    ? 'Awaiting metrics'
                    : improved
                      ? `${Math.abs(delta).toFixed(2)} better`
                      : `${Math.abs(delta).toFixed(2)} worse`}
                </div>
              </div>

              {[
                { label: 'Before', value: entry.before, barClassName: 'bg-slate-400/80' },
                { label: 'After', value: entry.after, barClassName: 'bg-cyan-400' },
              ].map(series => (
                <div key={series.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{series.label}</span>
                    <span className="font-medium text-foreground">{formatMetric(series.value)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-background/80">
                    <div
                      className={cn('h-full rounded-full transition-all', series.barClassName)}
                      style={{
                        width: `${Math.max(6, ((series.value ?? 0) / maxValue) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RobotUploadBuffer() {
  return (
    <div className="relative flex min-h-[18rem] items-center justify-center overflow-hidden px-6 py-8">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,15,0.98),rgba(7,30,51,0.92))]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.18),transparent_70%)]" />
      <div className="absolute inset-x-10 bottom-6 h-24 bg-[radial-gradient(circle,rgba(96,165,250,0.2),transparent_70%)] blur-2xl" />
      <div className="absolute inset-x-8 bottom-11 h-[2px] rounded-full bg-white/10" />

      <div className="robot-loader-dots absolute right-6 top-6 flex items-center gap-2" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="absolute inset-x-6 bottom-8 h-40 overflow-hidden">
        <div className="robot-runner absolute bottom-0 left-0 h-40 w-40">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <filter id="cyan-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              
              {/* 3D Drop Shadow */}
              <filter id="robot-3d-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="3" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
              </filter>

              {/* 3D Shading Gradients */}
              <radialGradient id="head-3d" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </radialGradient>
              
              <linearGradient id="torso-3d" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>

              <radialGradient id="visor-3d" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="60%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>

              {/* Cylindrical shading for limbs (uses absolute coordinates near x=95) */}
              <linearGradient id="limb-fg-3d" x1="85" y1="0" x2="105" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>

              <linearGradient id="limb-bg-3d" x1="85" y1="0" x2="105" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>

              <radialGradient id="joint-3d" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
            </defs>

            {/* Shadow pulsing on the ground */}
            <ellipse className="robot-shadow" cx="95" cy="180" rx="35" ry="6" fill="rgba(4,10,20,0.6)" />

            <g className="robot-stumble" filter="url(#robot-3d-shadow)">
              <g className="robot-bounce">
                
                {/* --- BACKGROUND LIMBS --- */}
                <g className="robot-arm-left">
                  <line x1="95" y1="95" x2="95" y2="115" stroke="url(#limb-bg-3d)" strokeWidth="10" strokeLinecap="round" />
                  <g className="robot-forearm-left">
                    <line x1="95" y1="115" x2="95" y2="135" stroke="url(#limb-bg-3d)" strokeWidth="9" strokeLinecap="round" />
                    <circle cx="95" cy="135" r="4" fill="url(#joint-3d)" />
                  </g>
                  <circle cx="95" cy="115" r="3" fill="url(#joint-3d)" />
                </g>

                <g className="robot-leg-left">
                  <line x1="95" y1="120" x2="95" y2="145" stroke="url(#limb-bg-3d)" strokeWidth="12" strokeLinecap="round" />
                  <g className="robot-calf-left">
                    <line x1="95" y1="145" x2="95" y2="170" stroke="url(#limb-bg-3d)" strokeWidth="11" strokeLinecap="round" />
                    <path d="M 88 170 h 14 v 5 q 0 3 -7 3 q -7 0 -7 -3 z" fill="url(#joint-3d)" />
                  </g>
                  <circle cx="95" cy="145" r="3" fill="url(#joint-3d)" />
                </g>

                {/* --- TORSO & HEAD --- */}
                <rect x="91" y="70" width="8" height="20" rx="4" fill="#64748b" />
                
                <rect x="83" y="85" width="26" height="42" rx="13" fill="url(#torso-3d)" transform="rotate(10, 95, 105)" />
                <path d="M 83 95 q 13 10 26 0" stroke="#cbd5e1" strokeWidth="2" fill="none" transform="rotate(10, 95, 105)" />

                <g className="robot-head">
                  <ellipse cx="105" cy="45" rx="38" ry="34" fill="url(#head-3d)" />
                  
                  <rect x="85" y="28" width="45" height="32" rx="14" fill="url(#visor-3d)" transform="rotate(-8, 105, 45)" />
                  <path d="M 88 32 q 20 -8 40 0" stroke="#1e293b" strokeWidth="2" fill="none" transform="rotate(-8, 105, 45)" />

                  <circle className="robot-eye" cx="100" cy="42" r="6" fill="#00ffff" filter="url(#cyan-glow)" />
                  <circle className="robot-eye" cx="120" cy="46" r="6" fill="#00ffff" filter="url(#cyan-glow)" />

                  <circle cx="70" cy="45" r="12" fill="url(#joint-3d)" />
                  <circle cx="70" cy="45" r="8" fill="#334155" />
                  <circle cx="70" cy="45" r="3" fill="#00ffff" filter="url(#cyan-glow)" opacity="0.5" />
                </g>

                {/* --- FOREGROUND LIMBS --- */}
                <g className="robot-leg-right">
                  <line x1="95" y1="120" x2="95" y2="145" stroke="url(#limb-fg-3d)" strokeWidth="14" strokeLinecap="round" />
                  <g className="robot-calf-right">
                    <line x1="95" y1="145" x2="95" y2="170" stroke="url(#limb-fg-3d)" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 88 170 h 16 v 6 q 0 3 -8 3 q -8 0 -8 -3 z" fill="url(#joint-3d)" />
                  </g>
                  <circle cx="95" cy="145" r="3.5" fill="url(#joint-3d)" />
                </g>

                {/* Arm push wrappers that override the run cycle during falls */}
                <g className="robot-arm-push">
                  <g className="robot-arm-right">
                    <line x1="95" y1="95" x2="95" y2="115" stroke="url(#limb-fg-3d)" strokeWidth="12" strokeLinecap="round" />
                    
                    <g className="robot-forearm-push">
                      <g className="robot-forearm-right">
                        <line x1="95" y1="115" x2="95" y2="135" stroke="url(#limb-fg-3d)" strokeWidth="10" strokeLinecap="round" />
                        <circle cx="95" cy="135" r="4.5" fill="url(#joint-3d)" />
                      </g>
                    </g>
                    
                    <circle cx="95" cy="115" r="3.5" fill="url(#joint-3d)" />
                  </g>
                </g>

                <circle cx="95" cy="95" r="5" fill="url(#joint-3d)" />
                <circle cx="95" cy="120" r="5" fill="url(#joint-3d)" />

              </g>
            </g>
          </svg>
        </div>
      </div>

      <style jsx>{`
        /* Master timeline: 12 seconds total with 2 falls */
        .robot-runner {
          animation: robot-runner-path 12s ease-in-out infinite;
        }

        .robot-stumble {
          transform-origin: 95px 170px;
          animation: robot-stumble-anim 12s ease-in-out infinite;
        }

        /* Push wrappers that brace the ground and push the body up */
        .robot-arm-push {
          transform-origin: 95px 95px;
          animation: robot-arm-push-anim 12s ease-in-out infinite;
        }
        .robot-forearm-push {
          transform-origin: 95px 115px;
          animation: robot-forearm-push-anim 12s ease-in-out infinite;
        }

        /* Sub-animations for the standard run cycle (1.2s length) */
        .robot-bounce { transform-origin: 95px 120px; animation: robot-run-bounce 1.2s linear infinite; }
        .robot-shadow { transform-origin: 95px 180px; animation: robot-shadow-pulse 1.2s linear infinite; }
        .robot-head { transform-origin: 105px 70px; animation: robot-head-bob 1.2s linear infinite; }
        
        .robot-arm-left { transform-origin: 95px 95px; animation: robot-arm-left-run 1.2s linear infinite; }
        .robot-arm-right { transform-origin: 95px 95px; animation: robot-arm-right-run 1.2s linear infinite; }
        .robot-forearm-left { transform-origin: 95px 115px; animation: robot-forearm-left-run 1.2s linear infinite; }
        .robot-forearm-right { transform-origin: 95px 115px; animation: robot-forearm-right-run 1.2s linear infinite; }
        
        .robot-leg-left { transform-origin: 95px 120px; animation: robot-leg-left-run 1.2s linear infinite; }
        .robot-leg-right { transform-origin: 95px 120px; animation: robot-leg-right-run 1.2s linear infinite; }
        .robot-calf-left { transform-origin: 95px 145px; animation: robot-calf-left-run 1.2s linear infinite; }
        .robot-calf-right { transform-origin: 95px 145px; animation: robot-calf-right-run 1.2s linear infinite; }

        .robot-eye { transform-origin: 110px 44px; animation: robot-blink 4s ease-in-out infinite; }

        /* --- THE 12-SECOND STORY TIMELINE --- */
        @keyframes robot-runner-path {
          0% { left: -20%; }
          15% { left: 15%; }           /* Run into view */
          20%, 30% { left: 22%; }      /* Halted momentum during Fall 1 */
          35% { left: 25%; }           /* Slight nudge moving forward from push up */
          50% { left: 45%; }           /* Mid-screen running */
          55%, 65% { left: 52%; }      /* Halted momentum during Fall 2 */
          70% { left: 55%; }           /* Push up 2 */
          100% { left: 120%; }         /* Run off screen */
        }

        @keyframes robot-stumble-anim {
          0%, 15% { transform: rotate(0deg) translateY(0px) translateX(0px); }
          /* Trip & Fall 1 */
          17% { transform: rotate(50deg) translateY(5px) translateX(15px); }
          20%, 28% { transform: rotate(85deg) translateY(35px) translateX(25px); }
          /* Pushing Back Up 1 */
          32% { transform: rotate(40deg) translateY(15px) translateX(10px); }
          35%, 50% { transform: rotate(0deg) translateY(0px) translateX(0px); }
          /* Trip & Fall 2 */
          52% { transform: rotate(50deg) translateY(5px) translateX(15px); }
          55%, 63% { transform: rotate(85deg) translateY(35px) translateX(25px); }
          /* Pushing Back Up 2 */
          67% { transform: rotate(40deg) translateY(15px) translateX(10px); }
          70%, 100% { transform: rotate(0deg) translateY(0px) translateX(0px); }
        }

        @keyframes robot-arm-push-anim {
          0%, 15% { transform: rotate(0deg); }
          /* Bracing for Fall 1 */
          18%, 28% { transform: rotate(-70deg); }  /* Hand reaching down to ground */
          /* Engaging Push 1 */
          32% { transform: rotate(-110deg); }      /* Over-rotating to push the body up */
          35%, 50% { transform: rotate(0deg); }
          /* Bracing for Fall 2 */
          53%, 63% { transform: rotate(-70deg); } 
          /* Engaging Push 2 */
          67% { transform: rotate(-110deg); }
          70%, 100% { transform: rotate(0deg); }
        }

        @keyframes robot-forearm-push-anim {
          0%, 15% { transform: rotate(0deg); }
          18%, 28% { transform: rotate(40deg); }   /* Unbending the elbow to hit the floor */
          32% { transform: rotate(10deg); }
          35%, 50% { transform: rotate(0deg); }
          53%, 63% { transform: rotate(40deg); }
          67% { transform: rotate(10deg); }
          70%, 100% { transform: rotate(0deg); }
        }

        /* --- Slower, Heavier Run Cycle (1.2s) --- */
        @keyframes robot-run-bounce {
          0%, 50%, 100% { transform: translateY(0) rotate(5deg); }
          25%, 75% { transform: translateY(-6px) rotate(5deg); }
        }

        @keyframes robot-head-bob {
          0%, 50%, 100% { transform: rotate(0deg); }
          25%, 75% { transform: rotate(-3deg); }
        }

        @keyframes robot-shadow-pulse {
          0%, 50%, 100% { transform: scaleX(1); opacity: 0.6; }
          25%, 75% { transform: scaleX(0.8); opacity: 0.3; }
        }

        @keyframes robot-leg-right-run {
          0% { transform: rotate(-35deg); }
          25% { transform: rotate(0deg); }
          50% { transform: rotate(35deg); }
          75% { transform: rotate(0deg); }
          100% { transform: rotate(-35deg); }
        }
        @keyframes robot-calf-right-run {
          0%, 100% { transform: rotate(5deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(75deg); }
          75% { transform: rotate(90deg); }
        }

        @keyframes robot-leg-left-run {
          0% { transform: rotate(35deg); }
          25% { transform: rotate(0deg); }
          50% { transform: rotate(-35deg); }
          75% { transform: rotate(0deg); }
          100% { transform: rotate(35deg); }
        }
        @keyframes robot-calf-left-run {
          0% { transform: rotate(75deg); }
          25% { transform: rotate(90deg); }
          50% { transform: rotate(5deg); }
          75% { transform: rotate(15deg); }
          100% { transform: rotate(75deg); }
        }

        @keyframes robot-arm-right-run {
          0% { transform: rotate(45deg); }
          25% { transform: rotate(0deg); }
          50% { transform: rotate(-45deg); }
          75% { transform: rotate(0deg); }
          100% { transform: rotate(45deg); }
        }
        @keyframes robot-forearm-right-run {
          0%, 100% { transform: rotate(-25deg); }
          50% { transform: rotate(-85deg); }
        }

        @keyframes robot-arm-left-run {
          0% { transform: rotate(-45deg); }
          25% { transform: rotate(0deg); }
          50% { transform: rotate(45deg); }
          75% { transform: rotate(0deg); }
          100% { transform: rotate(-45deg); }
        }
        @keyframes robot-forearm-left-run {
          0%, 100% { transform: rotate(-85deg); }
          50% { transform: rotate(-25deg); }
        }

        @keyframes robot-blink {
          0%, 46%, 50%, 100% { transform: scaleY(1); }
          48% { transform: scaleY(0.1); }
        }

        .robot-loader-dots span {
          display: block;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 9999px;
          background: rgba(153, 246, 228, 0.92);
          box-shadow: 0 0 18px rgba(45, 212, 191, 0.35);
          animation: robot-dot 0.9s ease-in-out infinite;
        }
        .robot-loader-dots span:nth-child(2) { animation-delay: 0.12s; }
        .robot-loader-dots span:nth-child(3) { animation-delay: 0.24s; }

        @keyframes robot-dot {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}

export function FineTunePanel({ machineId, machineName, onTuned }: FineTunePanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<FineTuneStatus | null>(null)
  const [latestResult, setLatestResult] = useState<FineTuneResult | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const activeMetrics = useMemo(() => {
    if (latestResult) {
      return latestResult
    }
    if (!status?.before_metrics || !status?.after_metrics || !status?.trained_at) {
      return null
    }
    return {
      machine_id: status.machine_id,
      accepted: status.has_custom_model,
      has_custom_model: status.has_custom_model,
      before_metrics: status.before_metrics,
      after_metrics: status.after_metrics,
      artifact_id: status.artifact_id,
      trained_at: status.trained_at,
      coverage: status.coverage,
      tuning_strategy: status.tuning_strategy,
    } satisfies FineTuneResult
  }, [latestResult, status])

  async function loadStatus() {
    setIsLoadingStatus(true)
    setStatusError(null)

    try {
      const response = await fetch(`http://localhost:8000/machines/${machineId}/fine-tune-status`)
      if (!response.ok) {
        throw new Error(`Status check failed with ${response.status}`)
      }
      const data = (await response.json()) as FineTuneStatus
      setStatus(data)
    } catch (fetchError) {
      setStatusError(fetchError instanceof Error ? fetchError.message : 'Unable to reach the tuning backend.')
      setStatus(null)
    } finally {
      setIsLoadingStatus(false)
    }
  }

  useEffect(() => {
    setSelectedFile(null)
    setWarnings([])
    setError(null)
    setLatestResult(null)
    setIsDraggingFile(false)
    void loadStatus()
  }, [machineId])

  function handleFileSelect(file: File | null) {
    setError(null)
    setWarnings([])
    setLatestResult(null)
    setSelectedFile(file)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelect(event.target.files?.[0] ?? null)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
    handleFileSelect(event.dataTransfer.files?.[0] ?? null)
  }

  async function validateSelectedFile(file: File) {
    if (!file.size) {
      throw new Error('The selected file is empty.')
    }

    const text = await file.text()
    const rows = parseCsvRows(text)
    if (rows.length < 2) {
      throw new Error('The CSV must include a header row and at least one data row.')
    }

    const headers = rows[0]
    const headerIndex = new Map(headers.map((header, index) => [header, index]))

    for (const required of REQUIRED_COLUMNS) {
      if (!headerIndex.has(required)) {
        throw new Error(`Missing required column: ${required}.`)
      }
    }

    const presentSensors = REGISTERED_SENSORS.filter(sensor => headerIndex.has(sensor))
    const missingSensorRatio = (REGISTERED_SENSORS.length - presentSensors.length) / REGISTERED_SENSORS.length
    const nextWarnings: string[] = []

    if (missingSensorRatio > 0.4) {
      throw new Error(
        `Insufficient sensor coverage: ${(missingSensorRatio * 100).toFixed(1)}% of registered sensors are missing.`
      )
    }
    if (missingSensorRatio > 0.2) {
      nextWarnings.push(
        `Sensor coverage warning: ${(missingSensorRatio * 100).toFixed(1)}% of registered sensors are missing.`
      )
    }

    const numericColumns = [
      ...OPTIONAL_NUMERIC_COLUMNS.filter(column => headerIndex.has(column)),
      ...REGISTERED_SENSORS.filter(sensor => headerIndex.has(sensor)),
      'cycle',
      'rul',
    ]

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      if (!row.some(cell => cell !== '')) {
        continue
      }

      for (const column of numericColumns) {
        const columnIndex = headerIndex.get(column)
        if (columnIndex === undefined) {
          continue
        }

        const value = row[columnIndex] ?? ''
        const isRequiredNumeric = column === 'cycle' || column === 'rul'
        if (isRequiredNumeric && value === '') {
          throw new Error(`Row ${rowIndex + 1} is missing a numeric value for '${column}'.`)
        }
        if (value !== '' && Number.isNaN(Number(value))) {
          throw new Error(`Row ${rowIndex + 1} has a malformed numeric value in '${column}'.`)
        }
      }
    }

    setWarnings(nextWarnings)
  }

  async function handleSubmit() {
    if (!selectedFile || isSubmitting) {
      return
    }

    setError(null)
    setLatestResult(null)

    try {
      await validateSelectedFile(selectedFile)
      setIsSubmitting(true)

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`http://localhost:8000/machines/${machineId}/fine-tune`, {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.detail || `Fine-tune request failed with ${response.status}.`)
      }

      const result = payload as FineTuneResult
      setLatestResult(result)

      if (result.accepted) {
        setStatus({
          machine_id: result.machine_id,
          has_custom_model: true,
          trained_at: result.trained_at,
          before_metrics: result.before_metrics,
          after_metrics: result.after_metrics,
          artifact_id: result.artifact_id,
          coverage: result.coverage,
          tuning_strategy: result.tuning_strategy,
        })
        onTuned?.(machineId)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Fine-tuning failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-background to-background">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <BrainCircuit className="h-4 w-4" />
            Machine-Specific Fine Tune
          </CardTitle>
          <CardDescription>
            Upload labeled historical sensor readings for <span className="font-medium text-foreground">{machineName}</span>.
            The shared base bundle stays untouched; accepted fine-tunes are saved as a machine-only overlay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground" htmlFor={`fine-tune-upload-${machineId}`}>
              Labeled CSV Upload
            </label>
            <label
              htmlFor={isSubmitting ? undefined : `fine-tune-upload-${machineId}`}
              onDragEnter={
                isSubmitting
                  ? undefined
                  : event => {
                      event.preventDefault()
                      setIsDraggingFile(true)
                    }
              }
              onDragLeave={
                isSubmitting
                  ? undefined
                  : event => {
                      event.preventDefault()
                      setIsDraggingFile(false)
                    }
              }
              onDragOver={
                isSubmitting
                  ? undefined
                  : event => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'copy'
                    }
              }
              onDrop={isSubmitting ? undefined : handleDrop}
              className={cn(
                'group relative block w-full overflow-hidden rounded-2xl border-2 border-dashed transition-all',
                isSubmitting &&
                  'cursor-default border-cyan-400/40 bg-[linear-gradient(135deg,rgba(8,47,73,0.9),rgba(8,23,33,0.94))]',
                !isSubmitting &&
                  isDraggingFile &&
                  'border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]',
                !isSubmitting && !isDraggingFile && 'border-border/70 bg-muted/20 hover:border-cyan-500/40 hover:bg-cyan-500/5'
              )}
              aria-busy={isSubmitting}
            >
              <input
                accept=".csv,text/csv"
                className="hidden"
                id={`fine-tune-upload-${machineId}`}
                type="file"
                disabled={isSubmitting}
                onChange={handleInputChange}
              />
              {isSubmitting ? (
                <RobotUploadBuffer />
              ) : (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 transition-transform group-hover:scale-105">
                    <FileUp className="h-7 w-7" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-foreground">
                    {selectedFile ? 'File Ready For Fine-Tuning' : 'Drop CSV Here Or Click To Browse'}
                  </div>
                  <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {selectedFile
                      ? `${selectedFile.name} - ${(selectedFile.size / 1024).toFixed(1)} KB`
                      : 'Drive-style upload area: drag a labeled CSV into this panel or click anywhere here to choose a file.'}
                  </div>
                  <div className="mt-4 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    CSV only
                  </div>
                </div>
              )}
            </label>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Required columns: <span className="font-medium text-foreground">engine_id</span>,{' '}
              <span className="font-medium text-foreground">cycle</span>, and{' '}
              <span className="font-medium text-foreground">rul</span>. The result view compares{' '}
              <span className="font-medium text-foreground">RMSE</span> and{' '}
              <span className="font-medium text-foreground">MAE</span> before and after tuning.
            </div>
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Validation Warnings
                </div>
                <div className="space-y-1">
                  {warnings.map(warning => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" disabled={!selectedFile || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Submit To Fine Tune
            </Button>
            <Button className="gap-2" disabled={isLoadingStatus} onClick={() => void loadStatus()} variant="outline">
              {isLoadingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {statusError && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 pt-6 text-sm text-amber-100" role="status">
            <Info className="h-4 w-4" />
            Backend status check failed: {statusError}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            {activeMetrics?.has_custom_model ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground" />
            )}
            Fine-Tune Result
          </CardTitle>
          <CardDescription>
            {activeMetrics
              ? `Last result recorded on ${formatDate(activeMetrics.trained_at)}.`
              : 'No machine-specific overlay has been accepted for this machine yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {latestResult && !latestResult.accepted && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              The latest tuning attempt did not beat the base ensemble RMSE, so the shared base model remains active.
            </div>
          )}

          <MetricComparisonChart
            beforeMetrics={activeMetrics?.before_metrics}
            afterMetrics={activeMetrics?.after_metrics}
          />
        </CardContent>
      </Card>
    </div>
  )
}