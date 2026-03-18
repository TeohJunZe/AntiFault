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
  ArrowRight
} from 'lucide-react'

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

      {/* Action Button */}
      <Button className="w-full gap-2">
        Request Detailed Analysis
        <ArrowRight className="w-4 h-4" />
      </Button>

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
