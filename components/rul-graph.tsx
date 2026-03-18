'use client'

import { Machine } from '@/lib/data'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'

interface RULGraphProps {
  machine: Machine | null
  machines?: Machine[]
  isFleetView?: boolean
}

export function RULGraph({ machine, machines = [], isFleetView = false }: RULGraphProps) {
  // Fleet View - show RUL bar chart for all machines
  if (isFleetView && machines.length > 0) {
    const fleetData = machines
      .map(m => ({
        name: m.name.replace('Machine ', 'M'),
        fullName: m.name,
        rul: m.rul,
        health: m.healthIndex,
        status: m.status,
        id: m.id,
      }))
      .sort((a, b) => a.rul - b.rul)

    const getBarColor = (rul: number) => {
      if (rul <= 5) return '#ef4444'
      if (rul <= 15) return '#eab308'
      return '#22c55e'
    }

    const FleetTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs">
            <p className="font-medium mb-2">{data.fullName}</p>
            <div className="space-y-1">
              <p className="text-muted-foreground">
                RUL: <span className={
                  data.rul > 15 ? 'text-success' :
                  data.rul > 5 ? 'text-warning' :
                  'text-destructive'
                }>{data.rul} days</span>
              </p>
              <p className="text-muted-foreground">
                Health: <span className="font-mono">{data.health}%</span>
              </p>
              <p className="text-muted-foreground capitalize">
                Status: <span className={
                  data.status === 'optimal' ? 'text-success' :
                  data.status === 'impaired' ? 'text-warning' :
                  'text-destructive'
                }>{data.status}</span>
              </p>
            </div>
          </div>
        )
      }
      return null
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Fleet RUL Overview</h4>
            <p className="text-xs text-muted-foreground">Remaining useful life by machine</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Critical (&lt;5d)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-warning" />
              <span className="text-muted-foreground">Warning (&lt;15d)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
              <span className="text-muted-foreground">Good</span>
            </div>
          </div>
        </div>

        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fleetData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: 'currentColor', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: 'currentColor', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'currentColor' } }}
              />
              <Tooltip content={<FleetTooltip />} />
              
              {/* Critical threshold */}
              <ReferenceLine
                y={5}
                stroke="#ef4444"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                y={15}
                stroke="#eab308"
                strokeDasharray="3 3"
              />
              
              <Bar dataKey="rul" radius={[4, 4, 0, 0]}>
                {fleetData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.rul)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Single machine view - if no machine, show placeholder
  if (!machine) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        Select a machine to view RUL timeline
      </div>
    )
  }
  // Generate RUL timeline data (simulated historical and projected)
  const generateRULData = () => {
    const data = []
    const today = new Date()
    const totalDays = 90

    // Historical data (past 60 days)
    for (let i = -60; i <= 0; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      
      // Simulate degradation curve
      let health: number
      if (i < -30) {
        health = 95 + Math.random() * 3 // Stable period
      } else if (machine.changePointDate && new Date(machine.changePointDate) <= date) {
        // After change point - accelerated degradation
        const daysAfterChange = Math.floor((date.getTime() - new Date(machine.changePointDate).getTime()) / 86400000)
        health = 85 - daysAfterChange * (100 - machine.healthIndex) / 30 + Math.random() * 5
      } else {
        // Gradual degradation
        health = 95 - (30 + i) * 0.3 + Math.random() * 3
      }

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        health: Math.max(0, Math.min(100, Math.round(health))),
        rul: Math.max(0, machine.rul + i),
        isProjected: false,
        isChangePoint: machine.changePointDate && 
          date.toDateString() === new Date(machine.changePointDate).toDateString(),
      })
    }

    // Projected data (next 30 days)
    const degradationRate = (100 - machine.healthIndex) / 60
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      
      const projectedHealth = Math.max(0, machine.healthIndex - degradationRate * i * 1.2)
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        health: Math.round(projectedHealth),
        projectedHealth: Math.round(projectedHealth),
        rul: Math.max(0, machine.rul - i),
        isProjected: true,
        isChangePoint: false,
      })
    }

    return data
  }

  const data = generateRULData()
  const changePointIndex = data.findIndex(d => d.isChangePoint)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs">
          <p className="font-medium mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Health: <span className={
                dataPoint.health >= 80 ? 'text-success' :
                dataPoint.health >= 60 ? 'text-warning' :
                'text-destructive'
              }>{dataPoint.health}%</span>
            </p>
            <p className="text-muted-foreground">
              RUL: <span className="text-foreground font-mono">{dataPoint.rul} days</span>
            </p>
            {dataPoint.isProjected && (
              <p className="text-accent italic">Projected</p>
            )}
            {dataPoint.isChangePoint && (
              <p className="text-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Change Point Detected
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">RUL Timeline</h4>
          <p className="text-xs text-muted-foreground">Health degradation over time</p>
        </div>
        {machine.changePointDate && (
          <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-2 py-1 rounded">
            <AlertTriangle className="w-3 h-3" />
            Change point: {new Date(machine.changePointDate).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            {/* Critical zone */}
            <ReferenceArea y1={0} y2={30} fill="oklch(0.55 0.22 25)" fillOpacity={0.1} />
            
            {/* Warning zone */}
            <ReferenceArea y1={30} y2={60} fill="oklch(0.75 0.18 75)" fillOpacity={0.05} />

            <XAxis
              dataKey="date"
              tick={{ fill: 'currentColor', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'currentColor', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Historical health */}
            <Area
              type="monotone"
              dataKey="health"
              stroke="oklch(0.75 0.15 195)"
              fill="url(#healthGradient)"
              strokeWidth={2}
              dot={false}
            />
            
            {/* Projected health */}
            <Area
              type="monotone"
              dataKey="projectedHealth"
              stroke="oklch(0.65 0.18 250)"
              strokeDasharray="5 5"
              fill="url(#projectedGradient)"
              strokeWidth={2}
              dot={false}
            />

            {/* Change point line */}
            {changePointIndex >= 0 && (
              <ReferenceLine
                x={data[changePointIndex].date}
                stroke="oklch(0.75 0.18 75)"
                strokeDasharray="3 3"
                label={{
                  value: 'Change Point',
                  fill: 'oklch(0.75 0.18 75)',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            )}

            {/* Critical threshold */}
            <ReferenceLine
              y={30}
              stroke="oklch(0.55 0.22 25)"
              strokeDasharray="3 3"
              label={{
                value: 'Critical',
                fill: 'oklch(0.55 0.22 25)',
                fontSize: 10,
                position: 'right',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-primary rounded" />
          <span className="text-muted-foreground">Historical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-accent rounded" style={{ background: 'repeating-linear-gradient(90deg, oklch(0.65 0.18 250), oklch(0.65 0.18 250) 3px, transparent 3px, transparent 6px)' }} />
          <span className="text-muted-foreground">Projected</span>
        </div>
      </div>
    </div>
  )
}
