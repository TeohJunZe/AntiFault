'use client'

import { cn } from '@/lib/utils'

interface HealthGaugeProps {
  value: number
  label: string
  size?: 'sm' | 'md' | 'lg'
}

export function HealthGauge({ value, label, size = 'md' }: HealthGaugeProps) {
  const radius = size === 'sm' ? 40 : size === 'md' ? 60 : 80
  const strokeWidth = size === 'sm' ? 6 : size === 'md' ? 8 : 10
  const circumference = 2 * Math.PI * radius
  const progress = ((100 - value) / 100) * circumference
  
  const getColor = (val: number) => {
    if (val >= 80) return { stroke: 'stroke-success', text: 'text-success' }
    if (val >= 60) return { stroke: 'stroke-warning', text: 'text-warning' }
    return { stroke: 'stroke-destructive', text: 'text-destructive' }
  }

  const { stroke, text } = getColor(value)
  const svgSize = (radius + strokeWidth) * 2

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            className={cn('transition-all duration-1000', stroke)}
          />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            'font-bold font-mono',
            size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-4xl',
            text
          )}>
            {value}%
          </span>
        </div>
      </div>
      
      <span className={cn(
        'mt-2 text-muted-foreground',
        size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
      )}>
        {label}
      </span>
    </div>
  )
}
