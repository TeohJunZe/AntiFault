'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Calendar, SlidersHorizontal, X } from 'lucide-react'

export type DateRange = 'this-month' | 'last-month' | 'custom'
export type ComparisonMode = 'none' | 'vs-last-month' | 'vs-before-antifault'

interface FilterBarProps {
  dateRange: DateRange
  comparisonMode: ComparisonMode
  onDateRangeChange: (v: DateRange) => void
  onComparisonModeChange: (v: ComparisonMode) => void
}

export function FilterBar({
  dateRange,
  comparisonMode,
  onDateRangeChange,
  onComparisonModeChange,
}: FilterBarProps) {
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground dark:text-white uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
        </div>

        <div className="h-5 w-px bg-border/60" />

        {/* Date Range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex rounded-lg bg-muted/50 border border-border p-0.5 gap-0.5">
            {([
              { value: 'this-month', label: 'This Month' },
              { value: 'last-month', label: 'Last Month' },
              { value: 'custom', label: 'Custom' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => onDateRangeChange(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                  dateRange === opt.value
                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-500/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-5 w-px bg-border/60" />

        {/* Comparison Mode */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground dark:text-white">Compare</span>
          <div className="flex rounded-lg bg-muted/50 border border-border p-0.5 gap-0.5">
            {([
              { value: 'none', label: 'None' },
              { value: 'vs-last-month', label: 'vs Last Month' },
              { value: 'vs-before-antifault', label: 'vs Before AntiFault' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => onComparisonModeChange(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                  comparisonMode === opt.value
                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-500/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date picker (only shown when "Custom" is selected) */}
      {dateRange === 'custom' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-teal-500/20 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/50"
              />
            </div>
            <span className="text-muted-foreground/50">→</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/50"
              />
            </div>
          </div>
          <button
            onClick={() => { onDateRangeChange('this-month'); setCustomFrom(''); setCustomTo('') }}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
