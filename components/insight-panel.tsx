'use client'

import { Sparkles, TrendingUp, AlertTriangle, ShieldCheck, Zap } from 'lucide-react'

export type SegmentName = 'Reactive' | 'Preventive' | 'Predictive' | 'Saved' | null

interface InsightPanelProps {
  activeSegment: SegmentName
}

const insightData: Record<string, {
  title: string
  amount: string
  icon: React.ReactNode
  accentClass: string
  sections: { heading: string; items: string[] }[]
  action?: string
  potential?: string
}> = {
  Saved: {
    title: 'System-Generated Savings',
    amount: 'RM 68,200 saved',
    icon: <TrendingUp className="w-5 h-5" />,
    accentClass: 'text-teal-500 dark:text-teal-400',
    sections: [
      {
        heading: 'Impact',
        items: [
          '75 fewer downtime hours',
          '+18% operational output',
          'Reduced emergency repairs',
        ],
      },
      {
        heading: 'AI Insight',
        items: [
          'Savings mainly from early fault detection in Machine A',
        ],
      },
    ],
    action: 'Continue predictive maintenance strategy',
  },
  Reactive: {
    title: 'Reactive Maintenance',
    amount: 'RM 45,000',
    icon: <AlertTriangle className="w-5 h-5" />,
    accentClass: 'text-muted-foreground',
    sections: [
      {
        heading: 'Issue',
        items: [
          'High unplanned breakdowns',
          'Production delays observed',
        ],
      },
      {
        heading: 'Suggestion',
        items: [
          'Shift 30% to predictive maintenance',
        ],
      },
    ],
    potential: '+ RM 12,000',
  },
  Preventive: {
    title: 'Preventive Maintenance',
    amount: 'RM 30,000',
    icon: <ShieldCheck className="w-5 h-5" />,
    accentClass: 'text-muted-foreground/80',
    sections: [
      {
        heading: 'Status',
        items: [
          'Scheduled intervals maintained',
          'Some over-servicing detected',
        ],
      },
      {
        heading: 'Suggestion',
        items: [
          'Optimize intervals based on sensor data',
          'Reduce unnecessary part replacements',
        ],
      },
    ],
    potential: '+ RM 5,000',
  },
  Predictive: {
    title: 'Predictive Maintenance',
    amount: 'RM 41,800',
    icon: <Zap className="w-5 h-5" />,
    accentClass: 'text-teal-600 dark:text-teal-400',
    sections: [
      {
        heading: 'Status',
        items: [
          'Prevented major failures',
          'Reduced downtime significantly',
        ],
      },
      {
        heading: 'Impact',
        items: [
          'Major contributor to cost savings',
        ],
      },
    ],
  },
}

export function InsightPanel({ activeSegment }: InsightPanelProps) {
  if (!activeSegment) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-xl bg-card border border-border/50 shadow-sm min-h-[320px]">
        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Sparkles className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-sm font-medium text-muted-foreground mb-1">
          Click a segment
        </div>
        <div className="text-xs text-muted-foreground/60 max-w-[200px]">
          Select a slice on the donut chart to reveal detailed insights and recommendations
        </div>
      </div>
    )
  }

  const data = insightData[activeSegment]
  if (!data) return null

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 shadow-sm space-y-5 min-h-[320px]">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className={data.accentClass}>{data.icon}</div>
          <span className="text-xs font-medium text-muted-foreground dark:text-white uppercase tracking-wider">
            {data.title}
          </span>
        </div>
        <div className={`text-2xl font-extrabold ${data.accentClass}`}>
          {data.amount}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {data.sections.map((section) => (
          <div key={section.heading}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {section.heading}
            </div>
            <ul className="space-y-1">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Action */}
      {data.action && (
        <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/15">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Action
          </div>
          <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
            {data.action}
          </div>
        </div>
      )}

      {/* Potential Savings */}
      {data.potential && (
        <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/15">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Potential saving
          </div>
          <div className="text-sm font-bold text-teal-600 dark:text-teal-400">
            {data.potential}
          </div>
        </div>
      )}

      {/* What-If Simulation */}
      {activeSegment === 'Saved' && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            What-If Simulation
          </div>
          <div className="text-xs text-muted-foreground mb-1">
            If predictive maintenance increases by 10%:
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
              → Save additional RM 15,000
            </div>
            <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
              → Reduce downtime by 12 hours
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
