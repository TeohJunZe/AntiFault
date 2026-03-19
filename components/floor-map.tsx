'use client'

import { useState, useEffect } from 'react'
import { Machine } from '@/lib/data'
import { cn } from '@/lib/utils'

interface FloorMapProps {
  machines: Machine[]
  selectedMachineId: string | null
  onSelectMachine: (id: string) => void
}

export function FloorMap({ machines, selectedMachineId, onSelectMachine }: FloorMapProps) {
  const [predictions, setPredictions] = useState<Record<string, {rul: number, status: Machine['status']}>>({})

  useEffect(() => {
    const handleStorage = () => {
      try {
        const cached = localStorage.getItem('enginePredictions')
        if (cached) {
          setPredictions(JSON.parse(cached))
        }
      } catch (e) {
        console.warn("Error parsing predictions from local storage", e)
      }
    }
    
    // Initial fetch
    handleStorage()
    
    // Listen to custom updates from other components
    window.addEventListener('predictionsUpdated', handleStorage)
    return () => window.removeEventListener('predictionsUpdated', handleStorage)
  }, [])

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'optimal':
        return 'bg-success'
      case 'impaired':
        return 'bg-warning'
      case 'critical':
        return 'bg-destructive animate-pulse-glow'
    }
  }

  const getStatusGlow = (status: Machine['status']) => {
    switch (status) {
      case 'optimal':
        return 'shadow-[0_0_20px_rgba(34,197,94,0.5)]'
      case 'impaired':
        return 'shadow-[0_0_20px_rgba(234,179,8,0.5)]'
      case 'critical':
        return 'shadow-[0_0_30px_rgba(239,68,68,0.7)]'
    }
  }

  return (
    <div className="relative w-full h-[300px] bg-muted/30 rounded-lg border border-border overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floor plan labels */}
      <div className="absolute top-2 left-2 text-xs text-muted-foreground font-mono">ZONE A - Production Floor</div>
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground font-mono">Scale: 1:100</div>

      {/* Machine markers */}
      {machines.map((machine) => {
        const currentStatus = predictions[machine.id]?.status || machine.status
        const currentRul = predictions[machine.id]?.rul ?? machine.rul

        return (
          <button
            key={machine.id}
            onClick={() => onSelectMachine(machine.id)}
            className={cn(
              'absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300',
              'w-10 h-10 rounded-lg flex items-center justify-center',
              'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary',
              getStatusColor(currentStatus),
              getStatusGlow(currentStatus),
              selectedMachineId === machine.id && 'ring-2 ring-primary scale-110'
            )}
            style={{
              left: `${machine.location.x}%`,
              top: `${machine.location.y}%`,
            }}
            title={`${machine.name} - ${currentStatus.toUpperCase()} - RUL: ${currentRul} Days`}
          >
            <MachineIcon type={machine.type} />
          </button>
        )
      })}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success" />
          <span className="text-muted-foreground">Optimal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning" />
          <span className="text-muted-foreground">Impaired</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span className="text-muted-foreground">Critical</span>
        </div>
      </div>
    </div>
  )
}

function MachineIcon({ type }: { type: string }) {
  // Simple icons based on machine type
  if (type.includes('Pump')) {
    return (
      <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      </svg>
    )
  }
  if (type.includes('Compressor')) {
    return (
      <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    )
  }
  if (type.includes('Hydraulic')) {
    return (
      <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M4 8h16M4 16h16" />
        <rect x="6" y="8" width="12" height="8" />
      </svg>
    )
  }
  if (type.includes('CNC')) {
    return (
      <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 9v-3M12 18v-3" />
      </svg>
    )
  }
  // Default for conveyor/other
  return (
    <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
    </svg>
  )
}
