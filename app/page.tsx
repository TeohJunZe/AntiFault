"use client";

import Image from 'next/image'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import {
  mockMachines,
  mockAlerts,
  mockMaintenanceTasks,
  calculateGlobalHealthIndex,
  Machine,
  MachineComponent,
  Alert,
  generateSensorHistoryForHealth,
} from "@/lib/data";
import { cn } from "@/lib/utils";

import { UrgencyQueue } from '@/components/urgency-queue'
import { AlertPanel } from '@/components/alert-panel'
import { HealthGauge } from '@/components/health-gauge'
import { MachineViewer3D } from '@/components/machine-viewer-3d'
import { SensorCharts } from '@/components/sensor-charts'
import { RULGraph } from '@/components/rul-graph'
import { XAIPanel } from '@/components/xai-panel'
import { FineTunePanel } from '@/components/fine-tune-panel'
import { MaintenancePlanner } from '@/components/maintenance-planner'
import { SimulationPanel } from '@/components/simulation-panel'
import { TechnologySuggestions } from '@/components/technology-suggestions'
import { AIAssistant } from '@/components/ai-assistant'
import { MaintenanceBoard } from '@/components/maintenance-board'
import { AdminDashboard } from '@/components/admin-dashboard'
import { HUDOverlay } from '@/components/hud/HUDOverlay'
import { useNeoHUD } from '@/components/hud/NeoHUDContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  BrainCircuit,
  X,
  Box,
  Clock,
  Sun,
  Moon,
  Shield,
  HardHat,
  AlertTriangle
} from 'lucide-react'

const LAYOUT_KEY = "factoryFloorLayout";

export default function DigitalTwinDashboard() {
  const { setHUDVisible, isChatOpen, isHUDVisible, activeUIModules, activeContextData, setChatOpen, setActiveUIModules } = useNeoHUD()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [dashboardMode, setDashboardMode] = useState<'technician' | 'admin'>('technician')
  const isHydrated = useRef(false)
  const [machines, setMachines] = useState<Machine[]>(mockMachines)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) setMachines(JSON.parse(saved) as Machine[]);
    } catch { }
    isHydrated.current = true;
  }, []);
  const [tasks] = useState(mockMaintenanceTasks);
  const [hiddenAlertIds, setHiddenAlertIds] = useState<Set<string>>(new Set());
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(
    new Set(),
  );
  const [isFloorEditMode, setIsFloorEditMode] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(
    null,
  );
  const [selectedComponent, setSelectedComponent] =
    useState<MachineComponent | null>(null);
  const [activeTab, setActiveTab] = useState("diagnostics");
  const [dashboardTab, setDashboardTab] = useState("fleet");
  const [statFilter, setStatFilter] = useState<
    "optimal" | "impaired" | "critical" | "scheduled" | null
  >(null);
  const [predictionRefreshToken, setPredictionRefreshToken] = useState(0);
  const [focusedModuleInfo, setFocusedModuleInfo] = useState<{
    label: string;
    meshNames: string[];
  } | null>(null);
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);

  const [predictions, setPredictions] = useState<
    Record<string, { rul: number; status: Machine["status"] }>
  >({});

  useEffect(() => {
    const handleStorage = () => {
      try {
        const cached = localStorage.getItem("enginePredictions");
        if (cached) {
          setPredictions(JSON.parse(cached));
        }
      } catch (e) { }
    };
    handleStorage();
    window.addEventListener("predictionsUpdated", handleStorage);
    return () =>
      window.removeEventListener("predictionsUpdated", handleStorage);
  }, []);

  const activeMachines = useMemo(() => {
    return machines.map((m) => ({
      ...m,
      rul: predictions[m.id]?.rul ?? m.rul,
      status: predictions[m.id]?.status ?? m.status,
    }));
  }, [machines, predictions]);

  const selectedMachine = useMemo(
    () => activeMachines.find((m) => m.id === selectedMachineId) || null,
    [activeMachines, selectedMachineId],
  );

  const globalHealth = useMemo(
    () => calculateGlobalHealthIndex(activeMachines),
    [activeMachines],
  );

  const alerts = useMemo(() => {
    return activeMachines
      .map((m) => {
        if (m.rul <= 30) {
          return {
            id: `alert-critical-${m.id}`,
            machineId: m.id,
            machineName: m.name,
            severity: "critical" as const,
            message: `Critical RUL detected: ${m.rul.toFixed(0)} days remaining. Immediate maintenance required.`,
            timestamp: new Date().toISOString(),
            acknowledged: acknowledgedAlertIds.has(`alert-critical-${m.id}`),
          };
        } else if (m.rul <= 80) {
          return {
            id: `alert-warning-${m.id}`,
            machineId: m.id,
            machineName: m.name,
            severity: "warning" as const,
            message: `High risk: RUL has fallen to ${m.rul.toFixed(0)} days. Schedule maintenance soon.`,
            timestamp: new Date().toISOString(),
            acknowledged: acknowledgedAlertIds.has(`alert-warning-${m.id}`),
          };
        }
        return null;
      })
      .filter((a) => a !== null && !hiddenAlertIds.has(a.id)) as Alert[];
  }, [activeMachines, hiddenAlertIds, acknowledgedAlertIds]);

  const criticalAlerts = useMemo(
    () => alerts.filter((a) => a.severity === "critical" && !a.acknowledged),
    [alerts],
  );

  // Persist layout changes
  useEffect(() => {
    if (!isHydrated.current) return;
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(machines));
    } catch { }
  }, [machines]);

  const handleAcknowledgeAlert = (id: string) => {
    setAcknowledgedAlertIds((prev) => new Set(prev).add(id));
  };

  const handleDismissAlert = (id: string) => {
    setHiddenAlertIds((prev) => new Set(prev).add(id));
  };

  const handleSelectMachine = (id: string) => {
    setSelectedMachineId(id);
    setSelectedComponent(null);
    setActiveTab("diagnostics");
  };

  const handleBackToDashboard = () => {
    setSelectedMachineId(null);
    setSelectedComponent(null);
  };

  const handleAddMachine = useCallback((machine: Machine) => {
    setMachines((prev) => [...prev, machine]);
  }, []);

  const handleUpdateMachinePosition = useCallback(
    (id: string, location: { x: number; y: number }) => {
      setMachines((prev) =>
        prev.map((m) => (m.id === id ? { ...m, location } : m)),
      );
    },
    [],
  );

  const handleRemoveMachine = useCallback(
    (id: string) => {
      setMachines((prev) => prev.filter((m) => m.id !== id));
      if (selectedMachineId === id) {
        setSelectedMachineId(null);
        setSelectedComponent(null);
      }
    },
    [selectedMachineId],
  );

  const handleScheduleMaintenance = useCallback(
    (
      machineId: string,
      date: string,
      technician: string,
      type: string,
      notes: string,
    ) => {
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId ? { ...m, nextScheduledMaintenance: date } : m,
        ),
      );
    },
    [],
  );

  const handleFineTuneComplete = useCallback((machineId: string) => {
    const clearStoredEntry = (storageKey: string) => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          delete parsed[machineId];
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      } catch { }
    };

    clearStoredEntry("enginePredictions");
    clearStoredEntry("engineExplainability");
    clearStoredEntry("engineChangepoints");
    setPredictionRefreshToken((token) => token + 1);
    window.dispatchEvent(new Event("predictionsUpdated"));
  }, []);

  // Alert → Maintenance Tab navigation
  const [focusedMachineId, setFocusedMachineId] = useState<string | null>(null);
  const [focusedAlertMessage, setFocusedAlertMessage] = useState<string | null>(
    null,
  );

  const handleAlertClick = useCallback(
    (machineId: string) => {
      // Find the alert message for display in the banner
      const alert = alerts.find(
        (a) => a.machineId === machineId && !a.acknowledged,
      );
      setFocusedMachineId(machineId);
      setFocusedAlertMessage(alert?.message ?? null);
      setDashboardTab("maintenance");
      // Scroll to top so the maintenance tab is visible before the card scrollIntoView fires
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [alerts],
  );

  // Neo Intent handler for maintenance
  useEffect(() => {
    if (activeUIModules.includes("MAINTENANCE_PANEL") && activeContextData) {
      setDashboardTab("maintenance");
      setFocusedMachineId(activeContextData.id);
      setHUDVisible(false);
      setChatOpen(false);


      // Allow the layout to shift before firing the event to auto-schedule
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("neo-auto-schedule", {
            detail: { machineId: activeContextData.id },
          }),
        );
      }, 500);


      // Clear the intent so it doesn't fire again
      setActiveUIModules(["SYSTEM_OVERVIEW"]);
    }
  }, [
    activeUIModules,
    activeContextData,
    setHUDVisible,
    setChatOpen,
    setActiveUIModules,
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-opacity duration-500",
          isHUDVisible && "opacity-0 pointer-events-none",
        )}
      >
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
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                <Image
                  src="/transparent-logo.png"
                  alt="AntiFault Logo"
                  width={32}
                  height={32}
                <Image
                  src="/transparent-logo.png"
                  alt="AntiFault Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="font-semibold text-lg">
                  {selectedMachine ? (
                    selectedMachine.name
                  ) : (
                    <span className="text-primary font-bold">AntiFault</span>
                  )}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {selectedMachine
                    ? `${selectedMachine.type} - ${selectedMachine.status.toUpperCase()}`
                    : dashboardMode === 'admin' ? 'Admin Dashboard' : 'Technician Dashboard'
                  }
                </p>
              </div>
            </div>

            {/* Admin / Technician Toggle */}
            {!selectedMachine && (
              <div className="hidden md:flex items-center bg-muted/50 rounded-lg p-1 border border-border gap-1">
                <button
                  onClick={() => { setDashboardMode('technician'); setSelectedMachineId(null); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                    dashboardMode === 'technician'
                      ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 shadow-sm border border-cyan-500/30'
                      : 'text-muted-foreground dark:text-white hover:text-foreground'
                  )}
                >
                  <HardHat className="w-3.5 h-3.5" />
                  Technician
                </button>
                <button
                  onClick={() => { setDashboardMode('admin'); setSelectedMachineId(null); setSelectedComponent(null); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                    dashboardMode === 'admin'
                      ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 shadow-sm border border-indigo-500/30'
                      : 'text-muted-foreground dark:text-white hover:text-foreground'
                  )}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* System Health Badge */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 px-3 h-10 rounded-xl border bg-card shadow-sm hover:bg-muted/50 transition-colors",
                    globalHealth >= 80 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400" :
                      globalHealth >= 50 ? "border-amber-500/30 text-amber-600 dark:text-amber-400" :
                        "border-red-500/30 text-red-600 dark:text-red-400"
                  )}
                >
                  <Activity className="w-4 h-4" />
                  <span className="font-bold">{Math.round(globalHealth)}%</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <h4 className="font-semibold text-sm mb-3 text-foreground">System Health</h4>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground">Overall Score</span>
                  <span className={cn(
                    "text-xl font-bold",
                    globalHealth >= 80 ? "text-emerald-500" :
                      globalHealth >= 50 ? "text-amber-500" : "text-red-500"
                  )}>
                    {Math.round(globalHealth)}%
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal
                    </span>
                    <span className="font-medium">{activeMachines.filter(m => m.status === 'optimal').length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <div className="w-2 h-2 rounded-full bg-amber-500" /> Impaired
                    </span>
                    <span className="font-medium">{activeMachines.filter(m => m.status === 'impaired').length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <div className="w-2 h-2 rounded-full bg-red-500" /> Critical
                    </span>
                    <span className="font-medium">{activeMachines.filter(m => m.status === 'critical').length}</span>
                  </div>
                </div>

                {activeMachines.filter(m => m.status === 'critical').length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <div className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      {activeMachines.filter(m => m.status === 'critical').length} Critical Machine{activeMachines.filter(m => m.status === 'critical').length > 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border shadow-md',
                mounted && theme === 'dark'
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-300/50 shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105'
                  : 'bg-gradient-to-br from-indigo-600 to-slate-800 border-indigo-400/30 shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105'
              )}
              title={mounted && theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-5 h-5 text-white drop-shadow-sm transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-5 h-5 text-white drop-shadow-sm transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>


            {/* Alerts Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border shadow-sm',
                    criticalAlerts.length > 0
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                      : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  <Bell
                    className={cn(
                      "w-5 h-5",
                      criticalAlerts.length > 0 && "animate-pulse",
                    )}
                  />
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
                      <button
                      onClick={() => {
                        setAcknowledgedAlertIds(
                          new Set([
                            ...acknowledgedAlertIds,
                            ...alerts.map((a) => a.id),
                          ]),
                        );
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
          {dashboardMode === 'admin' && !selectedMachine ? (
            // ADMIN DASHBOARD VIEW
            <AdminDashboard machines={activeMachines} />
          ) : !selectedMachine ? (
            // COMMAND CENTER VIEW (TECHNICIAN)
            <div className="space-y-6">
              {/* Top Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="md:col-span-1">
                  <CardContent className="pt-6">
                    <HealthGauge value={globalHealth} label="Overall System Health" size="md" />
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
                        onClick={() =>
                          setStatFilter(
                            statFilter === "optimal" ? null : "optimal",
                          )
                        }
                        className={cn(
                          "bg-success/15 dark:bg-success/10 rounded-lg p-4 text-center transition-all hover:bg-success/25 dark:hover:bg-success/20 hover:scale-105",
                          statFilter === 'optimal' && "ring-2 ring-success ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-success dark:text-success">
                          {activeMachines.filter(m => m.status === 'optimal').length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Optimal
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          setStatFilter(
                            statFilter === "impaired" ? null : "impaired",
                          )
                        }
                        className={cn(
                          "bg-warning/15 dark:bg-warning/10 rounded-lg p-4 text-center transition-all hover:bg-warning/25 dark:hover:bg-warning/20 hover:scale-105",
                          statFilter === 'impaired' && "ring-2 ring-warning ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-warning dark:text-warning">
                          {activeMachines.filter(m => m.status === 'impaired').length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Impaired
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          setStatFilter(
                            statFilter === "critical" ? null : "critical",
                          )
                        }
                        className={cn(
                          "bg-destructive/15 dark:bg-destructive/10 rounded-lg p-4 text-center transition-all hover:bg-destructive/25 dark:hover:bg-destructive/20 hover:scale-105",
                          statFilter === 'critical' && "ring-2 ring-destructive ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-destructive dark:text-destructive">
                          {activeMachines.filter(m => m.status === 'critical').length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Critical
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          setStatFilter(
                            statFilter === "scheduled" ? null : "scheduled",
                          )
                        }
                        className={cn(
                          "bg-primary/15 dark:bg-primary/10 rounded-lg p-4 text-center transition-all hover:bg-primary/25 dark:hover:bg-primary/20 hover:scale-105",
                          statFilter === 'scheduled' && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <div className="text-3xl font-bold text-primary dark:text-primary">
                          {tasks.filter(t => t.status === 'scheduled').length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Scheduled
                        </div>
                      </button>
                    </div>

                    {/* Machine List when filter active */}
                    {statFilter && (
                      <div className="mt-4 border-t border-border pt-4 animate-in fade-in-50 slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium capitalize">
                            {statFilter === "scheduled"
                              ? "Scheduled Maintenance"
                              : `${statFilter} Machines`}
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatFilter(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {statFilter === "scheduled"
                            ? tasks
                              .filter((t) => t.status === "scheduled")
                              .map((task) => {
                                const machine = activeMachines.find(
                                  (m) => m.id === task.machineId,
                                );
                                return (
                                  <button
                                    key={task.id}
                                    onClick={() =>
                                      handleSelectMachine(task.machineId)
                                    }
                                    className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                                  >
                                    <div>
                                      <div className="font-medium text-sm">
                                        {machine?.name || "Unknown"}
                                      </div>
                                      <div className="text-xs text-muted-foreground capitalize">
                                        {task.type}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs text-primary font-medium">
                                        {new Date(
                                          task.scheduledDate,
                                        ).toLocaleDateString()}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {task.estimatedDuration}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })
                            : activeMachines
                              .filter((m) => m.status === statFilter)
                              .map((machine) => (
                                <button
                                  key={machine.id}
                                  onClick={() =>
                                    handleSelectMachine(machine.id)
                                  }
                                  className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                                >
                                  <div>
                                    <div className="font-medium text-sm">
                                      {machine.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {machine.type}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div
                                      className={cn(
                                        "text-sm font-bold",
                                        machine.rul < 30
                                          ? "text-destructive"
                                          : machine.rul <= 80
                                            ? "text-warning"
                                            : "text-success",
                                      )}
                                    >
                                      {machine.rul}d RUL
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Health: {machine.healthIndex}%
                                    </div>
                                  </div>
                                </button>
                              ))}
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
                      onClick={() => setDashboardTab("fleet")}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        dashboardTab === 'fleet'
                          ? 'bg-indigo-500/30 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/40 dark:border-indigo-500/30 shadow-sm shadow-indigo-500/15 dark:shadow-indigo-500/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Box className={cn('w-4 h-4', dashboardTab === 'fleet' && 'text-indigo-700 dark:text-indigo-400')} />
                      Fleet Overview
                    </button>
                    <button
                      onClick={() => setDashboardTab("ttf")}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        dashboardTab === 'ttf'
                          ? 'bg-amber-500/30 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/40 dark:border-amber-500/30 shadow-sm shadow-amber-500/15 dark:shadow-amber-500/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Clock className={cn('w-4 h-4', dashboardTab === 'ttf' && 'text-amber-700 dark:text-amber-400')} />
                      Time to Failure
                    </button>
                    <button
                      onClick={() => setDashboardTab("maintenance")}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        dashboardTab === 'maintenance'
                          ? 'bg-emerald-500/30 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/40 dark:border-emerald-500/30 shadow-sm shadow-emerald-500/15 dark:shadow-emerald-500/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Wrench className={cn('w-4 h-4', dashboardTab === 'maintenance' && 'text-emerald-700 dark:text-emerald-400')} />
                      Maintenance
                    </button>
                  </div>
                </div>

                <TabsContent value="fleet" className="mt-0">
                  <div className="grid grid-cols-1 gap-6">
                    {/* 3D Fleet View */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          3D Factory Floor
                        </CardTitle>
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
                        <CardTitle className="text-sm font-medium">
                          Fleet RUL Timeline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RULGraph
                          machine={null}
                          machines={activeMachines}
                          isFleetView={true}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Simulation Panel for Fleet */}
                  <Card className="mt-6">
                    <CardContent>
                      <SimulationPanel
                        machine={null}
                        machines={activeMachines}
                        isFleetView={true}
                      />
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
                      refreshToken={predictionRefreshToken}
                      onModuleFocus={(info) => { setFocusedModuleInfo(info); if (!info) setSelectedMeshName(null); }}
                      onMeshSelect={setSelectedMeshName}
                      selectedMeshName={selectedMeshName}
                    />
                  </CardContent>
                </Card>

                {/* Health Stats */}
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center">
                        <HealthGauge
                          value={selectedMachine.healthIndex}
                          label="Machine Health"
                          size="lg"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div
                            className={cn(
                              "text-2xl font-bold font-mono",
                              selectedMachine.rul < 30
                                ? "text-destructive"
                                : selectedMachine.rul <= 80
                                  ? "text-warning"
                                  : "text-success",
                            )}
                          >
                            {selectedMachine.rul}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Days RUL
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold font-mono text-foreground">
                            $
                            {(
                              selectedMachine.financialImpactPerDay / 1000
                            ).toFixed(1)}
                            K
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Daily Impact
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {focusedModuleInfo && (
                    <Card className="border-primary/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          {focusedModuleInfo.label} — Parts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {focusedModuleInfo.meshNames.map((name) => (
                            <div
                              key={name}
                              onClick={() => setSelectedMeshName(selectedMeshName === name ? null : name)}
                              className={`text-xs font-mono py-0.5 px-2 rounded transition-colors cursor-pointer ${selectedMeshName === name
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/50 font-semibold"
                                  : "text-muted-foreground bg-muted hover:bg-muted/70"
                                }`}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {selectedComponent && (
                    <Card className="border-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          Selected Component
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="font-medium">
                            {selectedComponent.name}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Health
                            </span>
                            <span
                              className={cn(
                                "font-bold",
                                selectedComponent.health >= 80
                                  ? "text-success"
                                  : selectedComponent.health >= 60
                                    ? "text-warning"
                                    : "text-destructive",
                              )}
                            >
                              {selectedComponent.health}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Status
                            </span>
                            <span
                              className={cn(
                                "capitalize",
                                selectedComponent.status === "healthy"
                                  ? "text-success"
                                  : selectedComponent.status === "degraded"
                                    ? "text-warning"
                                    : "text-destructive",
                              )}
                            >
                              {selectedComponent.status}
                            </span>
                          </div>
                          {focusedModuleInfo && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                Level 2 Components
                              </div>
                              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                {focusedModuleInfo.meshNames.map((mesh) => (
                                  <div
                                    key={mesh}
                                    onClick={() => setSelectedMeshName(selectedMeshName === mesh ? null : mesh)}
                                    className={`text-xs p-1.5 rounded border transition-colors cursor-pointer ${selectedMeshName === mesh
                                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50 font-semibold"
                                        : "text-foreground bg-muted/50 border-border/50 hover:bg-muted"
                                      }`}
                                  >
                                    {mesh}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Tabbed Content */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-5 w-full max-w-[760px]">
                  <TabsTrigger
                    value="diagnostics"
                  <TabsTrigger
                    value="diagnostics"
                    className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                  >
                    <Activity className="w-4 h-4" />
                    <span className="hidden sm:inline">Diagnostics</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="fine-tune"
                  <TabsTrigger
                    value="fine-tune"
                    className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
                  >
                    <BrainCircuit className="w-4 h-4" />
                    <span className="hidden sm:inline">Fine Tune</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="maintenance"
                  <TabsTrigger
                    value="maintenance"
                    className="gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500"
                  >
                    <Wrench className="w-4 h-4" />
                    <span className="hidden sm:inline">Maintenance</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="simulation"
                  <TabsTrigger
                    value="simulation"
                    className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Simulation</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="upgrades"
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
                        <CardTitle className="text-sm">
                          Live Sensor Feed
                        </CardTitle>
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
                        <XAIPanel machineId={selectedMachine.id} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="fine-tune" className="mt-6">
                  <FineTunePanel
                    machineId={selectedMachine.id}
                    machineName={selectedMachine.name}
                    onTuned={handleFineTuneComplete}
                  />
                </TabsContent>

                <TabsContent value="maintenance" className="mt-6">
                  <Card>
                    <CardContent className="pt-6">
                      <MaintenancePlanner
                        machine={selectedMachine}
                        selectedComponent={selectedComponent}
                        tasks={tasks}
                        onScheduleMaintenance={() => {
                          setFocusedMachineId(selectedMachine.id);
                          setSelectedMachineId(null);
                          setDashboardTab("maintenance");
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
  );
}
