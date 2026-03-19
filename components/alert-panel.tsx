'use client'

import { Alert } from '@/lib/data'
import { cn } from '@/lib/utils'
import { AlertTriangle, AlertCircle, Info, Bell, Check, X } from 'lucide-react'
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
                'p-3 rounded-lg border transition-all',
                getSeverityStyles(alert.severity),
                alert.acknowledged && 'opacity-50',
                onAlertClick && !alert.acknowledged && 'cursor-pointer hover:brightness-110 hover:shadow-md active:scale-[0.99]'
              )}
              onClick={() => onAlertClick && !alert.acknowledged && onAlertClick(alert.machineId)}
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  'flex-shrink-0 mt-0.5',
                  alert.severity === 'critical' && !alert.acknowledged && 'animate-pulse'
                )}>
                  {getSeverityIcon(alert.severity)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{alert.machineName}</span>
                    <span className="text-[10px] opacity-70">{formatTime(alert.timestamp)}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{alert.message}</p>
                  {onAlertClick && !alert.acknowledged && (
                    <p className="text-[10px] mt-1 opacity-60 flex items-center gap-1">
                      🔧 Click to schedule maintenance
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 flex gap-1" onClick={e => e.stopPropagation()}>
                  {!alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onAcknowledge(alert.id)}
                      title="Acknowledge"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDismiss(alert.id)}
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
    </div>
  )
}
