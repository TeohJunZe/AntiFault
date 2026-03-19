'use client'

import { technologySuggestions } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Lightbulb, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  FileText,
  Activity,
  AlertTriangle,
  ShieldAlert,
  Settings
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TechnologySuggestionsProps {
  machineId: string
}

export function TechnologySuggestions({ machineId }: TechnologySuggestionsProps) {
  const suggestion = technologySuggestions.find(s => s.machineId === machineId)

  if (!suggestion) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <Lightbulb className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No technology upgrade suggestions available for this machine.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Current equipment is operating efficiently.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-warning" />
        <h4 className="text-sm font-medium">Technology Upgrade Suggestion</h4>
      </div>

      {/* Main Suggestion Card */}
      <div className="bg-gradient-to-br from-warning/10 to-primary/10 border border-warning/30 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h5 className="font-medium text-warning">{suggestion.suggestion}</h5>
            <p className="text-xs text-muted-foreground mt-1">
              Current equipment age: {suggestion.currentAge} years
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Benefits:</p>
          <div className="flex flex-wrap gap-2">
            {suggestion.benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-success/10 text-success px-2 py-1 rounded text-xs"
              >
                <CheckCircle2 className="w-3 h-3" />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <DollarSign className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Investment</p>
            <p className="text-sm font-bold">${(suggestion.estimatedCost / 1000).toFixed(0)}K</p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-xs text-muted-foreground">Annual Savings</p>
            <p className="text-sm font-bold text-success">${(suggestion.estimatedSavingsPerYear / 1000).toFixed(0)}K</p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">ROI Period</p>
            <p className="text-sm font-bold text-primary">{suggestion.roi}</p>
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">AI Recommendation:</p>
          <p className="text-sm">{suggestion.recommendation}</p>
        </div>
      </div>

      {/* Action Button & Modal */}
      <Dialog>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            Request Detailed Analysis
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-5 h-5 text-primary" />
              Detailed Analysis Report
            </DialogTitle>
            <DialogDescription>
              Comprehensive breakdown of machine performance and ROI potential.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Performance Metrics */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <Activity className="w-4 h-4" />
                  <h4 className="font-semibold">Performance Metrics</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className="text-muted-foreground">Efficiency Trend</span>
                      <span className="text-success text-shadow-sm">92%</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div className="h-full bg-gradient-to-r from-emerald-500/80 to-success rounded-full" style={{ width: '92%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className="text-muted-foreground">Resource Utilization</span>
                      <span className="text-foreground">78%</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div className="h-full bg-gradient-to-r from-blue-500/80 to-primary rounded-full" style={{ width: '78%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <DollarSign className="w-4 h-4" />
                  <h4 className="font-semibold">6-Month Cost Breakdown</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <div className="flex-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Maintenance</span>
                      <span className="font-medium font-mono">${(suggestion.estimatedCost * 0.4).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <div className="flex-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Energy Loss</span>
                      <span className="font-medium font-mono">${(suggestion.estimatedCost * 0.35).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <div className="flex-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Consumables</span>
                      <span className="font-medium font-mono">${(suggestion.estimatedCost * 0.25).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upgrade Scenarios */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <TrendingUp className="w-4 h-4" />
                  <h4 className="font-semibold">Upgrade Projection</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-background/80 rounded-lg p-3 border border-border shadow-sm text-center">
                     <div className="text-xs text-muted-foreground mb-1 font-medium">Expected Gains</div>
                     <div className="text-xl font-bold text-success">+15%</div>
                   </div>
                   <div className="bg-background/80 rounded-lg p-3 border border-border shadow-sm text-center">
                     <div className="text-xs text-muted-foreground mb-1 font-medium">Payback Period</div>
                     <div className="text-xl font-bold text-primary">{suggestion.roi}</div>
                   </div>
                </div>
              </div>

              {/* Risk & Criticality */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <AlertTriangle className="w-4 h-4" />
                  <h4 className="font-semibold">Risk Factor</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3 p-2 bg-warning/10 rounded-md border border-warning/20">
                    <ShieldAlert className="w-8 h-8 text-warning shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-warning">Medium Risk</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Failure likelihood increases substantially if upgrades are delayed.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Predictive Insights */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 p-4 rounded-xl shadow-inner mt-2">
               <div className="flex items-center gap-2 mb-2">
                 <Lightbulb className="w-4 h-4 text-indigo-400" />
                 <h4 className="font-semibold text-indigo-400">AI Predictive Insights</h4>
               </div>
               <p className="text-sm text-foreground/80 leading-relaxed">
                 {suggestion.recommendation} Simulation models suggest that proactive maintenance and immediate adoption of these upgrades will prevent an estimated <span className="font-semibold text-foreground">$12,000</span> in compounding secondary failure costs.
               </p>
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Export Full Report (PDF)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avoid Early Replacement Notice */}
      <div className="bg-muted/30 rounded-lg p-3 border border-border">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">Smart Replacement:</strong> Our AI analyzes component wear patterns to recommend optimal replacement timing, avoiding both premature replacement costs and unexpected failures.
          </span>
        </p>
      </div>
    </div>
  )
}
