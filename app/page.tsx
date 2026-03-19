'use client'

import { useState, useMemo } from 'react'
import { 
  mockMachines, 
  mockAlerts, 
  mockMaintenanceTasks,
  calculateGlobalHealthIndex,
  Machine,
  MachineComponent,
  Alert
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
import { HUDOverlay } from '@/components/hud/HUDOverlay'
import { useNeoHUD } from '@/components/hud/NeoHUDContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export default function DigitalTwinDashboard() {
  const { setIsHUDVisible } = useNeoHUD()
  
  const [machines] = useState(mockMachines)
  const [alerts, setAlerts] = useState(mockAlerts)
  const [tasks] = useState(mockMaintenanceTasks)
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<MachineComponent | null>(null)
  const [showAssistant, setShowAssistant] = useState(false)
  const [activeTab, setActiveTab] = useState('diagnostics')
  const [dashboardTab, setDashboardTab] = useState('fleet')
  const [statFilter, setStatFilter] = useState<'optimal' | 'impaired' | 'critical' | 'scheduled' | null>(null)

  const selectedMachine = useMemo(
    () => machines.find(m => m.id === selectedMachineId) || null,
    [machines, selectedMachineId]
  )

  const globalHealth = useMemo(
    () => calculateGlobalHealthIndex(machines),
    [machines]
  )

  const criticalAlerts = useMemo(
    () => alerts.filter(a => a.severity === 'critical' && !a.acknowledged),
    [alerts]
  )

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, acknowledged: true } : a
    ))
  }

  const handleDismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                  {selectedMachine ? selectedMachine.name : 'Digital Twin Command Center'}
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

            {/* Alerts Badge */}
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
              {criticalAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">
                  {criticalAlerts.length}
                </span>
              )}
            </Button>



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
          showAssistant && 'lg:mr-[400px]'
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
                          {machines.filter(m => m.status === 'optimal').length}
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
                          {machines.filter(m => m.status === 'impaired').length}
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
                          {machines.filter(m => m.status === 'critical').length}
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
                              const machine = machines.find(m => m.id === task.machineId)
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => handleSelectMachine(task.machineId)}
                                  className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                                >
                                  <div>
                                    <div className="font-medium text-sm">{machine?.name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{task.type} Maintenance</div>
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
                            machines.filter(m => m.status === statFilter).map(machine => (
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
                                    machine.rul <= 5 ? 'text-destructive' :
                                    machine.rul <= 15 ? 'text-warning' :
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
                  <TabsList>
                    <TabsTrigger value="fleet" className="gap-2">
                      <Box className="w-4 h-4" />
                      Fleet Overview
                    </TabsTrigger>
                    <TabsTrigger value="ttf" className="gap-2">
                      <Clock className="w-4 h-4" />
                      Time to Failure
                    </TabsTrigger>
                  </TabsList>
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
                          machines={machines}
                          onComponentSelect={() => {}}
                          selectedComponent={null}
                          onMachineSelect={handleSelectMachine}
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
                          machines={machines}
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
                        <RULGraph machine={null} machines={machines} isFleetView={true} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Simulation Panel for Fleet */}
                  <Card className="mt-6">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary" />
                        Delay Impact Simulator
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SimulationPanel machine={null} machines={machines} isFleetView={true} />
                    </CardContent>
                  </Card>
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
                            selectedMachine.rul <= 5 ? 'text-destructive' :
                            selectedMachine.rul <= 15 ? 'text-warning' :
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
                  <TabsTrigger value="diagnostics" className="gap-2">
                    <Activity className="w-4 h-4" />
                    <span className="hidden sm:inline">Diagnostics</span>
                  </TabsTrigger>
                  <TabsTrigger value="maintenance" className="gap-2">
                    <Wrench className="w-4 h-4" />
                    <span className="hidden sm:inline">Maintenance</span>
                  </TabsTrigger>
                  <TabsTrigger value="simulation" className="gap-2">
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Simulation</span>
                  </TabsTrigger>
                  <TabsTrigger value="upgrades" className="gap-2">
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
                        <SensorCharts data={selectedMachine.sensorHistory} />
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
                          components={selectedMachine.components}
                          healthIndex={selectedMachine.healthIndex}
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
                          // Handle scheduling
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
        {/* HUD Overlay */}
        <HUDOverlay />

        {/* AI Assistant Sidebar */}
        {showAssistant && (
          <aside className="fixed right-0 top-0 bottom-0 w-full lg:w-[450px] z-[60] border-l border-cyan-500/20 bg-[#0A101D] shadow-2xl transition-transform duration-300">
            <AIAssistant
              machines={machines}
              alerts={alerts}
              tasks={tasks}
              selectedMachine={selectedMachine}
              onClose={() => {
                setShowAssistant(false);
                setIsHUDVisible(false);
              }}
            />
          </aside>
        )}

        {/* Floating AI Assistant Button */}
        {!showAssistant && (
          <button
            onClick={() => {
              setShowAssistant(true);
              setIsHUDVisible(true);
            }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center hover:scale-110 transition-transform z-40 group"
          >
            <Bot className="w-7 h-7 text-white" />
            
            {/* Ping animation rings */}
            <div className="absolute inset-0 rounded-full border border-cyan-400 animate-ping opacity-75"></div>
            <div className="absolute inset-0 rounded-full border border-cyan-300 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50"></div>
          </button>
        )}
      </div>
    </div>
  )
}
