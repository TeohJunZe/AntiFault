// Admin Dashboard Types & Mock Data

export interface KPIData {
  totalCostSaved: number
  totalCostSavedBefore: number
  downtimeReduced: number
  downtimeHoursBefore: number
  downtimeHoursAfter: number
  productionEfficiency: number
  efficiencyBefore: number
  maintenanceCostSaved: number
  maintenanceCostBefore: number
  factoryUtilization: number
  activeAlerts: number
}

export interface OrderInput {
  quantity: number
  deadline: string
  productType: string
  sellingPrice: number
}

export type Decision = 'Accept' | 'Caution' | 'Reject'

export interface OrderAnalysisResult {
  decision: Decision
  profit: number
  risk: 'Low' | 'Medium' | 'High'
  riskScore: number
  delayProbability: number
  completionDays: number
  breakdownProbability: number
  explanation: string
  recommendation: string
  scenarios: ScenarioCard[]
}

export interface ScenarioCard {
  title: string
  profit: number
  risk: 'Low' | 'Medium' | 'High'
  delayChance: number
  recommended: boolean
  description: string
}

// ── Mock KPI Data ──────────────────────────────────────────────
export const mockKPIData: KPIData = {
  totalCostSaved: 248500,
  totalCostSavedBefore: 0,
  downtimeReduced: 62,
  downtimeHoursBefore: 120,
  downtimeHoursAfter: 45,
  productionEfficiency: 87,
  efficiencyBefore: 69,
  maintenanceCostSaved: 68200,
  maintenanceCostBefore: 185000,
  factoryUtilization: 78,
  activeAlerts: 3,
}

// ── Business Impact Insights ──────────────────────────────────
export const businessInsights = [
  {
    icon: 'alert-triangle',
    severity: 'critical' as const,
    headline: 'High risk of production stoppage',
    detail: 'A critical machine may fail within 3 days. If not addressed, this could halt production for up to 2 days.',
    impact: 'Estimated loss: RM 30,000',
  },
  {
    icon: 'clock',
    severity: 'warning' as const,
    headline: 'Potential delivery delay',
    detail: 'Current machine condition may delay active orders by 1–2 days if maintenance is not scheduled soon.',
    impact: 'At risk: Order #102, Order #108',
  },
  {
    icon: 'trending-down',
    severity: 'warning' as const,
    headline: 'Efficiency declining this week',
    detail: 'Factory output has dropped 8% compared to last week due to increased machine wear.',
    impact: 'Revenue impact: RM 12,000/week',
  },
  {
    icon: 'check-circle',
    severity: 'success' as const,
    headline: 'Maintenance ROI is strong',
    detail: 'Predictive maintenance has saved RM 68,200 this month by preventing 4 unplanned breakdowns.',
    impact: 'Return on maintenance spend: 3.2x',
  },
]

// ── AI Summary Data ───────────────────────────────────────────
export const aiFinancialSummary = {
  totalSavedThisMonth: 248500,
  downtimeLossAvoided: 180000,
  maintenanceROI: 3.2,
}

export const aiRecommendations = [
  'Schedule maintenance for the critical machine within 2 days to avoid a RM 30,000 loss.',
  'Avoid accepting large orders (>5,000 units) this week until maintenance is completed.',
  'Consider adding one extra shift next week to catch up on delayed orders.',
  'Review supplier contracts — parts delivery is causing 15% of maintenance delays.',
]

export const aiNarrativeSummary =
  'AntiFault reduced unplanned downtime by 62% this month, saving the factory an estimated RM 248,500 in lost production. Based on current system health, the factory can safely accept small to medium orders. However, one machine is approaching critical condition — scheduling maintenance within 2 days will prevent a potential RM 30,000 production stoppage. Large-volume orders should be delayed until after maintenance is completed.'

// ── Donut chart data by period ────────────────────────────────
export interface DonutSegment {
  name: string
  value: number
}

// Current month data
export const currentMonthDonut: DonutSegment[] = [
  { name: 'Reactive', value: 45000 },
  { name: 'Preventive', value: 30000 },
  { name: 'Predictive', value: 41800 },
  { name: 'Saved', value: 68200 },
]

// Last month data (higher reactive, lower predictive)
export const lastMonthDonut: DonutSegment[] = [
  { name: 'Reactive', value: 60000 },
  { name: 'Preventive', value: 32000 },
  { name: 'Predictive', value: 35000 },
  { name: 'Saved', value: 52000 },
]

// Before AntiFault (no predictive, no savings, all reactive/preventive)
export const beforeAntiFaultDonut: DonutSegment[] = [
  { name: 'Reactive', value: 110000 },
  { name: 'Preventive', value: 45000 },
  { name: 'Predictive', value: 15000 },
  { name: 'Saved', value: 15000 },
]

export interface DonutDelta {
  name: string
  currentValue: number
  previousValue: number
  change: number      // absolute
  changePercent: number // percentage
  improved: boolean    // true = cost went down (good)
}

export function computeDeltas(
  current: DonutSegment[],
  previous: DonutSegment[]
): DonutDelta[] {
  return current.map(c => {
    const p = previous.find(s => s.name === c.name)
    const prevVal = p?.value ?? 0
    const change = c.value - prevVal
    const changePercent = prevVal > 0 ? ((change / prevVal) * 100) : 0
    // For "Saved" segment, increase is good; for costs, decrease is good
    const improved = c.name === 'Saved' ? change > 0 : change < 0
    return {
      name: c.name,
      currentValue: c.value,
      previousValue: prevVal,
      change,
      changePercent,
      improved,
    }
  })
}

export function computeTotalSavings(
  current: DonutSegment[],
  previous: DonutSegment[]
): { totalCurrentCost: number; totalPreviousCost: number; costReduced: number; percentChange: number } {
  const costSegments = (d: DonutSegment[]) => d.filter(s => s.name !== 'Saved').reduce((sum, s) => sum + s.value, 0)
  const totalCurrentCost = costSegments(current)
  const totalPreviousCost = costSegments(previous)
  const costReduced = totalPreviousCost - totalCurrentCost
  const percentChange = totalPreviousCost > 0 ? ((costReduced / totalPreviousCost) * 100) : 0
  return { totalCurrentCost, totalPreviousCost, costReduced, percentChange }
}

// ── Product types for order form ──────────────────────────────
export const productTypes = [
  { value: 'standard', label: 'Standard Parts' },
  { value: 'precision', label: 'Precision Components' },
  { value: 'heavy', label: 'Heavy Machinery Parts' },
  { value: 'electronics', label: 'Electronic Assemblies' },
  { value: 'custom', label: 'Custom Orders' },
]

// ── Order analysis helper ─────────────────────────────────────
export function analyzeOrder(
  input: OrderInput,
  avgMachineHealth: number,
  currentLoad: number
): OrderAnalysisResult {
  // Step 1: Risk Score
  const healthFactor = (1 - avgMachineHealth / 100) * 0.6
  const loadFactor = (currentLoad / 100) * 0.4
  const riskScore = Math.min(1, healthFactor + loadFactor)

  // Step 2: Profit
  const unitPrice = input.sellingPrice || 15
  const laborCostPerUnit = 3
  const materialCostPerUnit = 5
  const maintenanceSurcharge = riskScore > 0.5 ? input.quantity * 1.5 : 0
  const profit = input.quantity * (unitPrice - laborCostPerUnit - materialCostPerUnit) - maintenanceSurcharge

  // Step 3: Decision
  let decision: Decision
  let risk: 'Low' | 'Medium' | 'High'
  if (riskScore < 0.4) {
    decision = 'Accept'
    risk = 'Low'
  } else if (riskScore < 0.7) {
    decision = 'Caution'
    risk = 'Medium'
  } else {
    decision = 'Reject'
    risk = 'High'
  }

  // Timing
  const baseProductionDays = Math.ceil(input.quantity / 2000)
  const delayProbability = Math.min(0.95, riskScore * 0.8 + (input.quantity > 5000 ? 0.15 : 0))
  const completionDays = baseProductionDays + Math.round(delayProbability * 3)
  const breakdownProbability = Math.min(95, Math.round(riskScore * 100))

  // Explanation
  const explanations: string[] = []
  if (riskScore > 0.5) {
    explanations.push('Current factory workload is high, which increases the chance of delays.')
  }
  if (avgMachineHealth < 70) {
    explanations.push('Some machines need attention soon, which could cause unexpected stoppages.')
  }
  if (input.quantity > 5000) {
    explanations.push('This is a large order that will put extra pressure on factory capacity.')
  }
  if (profit > 0) {
    explanations.push(`This order is expected to generate RM ${profit.toLocaleString()} in profit.`)
  }

  const explanation = explanations.length > 0
    ? explanations.join(' ')
    : 'Based on current conditions, the factory can handle this order comfortably with minimal risk.'

  const recommendation = decision === 'Accept'
    ? 'Proceed with the order. Factory conditions are favorable.'
    : decision === 'Caution'
      ? 'Consider performing maintenance first to reduce risk before accepting.'
      : 'Factory conditions are not suitable. Reject or delay this order until maintenance is completed.'

  // Scenarios
  const scenarios: ScenarioCard[] = [
    {
      title: 'Accept Now',
      profit: profit,
      risk: risk,
      delayChance: Math.round(delayProbability * 100),
      recommended: decision === 'Accept',
      description: 'Take the order immediately with current factory conditions.',
    },
    {
      title: 'Maintain First',
      profit: Math.round(profit * 0.9),
      risk: 'Low',
      delayChance: Math.max(5, Math.round(delayProbability * 30)),
      recommended: decision === 'Caution',
      description: 'Schedule maintenance first, then accept. Safer but slightly lower profit due to delay.',
    },
    {
      title: 'Reject Order',
      profit: 0,
      risk: 'Low',
      delayChance: 0,
      recommended: decision === 'Reject',
      description: 'Decline the order to avoid risk entirely. No revenue but no risk.',
    },
  ]

  return {
    decision,
    profit,
    risk,
    riskScore,
    delayProbability,
    completionDays,
    breakdownProbability,
    explanation,
    recommendation,
    scenarios,
  }
}
