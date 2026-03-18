'use client'

import { SensorReading } from '@/lib/data'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface SensorChartsProps {
  data: SensorReading[]
}

export function SensorCharts({ data }: SensorChartsProps) {
  const formattedData = data.map((reading) => ({
    time: new Date(reading.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    temperature: Math.round(reading.temperature * 10) / 10,
    vibration: Math.round(reading.vibration * 100) / 100,
    load: Math.round(reading.load),
    pressure: Math.round(reading.pressure),
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-2 text-xs">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'Temperature' ? '°C' :
               entry.name === 'Vibration' ? ' mm/s' :
               entry.name === 'Load' ? '%' :
               entry.name === 'Pressure' ? ' PSI' : ''}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Temperature */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Temperature</span>
          <span className="text-sm font-mono text-chart-1">
            {formattedData[formattedData.length - 1]?.temperature}°C
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="temperature"
                name="Temperature"
                stroke="oklch(0.75 0.15 195)"
                fill="url(#tempGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vibration */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Vibration</span>
          <span className="text-sm font-mono text-chart-2">
            {formattedData[formattedData.length - 1]?.vibration} mm/s
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="vibGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.2 145)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.2 145)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="vibration"
                name="Vibration"
                stroke="oklch(0.65 0.2 145)"
                fill="url(#vibGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Load */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Load</span>
          <span className="text-sm font-mono text-chart-3">
            {formattedData[formattedData.length - 1]?.load}%
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.75 0.18 75)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.75 0.18 75)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="load"
                name="Load"
                stroke="oklch(0.75 0.18 75)"
                fill="url(#loadGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pressure */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Pressure</span>
          <span className="text-sm font-mono text-chart-5">
            {formattedData[formattedData.length - 1]?.pressure} PSI
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="pressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="pressure"
                name="Pressure"
                stroke="oklch(0.65 0.18 250)"
                fill="url(#pressGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
