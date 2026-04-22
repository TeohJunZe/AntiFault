'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts'

const comparisonData = [
  {
    metric: 'Maintenance Cost',
    before: 185000,
    after: 116800,
    unit: 'RM',
    format: (v: number) => `RM ${(v / 1000).toFixed(0)}k`,
  },
  {
    metric: 'Downtime Hours',
    before: 120,
    after: 45,
    unit: 'hrs',
    format: (v: number) => `${v} hrs`,
  },
  {
    metric: 'Uptime %',
    before: 69,
    after: 87,
    unit: '%',
    format: (v: number) => `${v}%`,
  },
]

export function ComparisonBarChart() {
  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-6">
        Before vs After Comparison
      </div>

      <div className="space-y-8">
        {comparisonData.map((item) => {
          const maxVal = Math.max(item.before, item.after) * 1.15
          const beforePct = (item.before / maxVal) * 100
          const afterPct = (item.after / maxVal) * 100

          // For uptime, higher is better so After should look better
          const isAfterBetter = item.metric === 'Uptime %' ? item.after > item.before : item.after < item.before

          return (
            <div key={item.metric} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {item.metric}
                </span>
                <span className={`text-xs font-bold ${isAfterBetter ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {item.metric === 'Uptime %'
                    ? `+${item.after - item.before}%`
                    : item.metric === 'Downtime Hours'
                      ? `-${item.before - item.after} hrs`
                      : `-RM ${((item.before - item.after) / 1000).toFixed(1)}k`
                  }
                </span>
              </div>

              {/* Before Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">Before</span>
                  <div className="flex-1 h-6 bg-muted/30 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground/25 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                      style={{ width: `${beforePct}%` }}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {item.format(item.before)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* After Bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 w-12 shrink-0 font-medium">After</span>
                  <div className="flex-1 h-6 bg-teal-500/5 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-teal-500/30 dark:bg-teal-500/25 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                      style={{ width: `${afterPct}%` }}
                    >
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300">
                        {item.format(item.after)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground/25" />
          <span className="text-[10px] text-muted-foreground">Before AntiFault</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-teal-500/30" />
          <span className="text-[10px] text-muted-foreground">After AntiFault</span>
        </div>
      </div>
    </div>
  )
}
