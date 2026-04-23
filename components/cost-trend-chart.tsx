'use client'

import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, ArrowUpRight } from 'lucide-react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export function CostTrendChart() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [timeFilter, setTimeFilter] = useState('Quarterly')
  
  useEffect(() => {
    const root = document.documentElement
    const check = () => setIsDarkMode(root.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const activeData = useMemo(() => {
    switch (timeFilter) {
      case 'Weekly': return [
        { date: 'Mon', before: 27500, current: 24500 },
        { date: 'Tue', before: 28000, current: 24000 },
        { date: 'Wed', before: 28200, current: 23800 },
        { date: 'Thu', before: 28500, current: 23500 },
        { date: 'Fri', before: 28800, current: 23000 },
        { date: 'Sat', before: 29000, current: 22800 },
        { date: 'Sun', before: 29500, current: 22000 },
      ]
      case 'Monthly': return [
        { date: 'Week 1', before: 62000, current: 58000 },
        { date: 'Week 2', before: 65000, current: 54000 },
        { date: 'Week 3', before: 68000, current: 49000 },
        { date: 'Week 4', before: 72000, current: 45000 },
      ]
      case 'Quarterly': return [
        { date: 'Jan', before: 155000, current: 155000 },
        { date: 'Feb', before: 160000, current: 150000 },
        { date: 'Mar', before: 162000, current: 142000 },
      ]
      case 'Yearly': return [
        { date: 'Jul', before: 140000, current: 140000 },
        { date: 'Aug', before: 142000, current: 141000 },
        { date: 'Sep', before: 145000, current: 142000 },
        { date: 'Oct', before: 148000, current: 144000 },
        { date: 'Nov', before: 150000, current: 145000 },
        { date: 'Dec', before: 152000, current: 148000 },
        { date: 'Jan', before: 155000, current: 150000 },
        { date: 'Feb', before: 160000, current: 148000 },
        { date: 'Mar', before: 162000, current: 142000 },
        { date: 'Apr', before: 168000, current: 135000 },
        { date: 'May', before: 172000, current: 125000 },
        { date: 'Jun', before: 184800, current: 116600 },
      ]
      default: return []
    }
  }, [timeFilter])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const currentData = payload.find((p: any) => p.dataKey === 'current')
      if (!currentData) return null
      return (
        <div className="bg-background/95 border border-border shadow-sm px-3 py-2 rounded-lg backdrop-blur-md">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{label}</div>
          <div className="text-sm font-black text-foreground">RM {currentData.value.toLocaleString()}</div>
        </div>
      )
    }
    return null
  }

  return (
    <section className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Cost & Savings Trend
          </h2>
          <div className="flex gap-0.5 bg-muted/40 p-1 rounded-lg border border-border/50 shadow-sm">
            {['Weekly', 'Monthly', 'Quarterly', 'Yearly'].map(t => (
              <button 
                key={t} 
                onClick={() => setTimeFilter(t)}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  t === timeFilter 
                    ? 'bg-background shadow-sm text-foreground border border-border/50' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4">
        {/* Left: Line Chart */}
        <Card className="border border-border/50 bg-card shadow-sm">
          <CardContent className="p-4 h-[400px] relative overflow-hidden rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeData} margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#4b5563' : '#d1d5db'} />
                
                <XAxis 
                  dataKey="date" 
                  axisLine={{ stroke: isDarkMode ? '#4b5563' : '#9ca3af', strokeWidth: 1.5 }}
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: isDarkMode ? '#d1d5db' : '#4b5563', fontWeight: 800 }} 
                  tickMargin={12}
                />
                
                <YAxis 
                  domain={['dataMin - 2000', 'dataMax + 2000']} 
                  axisLine={{ stroke: isDarkMode ? '#4b5563' : '#9ca3af', strokeWidth: 1.5 }}
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: isDarkMode ? '#d1d5db' : '#4b5563', fontWeight: 800 }} 
                  tickFormatter={(val) => `RM ${val > 1000 ? (val / 1000) + 'k' : val}`}
                  width={60}
                  tickMargin={12}
                />
                
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: isDarkMode ? '#374151' : '#e5e7eb', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                
                {/* Optional Baseline */}
                <Line 
                  type="monotone" 
                  dataKey="before" 
                  stroke={isDarkMode ? '#374151' : '#d1d5db'} 
                  strokeWidth={1.5} 
                  strokeDasharray="4 4" 
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                
                {/* Soft Shaded Area */}
                <Area 
                  type="monotone" 
                  dataKey="current" 
                  fill="url(#areaFill)" 
                  stroke="none" 
                  activeDot={false}
                />
                
                {/* Main Clean Line */}
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#10b981" 
                  strokeWidth={3.5} 
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right: KPI Summary Panel */}
        <div className="flex flex-col gap-3">
          <Card className="border border-border/50 bg-card shadow-sm flex-1 flex flex-col justify-center px-6 py-4">
            <span className="text-xs font-semibold text-muted-foreground dark:text-white uppercase tracking-wider mb-1">
              Total Saved (YTD)
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              RM 204,400
            </div>
          </Card>
          
          <Card className="border border-border/50 bg-card shadow-sm flex-1 flex flex-col justify-center px-6 py-4">
            <span className="text-xs font-semibold text-muted-foreground dark:text-white uppercase tracking-wider mb-1">
              Estimated ROI
            </span>
            <div className="flex items-end gap-2">
              <div className="text-2xl font-black text-foreground">
                325%
              </div>
              <div className="flex items-center text-xs font-bold text-emerald-500 mb-1">
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                3.25x
              </div>
            </div>
          </Card>

          <Card className="border border-border/50 bg-card shadow-sm flex-1 flex flex-col justify-center px-6 py-4">
            <span className="text-xs font-semibold text-muted-foreground dark:text-white uppercase tracking-wider mb-1">
              Payback Period
            </span>
            <div className="text-2xl font-black text-foreground">
              3.8 <span className="text-sm font-semibold text-muted-foreground uppercase">months</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
