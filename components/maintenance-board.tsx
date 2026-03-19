'use client'

import { useState, useEffect, useMemo } from 'react'
import { Machine } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  X,
  ArrowRight,
  Undo2,
  Wrench,
} from 'lucide-react'

// =============================================
// Types & Constants
// =============================================
type RulCategory = 'safe' | 'high_risk' | 'critical'
type BoardColumn = RulCategory | 'scheduled' | 'completed'

interface ScheduledEntry {
  machineId: string
  scheduledDate: string
  scheduledTime: string
  technician: string
  notes: string
  scheduledAt: string // ISO timestamp of when user clicked schedule
}

interface CompletedEntry {
  machineId: string
  completedAt: string
  previousSchedule?: ScheduledEntry
}

const STORAGE_KEY_SCHEDULED = 'maintenanceScheduled'
const STORAGE_KEY_COMPLETED = 'maintenanceCompleted'

const COLUMN_CONFIG: Record<BoardColumn, { label: string; color: string; bg: string; border: string; headerBg: string; Icon: any }> = {
  safe:      { label: 'Safe',      color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  headerBg: 'bg-green-600',  Icon: ShieldCheck },
  high_risk: { label: 'High Risk', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', headerBg: 'bg-yellow-600', Icon: ShieldAlert },
  critical:  { label: 'Critical',  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', headerBg: 'bg-orange-600', Icon: ShieldX },
  scheduled: { label: 'Scheduled', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   headerBg: 'bg-blue-600',   Icon: Calendar },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', headerBg: 'bg-emerald-700', Icon: CheckCircle2 },
}

function getRulCategory(rul: number): RulCategory {
  if (rul > 80) return 'safe'
  if (rul > 30) return 'high_risk'
  return 'critical'
}

// =============================================
// Component
// =============================================
interface MaintenanceBoardProps {
  machines: Machine[]
  onMachineSelect?: (id: string) => void
}

export function MaintenanceBoard({ machines, onMachineSelect }: MaintenanceBoardProps) {
  // ---- localStorage state ----
  const [scheduled, setScheduled] = useState<ScheduledEntry[]>([])
  const [completed, setCompleted] = useState<CompletedEntry[]>([])
  const [scheduleForm, setScheduleForm] = useState<{ machineId: string; date: string; time: string; technician: string; notes: string } | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_SCHEDULED)
      if (s) setScheduled(JSON.parse(s))
    } catch {}
    try {
      const c = localStorage.getItem(STORAGE_KEY_COMPLETED)
      if (c) setCompleted(JSON.parse(c))
    } catch {}
  }, [])

  // Persist scheduled
  const persistScheduled = (entries: ScheduledEntry[]) => {
    setScheduled(entries)
    localStorage.setItem(STORAGE_KEY_SCHEDULED, JSON.stringify(entries))
  }

  // Persist completed
  const persistCompleted = (entries: CompletedEntry[]) => {
    setCompleted(entries)
    localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(entries))
  }

  // Read live RUL from localStorage
  const [predictions, setPredictions] = useState<Record<string, { rul: number }>>({})
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

  // ---- derived column data ----
  const scheduledIds = useMemo(() => new Set(scheduled.map(s => s.machineId)), [scheduled])
  const completedIds = useMemo(() => new Set(completed.map(c => c.machineId)), [completed])

  const columns = useMemo(() => {
    const cols: Record<BoardColumn, Machine[]> = {
      safe: [], high_risk: [], critical: [], scheduled: [], completed: [],
    }

    machines.forEach(m => {
      if (completedIds.has(m.id)) {
        cols.completed.push(m)
      } else if (scheduledIds.has(m.id)) {
        cols.scheduled.push(m)
      } else {
        const liveRul = predictions[m.id]?.rul ?? m.rul
        const cat = getRulCategory(liveRul)
        cols[cat].push(m)
      }
    })

    return cols
  }, [machines, scheduledIds, completedIds, predictions])

  // ---- actions ----
  const handleSchedule = (machineId: string, date: string, time: string, technician: string, notes: string) => {
    const entry: ScheduledEntry = { machineId, scheduledDate: date, scheduledTime: time, technician, notes, scheduledAt: new Date().toISOString() }
    persistScheduled([...scheduled.filter(s => s.machineId !== machineId), entry])
    setScheduleForm(null)
  }

  const handleRemoveScheduled = (machineId: string) => {
    persistScheduled(scheduled.filter(s => s.machineId !== machineId))
  }

  const handleComplete = (machineId: string) => {
    const prevSchedule = scheduled.find(s => s.machineId === machineId)
    const entry: CompletedEntry = { machineId, completedAt: new Date().toISOString(), previousSchedule: prevSchedule }
    persistCompleted([...completed.filter(c => c.machineId !== machineId), entry])
    persistScheduled(scheduled.filter(s => s.machineId !== machineId))
  }

  const handleRemoveCompleted = (machineId: string) => {
    persistCompleted(completed.filter(c => c.machineId !== machineId))
  }

  const getScheduleEntry = (machineId: string) => scheduled.find(s => s.machineId === machineId)
  const getCompletedEntry = (machineId: string) => completed.find(c => c.machineId === machineId)

  // ---- render ----
  const columnOrder: BoardColumn[] = ['safe', 'high_risk', 'critical', 'scheduled', 'completed']

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pb-2 w-full">
      {columnOrder.map(col => {
        const cfg = COLUMN_CONFIG[col]
        const items = columns[col]
        return (
          <div key={col} className="flex flex-col min-w-0">
            {/* Column header bar */}
            <div className={cn('rounded-t-xl px-4 py-2', cfg.headerBg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <cfg.Icon className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white uppercase tracking-wide">{cfg.label}</span>
                </div>
                <span className="text-xs font-bold text-white/80 bg-white/20 rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>
            </div>

            {/* Column body */}
            <div className={cn(
              'flex-1 rounded-b-xl border-x border-b p-3 space-y-3 min-h-[300px] max-h-[600px] overflow-y-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
              cfg.border, 'bg-card/50'
            )}>
              {items.length === 0 && (
                <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground">
                  No machines
                </div>
              )}

              {items.map(machine => {
                const liveRul = predictions[machine.id]?.rul ?? machine.rul
                const schedEntry = getScheduleEntry(machine.id)
                const compEntry = getCompletedEntry(machine.id)

                return (
                  <div
                    key={machine.id}
                    className="bg-background rounded-lg p-4 border-2 border-white/15 hover:border-primary/50 transition-all shadow-md"
                  >
                    {/* Machine name & type */}
                    <div className="flex items-center justify-between mb-2">
                      <button
                        className="text-base font-semibold hover:text-primary transition-colors text-left truncate"
                        onClick={() => onMachineSelect?.(machine.id)}
                      >
                        {machine.name}
                      </button>
                    </div>

                    <div className="text-xs text-muted-foreground mb-3">{machine.type}</div>

                    {/* RUL bar */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground w-8">RUL</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            liveRul > 80 ? 'bg-green-500' :
                            liveRul > 30 ? 'bg-yellow-500' : 'bg-orange-500'
                          )}
                          style={{ width: `${Math.min(100, (liveRul / 120) * 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-bold w-12 text-right',
                        liveRul > 80 ? 'text-green-400' :
                        liveRul > 30 ? 'text-yellow-400' : 'text-orange-400'
                      )}>{liveRul.toFixed(0)}d</span>
                    </div>

                    {/* Scheduled info */}
                    {col === 'scheduled' && schedEntry && (
                      <div className="text-sm bg-blue-500/10 rounded-md p-2.5 mb-3 border border-blue-500/20">
                        <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-medium">Scheduled: {new Date(schedEntry.scheduledDate).toLocaleDateString()}{schedEntry.scheduledTime ? ` at ${schedEntry.scheduledTime}` : ''}</span>
                        </div>
                        {schedEntry.technician && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Wrench className="w-3 h-3" />
                            Technician: {schedEntry.technician}
                          </div>
                        )}
                        {schedEntry.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{schedEntry.notes}</div>
                        )}
                      </div>
                    )}

                    {/* Completed info */}
                    {col === 'completed' && compEntry && (
                      <div className="text-sm bg-emerald-500/10 rounded-md p-2.5 mb-3 border border-emerald-500/20">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="font-medium">Completed: {new Date(compEntry.completedAt).toLocaleDateString()}</span>
                        </div>
                        {compEntry.previousSchedule?.technician && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Wrench className="w-3 h-3" />
                            Technician: {compEntry.previousSchedule.technician}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons based on column */}
                    <div className="flex gap-1.5 mt-1">
                      {/* RUL columns: Schedule button */}
                      {(col === 'safe' || col === 'high_risk' || col === 'critical') && (
                        <>
                          {scheduleForm?.machineId === machine.id ? (
                            <div className="w-full space-y-2.5 bg-muted/30 rounded-lg p-3 border-2 border-blue-500/30">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Date *</label>
                                  <input
                                    type="date"
                                    value={scheduleForm.date}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                                    className="w-full bg-muted border border-border rounded-md px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 [&::-webkit-calendar-picker-indicator]:hidden"
                                    style={{ WebkitAppearance: 'textfield' }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Time</label>
                                  <input
                                    type="time"
                                    lang="en-GB"
                                    value={scheduleForm.time}
                                    onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                                    className="w-full bg-muted border border-border rounded-md px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 [&::-webkit-calendar-picker-indicator]:hidden"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground font-medium mb-1 block">Technician</label>
                                <input
                                  type="text"
                                  placeholder="Assign technician..."
                                  value={scheduleForm.technician}
                                  onChange={e => setScheduleForm({ ...scheduleForm, technician: e.target.value })}
                                  className="w-full bg-muted border border-border rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-muted-foreground/50"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground font-medium mb-1 block">Notes</label>
                                <input
                                  type="text"
                                  placeholder="Optional notes..."
                                  value={scheduleForm.notes}
                                  onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                                  className="w-full bg-muted border border-border rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-muted-foreground/50"
                                />
                              </div>
                              <div className="flex flex-col xl:flex-row gap-1.5 pt-1">
                                <Button
                                  size="sm"
                                  className="flex-1 h-9 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700 text-white min-w-0"
                                  onClick={() => handleSchedule(machine.id, scheduleForm.date, scheduleForm.time, scheduleForm.technician, scheduleForm.notes)}
                                  disabled={!scheduleForm.date}
                                >
                                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">Confirm Schedule</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 text-sm px-2 flex-shrink-0"
                                  onClick={() => setScheduleForm(null)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 text-xs gap-1.5 border-white/15"
                              onClick={() => setScheduleForm({
                                machineId: machine.id,
                                date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                                time: '09:00',
                                technician: '',
                                notes: '',
                              })}
                            >
                              <Plus className="w-3 h-3" />
                              Schedule
                            </Button>
                          )}
                        </>
                      )}

                      {/* Scheduled column: Complete + Remove */}
                      {col === 'scheduled' && (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleComplete(machine.id)}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-white/15"
                            onClick={() => handleRemoveScheduled(machine.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      )}

                      {/* Completed column: Remove */}
                      {col === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-white/15"
                          onClick={() => handleRemoveCompleted(machine.id)}
                        >
                          <Undo2 className="w-3 h-3" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
