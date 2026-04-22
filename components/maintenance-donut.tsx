'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import { ArrowDown, ArrowUp, TrendingDown, TrendingUp, Sparkles } from 'lucide-react'
import type { SegmentName } from './insight-panel'
import type { ComparisonMode } from './filter-bar'
import {
  currentMonthDonut,
  lastMonthDonut,
  beforeAntiFaultDonut,
  computeDeltas,
  computeTotalSavings,
} from '@/lib/admin-data'

/* ── Color system ──────────────────────────────────────────────
   Current ring: strong, vivid colours per segment
   Before ring:  uniform neutral grey at 30-35 % opacity         */

const CURRENT_COLORS: Record<string, { light: string; dark: string }> = {
  Reactive:   { light: '#6b7280', dark: '#9ca3af' },   // grey-500 / grey-400
  Preventive: { light: '#a78bfa', dark: '#c4b5fd' },   // violet-400 / violet-300
  Predictive: { light: '#14b8a6', dark: '#2dd4bf' },   // teal-500 / teal-400
  Saved:      { light: '#34d399', dark: '#6ee7b7' },   // emerald-400 / emerald-300
}

// Inner "before" ring is always neutral grey
const BEFORE_COLOR = { light: '#9ca3af', dark: '#4b5563' }

interface MaintenanceDonutProps {
  activeSegment: SegmentName
  onSegmentClick: (name: SegmentName) => void
  comparisonMode: ComparisonMode
}

/* ── Hover tooltip state (lifted so the overlay can read it) ── */
interface HoverInfo {
  name: string
  currentVal: number
  previousVal: number
  change: number
  improved: boolean
  cx: number
  cy: number
}

/* ── Active shape: pop-out + glow for improved segments ─────── */
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

  // ── Hover state ──
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  // ── Computed deltas ──
  const deltas = useMemo(() => computeDeltas(currentData, comparisonData), [currentData, comparisonData])
  const savings = useMemo(() => computeTotalSavings(currentData, comparisonData), [currentData, comparisonData])
  const deltaMap = useMemo(() => {
    const m: Record<string, ReturnType<typeof computeDeltas>[0]> = {}
    deltas.forEach(d => { m[d.name] = d })
    return m
  }, [deltas])

  const topInsight = useMemo(() => {
    const sorted = deltas
      .filter(d => d.name !== 'Saved')
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    const top = sorted[0]
    if (!top) return ''
    return `${top.name} maintenance ${top.improved ? 'reduced' : 'increased'} by ${Math.abs(Math.round(top.changePercent))}%`
  }, [deltas])

  const currentTotal = currentData.filter(s => s.name !== 'Saved').reduce((s, d) => s + d.value, 0)
  const comparisonLabel = comparisonMode === 'vs-last-month' ? 'vs Last Month' : 'vs Before AntiFault'

  // ── Chart geometry ──
  const outerOuter = isComparing ? 158 : 160
  const outerInner = isComparing ? 110 : 100
  const innerOuter = 95
  const innerInner = 58

  // ── Segment-level annotation positions (rendered as SVG text via customized label) ──
  const renderSegmentArrow = useCallback((props: any) => {
    if (!isComparing) return null
    const { cx, cy, midAngle, outerRadius, index } = props
    const entry = currentData[index]
    const delta = deltaMap[entry.name]
    if (!delta || delta.change === 0) return null

    const RADIAN = Math.PI / 180
    const radius = outerRadius + 22
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    const arrow = delta.improved ? '↓' : '↑'
    const color = delta.improved ? '#10b981' : '#ef4444'

    return (
      <g>
        <text
          x={x} y={y}
          textAnchor="middle" dominantBaseline="central"
          fill={color}
          fontSize={14} fontWeight={800}
          style={{ pointerEvents: 'none' }}
        >
          {arrow}
        </text>
      </g>
    )
  }, [isComparing, currentData, deltaMap])

  // ── Mouse handlers for hover tooltip ──
  const handleMouseEnter = useCallback((_: any, index: number) => {
    if (!isComparing) return
    const entry = currentData[index]
    const delta = deltaMap[entry.name]
    if (!delta) return
    setHoverInfo({
      name: entry.name,
      currentVal: delta.currentValue,
      previousVal: delta.previousValue,
      change: delta.change,
      improved: delta.improved,
      cx: 0, cy: 0,
    })
  }, [isComparing, currentData, deltaMap])

  const handleMouseLeave = useCallback(() => { setHoverInfo(null) }, [])

  return (
    <div className="p-6 rounded-xl bg-card border border-border/50 shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Maintenance Cost Breakdown {isComparing ? '— Comparison' : '(This Month)'}
        </div>
        {isComparing && (
          <div className="flex items-center gap-3 text-[10px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isDarkMode ? '#2dd4bf' : '#14b8a6' }} />
              <span className="text-foreground/80">Current</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full opacity-35" style={{ backgroundColor: isDarkMode ? BEFORE_COLOR.dark : BEFORE_COLOR.light }} />
              <span className="text-muted-foreground">{comparisonLabel}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div className="relative" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Inner ring — BEFORE (neutral grey, low opacity) */}
            {isComparing && (
              <Pie
                data={comparisonData}
                cx="50%" cy="50%"
                innerRadius={innerInner}
                outerRadius={innerOuter}
                paddingAngle={2}
                dataKey="value"
                style={{ cursor: 'default', outline: 'none' }}
                isAnimationActive animationDuration={800}
              >
                {comparisonData.map((_entry, index) => (
                  <Cell
                    key={`inner-${index}`}
                    fill={isDarkMode ? BEFORE_COLOR.dark : BEFORE_COLOR.light}
                    opacity={0.3}
                    stroke="none"
                    style={{ outline: 'none' }}
                  />
                ))}
              </Pie>
            )}

            {/* Outer ring — CURRENT (vivid, full opacity, glow on improved) */}
            <Pie
              data={currentData}
              cx="50%" cy="50%"
              innerRadius={outerInner}
              outerRadius={outerOuter}
              paddingAngle={2}
              dataKey="value"
              activeIndex={activeIndex >= 0 ? activeIndex : undefined}
              activeShape={renderActiveShape}
              onClick={handleClickOuter}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              label={renderSegmentArrow}
              labelLine={false}
              style={{ cursor: 'pointer', outline: 'none' }}
              isAnimationActive animationDuration={800}
            >
              {currentData.map((entry, index) => {
                const col = CURRENT_COLORS[entry.name]
                const fill = isDarkMode ? col.dark : col.light
                const isActive = activeSegment === null || activeSegment === entry.name
                const delta = deltaMap[entry.name]
                const glowing = isComparing && delta?.improved
                return (
                  <Cell
                    key={`outer-${index}`}
                    fill={fill}
                    opacity={isActive ? 1 : 0.2}
                    stroke="none"
                    style={{
                      transition: 'opacity 0.3s ease, filter 0.3s ease',
                      outline: 'none',
                      filter: glowing && isActive ? `drop-shadow(0 0 8px ${fill})` : 'none',
                    }}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* ── Center label ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {isComparing ? (
            <>
              <div className="flex items-center gap-1.5">
                {savings.costReduced > 0 ? (
                  <TrendingDown className="w-6 h-6 text-emerald-500" />
                ) : (
                  <TrendingUp className="w-6 h-6 text-red-500" />
                )}
                <span className={`text-[2rem] font-black tracking-tight leading-none ${
                  savings.costReduced > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500'
                }`}>
                  RM {Math.abs(savings.costReduced).toLocaleString()}
                </span>
              </div>
              <div className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                Saved
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 opacity-70">
                {comparisonLabel.toLowerCase()}
              </div>
            </>
          ) : (
            <>
              <div className="text-4xl font-extrabold text-foreground tracking-tight">
                RM {currentTotal.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
                Total Cost
              </div>
              <div className="text-sm font-bold text-teal-600 dark:text-teal-400 mt-2">
                ↓ RM {currentData.find(d => d.name === 'Saved')?.value.toLocaleString()} saved
              </div>
            </>
          )}
        </div>

        {/* ── Hover tooltip ── */}
        {hoverInfo && isComparing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-xl bg-popover border border-border shadow-xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="text-xs font-bold text-foreground mb-1">{hoverInfo.name}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">RM {hoverInfo.previousVal.toLocaleString()}</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="font-bold text-foreground">RM {hoverInfo.currentVal.toLocaleString()}</span>
              <span className={`font-black ${hoverInfo.improved ? 'text-emerald-500' : 'text-red-500'}`}>
                ({hoverInfo.improved ? '↓' : '↑'} RM {Math.abs(hoverInfo.change).toLocaleString()})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="grid grid-cols-4 gap-2 mt-2">
        {currentData.map((entry) => {
          const col = CURRENT_COLORS[entry.name]
          const isActive = activeSegment === null || activeSegment === entry.name
          const delta = deltaMap[entry.name]
          const compEntry = comparisonData.find(d => d.name === entry.name)

          return (
            <button
              key={entry.name}
              onClick={() => onSegmentClick(activeSegment === entry.name ? null : (entry.name as SegmentName))}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-200 hover:bg-muted/50 ${
                isActive ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: isDarkMode ? col.dark : col.light }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-foreground truncate">{entry.name}</span>
                  {isComparing && delta && delta.change !== 0 && (
                    <span className={`text-[10px] font-black ${delta.improved ? 'text-emerald-500' : 'text-red-500'}`}>
                      {delta.improved ? '↓' : '↑'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  RM {entry.value.toLocaleString()}
                  {isComparing && compEntry && (
                    <span className="text-muted-foreground/40"> ← {compEntry.value.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Comparison deltas + insight ── */}
      {isComparing && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {deltas.filter(d => d.change !== 0).map(d => (
              <div
                key={d.name}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  d.improved
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/5 border-red-500/20 text-red-500 dark:text-red-400'
                }`}
              >
                {d.improved ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                <span>{d.name}</span>
                <span className="font-black">
                  {d.improved ? '↓' : '↑'} RM {Math.abs(d.change).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {topInsight && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{topInsight}</span>
                {' — '}
                {savings.costReduced > 0
                  ? `saving RM ${savings.costReduced.toLocaleString()} in total maintenance costs.`
                  : `maintenance costs increased by RM ${Math.abs(savings.costReduced).toLocaleString()}.`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
