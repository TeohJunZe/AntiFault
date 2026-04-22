'use client'

export function ComparisonSummary() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* BEFORE */}
      <div className="p-6 rounded-xl bg-card border border-border/50 shadow-sm">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-5">
          Before AntiFault
        </div>
        <div className="space-y-5">
          <div>
            <div className="text-4xl font-extrabold text-muted-foreground/70 tracking-tight">
              RM 185,000
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total Maintenance Cost
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-muted-foreground/70">
                69%
              </div>
              <div className="text-xs text-muted-foreground">Uptime</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted-foreground/70">
                120 hrs
              </div>
              <div className="text-xs text-muted-foreground">Downtime</div>
            </div>
          </div>
        </div>
      </div>

      {/* AFTER */}
      <div className="p-6 rounded-xl bg-card border border-teal-500/20 shadow-sm">
        <div className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-5">
          After AntiFault
        </div>
        <div className="space-y-5">
          <div>
            <div className="text-4xl font-extrabold text-teal-600 dark:text-teal-400 tracking-tight">
              RM 116,800
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total Maintenance Cost
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                87%
              </div>
              <div className="text-xs text-muted-foreground">Uptime</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                45 hrs
              </div>
              <div className="text-xs text-muted-foreground">Downtime</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
