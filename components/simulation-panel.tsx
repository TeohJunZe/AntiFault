'use client'

import { useState, useMemo } from 'react'
import { Machine, simulateMaintenanceDelay, SimulationResult } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'
import { 
  Play, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  Lightbulb,
} from 'lucide-react'

interface SimulationPanelProps {
  machine: Machine | null
  machines?: Machine[]
  isFleetView?: boolean
}

export function SimulationPanel({ machine, machines = [], isFleetView = false }: SimulationPanelProps) {
  const [daysToDelay, setDaysToDelay] = useState(3)

  // Compute results in real-time based on slider value
  const fleetResults = useMemo(() => {
    if (!isFleetView || machines.length === 0) return null
    return machines.map(m => ({
      machine: m,
      result: simulateMaintenanceDelay(m, daysToDelay)
    }))
  }, [isFleetView, machines, daysToDelay])

  const result = useMemo(() => {
    if (isFleetView || !machine) return null
    return simulateMaintenanceDelay(machine, daysToDelay)
  }, [isFleetView, machine, daysToDelay])

  const getRiskColor = (risk: SimulationResult['riskLevel']) => {
    switch (risk) {
      case 'low':
        return 'text-success bg-success/20 border-success/30'
      case 'medium':
        return 'text-primary bg-primary/20 border-primary/30'
      case 'high':
        return 'text-warning bg-warning/20 border-warning/30'
      case 'critical':
        return 'text-destructive bg-destructive/20 border-destructive/30'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium">Digital Twin Simulation</h4>
      </div>

      <p className="text-xs text-muted-foreground">
        Test the impact of delaying maintenance {isFleetView ? 'across your fleet' : machine ? `on ${machine.name}` : ''}
      </p>

      {/* Delay Selection with Slider */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Delay maintenance by:</span>
          <span className="text-xl font-bold text-primary">{daysToDelay} days</span>
        </div>

        {/* Slider */}
        <div className="px-1">
          <Slider
            value={[daysToDelay]}
            onValueChange={(value) => setDaysToDelay(value[0])}
            min={1}
            max={30}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>1 day</span>
            <span>30 days</span>
          </div>
        </div>
      </div>

      {/* Fleet Results - Real-time */}
      {fleetResults && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-destructive transition-all">
                {fleetResults.filter(r => r.result.riskLevel === 'critical').length}
              </div>
              <div className="text-xs text-muted-foreground">Critical Risk</div>
            </div>
            <div className="bg-warning/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-warning transition-all">
                {fleetResults.filter(r => r.result.riskLevel === 'high').length}
              </div>
              <div className="text-xs text-muted-foreground">High Risk</div>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-success transition-all">
                {fleetResults.filter(r => r.result.riskLevel === 'low' || r.result.riskLevel === 'medium').length}
              </div>
              <div className="text-xs text-muted-foreground">Safe</div>
            </div>
          </div>

          {/* Total Financial Impact */}
          <div className={cn(
            'p-4 rounded-lg border text-center transition-all',
            'bg-destructive/10 text-destructive border-destructive/30'
          )}>
            <div className="text-xs uppercase tracking-wider mb-1">Total Financial Impact</div>
            <div className="text-3xl font-bold tabular-nums">
              ${Math.round(fleetResults.reduce((acc, r) => acc + r.result.financialImpact, 0)).toLocaleString()}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              If maintenance delayed by {daysToDelay} days
            </div>
          </div>

          {/* Machine Breakdown */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-3">Machine Impact Breakdown</div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {fleetResults
                .sort((a, b) => {
                  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
                  return riskOrder[a.result.riskLevel] - riskOrder[b.result.riskLevel]
                })
                .map(({ machine: m, result: r }) => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-background rounded transition-all">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-2 h-2 rounded-full transition-colors',
                        r.riskLevel === 'critical' ? 'bg-destructive' :
                        r.riskLevel === 'high' ? 'bg-warning' :
                        'bg-success'
                      )} />
                      <span className="text-sm">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={cn(
                        'tabular-nums transition-colors',
                        r.projectedRUL <= 0 ? 'text-destructive' :
                        r.projectedRUL <= 5 ? 'text-warning' :
                        'text-muted-foreground'
                      )}>
                        RUL: {r.projectedRUL <= 0 ? 'FAIL' : `${Math.round(r.projectedRUL)}d`}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        ${Math.round(r.financialImpact).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Key Recommendations */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Lightbulb className="w-3 h-3" />
              Key Recommendations
            </div>
            <ul className="space-y-1.5">
              {fleetResults.filter(r => r.result.riskLevel === 'critical').length > 0 && (
                <li className="flex items-start gap-2 text-xs text-destructive font-medium">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {fleetResults.filter(r => r.result.riskLevel === 'critical').length} machine(s) will reach critical state - immediate action required
                </li>
              )}
              {fleetResults.some(r => r.result.projectedRUL <= 0) && (
                <li className="flex items-start gap-2 text-xs text-destructive font-medium">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Potential machine failures projected - do not delay maintenance
                </li>
              )}
              <li className="flex items-start gap-2 text-xs">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Consider staggering maintenance to minimize production impact
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Single Machine Results - Real-time */}
      {result && machine && (
        <div className="space-y-4">
          {/* Risk Level */}
          <div className={cn(
            'p-4 rounded-lg border text-center transition-all',
            getRiskColor(result.riskLevel)
          )}>
            <div className="text-xs uppercase tracking-wider mb-1">Risk Level</div>
            <div className="text-2xl font-bold uppercase">{result.riskLevel}</div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock className="w-3 h-3" />
                Projected RUL
              </div>
              <div className={cn(
                'text-lg font-bold tabular-nums transition-colors',
                result.projectedRUL <= 0 ? 'text-destructive' :
                result.projectedRUL <= 5 ? 'text-warning' :
                'text-foreground'
              )}>
                {result.projectedRUL <= 0 ? 'FAILURE' : `${Math.round(result.projectedRUL)} days`}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Current: {machine.rul} days
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="w-3 h-3" />
                Financial Impact
              </div>
              <div className={cn(
                'text-lg font-bold tabular-nums transition-colors',
                result.financialImpact > 10000 ? 'text-destructive' :
                result.financialImpact > 5000 ? 'text-warning' :
                'text-foreground'
              )}>
                ${Math.round(result.financialImpact).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Risk-adjusted cost
              </div>
            </div>
          </div>

          {/* Comparison Visualization */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <TrendingDown className="w-3 h-3" />
              RUL Comparison
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs w-16">Current</span>
                <div className="flex-1 h-4 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(machine.rul / 60) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-12 text-right tabular-nums">{machine.rul}d</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs w-16">After</span>
                <div className="flex-1 h-4 bg-background rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      result.projectedRUL <= 0 ? 'bg-destructive' :
                      result.projectedRUL <= 5 ? 'bg-warning' :
                      'bg-success'
                    )}
                    style={{ width: `${Math.max(0, (result.projectedRUL / 60) * 100)}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs font-mono w-12 text-right tabular-nums',
                  result.projectedRUL <= 0 && 'text-destructive'
                )}>
                  {result.projectedRUL <= 0 ? 'FAIL' : `${Math.round(result.projectedRUL)}d`}
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Lightbulb className="w-3 h-3" />
              Recommendations
            </div>
            <ul className="space-y-1.5">
              {result.recommendations.map((rec, index) => (
                <li
                  key={index}
                  className={cn(
                    'flex items-start gap-2 text-xs',
                    index === 0 && result.riskLevel === 'critical' && 'text-destructive font-medium'
                  )}
                >
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
