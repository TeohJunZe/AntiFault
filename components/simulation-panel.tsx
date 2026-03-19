'use client'

import { useState, useEffect, useMemo } from 'react'
import { Machine } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'
import { 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  Lightbulb,
  Calculator,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react'

// ==========================================
// Financial Constants
// ==========================================
const BASE_MAINTENANCE_COST = 2_000    // Baseline scheduled maintenance
const REPAIR_COST_PER_DAY_LATE = 500   // Incremental cost per day of delay
const REPLACEMENT_COST = 150_000       // Total loss when RUL hits 0 (full replacement)
const DOWNTIME_COST_PER_DAY = 8_000    // Lost production per day of unplanned downtime
const EMERGENCY_PREMIUM = 3.0          // Multiplier for emergency response

interface SimulationPanelProps {
  machine: Machine | null
  machines?: Machine[]
  isFleetView?: boolean
}

type RiskLevel = 'safe' | 'high_risk' | 'critical' | 'scrapped'

interface MachineImpact {
  id: string
  name: string
  currentRul: number
  projectedRul: number
  risk: RiskLevel
  maintenanceCost: number
  downtimeCost: number
  replacementCost: number
  totalCost: number
  steps: string[]
}

function getRisk(rul: number): RiskLevel {
  if (rul > 80) return 'safe'
  if (rul > 30) return 'high_risk'
  if (rul > 0) return 'critical'
  return 'scrapped'
}

function getRiskLabel(risk: RiskLevel) {
  switch (risk) {
    case 'safe': return 'Safe'
    case 'high_risk': return 'High Risk'
    case 'critical': return 'Critical'
    case 'scrapped': return 'Scrapped'
  }
}

function getRiskStyle(risk: RiskLevel) {
  switch (risk) {
    case 'safe': return 'text-green-500 bg-green-500/20 border-green-500/30'
    case 'high_risk': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30'
    case 'critical': return 'text-orange-500 bg-orange-500/20 border-orange-500/30'
    case 'scrapped': return 'text-red-500 bg-red-500/20 border-red-500/30'
  }
}

function getRiskIcon(risk: RiskLevel) {
  switch (risk) {
    case 'safe': return ShieldCheck
    case 'high_risk': return AlertTriangle
    case 'critical': return ShieldAlert
    case 'scrapped': return ShieldX
  }
}

function calculateImpact(name: string, id: string, currentRul: number, daysDelay: number): MachineImpact {
  const projectedRul = Math.max(0, currentRul - daysDelay)
  const risk = getRisk(projectedRul)
  const steps: string[] = []

  // Step 1: Base maintenance cost
  let maintenanceCost = BASE_MAINTENANCE_COST
  steps.push(`Base maintenance: $${BASE_MAINTENANCE_COST.toLocaleString()}`)

  // Step 2: Degradation surcharge (lower RUL = higher cost)
  if (projectedRul <= 80) {
    const degradationFactor = (80 - projectedRul) / 80
    const surcharge = Math.round(degradationFactor * daysDelay * REPAIR_COST_PER_DAY_LATE)
    maintenanceCost += surcharge
    steps.push(`Degradation surcharge: $${surcharge.toLocaleString()}`)
  } else {
    steps.push(`Degradation surcharge: $0`)
  }

  // Step 3: Emergency premium for critical or scrapped machines
  if (risk === 'critical' || risk === 'scrapped') {
    const premiumCost = Math.round(maintenanceCost * (EMERGENCY_PREMIUM - 1))
    steps.push(`Emergency premium (${EMERGENCY_PREMIUM}x): +$${premiumCost.toLocaleString()}`)
    maintenanceCost = Math.round(maintenanceCost * EMERGENCY_PREMIUM)
  }

  // Step 4: Downtime cost
  let downtimeCost = 0
  if (projectedRul <= 30) {
    const downtimeDays = Math.min(daysDelay, Math.ceil(30 - projectedRul))
    downtimeCost = downtimeDays * DOWNTIME_COST_PER_DAY
    steps.push(`Unplanned downtime: $${downtimeCost.toLocaleString()}`)
  } else {
    steps.push(`Unplanned downtime: $0`)
  }

  // Step 5: Replacement cost (RUL hits 0 = total loss)
  let replacementCost = 0
  if (projectedRul <= 0) {
    replacementCost = REPLACEMENT_COST
    steps.push(`⚠ Full replacement: $${REPLACEMENT_COST.toLocaleString()}`)
  }

  const totalCost = maintenanceCost + downtimeCost + replacementCost
  steps.push(`──────────`)
  steps.push(`Total = $${maintenanceCost.toLocaleString()} + $${downtimeCost.toLocaleString()} + $${replacementCost.toLocaleString()} = $${totalCost.toLocaleString()}`)

  return {
    id, name, currentRul, projectedRul, risk,
    maintenanceCost, downtimeCost, replacementCost, totalCost, steps,
  }
}

export function SimulationPanel({ machine, machines = [], isFleetView = false }: SimulationPanelProps) {
  const [daysToDelay, setDaysToDelay] = useState(3)
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null)

  // Read predictions from browser storage
  const [predictions, setPredictions] = useState<Record<string, { rul: number; status: string }>>({})

  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem('enginePredictions')
        if (stored) setPredictions(JSON.parse(stored))
      } catch {}
    }
    load()
    window.addEventListener('predictionsUpdated', load)
    return () => window.removeEventListener('predictionsUpdated', load)
  }, [])

  // Resolve which machines to analyze
  const targetMachines = useMemo(() => {
    if (isFleetView) return machines
    if (machine) return [machine]
    return []
  }, [isFleetView, machines, machine])

  // Compute financial impacts using live RUL from browser storage
  const impacts = useMemo(() => {
    return targetMachines.map(m => {
      const liveRul = predictions[m.id]?.rul ?? m.rul
      return calculateImpact(m.name, m.id, liveRul, daysToDelay)
    }).sort((a, b) => a.projectedRul - b.projectedRul)
  }, [targetMachines, predictions, daysToDelay])

  const totalFinancialImpact = useMemo(() =>
    impacts.reduce((acc, i) => acc + i.totalCost, 0), [impacts])

  const riskCounts = useMemo(() => ({
    safe: impacts.filter(i => i.risk === 'safe').length,
    high_risk: impacts.filter(i => i.risk === 'high_risk').length,
    critical: impacts.filter(i => i.risk === 'critical').length,
    scrapped: impacts.filter(i => i.risk === 'scrapped').length,
  }), [impacts])

  if (targetMachines.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        Select a machine to simulate delay impact
      </div>
    )
  }

  return (
    <div className="space-y-4 text-base">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-primary" />
        <h4 className="text-base font-semibold">Delay Impact Simulator</h4>
      </div>

      <p className="text-sm text-muted-foreground">
        Simulate the financial and operational impact of delaying maintenance
        {isFleetView ? ' across your fleet' : machine ? ` on ${machine.name}` : ''}
      </p>

      {/* Delay Slider */}
      <div className="space-y-4 bg-muted/20 p-4 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-base font-medium">Delay maintenance by:</span>
          <span className={cn(
            "text-2xl font-bold transition-colors",
            daysToDelay <= 10 ? 'text-success' :
            daysToDelay <= 20 ? 'text-warning' :
            'text-destructive'
          )}>
            {daysToDelay} days
          </span>
        </div>

        <div className="text-sm font-medium">
          {daysToDelay <= 10 && <span className="text-success flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Low Risk - Minimal additional degradation</span>}
          {daysToDelay > 10 && daysToDelay <= 20 && <span className="text-warning flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> Moderate Risk - Accelerated wear and increased costs</span>}
          {daysToDelay > 20 && <span className="text-destructive flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> Critical Risk - High likelihood of unplanned downtime</span>}
        </div>

        <div className={cn(
          "px-1 py-4 transition-all duration-300",
          daysToDelay <= 10 ? "[&_[data-slot=slider-range]]:bg-success [&_[data-slot=slider-thumb]]:border-success focus-visible:[&_[data-slot=slider-thumb]]:ring-success/50" :
          daysToDelay <= 20 ? "[&_[data-slot=slider-range]]:bg-warning [&_[data-slot=slider-thumb]]:border-warning focus-visible:[&_[data-slot=slider-thumb]]:ring-warning/50" :
          "[&_[data-slot=slider-range]]:bg-destructive [&_[data-slot=slider-thumb]]:border-destructive focus-visible:[&_[data-slot=slider-thumb]]:ring-destructive/50"
        )}>
          <Slider
            value={[daysToDelay]}
            onValueChange={(value) => setDaysToDelay(value[0])}
            min={1}
            max={30}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between mt-3 text-xs font-medium text-muted-foreground">
            <span>1 day</span>
            <span>15 days</span>
            <span>30 days</span>
          </div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-green-500/10 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-green-500 transition-all">{riskCounts.safe}</div>
          <div className="text-sm text-muted-foreground">Safe</div>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-yellow-500 transition-all">{riskCounts.high_risk}</div>
          <div className="text-sm text-muted-foreground">High Risk</div>
        </div>
        <div className="bg-orange-500/10 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-orange-500 transition-all">{riskCounts.critical}</div>
          <div className="text-sm text-muted-foreground">Critical</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-red-500 transition-all">{riskCounts.scrapped}</div>
          <div className="text-sm text-muted-foreground">Scrapped</div>
        </div>
      </div>

      {/* Total Financial Impact */}
      <div className={cn(
        'p-4 rounded-lg border text-center transition-all',
        totalFinancialImpact > 100_000
          ? 'bg-destructive/10 text-destructive border-destructive/30'
          : totalFinancialImpact > 30_000
          ? 'bg-warning/10 text-warning border-warning/30'
          : 'bg-success/10 text-success border-success/30'
      )}>
        <div className="text-sm uppercase tracking-wider mb-1">Total Financial Impact</div>
        <div className="text-4xl font-bold tabular-nums">
          ${totalFinancialImpact.toLocaleString()}
        </div>
        <div className="text-sm mt-1 text-muted-foreground">
          If maintenance delayed by {daysToDelay} day{daysToDelay > 1 ? 's' : ''}
        </div>
      </div>

      {/* Side-by-side: Breakdown + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

      {/* Machine Breakdown with Expandable Calculation Steps */}
      <div className="bg-muted/30 rounded-lg p-4 md:col-span-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Calculator className="w-4 h-4" />
          Machine Impact Breakdown — click to view calculations
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {impacts.map(impact => {
            const isExpanded = expandedMachine === impact.id
            const RiskIcon = getRiskIcon(impact.risk)
            return (
              <div key={impact.id} className="bg-background rounded-lg transition-all overflow-hidden">
                {/* Summary row */}
                <button
                  className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedMachine(isExpanded ? null : impact.id)}
                >
                  <div className="flex items-center gap-2">
                    <RiskIcon className={cn('w-4 h-4',
                      impact.risk === 'safe' ? 'text-green-500' :
                      impact.risk === 'high_risk' ? 'text-yellow-500' : 
                      impact.risk === 'critical' ? 'text-orange-500' : 'text-red-500'
                    )} />
                    <div>
                      <div className="text-base font-medium">{impact.name}</div>
                      <div className="text-xs text-muted-foreground">
                        RUL: {impact.currentRul.toFixed(1)}d → {impact.projectedRul.toFixed(1)}d
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={cn('text-base font-bold tabular-nums',
                        impact.risk === 'scrapped' ? 'text-red-500' :
                        impact.risk === 'critical' ? 'text-orange-500' :
                        impact.risk === 'high_risk' ? 'text-yellow-500' : 'text-green-500'
                      )}>
                        ${impact.totalCost.toLocaleString()}
                      </div>
                      <div className={cn('text-xs font-medium',
                        getRiskStyle(impact.risk).split(' ')[0]
                      )}>
                        {getRiskLabel(impact.risk)}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Expandable calculation steps */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border">
                    <div className="mt-2 space-y-1.5">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Calculation Breakdown
                      </div>
                      {impact.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'text-sm font-mono',
                            step.startsWith('⚠') ? 'text-red-500 font-semibold' :
                            step.startsWith('──') ? 'text-border' :
                            step.startsWith('Total') ? 'text-foreground font-bold' :
                            'text-muted-foreground'
                          )}
                        >
                          {step}
                        </div>
                      ))}
                    </div>

                    {/* RUL bar comparison */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-14">Current</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (impact.currentRul / 120) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono w-14 text-right">{impact.currentRul.toFixed(1)}d</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-14">After</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              impact.risk === 'scrapped' ? 'bg-red-500' :
                              impact.risk === 'critical' ? 'bg-orange-500' :
                              impact.risk === 'high_risk' ? 'bg-yellow-500' : 'bg-green-500'
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, (impact.projectedRul / 120) * 100))}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-xs font-mono w-14 text-right',
                          impact.projectedRul <= 0 && 'text-red-500 font-bold'
                        )}>
                          {impact.projectedRul <= 0 ? 'FAIL' : `${impact.projectedRul.toFixed(1)}d`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recommendations — separate card to the right */}
      <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
        <div className="flex items-center gap-2 text-base font-semibold mb-3">
          <Lightbulb className="w-5 h-5 text-primary" />
          Recommendations
        </div>
        <ul className="space-y-3">
          {riskCounts.critical > 0 && (
            <li className="flex items-start gap-2 text-sm text-orange-500 font-medium">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {riskCounts.critical} machine{riskCounts.critical > 1 ? 's' : ''} will enter critical state — immediate maintenance required
            </li>
          )}
          {riskCounts.scrapped > 0 && (
            <li className="flex items-start gap-2 text-sm text-red-500 font-medium">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {riskCounts.scrapped} machine{riskCounts.scrapped > 1 ? 's' : ''} failure projected — full replacement cost of ${REPLACEMENT_COST.toLocaleString()} per unit
            </li>
          )}
          {riskCounts.high_risk > 0 && (
            <li className="flex items-start gap-2 text-sm text-yellow-500">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {riskCounts.high_risk} machine{riskCounts.high_risk > 1 ? 's' : ''} approaching critical threshold — schedule maintenance within {Math.max(1, Math.round(impacts.filter(i => i.risk === 'high_risk').reduce((min, i) => Math.min(min, i.projectedRul - 30), Infinity)))} days
            </li>
          )}
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Consider staggering maintenance to minimize production impact
          </li>
        </ul>
      </div>

      </div> {/* end grid */}
    </div>
  )
}
