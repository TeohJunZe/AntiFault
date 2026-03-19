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
  Timer,
  Lightbulb,
  Bot,
  TrendingUp,
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

      {/* AI Recommendation & Analysis */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-xl p-5 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Bot className="w-20 h-20 text-indigo-400" />
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-400 uppercase tracking-widest">
            <Lightbulb className="w-4 h-4" />
            AI Predictive Maintenance Engine
          </h4>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            LIVE ANALYSIS
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div className="md:col-span-2">
            <p className="text-sm text-foreground/90 leading-relaxed mb-4">
              {selectedComponent ? (
                <>Based on high-frequency vibration analysis and thermal delta tracking, the <strong className="text-indigo-400 font-bold bg-indigo-500/5 px-1 rounded">secondary seal degradation</strong>. Neural models project a <span className="text-destructive font-black">84% probability</span> of unplanned stoppage if intervention is delayed beyond the next maintenance window.</>
              ) : (
                <>Fleet-wide telemetry indicates a <span className="text-warning font-bold bg-warning/5 px-1 rounded">correlative health decline</span> across {machine.components.filter(c => c.status !== 'healthy').length} sub-systems. Operational efficiency (OEE) is projected to drop by <span className="text-destructive font-black">4.2%</span> over the next 72 hours without targeted fluid-dynamic calibration.</>
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/40 px-2 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                Validating sensor calibration...
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/40 px-2 py-1 rounded-md">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                Analyzing historical failure patterns
              </div>
            </div>
          </div>
          
          <div className="space-y-3 bg-background/30 p-4 rounded-xl border border-indigo-500/10">
            <div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground mb-1">
                <span>Confidence Score</span>
                <span className="text-indigo-400">96.4%</span>
              </div>
              <div className="h-1.5 w-full bg-indigo-500/10 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '96.4%' }} />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Risk Level</div>
              <div className={cn(
                "inline-flex px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                selectedComponent?.status === 'failing' ? "bg-destructive/20 text-destructive border border-destructive/30" : "bg-warning/20 text-warning border border-warning/30"
              )}>
                {selectedComponent?.status === 'failing' ? 'CRITICAL EVASION REQUIRED' : 'PROACTIVE MONITORING ACTIVE'}
              </div>
            </div>
            <div className="pt-1 border-t border-indigo-500/10">
               <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Estimated Savings</div>
               <div className="text-lg font-black text-success tabular-nums">
                 +${((selectedComponent?.replacementCost || 50000) * 0.15).toLocaleString()}
               </div>
            </div>
          </div>
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
