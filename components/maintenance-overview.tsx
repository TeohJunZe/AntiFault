'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Machine, MaintenanceTask } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  ClipboardList,
  TrendingDown,
} from 'lucide-react'

interface MaintenanceOverviewProps {
  machines: Machine[]
  tasks?: MaintenanceTask[]
  onMachineSelect: (id: string) => void
  onScheduleMaintenance: (machineId: string, date: string, technician: string, type: string, notes: string) => void
  focusedMachineId?: string | null
  focusedAlertMessage?: string | null
}

type MaintenanceStatus = 'overdue' | 'critical' | 'due-soon' | 'scheduled' | 'good'

function getMachineMaintenanceStatus(machine: Machine): MaintenanceStatus {
  const now = new Date()
  const nextDate = new Date(machine.nextScheduledMaintenance)
  const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / 86400000)

  if (machine.rul < 10) return 'critical'
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 7) return 'due-soon'
  if (daysUntil <= 30) return 'scheduled'
  return 'good'
}

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  overdue: { label: 'Overdue', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', Icon: AlertTriangle },
  critical: { label: 'Critical RUL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', Icon: TrendingDown },
  'due-soon': { label: 'Due Soon', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', Icon: Clock },
  scheduled: { label: 'Scheduled', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', Icon: Calendar },
  good: { label: 'On Track', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', Icon: CheckCircle2 },
}

const MAINTENANCE_TYPES = ['Preventive', 'Predictive', 'Corrective', 'Inspection']
const STATUS_SORT_ORDER: MaintenanceStatus[] = ['overdue', 'critical', 'due-soon', 'scheduled', 'good']

interface ScheduleFormState {
  date: string
  technician: string
  type: string
  notes: string
}

export function MaintenanceOverview({ machines, tasks = [], onMachineSelect, onScheduleMaintenance, focusedMachineId, focusedAlertMessage }: MaintenanceOverviewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, ScheduleFormState>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // When focusedMachineId changes (from an alert click), expand and scroll to that card
  useEffect(() => {
    if (!focusedMachineId) return
    setExpandedId(focusedMachineId)
    // Give the DOM a tick to render the expanded form before scrolling
    setTimeout(() => {
      const el = cardRefs.current[focusedMachineId]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [focusedMachineId])
  const sorted = useMemo(() => {
    return [...machines].sort((a, b) => {
      const sA = getMachineMaintenanceStatus(a)
      const sB = getMachineMaintenanceStatus(b)
      const diff = STATUS_SORT_ORDER.indexOf(sA) - STATUS_SORT_ORDER.indexOf(sB)
      if (diff !== 0) return diff
      return a.rul - b.rul // within same status, urgent RUL first
    })
  }, [machines])

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<MaintenanceStatus, number> = { overdue: 0, critical: 0, 'due-soon': 0, scheduled: 0, good: 0 }
    machines.forEach(m => { c[getMachineMaintenanceStatus(m)]++ })
    return c
  }, [machines])

  const getForm = (id: string): ScheduleFormState => forms[id] ?? {
    date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    technician: '',
    type: 'Preventive',
    notes: '',
  }

  const setForm = (id: string, update: Partial<ScheduleFormState>) => {
    setForms(prev => ({ ...prev, [id]: { ...getForm(id), ...update } }))
  }

  const handleSubmit = (machineId: string) => {
    const f = getForm(machineId)
    if (!f.date) return
    onScheduleMaintenance(machineId, f.date, f.technician, f.type, f.notes)
    setExpandedId(null)
  }

  const pendingTasksForMachine = (machineId: string) =>
    tasks.filter(t => t.machineId === machineId && t.status !== 'completed')

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.entries(STATUS_CONFIG) as [MaintenanceStatus, typeof STATUS_CONFIG[MaintenanceStatus]][]).map(([key, cfg]) => (
          <div key={key} className={cn('rounded-xl p-3 border flex items-center gap-3', cfg.bg, cfg.border)}>
            <cfg.Icon className={cn('w-5 h-5 flex-shrink-0', cfg.color)} />
            <div>
              <div className={cn('text-2xl font-bold leading-none', cfg.color)}>{counts[key]}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{cfg.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Machine Cards */}
      <div className="space-y-3">
        {sorted.map((machine) => {
          const status = getMachineMaintenanceStatus(machine)
          const cfg = STATUS_CONFIG[status]
          const isExpanded = expandedId === machine.id
          const f = getForm(machine.id)
          const pending = pendingTasksForMachine(machine.id)
          const daysUntil = Math.ceil(
            (new Date(machine.nextScheduledMaintenance).getTime() - Date.now()) / 86400000
          )

          return (
            <div key={machine.id} ref={el => { cardRefs.current[machine.id] = el }}>
            <Card className={cn('transition-all duration-200', isExpanded && 'ring-1 ring-emerald-500/30', focusedMachineId === machine.id && 'ring-2 ring-amber-500/50')}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border', cfg.bg, cfg.border)}>
                    <cfg.Icon className={cn('w-5 h-5', cfg.color)} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onMachineSelect(machine.id)}
                        className="font-semibold text-sm hover:text-primary transition-colors text-left"
                      >
                        {machine.name}
                      </button>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', cfg.bg, cfg.border, cfg.color)}>
                        {cfg.label}
                      </span>
                      {pending.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                          {pending.length} task{pending.length > 1 ? 's' : ''} pending
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{machine.type}</div>

                    {/* Metrics row */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Health:</span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', machine.healthIndex >= 80 ? 'bg-emerald-500' : machine.healthIndex >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${machine.healthIndex}%` }}
                          />
                        </div>
                        <span className={cn('font-medium', machine.healthIndex >= 80 ? 'text-emerald-400' : machine.healthIndex >= 60 ? 'text-amber-400' : 'text-red-400')}>
                          {machine.healthIndex}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">RUL:</span>
                        <span className={cn('font-medium', machine.rul < 30 ? 'text-red-400' : machine.rul <= 80 ? 'text-amber-400' : 'text-emerald-400')}>
                          {machine.rul}d
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Last service:</span>
                        <span className="font-medium">{new Date(machine.lastMaintenance).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Next scheduled:</span>
                        <span className={cn('font-medium', daysUntil < 0 ? 'text-red-400' : daysUntil <= 7 ? 'text-amber-400' : '')}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : `in ${daysUntil}d`}
                          {' '}({new Date(machine.nextScheduledMaintenance).toLocaleDateString()})
                        </span>
                      </div>
                    </div>

                    {/* Pending tasks preview */}
                    {pending.length > 0 && !isExpanded && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pending.slice(0, 2).map(t => (
                          <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {t.type} — {new Date(t.scheduledDate).toLocaleDateString()}
                            {t.assignedTechnician && ` · ${t.assignedTechnician}`}
                          </span>
                        ))}
                        {pending.length > 2 && <span className="text-[10px] text-muted-foreground">+{pending.length - 2} more</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant={isExpanded ? 'default' : 'outline'}
                      className={cn('gap-1.5 text-xs', isExpanded && 'bg-emerald-600 hover:bg-emerald-700 text-white border-0')}
                      onClick={() => setExpandedId(isExpanded ? null : machine.id)}
                    >
                      {isExpanded ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Close</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Schedule</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Schedule Form */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border animate-in fade-in-50 slide-in-from-top-2 duration-200">
                    {/* Alert source banner */}
                    {focusedMachineId === machine.id && focusedAlertMessage && (
                      <div className="mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300">{focusedAlertMessage}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">Schedule Maintenance — {machine.name}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Date *</label>
                        <input
                          type="date"
                          value={f.date}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={e => setForm(machine.id, { date: e.target.value })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Type</label>
                        <select
                          value={f.type}
                          onChange={e => setForm(machine.id, { type: e.target.value })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        >
                          {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Technician</label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Assign technician..."
                            value={f.technician}
                            onChange={e => setForm(machine.id, { technician: e.target.value })}
                            className="w-full bg-muted border border-border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-muted-foreground/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Notes</label>
                        <input
                          type="text"
                          placeholder="Optional notes..."
                          value={f.notes}
                          onChange={e => setForm(machine.id, { notes: e.target.value })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-muted-foreground/50"
                        />
                      </div>
                    </div>

                    {/* Existing pending tasks */}
                    {pending.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5" /> Existing scheduled tasks
                        </div>
                        <div className="space-y-2">
                          {pending.map(t => (
                            <div key={t.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-xs">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded font-medium',
                                  t.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                  t.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                                  t.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-muted text-muted-foreground'
                                )}>
                                  {t.priority}
                                </span>
                                <span className="text-foreground">{t.type}</span>
                                {t.assignedTechnician && (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <User className="w-3 h-3" />{t.assignedTechnician}
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground">
                                {new Date(t.scheduledDate).toLocaleDateString()} · {t.estimatedDuration}h
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        onClick={() => handleSubmit(machine.id)}
                        disabled={!f.date}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Confirm Schedule
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          )
        })
        }
      </div>
    </div>
  )
}
