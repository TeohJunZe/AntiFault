'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  mockMachines,
  mockAlerts,
  mockMaintenanceTasks,
  calculateGlobalHealthIndex,
  Machine,
  MachineComponent,
  Alert,
  generateSensorHistoryForHealth
} from '@/lib/data'
import { cn } from '@/lib/utils'

import { UrgencyQueue } from '@/components/urgency-queue'
import { AlertPanel } from '@/components/alert-panel'
import { HealthGauge } from '@/components/health-gauge'
import { MachineViewer3D } from '@/components/machine-viewer-3d'
import { SensorCharts } from '@/components/sensor-charts'
import { RULGraph } from '@/components/rul-graph'
import { XAIPanel } from '@/components/xai-panel'
import { MaintenancePlanner } from '@/components/maintenance-planner'
import { SimulationPanel } from '@/components/simulation-panel'
import { TechnologySuggestions } from '@/components/technology-suggestions'
import { AIAssistant } from '@/components/ai-assistant'
import { MaintenanceBoard } from '@/components/maintenance-board'
import { HUDOverlay } from '@/components/hud/HUDOverlay'
import { useNeoHUD } from '@/components/hud/NeoHUDContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Factory,
  Bot,
  Activity,
  Settings,
  Bell,
  ArrowLeft,
  Gauge,
  Wrench,
  BarChart3,
  Play,
  Lightbulb,
  X,
  Box,
  Clock
} from 'lucide-react'

const LAYOUT_KEY = 'factoryFloorLayout'

export default function DigitalTwinDashboard() {
  const { setHUDVisible, isChatOpen, isHUDVisible } = useNeoHUD()
  const [machines, setMachines] = useState<Machine[]>(() => {
    if (typeof window === 'undefined') return mockMachines
    try {
      const saved = localStorage.getItem(LAYOUT_KEY)
      if (saved) return JSON.parse(saved) as Machine[]
    } catch { }
    return mockMachines
  })
  const [tasks] = useState(mockMaintenanceTasks)
  const [hiddenAlertIds, setHiddenAlertIds] = useState<Set<string>>(new Set())
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(new Set())
  const [isFloorEditMode, setIsFloorEditMode] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<MachineComponent | null>(null)
  const [activeTab, setActiveTab] = useState('diagnostics')
  const [dashboardTab, setDashboardTab] = useState('fleet')
  const [statFilter, setStatFilter] = useState<'optimal' | 'impaired' | 'critical' | 'scheduled' | null>(null)

  const [predictions, setPredictions] = useState<Record<string, { rul: number, status: Machine['status'] }>>({})

  useEffect(() => {
    const handleStorage = () => {
      try {
        const cached = localStorage.getItem('enginePredictions')
        if (cached) {
          setPredictions(JSON.parse(cached))
        }
      } catch (e) { }
    }
    handleStorage()
    window.addEventListener('predictionsUpdated', handleStorage)
    return () => window.removeEventListener('predictionsUpdated', handleStorage)
  }, [])

  const activeMachines = useMemo(() => {
    return machines.map(m => ({
      ...m,
      rul: predictions[m.id]?.rul ?? m.rul,
      status: predictions[m.id]?.status ?? m.status
    }))
  }, [machines, predictions])

  const selectedMachine = useMemo(
    () => activeMachines.find(m => m.id === selectedMachineId) || null,
    [activeMachines, selectedMachineId]
  )

  const globalHealth = useMemo(
    () => calculateGlobalHealthIndex(activeMachines),
    [activeMachines]
  )

  const alerts = useMemo(() => {
    return activeMachines.map(m => {
      if (m.rul <= 30) {
        return {
          id: `alert-critical-${m.id}`,
          machineId: m.id,
          machineName: m.name,
          severity: 'critical' as const,
          message: `Critical RUL detected: ${m.rul.toFixed(0)} days remaining. Immediate maintenance required.`,
          timestamp: new Date().toISOString(),
          acknowledged: acknowledgedAlertIds.has(`alert-critical-${m.id}`)
        }
      } else if (m.rul <= 80) {
        return {
          id: `alert-warning-${m.id}`,
          machineId: m.id,
          machineName: m.name,
          severity: 'warning' as const,
          message: `High risk: RUL has fallen to ${m.rul.toFixed(0)} days. Schedule maintenance soon.`,
          timestamp: new Date().toISOString(),
          acknowledged: acknowledgedAlertIds.has(`alert-warning-${m.id}`)
        }
      }
      return null
    }).filter(a => a !== null && !hiddenAlertIds.has(a.id)) as Alert[]
  }, [activeMachines, hiddenAlertIds, acknowledgedAlertIds])

  const criticalAlerts = useMemo(
    () => alerts.filter(a => a.severity === 'critical' && !a.acknowledged),
    [alerts]
  )

  // Persist layout changes
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(machines))
    } catch { }
  }, [machines])

  const handleAcknowledgeAlert = (id: string) => {
    setAcknowledgedAlertIds(prev => new Set(prev).add(id))
  }

  const handleDismissAlert = (id: string) => {
    setHiddenAlertIds(prev => new Set(prev).add(id))
  }

  const handleSelectMachine = (id: string) => {
    setSelectedMachineId(id)
    setSelectedComponent(null)
    setActiveTab('diagnostics')
  }

  const handleBackToDashboard = () => {
    setSelectedMachineId(null)
    setSelectedComponent(null)
  }

  const handleAddMachine = useCallback((machine: Machine) => {
    setMachines(prev => [...prev, machine])
  }, [])

  const handleUpdateMachinePosition = useCallback((id: string, location: { x: number; y: number }) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, location } : m))
  }, [])

  const handleRemoveMachine = useCallback((id: string) => {
    setMachines(prev => prev.filter(m => m.id !== id))
    if (selectedMachineId === id) {
      setSelectedMachineId(null)
      setSelectedComponent(null)
    }
  }, [selectedMachineId])

  const handleScheduleMaintenance = useCallback((
    machineId: string,
    date: string,
    technician: string,
    type: string,
    notes: string
  ) => {
    setMachines(prev => prev.map(m =>
      m.id === machineId ? { ...m, nextScheduledMaintenance: date } : m
    ))
  }, [])

  // Alert → Maintenance Tab navigation
  const [focusedMachineId, setFocusedMachineId] = useState<string | null>(null)
  const [focusedAlertMessage, setFocusedAlertMessage] = useState<string | null>(null)

  const handleAlertClick = useCallback((machineId: string) => {
    // Find the alert message for display in the banner
    const alert = alerts.find(a => a.machineId === machineId && !a.acknowledged)
    setFocusedMachineId(machineId)
    setFocusedAlertMessage(alert?.message ?? null)
    setDashboardTab('maintenance')
    // Scroll to top so the maintenance tab is visible before the card scrollIntoView fires
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [alerts])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-opacity duration-500",
        isHUDVisible && "opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            {selectedMachine && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Factory className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">
                  {selectedMachine ? selectedMachine.name : <span className="text-primary font-bold">AntiFault</span>}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {selectedMachine
                    ? `${selectedMachine.type} - ${selectedMachine.status.toUpperCase()}`
                    : 'Predictive Maintenance Platform'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Health */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Fleet Health:</span>
              <span className={cn(
                'font-bold',
                globalHealth >= 80 ? 'text-success' :
                  globalHealth >= 60 ? 'text-warning' :
                    'text-destructive'
              )}>
                {globalHealth}%
              </span>
            </div>

            {/* Alerts Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'relative',
                    criticalAlerts.length > 0 && 'text-destructive'
                  )}
                >
                  <Bell className={cn(
                    'w-5 h-5',
                    criticalAlerts.length > 0 && 'animate-pulse'
                  )} />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center border-2 border-background font-bold">
                      {alerts.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="end">
                <div className="p-4 border-b border-border bg-muted/20">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Alert Notifications
                    {alerts.length > 0 && (
                      <span className="ml-auto text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                        {alerts.length} New
                      </span>
                    )}
                  </h3>
                </div>
                <div className="max-h-[400px] p-2">
                  <AlertPanel 
                    alerts={alerts}
                    onAcknowledge={handleAcknowledgeAlert}
                    onDismiss={handleDismissAlert}
                    onAlertClick={handleAlertClick}
                  />
                </div>
                {alerts.length > 0 && (
                  <div className="p-2 border-t border-border bg-muted/10 text-center">
                    <button 
                      onClick={() => {
                        setAcknowledgedAlertIds(new Set([...acknowledgedAlertIds, ...alerts.map(a => a.id)]))
                      }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                    >
                      Acknowledge All
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>



            <Button variant="ghost" size="sm">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Main Panel */}
        <main className={cn(
          'flex-1 p-6 transition-all duration-300',
          isChatOpen && 'lg:mr-[400px]',
          isHUDVisible && 'opacity-0 pointer-events-none'
        )}>
          {!selectedMachine ? (
            // COMMAND CENTER VIEW
            <div className="space-y-6">
              {/* Top Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="md:col-span-1">
                  <CardContent className="pt-6">
                    <HealthGauge value={globalHealth} label="Global Health Index" size="md" />
                  </CardContent>
                </Card>

                <Card className="md:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button
                        onClick={() => setStatFilter(statFilter === 'optimal' ? null : 'optimal')}
                        className={cn(
                          "bg-success/10 rounded-lg p-4 text-center transition-all hover:bg-success/20 hover:scale-105",
                          statFilter === 'optimal' && "ring-2 ring-success ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-success">
                          {activeMachines.filter(m => m.status === 'optimal').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Optimal</div>
                      </button>
                      <button
                        onClick={() => setStatFilter(statFilter === 'impaired' ? null : 'impaired')}
                        className={cn(
                          "bg-warning/10 rounded-lg p-4 text-center transition-all hover:bg-warning/20 hover:scale-105",
                          statFilter === 'impaired' && "ring-2 ring-warning ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-warning">
                          {activeMachines.filter(m => m.status === 'impaired').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Impaired</div>
                      </button>
                      <button
                        onClick={() => setStatFilter(statFilter === 'critical' ? null : 'critical')}
                        className={cn(
                          "bg-destructive/10 rounded-lg p-4 text-center transition-all hover:bg-destructive/20 hover:scale-105",
                          statFilter === 'critical' && "ring-2 ring-destructive ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-destructive">
                          {activeMachines.filter(m => m.status === 'critical').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Critical</div>
                      </button>
                      <button
                        onClick={() => setStatFilter(statFilter === 'scheduled' ? null : 'scheduled')}
                        className={cn(
                          "bg-primary/10 rounded-lg p-4 text-center transition-all hover:bg-primary/20 hover:scale-105",
                          statFilter === 'scheduled' && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-primary">
                          {tasks.filter(t => t.status === 'scheduled').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Scheduled</div>
                      </button>
                    </div>

                    {/* Machine List when filter active */}
                    {statFilter && (
                      <div className="mt-4 border-t border-border pt-4 animate-in fade-in-50 slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium capitalize">
                            {statFilter === 'scheduled' ? 'Scheduled Maintenance' : `${statFilter} Machines`}
                          </h4>
                          <Button variant="ghost" size="sm" onClick={() => setStatFilter(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {statFilter === 'scheduled' ? (
                            tasks.filter(t => t.status === 'scheduled').map(task => {
                              const machine = activeMachines.find(m => m.id === task.machineId)
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => handleSelectMachine(task.machineId)}
                                  className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                                >
                                  <div>
                                    <div className="font-medium text-sm">{machine?.name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{task.type}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-primary font-medium">
                                      {new Date(task.scheduledDate).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{task.estimatedDuration}</div>
                                  </div>
                                </button>
                              )
                            })
                          ) : (
                            activeMachines.filter(m => m.status === statFilter).map(machine => (
                              <button
                                key={machine.id}
                                onClick={() => handleSelectMachine(machine.id)}
                                className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                              >
                                <div>
                                  <div className="font-medium text-sm">{machine.name}</div>
                                  <div className="text-xs text-muted-foreground">{machine.type}</div>
                                </div>
                                <div className="text-right">
                                  <div className={cn(
                                    "text-sm font-bold",
                                    machine.rul < 30 ? 'text-destructive' :
                                      machine.rul <= 80 ? 'text-warning' :
                                        'text-success'
                                  )}>
                                    {machine.rul}d RUL
                                  </div>
                                  <div className="text-xs text-muted-foreground">Health: {machine.healthIndex}%</div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabbed Main Content */}
              <Tabs value={dashboardTab} onValueChange={setDashboardTab}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex p-1 rounded-xl bg-muted/50 border border-border gap-1">
                    <button
                      onClick={() => setDashboardTab('fleet')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        dashboardTab === 'fleet'
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Box className={cn('w-4 h-4', dashboardTab === 'fleet' && 'text-indigo-400')} />
                      Fleet Overview
                    </button>
                    <button
                      onClick={() => setDashboardTab('ttf')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        dashboardTab === 'ttf'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Clock className={cn('w-4 h-4', dashboardTab === 'ttf' && 'text-amber-400')} />
                      Time to Failure
                    </button>
                    <button
                      onClick={() => setDashboardTab('maintenance')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        dashboardTab === 'maintenance'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Wrench className={cn('w-4 h-4', dashboardTab === 'maintenance' && 'text-emerald-400')} />
                      Maintenance
                    </button>
                  </div>
                </div>

                <TabsContent value="fleet" className="mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 3D Fleet View */}
                    <Card className="lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">3D Factory Floor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MachineViewer3D
                          machine={null}
                          isFleetView={true}
                          machines={activeMachines}
                          onComponentSelect={() => { }}
                          selectedComponent={null}
                          onMachineSelect={handleSelectMachine}
                          isEditMode={isFloorEditMode}
                          onEditModeChange={setIsFloorEditMode}
                          onAddMachine={handleAddMachine}
                          onUpdateMachinePosition={handleUpdateMachinePosition}
                          onRemoveMachine={handleRemoveMachine}
                        />
                      </CardContent>
                    </Card>

                    {/* Alerts Panel */}
                    <Card className="lg:col-span-1 flex flex-col">
                      <CardHeader className="pb-2 flex-shrink-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Bell className={cn(
                            'w-4 h-4',
                            criticalAlerts.length > 0 ? 'text-destructive' : 'text-primary'
                          )} />
                          System Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-hidden">
                        <AlertPanel
                          alerts={alerts}
                          onAcknowledge={handleAcknowledgeAlert}
                          onDismiss={handleDismissAlert}
                          onAlertClick={handleAlertClick}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="ttf" className="mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Urgency Queue */}
                    <Card className="lg:col-span-1">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-primary" />
                          Urgency Queue
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <UrgencyQueue
                          machines={activeMachines}
                          onSelectMachine={handleSelectMachine}
                        />
                      </CardContent>
                    </Card>

                    {/* RUL Overview */}
                    <Card className="lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Fleet RUL Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RULGraph machine={null} machines={activeMachines} isFleetView={true} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Simulation Panel for Fleet */}
                  <Card className="mt-6">
                    <CardContent>
                      <SimulationPanel machine={null} machines={activeMachines} isFleetView={true} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="maintenance" className="mt-0">
                  <MaintenanceBoard
                    machines={activeMachines}
                    onMachineSelect={handleSelectMachine}
                    focusedMachineId={focusedMachineId}
                    onFocusClear={() => setFocusedMachineId(null)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            // MACHINE DETAIL VIEW
            <div className="space-y-6">
              {/* 3D Viewer and Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3D Model */}
                <Card className="lg:col-span-2">
                  <CardContent className="pt-6">
                    <MachineViewer3D
                      machine={selectedMachine}
                      onComponentSelect={setSelectedComponent}
                      selectedComponent={selectedComponent}
                    />
                  </CardContent>
                </Card>

                {/* Health Stats */}
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center">
                        <HealthGauge value={selectedMachine.healthIndex} label="Machine Health" size="lg" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className={cn(
                            'text-2xl font-bold font-mono',
                            selectedMachine.rul < 30 ? 'text-destructive' :
                              selectedMachine.rul <= 80 ? 'text-warning' :
                                'text-success'
                          )}>
                            {selectedMachine.rul}
                          </div>
                          <div className="text-xs text-muted-foreground">Days RUL</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold font-mono text-foreground">
                            ${(selectedMachine.financialImpactPerDay / 1000).toFixed(1)}K
                          </div>
                          <div className="text-xs text-muted-foreground">Daily Impact</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedComponent && (
                    <Card className="border-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Selected Component</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="font-medium">{selectedComponent.name}</div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Health</span>
                            <span className={cn(
                              'font-bold',
                              selectedComponent.health >= 80 ? 'text-success' :
                                selectedComponent.health >= 60 ? 'text-warning' :
                                  'text-destructive'
                            )}>
                              {selectedComponent.health}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <span className={cn(
                              'capitalize',
                              selectedComponent.status === 'healthy' ? 'text-success' :
                                selectedComponent.status === 'degraded' ? 'text-warning' :
                                  'text-destructive'
                            )}>
                              {selectedComponent.status}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Tabbed Content */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full max-w-[600px]">
                  <TabsTrigger 
                    value="diagnostics" 
                    className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                  >
                    <Activity className="w-4 h-4" />
                    <span className="hidden sm:inline">Diagnostics</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="maintenance" 
                    className="gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500"
                  >
                    <Wrench className="w-4 h-4" />
                    <span className="hidden sm:inline">Maintenance</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="simulation" 
                    className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Simulation</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="upgrades" 
                    className="gap-2 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400"
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span className="hidden sm:inline">Upgrades</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="diagnostics" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Live Sensor Feed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SensorCharts machineId={selectedMachine.id} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">RUL Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RULGraph machine={selectedMachine} />
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardContent className="pt-6">
                        <XAIPanel
                          machineId={selectedMachine.id}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="maintenance" className="mt-6">
                  <Card>
                    <CardContent className="pt-6">
                      <MaintenancePlanner
                        machine={selectedMachine}
                        selectedComponent={selectedComponent}
                        tasks={tasks}
                        onScheduleMaintenance={() => {
                          setFocusedMachineId(selectedMachine.id)
                          setSelectedMachineId(null)
                          setDashboardTab('maintenance')
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="simulation" className="mt-6">
                  <Card>
                    <CardContent className="pt-6">
                      <SimulationPanel machine={selectedMachine} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="upgrades" className="mt-6">
                  <Card>
                    <CardContent className="pt-6">
                      <TechnologySuggestions machineId={selectedMachine.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
        {/* HUD Overlay - shown behind chat */}
        <HUDOverlay />

        {/* Global AI Assistant (Handles its own button and panel internally) */}
        <AIAssistant
          machines={activeMachines}
          alerts={alerts}
          tasks={tasks}
          selectedMachine={selectedMachine}
        />
      </div>
    </div>
  )
}
