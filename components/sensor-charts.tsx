'use client'

import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

import mockRul10 from '../lib/mock_data/mock_payload_rul_10.json'
import mockRul40 from '../lib/mock_data/mock_payload_rul_40.json'
import mockRul100 from '../lib/mock_data/mock_payload_rul_100.json'

interface SensorChartsProps {
  machineId: string
}

export function SensorCharts({ machineId }: SensorChartsProps) {
  let payload: any;
  if (machineId === 'machine-1' || machineId === 'machine-4') payload = mockRul40;
  else if (machineId === 'machine-2' || machineId === 'machine-5') payload = mockRul100;
  else payload = mockRul10;

  const flightHistory = payload.flight_history || [];
  const recentFlights = flightHistory.slice(-24);
  const now = Date.now();

  const formattedData = recentFlights.map((flight: any, idx: number) => ({
    time: new Date(now - (recentFlights.length - 1 - idx) * 3600000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    s1: Math.round(flight.sensor_1 * 100) / 100,
    s5: Math.round(flight.sensor_5 * 100) / 100,
    s2: Math.round(flight.sensor_2 * 100) / 100,
    s11: Math.round(flight.sensor_11 * 100) / 100,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-2 text-xs">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Sensor 1: Stagnant */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground" title="Temperature 1">Temperature 1</span>
          <span className="text-sm font-mono text-chart-1">
            {formattedData[formattedData.length - 1]?.s1} °C
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="gradient1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="s1"
                name="Temperature 1"
                stroke="oklch(0.75 0.15 195)"
                fill="url(#gradient1)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sensor 5: Stagnant */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground" title="Vibration 1">Vibration 1</span>
          <span className="text-sm font-mono text-chart-2">
            {formattedData[formattedData.length - 1]?.s5} mm/s
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="gradient5" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.2 145)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.2 145)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="s5"
                name="Vibration 1"
                stroke="oklch(0.65 0.2 145)"
                fill="url(#gradient5)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sensor 2: Changing */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground" title="Temperature 2">Temperature 2</span>
          <span className="text-sm font-mono text-chart-3">
            {formattedData[formattedData.length - 1]?.s2} °C
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="gradient2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.75 0.18 75)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.75 0.18 75)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="s2"
                name="Temperature 2"
                stroke="oklch(0.75 0.18 75)"
                fill="url(#gradient2)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sensor 11: Changing */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground" title="Vibration 2">Vibration 2</span>
          <span className="text-sm font-mono text-chart-5">
            {formattedData[formattedData.length - 1]?.s11} mm/s
          </span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="gradient11" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="s11"
                name="Vibration 2"
                stroke="oklch(0.65 0.18 250)"
                fill="url(#gradient11)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
