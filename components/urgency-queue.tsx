'use client'

import { Machine } from '@/lib/data'
import { cn } from '@/lib/utils'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'

interface UrgencyQueueProps {
  machines: Machine[]
  onSelectMachine: (id: string) => void
}

export function UrgencyQueue({ machines, onSelectMachine }: UrgencyQueueProps) {
  // Sort by RUL (shortest first)
  const sortedMachines = [...machines].sort((a, b) => a.rul - b.rul)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Urgency Queue</h3>
        <span className="text-xs text-muted-foreground">Sorted by RUL</span>
      </div>
      
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {sortedMachines.map((machine, index) => (
          <button
            key={machine.id}
            onClick={() => onSelectMachine(machine.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg transition-all',
              'bg-muted/50 hover:bg-muted border border-transparent',
              'hover:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary',
              machine.status === 'critical' && 'bg-destructive/10 border-destructive/30'
            )}
          >
            {/* Priority indicator */}
            <div className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
              index === 0 && machine.status === 'critical' ? 'bg-destructive text-destructive-foreground animate-pulse' :
              index === 0 ? 'bg-warning text-warning-foreground' :
              'bg-muted-foreground/20 text-muted-foreground'
            )}>
              {index + 1}
            </div>

            {/* Machine info */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{machine.name}</span>
                {machine.status === 'critical' && (
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">{machine.type}</div>
            </div>

            {/* RUL countdown */}
            <div className="flex-shrink-0 text-right">
              <div className={cn(
                'flex items-center gap-1 text-sm font-mono font-bold',
                machine.rul <= 5 ? 'text-destructive' :
                machine.rul <= 15 ? 'text-warning' :
                'text-success'
              )}>
                <Clock className="w-3 h-3" />
                {machine.rul}d
              </div>
              <div className="text-[10px] text-muted-foreground">RUL</div>
            </div>

            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}
