'use client'

import { MachineComponent } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Info, TrendingDown, Wrench, DollarSign, Clock } from 'lucide-react'

interface XAIPanelProps {
  components: MachineComponent[]
  healthIndex: number
}

export function XAIPanel({ components, healthIndex }: XAIPanelProps) {
  // Sort components by contribution to RUL degradation
  const sortedComponents = [...components]
    .filter(c => c.contributionToRUL > 0)
    .sort((a, b) => b.contributionToRUL - a.contributionToRUL)

  const totalContribution = sortedComponents.reduce((sum, c) => sum + c.contributionToRUL, 0)

  if (sortedComponents.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-medium">Explainable AI Analysis</h4>
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No significant degradation factors detected.
          <br />
          All components operating within normal parameters.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium">Explainable AI Analysis</h4>
      </div>

      <div className="mb-4 p-3 bg-background/50 rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">RUL Degradation Summary</p>
        <p className="text-sm">
          Health index decreased to <span className={cn(
            'font-bold',
            healthIndex >= 80 ? 'text-success' :
            healthIndex >= 60 ? 'text-warning' :
            'text-destructive'
          )}>{healthIndex}%</span> due to:
        </p>
      </div>

      {/* Top Contributors */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Top Contributors</p>
        
        {sortedComponents.slice(0, 4).map((component) => {
          const percentage = Math.round((component.contributionToRUL / totalContribution) * 100)
          
          return (
            <div key={component.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className={cn(
                  'font-medium',
                  component.status === 'failing' || component.status === 'failed' ? 'text-destructive' :
                  component.status === 'degraded' ? 'text-warning' :
                  'text-foreground'
                )}>
                  {component.name}
                </span>
                <span className="font-mono text-xs">
                  {percentage}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    component.status === 'failing' || component.status === 'failed' ? 'bg-destructive' :
                    component.status === 'degraded' ? 'bg-warning' :
                    'bg-primary'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Component details */}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    component.health >= 80 ? 'bg-success' :
                    component.health >= 60 ? 'bg-warning' :
                    'bg-destructive'
                  )} />
                  Health: {component.health}%
                </span>
                {component.predictedFailure && (
                  <span className="flex items-center gap-1 text-destructive">
                    <Clock className="w-2.5 h-2.5" />
                    Fail: {new Date(component.predictedFailure).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recommendations */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">AI Recommendations</p>
        <div className="space-y-2">
          {sortedComponents.slice(0, 2).map((component) => (
            <div key={component.id} className="flex items-start gap-2 text-xs">
              <Wrench className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
              <span>
                {component.status === 'failing' || component.status === 'failed'
                  ? `Immediate replacement of ${component.name} recommended`
                  : component.status === 'degraded'
                  ? `Schedule ${component.name} inspection within ${Math.ceil(component.health / 10)} days`
                  : `Monitor ${component.name} during next maintenance window`}
              </span>
            </div>
          ))}
          
          {sortedComponents.some(c => c.predictedFailure) && (
            <div className="flex items-start gap-2 text-xs text-warning">
              <DollarSign className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                Early intervention could save $
                {sortedComponents
                  .filter(c => c.predictedFailure)
                  .reduce((sum, c) => sum + c.replacementCost * 0.3, 0)
                  .toLocaleString()} in emergency repair costs
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
