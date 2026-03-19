// Types for Digital Twin Application
export type MachineStatus = 'optimal' | 'impaired' | 'critical'
export type ComponentStatus = 'healthy' | 'degraded' | 'failing' | 'failed'

export interface SensorReading {
  timestamp: number
  temperature: number
  vibration: number
  load: number
  pressure: number
}

export interface MachineComponent {
  id: string
  name: string
  status: ComponentStatus
  health: number // 0-100
  lastMaintenance: string
  predictedFailure: string | null
  position: [number, number, number] // 3D position
  repairTime: number // hours
  replacementCost: number
  contributionToRUL: number // percentage contribution to RUL degradation
}

export interface Machine {
  id: string
  name: string
  type: string
  status: MachineStatus
  location: { x: number; y: number }
  healthIndex: number // 0-100
  rul: number // Remaining Useful Life in days
  lastMaintenance: string
  nextScheduledMaintenance: string
  components: MachineComponent[]
  sensorHistory: SensorReading[]
  financialImpactPerDay: number
  changePointDate: string | null
}

export interface MaintenanceTask {
  id: string
  machineId: string
  machineName: string
  type: 'preventive' | 'corrective' | 'predictive'
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high' | 'critical'
  scheduledDate: string
  estimatedDuration: number // hours
  assignedTechnician: string | null
  partsRequired: string[]
  estimatedCost: number
}

export interface Alert {
  id: string
  machineId: string
  machineName: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: string
  acknowledged: boolean
}

export interface SimulationResult {
  daysDelayed: number
  projectedRUL: number
  financialImpact: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
}

// Mock Data
export const mockMachines: Machine[] = [
  {
    id: 'machine-1',
    name: 'Boiler Pump #1',
    type: 'Industrial Pump',
    status: 'optimal',
    location: { x: 20, y: 30 },
    healthIndex: 92,
    rul: 45,
    lastMaintenance: '2026-02-15',
    nextScheduledMaintenance: '2026-04-15',
    changePointDate: null,
    financialImpactPerDay: 5200,
    components: [
      { id: 'c1-1', name: 'Motor', status: 'healthy', health: 95, lastMaintenance: '2026-02-15', predictedFailure: null, position: [0, 0.5, 0], repairTime: 4, replacementCost: 12000, contributionToRUL: 0 },
      { id: 'c1-2', name: 'Bearing Assembly', status: 'healthy', health: 88, lastMaintenance: '2026-02-15', predictedFailure: null, position: [0, -0.3, 0.4], repairTime: 2, replacementCost: 3500, contributionToRUL: 5 },
      { id: 'c1-3', name: 'Impeller', status: 'healthy', health: 94, lastMaintenance: '2026-01-10', predictedFailure: null, position: [0, 0, 0.8], repairTime: 3, replacementCost: 8000, contributionToRUL: 0 },
      { id: 'c1-4', name: 'Seal Assembly', status: 'healthy', health: 91, lastMaintenance: '2026-02-15', predictedFailure: null, position: [0, 0, -0.4], repairTime: 1.5, replacementCost: 2000, contributionToRUL: 3 },
    ],
    sensorHistory: generateSensorHistory(92),
  },
  {
    id: 'machine-2',
    name: 'Compressor Unit #3',
    type: 'Air Compressor',
    status: 'impaired',
    location: { x: 50, y: 40 },
    healthIndex: 68,
    rul: 12,
    lastMaintenance: '2026-01-20',
    nextScheduledMaintenance: '2026-03-20',
    changePointDate: '2026-03-05',
    financialImpactPerDay: 8500,
    components: [
      { id: 'c2-1', name: 'Compression Chamber', status: 'degraded', health: 62, lastMaintenance: '2026-01-20', predictedFailure: '2026-03-29', position: [0, 0, 0], repairTime: 6, replacementCost: 25000, contributionToRUL: 45 },
      { id: 'c2-2', name: 'Cooling System', status: 'healthy', health: 78, lastMaintenance: '2026-01-20', predictedFailure: null, position: [0.6, 0, 0], repairTime: 3, replacementCost: 6000, contributionToRUL: 15 },
      { id: 'c2-3', name: 'Drive Belt', status: 'degraded', health: 55, lastMaintenance: '2025-12-15', predictedFailure: '2026-03-25', position: [-0.4, 0.3, 0], repairTime: 1, replacementCost: 800, contributionToRUL: 30 },
      { id: 'c2-4', name: 'Control Unit', status: 'healthy', health: 85, lastMaintenance: '2026-01-20', predictedFailure: null, position: [0, 0.6, 0], repairTime: 2, replacementCost: 4500, contributionToRUL: 10 },
    ],
    sensorHistory: generateSensorHistory(68),
  },
  {
    id: 'machine-3',
    name: 'Hydraulic Press #2',
    type: 'Hydraulic System',
    status: 'critical',
    location: { x: 75, y: 60 },
    healthIndex: 35,
    rul: 3,
    lastMaintenance: '2025-12-01',
    nextScheduledMaintenance: '2026-03-01',
    changePointDate: '2026-02-20',
    financialImpactPerDay: 15000,
    components: [
      { id: 'c3-1', name: 'Hydraulic Cylinder', status: 'failing', health: 28, lastMaintenance: '2025-12-01', predictedFailure: '2026-03-20', position: [0, 0.4, 0], repairTime: 8, replacementCost: 35000, contributionToRUL: 55 },
      { id: 'c3-2', name: 'Pump Assembly', status: 'degraded', health: 42, lastMaintenance: '2025-12-01', predictedFailure: '2026-03-28', position: [0, -0.3, 0], repairTime: 5, replacementCost: 18000, contributionToRUL: 25 },
      { id: 'c3-3', name: 'Valve Block', status: 'degraded', health: 38, lastMaintenance: '2025-12-01', predictedFailure: '2026-03-22', position: [0.5, 0, 0], repairTime: 3, replacementCost: 8500, contributionToRUL: 15 },
      { id: 'c3-4', name: 'Pressure Sensor', status: 'healthy', health: 72, lastMaintenance: '2026-01-15', predictedFailure: null, position: [-0.3, 0.2, 0], repairTime: 1, replacementCost: 1200, contributionToRUL: 5 },
    ],
    sensorHistory: generateSensorHistory(35),
  },
  {
    id: 'machine-4',
    name: 'CNC Mill #5',
    type: 'CNC Machine',
    status: 'optimal',
    location: { x: 35, y: 70 },
    healthIndex: 88,
    rul: 60,
    lastMaintenance: '2026-03-01',
    nextScheduledMaintenance: '2026-05-01',
    changePointDate: null,
    financialImpactPerDay: 12000,
    components: [
      { id: 'c4-1', name: 'Spindle Motor', status: 'healthy', health: 90, lastMaintenance: '2026-03-01', predictedFailure: null, position: [0, 0.5, 0], repairTime: 6, replacementCost: 28000, contributionToRUL: 0 },
      { id: 'c4-2', name: 'Linear Guides', status: 'healthy', health: 85, lastMaintenance: '2026-03-01', predictedFailure: null, position: [0, -0.2, 0.3], repairTime: 4, replacementCost: 9000, contributionToRUL: 8 },
      { id: 'c4-3', name: 'Ball Screw Assembly', status: 'healthy', health: 88, lastMaintenance: '2026-03-01', predictedFailure: null, position: [0, 0, -0.3], repairTime: 5, replacementCost: 7500, contributionToRUL: 4 },
      { id: 'c4-4', name: 'Tool Changer', status: 'healthy', health: 92, lastMaintenance: '2026-03-01', predictedFailure: null, position: [0.4, 0.3, 0], repairTime: 2, replacementCost: 5000, contributionToRUL: 0 },
    ],
    sensorHistory: generateSensorHistory(88),
  },
  {
    id: 'machine-5',
    name: 'Conveyor System #1',
    type: 'Material Handling',
    status: 'impaired',
    location: { x: 60, y: 25 },
    healthIndex: 72,
    rul: 18,
    lastMaintenance: '2026-02-01',
    nextScheduledMaintenance: '2026-04-01',
    changePointDate: '2026-03-10',
    financialImpactPerDay: 4800,
    components: [
      { id: 'c5-1', name: 'Drive Motor', status: 'healthy', health: 82, lastMaintenance: '2026-02-01', predictedFailure: null, position: [0, 0.3, 0], repairTime: 3, replacementCost: 6500, contributionToRUL: 10 },
      { id: 'c5-2', name: 'Belt Assembly', status: 'degraded', health: 58, lastMaintenance: '2026-02-01', predictedFailure: '2026-04-05', position: [0, 0, 0], repairTime: 2, replacementCost: 3200, contributionToRUL: 40 },
      { id: 'c5-3', name: 'Tensioner', status: 'degraded', health: 65, lastMaintenance: '2026-02-01', predictedFailure: '2026-04-10', position: [0.3, 0, 0], repairTime: 1, replacementCost: 1500, contributionToRUL: 30 },
      { id: 'c5-4', name: 'Roller Bearings', status: 'healthy', health: 78, lastMaintenance: '2026-02-01', predictedFailure: null, position: [-0.3, 0, 0], repairTime: 2, replacementCost: 2800, contributionToRUL: 20 },
    ],
    sensorHistory: generateSensorHistory(72),
  },
]

export const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    machineId: 'machine-3',
    machineName: 'Hydraulic Press #2',
    severity: 'critical',
    message: 'Imminent hydraulic cylinder failure detected. RUL: 3 days. Immediate maintenance required.',
    timestamp: '2026-03-17T08:30:00Z',
    acknowledged: false,
  },
  {
    id: 'alert-2',
    machineId: 'machine-2',
    machineName: 'Compressor Unit #3',
    severity: 'warning',
    message: 'Drive belt degradation accelerating. Scheduled replacement recommended within 8 days.',
    timestamp: '2026-03-17T06:15:00Z',
    acknowledged: false,
  },
  {
    id: 'alert-3',
    machineId: 'machine-5',
    machineName: 'Conveyor System #1',
    severity: 'warning',
    message: 'Belt tension anomaly detected. Inspection recommended.',
    timestamp: '2026-03-16T14:45:00Z',
    acknowledged: true,
  },
  {
    id: 'alert-4',
    machineId: 'machine-3',
    machineName: 'Hydraulic Press #2',
    severity: 'critical',
    message: 'Pressure fluctuations exceeding safe threshold. Production quality may be affected.',
    timestamp: '2026-03-17T09:00:00Z',
    acknowledged: false,
  },
]

export const mockMaintenanceTasks: MaintenanceTask[] = [
  {
    id: 'task-1',
    machineId: 'machine-3',
    machineName: 'Hydraulic Press #2',
    type: 'corrective',
    status: 'overdue',
    priority: 'critical',
    scheduledDate: '2026-03-15',
    estimatedDuration: 8,
    assignedTechnician: 'John Smith',
    partsRequired: ['Hydraulic Cylinder', 'Seal Kit', 'Hydraulic Fluid'],
    estimatedCost: 42000,
  },
  {
    id: 'task-2',
    machineId: 'machine-2',
    machineName: 'Compressor Unit #3',
    type: 'predictive',
    status: 'scheduled',
    priority: 'high',
    scheduledDate: '2026-03-20',
    estimatedDuration: 4,
    assignedTechnician: 'Maria Garcia',
    partsRequired: ['Drive Belt', 'Tensioner Pulley'],
    estimatedCost: 1800,
  },
  {
    id: 'task-3',
    machineId: 'machine-5',
    machineName: 'Conveyor System #1',
    type: 'predictive',
    status: 'scheduled',
    priority: 'medium',
    scheduledDate: '2026-03-25',
    estimatedDuration: 3,
    assignedTechnician: null,
    partsRequired: ['Belt Assembly', 'Tensioner Springs'],
    estimatedCost: 4200,
  },
  {
    id: 'task-4',
    machineId: 'machine-1',
    machineName: 'Boiler Pump #1',
    type: 'preventive',
    status: 'scheduled',
    priority: 'low',
    scheduledDate: '2026-04-15',
    estimatedDuration: 2,
    assignedTechnician: 'David Chen',
    partsRequired: ['Lubricant', 'Filter Kit'],
    estimatedCost: 850,
  },
]

export const technologySuggestions = [
  {
    machineId: 'machine-3',
    machineName: 'Hydraulic Press #2',
    currentAge: 8,
    suggestion: 'Upgrade to Servo-Electric Press',
    benefits: ['30% energy reduction', '50% faster cycle time', 'Reduced maintenance'],
    estimatedCost: 185000,
    estimatedSavingsPerYear: 45000,
    roi: '4.1 years',
    recommendation: 'Consider replacement within 12 months given current failure rate',
  },
  {
    machineId: 'machine-2',
    machineName: 'Compressor Unit #3',
    currentAge: 5,
    suggestion: 'Install Variable Frequency Drive (VFD)',
    benefits: ['25% energy reduction', 'Reduced wear on components', 'Better pressure control'],
    estimatedCost: 12000,
    estimatedSavingsPerYear: 4200,
    roi: '2.9 years',
    recommendation: 'Upgrade during next scheduled maintenance',
  },
]

// Helper function to generate sensor history
export function generateSensorHistoryForHealth(healthIndex: number): SensorReading[] {
  return generateSensorHistory(healthIndex)
}

function generateSensorHistory(healthIndex: number): SensorReading[] {
  const now = Date.now()
  const readings: SensorReading[] = []
  const degradationFactor = (100 - healthIndex) / 100

  for (let i = 0; i < 24; i++) {
    const baseTemp = 65 + degradationFactor * 25
    const baseVibration = 2 + degradationFactor * 8
    const baseLoad = 70 + degradationFactor * 15
    const basePressure = 100 + degradationFactor * 30

    readings.push({
      timestamp: now - (23 - i) * 3600000,
      temperature: baseTemp + (Math.random() - 0.5) * 10,
      vibration: baseVibration + (Math.random() - 0.5) * 2,
      load: baseLoad + (Math.random() - 0.5) * 10,
      pressure: basePressure + (Math.random() - 0.5) * 15,
    })
  }

  return readings
}

export function simulateMaintenanceDelay(machine: Machine, daysDelayed: number): SimulationResult {
  const currentRUL = machine.rul
  const degradationRate = (100 - machine.healthIndex) / currentRUL
  const projectedRUL = Math.max(0, currentRUL - daysDelayed * (1 + degradationRate * 0.5))
  const financialImpact = daysDelayed > currentRUL 
    ? machine.financialImpactPerDay * (daysDelayed - currentRUL) * 1.5 
    : machine.financialImpactPerDay * daysDelayed * 0.1

  let riskLevel: SimulationResult['riskLevel']
  const recommendations: string[] = []

  if (projectedRUL <= 0) {
    riskLevel = 'critical'
    recommendations.push('Immediate maintenance required - machine failure imminent')
    recommendations.push('Schedule emergency repair team')
    recommendations.push('Prepare backup production capacity')
  } else if (projectedRUL <= 5) {
    riskLevel = 'high'
    recommendations.push('High risk of unplanned downtime')
    recommendations.push('Accelerate parts procurement')
    recommendations.push('Brief maintenance team on procedure')
  } else if (projectedRUL <= 15) {
    riskLevel = 'medium'
    recommendations.push('Monitor closely for further degradation')
    recommendations.push('Confirm parts availability')
    recommendations.push('Review maintenance schedule optimization')
  } else {
    riskLevel = 'low'
    recommendations.push('Delay acceptable within safety margins')
    recommendations.push('Continue regular monitoring')
    recommendations.push('Optimize delay to align with production gaps')
  }

  return {
    daysDelayed,
    projectedRUL,
    financialImpact,
    riskLevel,
    recommendations,
  }
}

export function calculateGlobalHealthIndex(machines: Machine[]): number {
  if (machines.length === 0) return 0
  const totalHealth = machines.reduce((sum, m) => sum + m.healthIndex, 0)
  return Math.round(totalHealth / machines.length)
}
