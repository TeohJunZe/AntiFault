'use client'

import { Alert } from '@/lib/data'
import { cn } from '@/lib/utils'
import { AlertTriangle, AlertCircle, Info, Bell, Check, X, Wrench, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AlertPanelProps {
  alerts: Alert[]
  onAcknowledge: (id: string) => void
  onDismiss: (id: string) => void
  onAlertClick?: (machineId: string) => void
}

export function AlertPanel({ alerts, onAcknowledge, onDismiss, onAlertClick }: AlertPanelProps) {
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged)
  const criticalCount = unacknowledgedAlerts.filter(a => a.severity === 'critical').length

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />
      case 'warning':
        return <AlertCircle className="w-4 h-4" />
      case 'info':
        return <Info className="w-4 h-4" />
    }
  }

  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 border-destructive/50 text-destructive'
      case 'warning':
        return 'bg-warning/10 border-warning/50 text-warning'
      case 'info':
        return 'bg-accent/10 border-accent/50 text-accent'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  return (
    <div className="space-y-2 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No active alerts
          </div>
        ) : (
        alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'group relative p-3 rounded-xl border transition-all duration-200 bg-background mb-2',
                alert.severity === 'critical' ? 'border-destructive/30 hover:border-destructive/50' :
                alert.severity === 'warning' ? 'border-warning/30 hover:border-warning/50' :
                'border-primary/30 hover:border-primary/50',
                alert.acknowledged && 'opacity-60 grayscale-[0.5]'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                  alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                  alert.severity === 'warning' ? 'bg-warning/10 text-warning' :
                  'bg-primary/10 text-primary'
                )}>
                  {getSeverityIcon(alert.severity)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                  <h4 className="text-sm md:text-base font-bold mb-1 truncate">{alert.machineName}</h4>
                  <p className="text-xs md:text-sm text-muted-foreground leading-snug mb-3 line-clamp-2 italic">
                    "{alert.message}"
                  </p>

                  {/* AI Recommendation */}
                  {!alert.acknowledged && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-3 border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1.5 uppercase tracking-tight">
                        <Lightbulb className="w-4 h-4" />
                        AI Expert Recommendation
                      </div>
                      <p className="text-xs md:text-sm leading-relaxed text-foreground/80">
                        {alert.severity === 'critical' 
                          ? <><strong className="text-destructive font-bold bg-destructive/5 px-1 rounded">Critical thermal variance</strong> detected. Emergency <strong className="text-indigo-400">shutoff & seal inspection</strong> recommended within 2h.</>
                          : <><strong className="text-warning font-bold bg-warning/5 px-1 rounded">Vibration patterns</strong> suggest early bearing wear. Schedule <strong className="text-indigo-400">non-disruptive inspection</strong> within 48h.</>}
                      </p>
                    </div>
                  )}

                  {!alert.acknowledged && (
                    <div className="flex gap-2 mb-1">
                       <Button
                        size="sm"
                        className="h-8 text-xs flex-1 gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border-none font-bold"
                        onClick={() => onAlertClick?.(alert.machineId)}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Fix Now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 px-3"
                        onClick={() => onAcknowledge(alert.id)}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                     className="text-muted-foreground hover:text-foreground"
                   >
                     <X className="w-3 h-3" />
                   </button>
                </div>
              </div>
            </div>
          ))
        )}
    </div>
  )
}
