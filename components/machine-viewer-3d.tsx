'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Environment, Float } from '@react-three/drei'
import { Machine, MachineComponent } from '@/lib/data'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Box, Layers, RotateCcw } from 'lucide-react'

interface MachineViewer3DProps {
  machine: Machine | null
  onComponentSelect: (component: MachineComponent | null) => void
  selectedComponent: MachineComponent | null
  isFleetView?: boolean
  machines?: Machine[]
  onMachineSelect?: (id: string) => void
}

export function MachineViewer3D({ 
  machine, 
  onComponentSelect, 
  selectedComponent,
  isFleetView = false,
  machines = [],
  onMachineSelect
}: MachineViewer3DProps) {
  const [isExploded, setIsExploded] = useState(false)

  // Fleet View Mode
  if (isFleetView && machines.length > 0) {
    return (
      <div className="relative w-full h-full min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border text-sm">
            Click on a machine to view details
          </div>
        </div>

        <Canvas camera={{ position: [8, 6, 8], fov: 50 }}>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          
          <FleetModel machines={machines} onMachineSelect={onMachineSelect} />
          
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={4}
            maxDistance={20}
          />
          <Environment preset="warehouse" />
          
          {/* Floor grid */}
          <gridHelper args={[20, 20, '#334155', '#1e293b']} position={[0, -0.5, 0]} />
        </Canvas>
      </div>
    )
  }

  // Single Machine View
  if (!machine) {
    return (
      <div className="relative w-full h-full min-h-[400px] bg-muted/20 rounded-lg overflow-hidden flex items-center justify-center">
        <p className="text-muted-foreground">Select a machine to view</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
      {/* Controls overlay */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <Button
          variant={isExploded ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setIsExploded(!isExploded)}
          className="gap-2"
        >
          <Layers className="w-4 h-4" />
          {isExploded ? 'Assemble' : 'Explode View'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onComponentSelect(null)}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Machine status badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className={`
          px-3 py-1.5 rounded-full text-xs font-medium
          ${machine.status === 'optimal' ? 'bg-success/20 text-success' :
            machine.status === 'impaired' ? 'bg-warning/20 text-warning' :
            'bg-destructive/20 text-destructive animate-pulse'}
        `}>
          {machine.status.toUpperCase()} - Health: {machine.healthIndex}%
        </div>
      </div>

      <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        
        <MachineModel
          machine={machine}
          isExploded={isExploded}
          onComponentSelect={onComponentSelect}
          selectedComponent={selectedComponent}
        />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
        />
        <Environment preset="warehouse" />
      </Canvas>
    </div>
  )
}

// Fleet Model - shows all machines in 3D grid
interface FleetModelProps {
  machines: Machine[]
  onMachineSelect?: (id: string) => void
}

function FleetModel({ machines, onMachineSelect }: FleetModelProps) {
  const gridSize = Math.ceil(Math.sqrt(machines.length))
  const spacing = 3

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'optimal': return '#22c55e'
      case 'impaired': return '#eab308'
      case 'critical': return '#ef4444'
      default: return '#64748b'
    }
  }

  return (
    <group>
      {machines.map((machine, index) => {
        const row = Math.floor(index / gridSize)
        const col = index % gridSize
        const x = (col - gridSize / 2) * spacing + spacing / 2
        const z = (row - gridSize / 2) * spacing + spacing / 2
        const isProblem = machine.status === 'critical'

        return (
          <group key={machine.id} position={[x, 0, z]}>
            {/* Base */}
            <mesh position={[0, -0.4, 0]} receiveShadow>
              <cylinderGeometry args={[0.8, 1, 0.2, 32]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Machine body */}
            <Float
              speed={isProblem ? 2 : 0}
              rotationIntensity={0}
              floatIntensity={isProblem ? 0.2 : 0}
            >
              <mesh
                position={[0, 0.3, 0]}
                castShadow
                onClick={(e) => {
                  e.stopPropagation()
                  onMachineSelect?.(machine.id)
                }}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  document.body.style.cursor = 'pointer'
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'default'
                }}
              >
                <boxGeometry args={[1, 0.8, 0.7]} />
                <meshStandardMaterial
                  color={getStatusColor(machine.status)}
                  metalness={0.5}
                  roughness={0.4}
                  emissive={isProblem ? '#ef4444' : '#000000'}
                  emissiveIntensity={isProblem ? 0.4 : 0}
                />
              </mesh>
            </Float>

            {/* Status indicator light */}
            <mesh position={[0, 0.85, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial
                color={getStatusColor(machine.status)}
                emissive={getStatusColor(machine.status)}
                emissiveIntensity={isProblem ? 1 : 0.5}
              />
            </mesh>

            {/* Label */}
            <Html
              position={[0, 1.2, 0]}
              center
              distanceFactor={10}
              style={{ pointerEvents: 'none' }}
            >
              <div className="bg-card/95 backdrop-blur-sm px-2 py-1 rounded text-xs whitespace-nowrap border border-border">
                <div className="font-medium">{machine.name}</div>
                <div className="text-muted-foreground">
                  RUL: <span className={
                    machine.rul > 15 ? 'text-success' :
                    machine.rul > 5 ? 'text-warning' :
                    'text-destructive'
                  }>{machine.rul}d</span>
                </div>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

interface MachineModelProps {
  machine: Machine
  isExploded: boolean
  onComponentSelect: (component: MachineComponent | null) => void
  selectedComponent: MachineComponent | null
}

function MachineModel({ machine, isExploded, onComponentSelect, selectedComponent }: MachineModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (groupRef.current && !isExploded) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
    }
  })

  const getComponentColor = (component: MachineComponent) => {
    // Highlight selected component
    if (selectedComponent?.id === component.id) {
      return '#3b82f6' // primary blue for selected
    }
    
    // Color based on health status
    switch (component.status) {
      case 'healthy':
        return '#22c55e' // green
      case 'degraded':
        return '#eab308' // yellow/amber
      case 'failing':
        return '#f97316' // orange
      case 'failed':
        return '#ef4444' // red
    }
  }

  const getExplodedOffset = (position: [number, number, number], index: number): [number, number, number] => {
    if (!isExploded) return position
    const multiplier = 1.8
    return [
      position[0] * multiplier + (index % 2 === 0 ? 0.5 : -0.5),
      position[1] * multiplier,
      position[2] * multiplier + (index % 3 === 0 ? 0.3 : -0.3)
    ]
  }

  return (
    <group ref={groupRef}>
      {/* Base platform */}
      <mesh position={[0, -0.8, 0]} receiveShadow>
        <cylinderGeometry args={[1.2, 1.4, 0.15, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Machine housing */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.5, 1.2, 1]} />
        <meshStandardMaterial 
          color="#374151" 
          metalness={0.6} 
          roughness={0.3}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Components */}
      {machine.components.map((component, index) => {
        const position = getExplodedOffset(component.position, index)
        const isSelected = selectedComponent?.id === component.id
        const isProblem = component.status === 'failing' || component.status === 'failed'
        
        return (
          <Float
            key={component.id}
            speed={isProblem ? 4 : 0}
            rotationIntensity={isProblem ? 0.2 : 0}
            floatIntensity={isProblem ? 0.3 : 0}
          >
            <group position={position}>
              <mesh
                castShadow
                onClick={(e) => {
                  e.stopPropagation()
                  onComponentSelect(component)
                }}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  document.body.style.cursor = 'pointer'
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'default'
                }}
              >
                <ComponentGeometry type={component.name} />
                <meshStandardMaterial
                  color={getComponentColor(component)}
                  metalness={0.5}
                  roughness={0.4}
                  emissive={isProblem ? getComponentColor(component) : '#000000'}
                  emissiveIntensity={isProblem ? 0.3 : 0}
                />
              </mesh>

              {/* Label on hover/select */}
              {(isSelected || isExploded) && (
                <Html
                  position={[0, 0.4, 0]}
                  center
                  distanceFactor={8}
                  style={{ pointerEvents: 'none' }}
                >
                  <div className="bg-card/95 backdrop-blur-sm px-2 py-1 rounded text-xs whitespace-nowrap border border-border">
                    <div className="font-medium">{component.name}</div>
                    <div className="text-muted-foreground">
                      Health: <span className={
                        component.health >= 80 ? 'text-success' :
                        component.health >= 60 ? 'text-warning' :
                        'text-destructive'
                      }>{component.health}%</span>
                    </div>
                  </div>
                </Html>
              )}
            </group>
          </Float>
        )
      })}
    </group>
  )
}

function ComponentGeometry({ type }: { type: string }) {
  // Different geometries for different component types
  if (type.includes('Motor') || type.includes('Drive')) {
    return <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
  }
  if (type.includes('Bearing') || type.includes('Roller')) {
    return <torusGeometry args={[0.15, 0.05, 8, 24]} />
  }
  if (type.includes('Belt') || type.includes('Chain')) {
    return <torusGeometry args={[0.2, 0.03, 6, 32]} />
  }
  if (type.includes('Cylinder') || type.includes('Chamber')) {
    return <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
  }
  if (type.includes('Valve') || type.includes('Pump')) {
    return <boxGeometry args={[0.25, 0.2, 0.25]} />
  }
  if (type.includes('Sensor') || type.includes('Control')) {
    return <boxGeometry args={[0.12, 0.08, 0.12]} />
  }
  if (type.includes('Seal')) {
    return <torusGeometry args={[0.1, 0.03, 8, 24]} />
  }
  if (type.includes('Impeller') || type.includes('Fan')) {
    return <coneGeometry args={[0.18, 0.25, 6]} />
  }
  if (type.includes('Spindle') || type.includes('Screw')) {
    return <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
  }
  if (type.includes('Guide') || type.includes('Linear')) {
    return <boxGeometry args={[0.4, 0.08, 0.08]} />
  }
  if (type.includes('Changer') || type.includes('Tool')) {
    return <boxGeometry args={[0.2, 0.15, 0.2]} />
  }
  if (type.includes('Cooling') || type.includes('Radiator')) {
    return <boxGeometry args={[0.3, 0.25, 0.1]} />
  }
  if (type.includes('Tensioner')) {
    return <sphereGeometry args={[0.1, 16, 16]} />
  }
  
  // Default box
  return <boxGeometry args={[0.2, 0.2, 0.2]} />
}
