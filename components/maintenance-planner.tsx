'use client'

import { useState, useEffect } from 'react'
import { Machine, MaintenanceTask, MachineComponent } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Clock, 
  Wrench, 
  User, 
  Package, 
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  Timer
} from 'lucide-react'

interface MaintenancePlannerProps {
  machine: Machine
  selectedComponent: MachineComponent | null
  tasks: MaintenanceTask[]
  onScheduleMaintenance: () => void
}

export function MaintenancePlanner({ 
  machine, 
  selectedComponent, 
  tasks,
  onScheduleMaintenance 
}: MaintenancePlannerProps) {
  const [scheduledStorage, setScheduledStorage] = useState<{
    machineId: string
    scheduledDate: string
    scheduledTime: string
    technician: string
    notes: string
    scheduledAt: string
  }[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('maintenanceScheduled')
      if (saved) setScheduledStorage(JSON.parse(saved))
    } catch (e) {}
  }, [])

  const machineTasks = scheduledStorage.filter(t => t.machineId === machine.id)
  
  const getStatusIcon = (status: MaintenanceTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />
      case 'in-progress':
        return <PlayCircle className="w-4 h-4 text-primary animate-pulse" />
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
      default:
        return <Timer className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getPriorityBadge = (priority: MaintenanceTask['priority']) => {
    const styles = {
      critical: 'bg-destructive/20 text-destructive border-destructive/30',
      high: 'bg-warning/20 text-warning border-warning/30',
      medium: 'bg-primary/20 text-primary border-primary/30',
      low: 'bg-muted text-muted-foreground border-muted',
    }
    return (
      <span className={cn(
        'px-2 py-0.5 rounded text-[10px] font-medium uppercase border',
        styles[priority]
      )}>
        {priority}
      </span>
    )
  }

  // Find next production gap (simulated)
  const nextProductionGap = '4 hours from now'

  return (
    <div className="space-y-4">
      {/* Quick Schedule */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Schedule Assistant
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Next scheduled production gap is in <span className="text-primary font-medium">{nextProductionGap}</span>
            </p>
          </div>
          <Button
            size="sm"
            onClick={machineTasks.length > 0 ? undefined : onScheduleMaintenance}
            className={cn("gap-2", machineTasks.length > 0 && "opacity-90 pointer-events-none border border-emerald-500/30 text-emerald-400 bg-emerald-500/10")}
            variant={machineTasks.length > 0 ? "outline" : "default"}
          >
            {machineTasks.length > 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Scheduled
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                Book Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Component-specific repair info */}
      {selectedComponent && (
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            Repair Info: {selectedComponent.name}
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Repair Time</p>
                <p className="text-sm font-medium">{selectedComponent.repairTime} hours</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Replacement Cost</p>
                <p className="text-sm font-medium">${selectedComponent.replacementCost.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Last Maintenance</p>
                <p className="text-sm font-medium">
                  {new Date(selectedComponent.lastMaintenance).toLocaleDateString()}
                </p>
              </div>
            </div>

            {selectedComponent.predictedFailure && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Predicted Failure</p>
                  <p className="text-sm font-medium text-destructive">
                    {new Date(selectedComponent.predictedFailure).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Tasks */}
      <div>
        <h4 className="text-sm font-medium mb-3">Scheduled Tasks</h4>
        {machineTasks.length > 0 ? (
          <div className="space-y-2">
            {machineTasks.map((task, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border transition-all bg-muted/30 border-border shadow-sm"
              >
                <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="text-base font-semibold">Scheduled Maintenance</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{new Date(task.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{task.scheduledTime || '09:00'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium truncate">{task.technician || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-start gap-2 max-w-full overflow-hidden">
                    <span className="font-medium text-muted-foreground shrink-0 mt-0.5">Notes:</span>
                    <span className="text-sm truncate" title={task.notes}>{task.notes || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg text-center border border-dashed border-border">
            No maintenance tasks scheduled for this machine.
          </div>
        )}
      </div>

      {/* Resource Kit */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Resource Kit
        </h4>
        <p className="text-xs text-muted-foreground mb-2">Parts likely needed for repair:</p>
        
        <div className="flex flex-wrap gap-2">
          {selectedComponent ? (
            <>
              <span className="px-2 py-1 bg-background rounded text-xs">
                {selectedComponent.name}
              </span>
              <span className="px-2 py-1 bg-background rounded text-xs">Seal Kit</span>
              <span className="px-2 py-1 bg-background rounded text-xs">Lubricant</span>
              {selectedComponent.status === 'failing' && (
                <span className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs">
                  Replacement Unit
                </span>
              )}
            </>
          ) : (
            machine.components
              .filter(c => c.status !== 'healthy')
              .slice(0, 4)
              .map(c => (
                <span
                  key={c.id}
                  className={cn(
                    'px-2 py-1 rounded text-xs',
                    c.status === 'failing' || c.status === 'failed' 
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-warning/20 text-warning'
                  )}
                >
                  {c.name}
                </span>
              ))
          )}
        </div>
      </div>
    </div>
  )
}
