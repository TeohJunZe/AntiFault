'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import { ArrowDown, ArrowUp, ArrowRight } from 'lucide-react'
import type { SegmentName } from './insight-panel'
import type { ComparisonMode } from './filter-bar'
import {
  currentMonthDonut,
  lastMonthDonut,
  beforeAntiFaultDonut,
  computeDeltas,
  computeTotalSavings,
} from '@/lib/admin-data'

/* ── Color system ────────────────────────────────────────────── */
const CURRENT_COLORS: Record<string, { light: string; dark: string }> = {
  Reactive:   { light: '#6b7280', dark: '#9ca3af' },   // grey-500 / grey-400
  Preventive: { light: '#a78bfa', dark: '#c4b5fd' },   // violet-400 / violet-300
  Predictive: { light: '#14b8a6', dark: '#2dd4bf' },   // teal-500 / teal-400
  Saved:      { light: '#34d399', dark: '#6ee7b7' },   // emerald-400 / emerald-300
}

const BEFORE_COLOR = { light: '#9ca3af', dark: '#4b5563' }

interface MaintenanceDonutProps {
  activeSegment: SegmentName
  onSegmentClick: (name: SegmentName) => void
  comparisonMode: ComparisonMode
}

/* ── Active shape: pop-out + glow ─────── */
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 12}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.3))' }}
      />
    </g>
  )
}

export function MaintenanceDonut({ activeSegment, onSegmentClick, comparisonMode }: MaintenanceDonutProps) {
  const isComparing = comparisonMode === 'vs-last-month' || comparisonMode === 'vs-before-antifault'
  const currentData = currentMonthDonut
  const comparisonData = comparisonMode === 'vs-last-month' ? lastMonthDonut : beforeAntiFaultDonut

  const activeIndex = activeSegment
    ? currentData.findIndex((d) => d.name === activeSegment)
    : -1

  const handleClickOuter = useCallback((_: any, index: number) => {
    const name = currentData[index].name as SegmentName
    onSegmentClick(activeSegment === name ? null : name)
  }, [activeSegment, onSegmentClick, currentData])

  // ── Dark mode ──
  const [isDarkMode, setIsDarkMode] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const check = () => setIsDarkMode(root.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // ── Computed deltas ──
  const deltas = useMemo(() => computeDeltas(currentData, comparisonData), [currentData, comparisonData])
  const savings = useMemo(() => computeTotalSavings(currentData, comparisonData), [currentData, comparisonData])
  const deltaMap = useMemo(() => {
    const m: Record<string, ReturnType<typeof computeDeltas>[0]> = {}
    deltas.forEach(d => { m[d.name] = d })
    return m
  }, [deltas])

  // ── Segment-level annotation for current donut (Percentage Change) ──
  const renderSegmentLabel = useCallback((props: any) => {
    if (!isComparing) return null
    const { cx, cy, midAngle, outerRadius, index } = props
    const entry = currentData[index]
    const delta = deltaMap[entry.name]
    if (!delta || delta.change === 0) return null

    const RADIAN = Math.PI / 180
    const radius = outerRadius + 12
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    const isImproved = delta.improved
    const color = isImproved ? '#10b981' : '#ef4444' // emerald-500 : red-500
    // Show change percent
    const text = `${isImproved ? '↓' : '↑'} ${Math.abs(Math.round(delta.changePercent))}%`

    return (
      <text
        x={x} y={y}
        textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
        fill={color}
        fontSize={12} fontWeight={800}
        style={{ pointerEvents: 'none' }}
      >
        {text}
      </text>
    )
  }, [isComparing, currentData, deltaMap])

  const currentTotal = currentData.filter(s => s.name !== 'Saved').reduce((s, d) => s + d.value, 0)
  const prevTotal = comparisonData.filter(s => s.name !== 'Saved').reduce((s, d) => s + d.value, 0)
  const comparisonLabel = comparisonMode === 'vs-last-month' ? 'vs Last Month' : 'vs Before AntiFault'

  return (
    <div className="p-6 rounded-xl bg-card border border-border/50 shadow-sm flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs font-medium text-muted-foreground dark:text-white uppercase tracking-wider">
          Maintenance Cost Breakdown {isComparing ? '— Comparison' : '(This Month)'}
        </div>
      </div>

      {/* ── Chart Area ── */}
      {isComparing ? (
        <div className="flex items-center justify-between mb-8 px-2 md:px-4">
          {/* Previous Chart (Muted, but clearer now) */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-muted-foreground mb-3 tracking-wide uppercase">{comparisonLabel}</span>
            <div className="relative w-[160px] h-[160px]">
              {/* Dashed Outline */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="78" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className="text-muted-foreground/30" />
              </svg>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={comparisonData}
                    cx="50%" cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={true}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                    activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                    activeShape={(props: any) => {
                      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
                      return (
                        <g>
                          <Sector
                            cx={cx} cy={cy}
                            innerRadius={innerRadius - 3}
                            outerRadius={outerRadius + 8}
                            startAngle={startAngle} endAngle={endAngle}
                            fill={fill}
                            style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.2))' }}
                          />
                        </g>
                      )
                    }}
                  >
                    {comparisonData.map((entry, index) => {
                      const isActive = activeSegment === null || activeSegment === entry.name
                      return (
                        <Cell key={`prev-${index}`} fill={isDarkMode ? BEFORE_COLOR.dark : BEFORE_COLOR.light} opacity={isActive ? 0.7 : 0.25} />
                      )
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-foreground">RM {prevTotal.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 opacity-80">Total</span>
              </div>
            </div>
          </div>

          {/* Transition Indicator */}
          <div className="flex flex-col items-center justify-center flex-1 px-4 z-10 animate-in fade-in zoom-in duration-500 delay-150">
            <div className={`flex flex-col items-center text-center ${savings.costReduced > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500'}`}>
              <div className="text-lg md:text-xl font-black mb-1 whitespace-nowrap tracking-tight">
                {savings.costReduced > 0 ? '↓' : '↑'} RM {Math.abs(savings.costReduced).toLocaleString()} saved
              </div>
              <div className="text-sm font-bold opacity-90 whitespace-nowrap mb-3">
                {savings.costReduced > 0 ? '↓' : '↑'} {Math.round(savings.percentChange)}% cost reduction
              </div>
              {/* Thick Gradient Arrow */}
              <svg width="100" height="24" viewBox="0 0 100 24" fill="none" className={savings.costReduced > 0 ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"}>
                <defs>
                  <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={isDarkMode ? '#6b7280' : '#9ca3af'} />
                    <stop offset="100%" stopColor={savings.costReduced > 0 ? '#10b981' : '#ef4444'} />
                  </linearGradient>
                </defs>
                <path d="M0 9H80V3L100 12L80 21V15H0V9Z" fill="url(#arrowGrad)" />
              </svg>
            </div>
          </div>

          {/* Current Chart (Focus) */}
          <div className="flex flex-col items-center">
             <span className="text-xs font-bold text-foreground mb-3 tracking-wide uppercase">Current Month</span>
            <div className="relative w-[280px] h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={currentData}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    dataKey="value"
                    activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                    activeShape={renderActiveShape}
                    onClick={handleClickOuter}
                    label={renderSegmentLabel}
                    labelLine={false}
                    style={{ cursor: 'pointer', outline: 'none' }}
                    isAnimationActive animationDuration={800}
                  >
                    {currentData.map((entry, index) => {
                      const col = CURRENT_COLORS[entry.name]
                      const fill = isDarkMode ? col.dark : col.light
                      const isActive = activeSegment === null || activeSegment === entry.name
                      return (
                        <Cell
                          key={`curr-${index}`}
                          fill={fill}
                          opacity={isActive ? 1 : 0.3}
                          stroke="none"
                          style={{
                            transition: 'opacity 0.3s ease, filter 0.3s ease',
                            outline: 'none',
                            filter: isActive ? `drop-shadow(0 0 8px ${fill}60)` : 'none',
                          }}
                        />
                      )
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-foreground">RM {currentTotal.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mb-6" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={currentData}
                cx="50%" cy="50%"
                innerRadius={80}
                outerRadius={115}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                dataKey="value"
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onClick={handleClickOuter}
                style={{ cursor: 'pointer', outline: 'none' }}
                isAnimationActive animationDuration={800}
              >
                {currentData.map((entry, index) => {
                  const col = CURRENT_COLORS[entry.name]
                  const fill = isDarkMode ? col.dark : col.light
                  const isActive = activeSegment === null || activeSegment === entry.name
                  return (
                    <Cell
                      key={`curr-${index}`}
                      fill={fill}
                      opacity={isActive ? 1 : 0.3}
                      stroke="none"
                      style={{ transition: 'opacity 0.3s ease' }}
                    />
                  )
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              RM {currentTotal.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
              Total Cost
            </div>
          </div>
        </div>
      )}

      {/* ── Breakdown List / Legend ── */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {isComparing ? (
          <div className="space-y-2">
            {currentData.map((entry) => {
              const col = CURRENT_COLORS[entry.name]
              const delta = deltaMap[entry.name]
              const prevVal = delta?.previousValue || 0
              const isActive = activeSegment === null || activeSegment === entry.name

              return (
                <button
                  key={entry.name}
                  onClick={() => onSegmentClick(activeSegment === entry.name ? null : (entry.name as SegmentName))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                    isActive ? 'bg-muted/40 border-border/80 shadow-sm' : 'opacity-60 border-transparent hover:bg-muted/20 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: isDarkMode ? col.dark : col.light }} />
                    <span className="text-sm font-semibold text-foreground">{entry.name}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className={`text-right font-black ${delta?.improved ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500'}`}>
                      {delta?.change === 0 ? '-' : (
                        <span className="flex items-center justify-end gap-1 text-base">
                          {delta?.improved ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                          RM {Math.abs(delta?.change || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {currentData.map((entry) => {
              const col = CURRENT_COLORS[entry.name]
              const isActive = activeSegment === null || activeSegment === entry.name

              return (
                <button
                  key={entry.name}
                  onClick={() => onSegmentClick(activeSegment === entry.name ? null : (entry.name as SegmentName))}
                  className={`flex flex-col items-start px-3 py-2 rounded-lg border transition-all duration-200 ${
                    isActive ? 'bg-muted/40 border-border/80' : 'opacity-60 border-transparent hover:bg-muted/20 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: isDarkMode ? col.dark : col.light }} />
                    <span className="text-xs font-semibold text-foreground truncate">{entry.name}</span>
                  </div>
                  <div className="text-sm font-bold pl-4.5">
                    RM {entry.value.toLocaleString()}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
