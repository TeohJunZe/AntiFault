'use client'

import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Environment, Float, useGLTF, useAnimations } from '@react-three/drei'
import { Machine, MachineComponent, generateSensorHistoryForHealth } from '@/lib/data'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Box, Layers, RotateCcw, PencilLine, PencilOff, Plus, X, GripVertical, Save } from 'lucide-react'

import mockRul10 from '../backend/mock_data/mock_payload_rul_10.json'
import mockRul40 from '../backend/mock_data/mock_payload_rul_40.json'
import mockRul100 from '../backend/mock_data/mock_payload_rul_100.json'

const MACHINE_TYPES = [
  'Industrial Pump',
  'Air Compressor',
  'Hydraulic System',
  'CNC Machine',
  'Material Handling',
  'Conveyor Belt',
  'Robotic Arm',
  'Welding Station',
]

interface MachineViewer3DProps {
  machine: Machine | null
  onComponentSelect: (component: MachineComponent | null) => void
  selectedComponent: MachineComponent | null
  isFleetView?: boolean
  machines?: Machine[]
  onMachineSelect?: (id: string) => void
  // Edit mode
  isEditMode?: boolean
  onEditModeChange?: (v: boolean) => void
  onAddMachine?: (m: Machine) => void
  onUpdateMachinePosition?: (id: string, location: { x: number; y: number }) => void
  onRemoveMachine?: (id: string) => void
}

export function MachineViewer3D({ 
  machine, 
  onComponentSelect, 
  selectedComponent,
  isFleetView = false,
  machines = [],
  onMachineSelect,
  isEditMode = false,
  onEditModeChange,
  onAddMachine,
  onUpdateMachinePosition,
  onRemoveMachine,
}: MachineViewer3DProps) {
  const [isExploded, setIsExploded] = useState(false)
  const [predictions, setPredictions] = useState<Record<string, {rul: number, status: Machine['status']}>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState(MACHINE_TYPES[0])
  const [newPosX, setNewPosX] = useState('50')
  const [newPosY, setNewPosY] = useState('50')

  const hasFetchedOnce = useRef(false)
  const orbitRef = useRef<any>(null)

  useEffect(() => {
    async function fetchPredictions() {
      const machinesToProcess = isFleetView ? machines : (machine ? [machine] : [])
      
      try {
        const cached = localStorage.getItem('enginePredictions')
        if (cached) {
          const parsed = JSON.parse(cached)
          const allCached = machinesToProcess.every(m => parsed[m.id] !== undefined)
          if (allCached) {
            setPredictions(prev => {
              if (JSON.stringify(prev) === cached) return prev;
              return parsed;
            });
            if (hasFetchedOnce.current) return;
          }
        }
      } catch (e) {
        console.warn("Failed to parse cached predictions", e)
      }

      hasFetchedOnce.current = true;
      const newPredictions: Record<string, {rul: number, status: Machine['status']}> = {}

      for (const m of machinesToProcess) {
        try {
          let payload;
          if (m.id === 'machine-1' || m.id === 'machine-4') payload = mockRul40;
          else if (m.id === 'machine-2' || m.id === 'machine-5') payload = mockRul100;
          else payload = mockRul10;
          payload = { ...payload, engine_id: m.id };

          const response = await fetch("http://localhost:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            let newStatus: Machine['status'] = 'optimal';
            if (data.predicted_rul < 30) newStatus = 'critical';
            else if (data.predicted_rul <= 80) newStatus = 'impaired';
            newPredictions[m.id] = { rul: data.predicted_rul, status: newStatus };
          }
        } catch (error) {
          console.error("Failed to fetch prediction for", m.id, error)
        }
      }

      if (Object.keys(newPredictions).length > 0) {
        const stored = localStorage.getItem('enginePredictions')
        const currentData = stored ? JSON.parse(stored) : {}
        const mergedObj = { ...currentData, ...newPredictions }
        localStorage.setItem('enginePredictions', JSON.stringify(mergedObj))
        window.dispatchEvent(new Event('predictionsUpdated'))
        setPredictions(prev => ({ ...prev, ...newPredictions }))
      }
    }
    fetchPredictions()
  }, [isFleetView, machines, machine])

  const handleAddMachine = () => {
    if (!newName.trim() || !onAddMachine) return
    const x = Math.min(95, Math.max(5, parseFloat(newPosX) || 50))
    const y = Math.min(95, Math.max(5, parseFloat(newPosY) || 50))
    const id = `machine-custom-${Date.now()}`
    const newMachine: Machine = {
      id,
      name: newName.trim(),
      type: newType,
      status: 'optimal',
      location: { x, y },
      healthIndex: 100,
      rul: 90,
      lastMaintenance: new Date().toISOString().split('T')[0],
      nextScheduledMaintenance: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
      changePointDate: null,
      financialImpactPerDay: 5000,
      components: [],
      sensorHistory: generateSensorHistoryForHealth(100),
    }
    onAddMachine(newMachine)
    setNewName('')
    setNewPosX('50')
    setNewPosY('50')
    setShowAddForm(false)
  }

  // Fleet View Mode
  if (isFleetView && machines.length > 0) {
    return (
      <div className="relative w-full h-full min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
        {/* Top overlay bar */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 items-start max-w-[calc(100%-80px)]">
          {!isEditMode ? (
            <div className="bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border text-sm">
              Click on a machine to view details
            </div>
          ) : (
            <div className="bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-primary/40 text-sm text-primary font-medium flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Edit Mode — Drag machines to move • Click ✕ to remove
            </div>
          )}

          {/* Add Machine form */}
          {isEditMode && (
            <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 flex flex-col gap-2 w-64 shadow-lg">
              {!showAddForm ? (
                <Button size="sm" className="w-full gap-2" onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4" /> Add Machine
                </Button>
              ) : (
                <>
                  <div className="text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                    <span>New Machine</span>
                    <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Machine name"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMachine()}
                    autoFocus
                  />
                  <select
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                  >
                    {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">X Position (%)</label>
                      <input
                        type="number" min="5" max="95"
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={newPosX}
                        onChange={e => setNewPosX(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">Y Position (%)</label>
                      <input
                        type="number" min="5" max="95"
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={newPosY}
                        onChange={e => setNewPosY(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button size="sm" className="w-full gap-2" onClick={handleAddMachine} disabled={!newName.trim()}>
                    <Save className="w-3.5 h-3.5" /> Add to Floor
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Edit Mode toggle button */}
        <div className="absolute top-3 right-3 z-10">
          <Button
            variant={isEditMode ? 'default' : 'secondary'}
            size="sm"
            className="gap-2 shadow-md"
            onClick={() => {
              onEditModeChange?.(!isEditMode)
              setShowAddForm(false)
            }}
          >
            {isEditMode
              ? <><PencilOff className="w-4 h-4" /> Done</>
              : <><PencilLine className="w-4 h-4" /> Edit Layout</>
            }
          </Button>
        </div>

        <Canvas camera={{ position: [8, 6, 8], fov: 50 }}>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          
          <FleetModel
            machines={machines}
            onMachineSelect={onMachineSelect}
            predictions={predictions}
            isEditMode={isEditMode}
            onUpdateMachinePosition={onUpdateMachinePosition}
            onRemoveMachine={onRemoveMachine}
            orbitRef={orbitRef}
          />
          
          <OrbitControls
            ref={orbitRef}
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

        {/* Machine count indicator in edit mode */}
        {isEditMode && (
          <div className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-sm px-2 py-1 rounded border border-border text-xs text-muted-foreground">
            {machines.length} machine{machines.length !== 1 ? 's' : ''} on floor
          </div>
        )}
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
          ${((predictions || {})[machine.id]?.status || machine.status) === 'optimal' ? 'bg-success/20 text-success' :
            ((predictions || {})[machine.id]?.status || machine.status) === 'impaired' ? 'bg-warning/20 text-warning' :
            'bg-destructive/20 text-destructive animate-pulse'}
        `}>
          {((predictions || {})[machine.id]?.status || machine.status).toUpperCase()} - RUL: {(predictions || {})[machine.id]?.rul ?? machine.rul} Days
        </div>
      </div>

      <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        
        <MachineGLTFModel
          machine={machine}
          isExploded={isExploded}
          setIsExploded={setIsExploded}
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
  predictions?: Record<string, {rul: number, status: Machine['status']}>
  isEditMode?: boolean
  onUpdateMachinePosition?: (id: string, location: { x: number; y: number }) => void
  onRemoveMachine?: (id: string) => void
  orbitRef?: React.RefObject<any>
}

// Convert floor 3D position to percentage location
function posToLocation(x: number, z: number, gridExtent: number): { x: number; y: number } {
  const px = ((x + gridExtent / 2) / gridExtent) * 100
  const py = ((z + gridExtent / 2) / gridExtent) * 100
  return {
    x: Math.min(95, Math.max(5, px)),
    y: Math.min(95, Math.max(5, py)),
  }
}

// Convert percentage location to 3D position
function locationToPos(location: { x: number; y: number }, gridExtent: number): [number, number] {
  const x = (location.x / 100) * gridExtent - gridExtent / 2
  const z = (location.y / 100) * gridExtent - gridExtent / 2
  return [x, z]
}

const GRID_EXTENT = 16

function FleetModel({ machines, onMachineSelect, predictions = {}, isEditMode = false, onUpdateMachinePosition, onRemoveMachine, orbitRef }: FleetModelProps) {
  // Shared drag state — only one machine can be dragged at a time
  const draggingId = useRef<string | null>(null)
  // Per-machine refs so the floor plane can move them without re-renders
  const machineRefs = useRef<Record<string, THREE.Group | null>>({})
  // Offset from click point to machine center (so it doesn't snap to center)
  const pickOffset = useRef(new THREE.Vector3())
  const { gl } = useThree()

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'optimal': return '#22c55e'
      case 'impaired': return '#eab308'
      case 'critical': return '#ef4444'
      default: return '#64748b'
    }
  }

  // Floor plane pointer events — the source of truth while dragging
  const handleFloorMove = useCallback((e: any) => {
    if (!draggingId.current) return
    e.stopPropagation()
    const group = machineRefs.current[draggingId.current]
    if (!group) return
    const { x, z } = e.point
    const newX = Math.max(-GRID_EXTENT / 2 + 0.5, Math.min(GRID_EXTENT / 2 - 0.5, x + pickOffset.current.x))
    const newZ = Math.max(-GRID_EXTENT / 2 + 0.5, Math.min(GRID_EXTENT / 2 - 0.5, z + pickOffset.current.z))
    group.position.set(newX, 0, newZ)
  }, [])

  const handleFloorUp = useCallback((e: any) => {
    if (!draggingId.current) return
    const id = draggingId.current
    const group = machineRefs.current[id]
    draggingId.current = null
    gl.domElement.style.cursor = 'grab'
    // Re-enable orbit now that drag is done
    if (orbitRef?.current) orbitRef.current.enabled = true
    if (group && onUpdateMachinePosition) {
      const newLocation = posToLocation(group.position.x, group.position.z, GRID_EXTENT)
      onUpdateMachinePosition(id, newLocation)
    }
  }, [gl, onUpdateMachinePosition, orbitRef])

  return (
    <group>
      {/* Invisible floor plane — catches pointer events while dragging */}
      {isEditMode && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.49, 0]}
          onPointerMove={handleFloorMove}
          onPointerUp={handleFloorUp}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {machines.map((machine) => {
        const [x, z] = locationToPos(machine.location, GRID_EXTENT)
        const currentStatus = predictions[machine.id]?.status || machine.status
        const currentRul = predictions[machine.id]?.rul ?? machine.rul
        const isProblem = currentStatus === 'critical'

        return (
          <DraggableMachine
            key={machine.id}
            machine={machine}
            x={x}
            z={z}
            currentStatus={currentStatus}
            currentRul={currentRul}
            isProblem={isProblem}
            getStatusColor={getStatusColor}
            isEditMode={isEditMode}
            onMachineSelect={onMachineSelect}
            onRemoveMachine={onRemoveMachine}
            // Drag coordination
            draggingId={draggingId}
            pickOffset={pickOffset}
            machineRefs={machineRefs}
            glDomElement={gl.domElement}
            orbitRef={orbitRef}
          />
        )
      })}
    </group>
  )
}

interface DraggableMachineProps {
  machine: Machine
  x: number
  z: number
  currentStatus: Machine['status']
  currentRul: number
  isProblem: boolean
  getStatusColor: (s: Machine['status']) => string
  isEditMode: boolean
  onMachineSelect?: (id: string) => void
  onRemoveMachine?: (id: string) => void
  // Shared drag state from FleetModel
  draggingId: React.MutableRefObject<string | null>
  pickOffset: React.MutableRefObject<THREE.Vector3>
  machineRefs: React.MutableRefObject<Record<string, THREE.Group | null>>
  glDomElement: HTMLElement
  orbitRef?: React.RefObject<any>
}

function DraggableMachine({
  machine, x, z, currentStatus, currentRul, isProblem, getStatusColor,
  isEditMode, onMachineSelect, onRemoveMachine,
  draggingId, pickOffset, machineRefs, glDomElement, orbitRef,
}: DraggableMachineProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Register this group in shared machineRefs
  useEffect(() => {
    machineRefs.current[machine.id] = groupRef.current
    return () => { delete machineRefs.current[machine.id] }
  }, [machine.id, machineRefs])

  // Sync position from props when not being dragged
  useEffect(() => {
    if (draggingId.current !== machine.id && groupRef.current) {
      groupRef.current.position.set(x, 0, z)
    }
  }, [x, z, machine.id, draggingId])

  const handlePointerDown = useCallback((e: any) => {
    if (!isEditMode) return
    e.stopPropagation()
    draggingId.current = machine.id
    setIsDragging(true)
    glDomElement.style.cursor = 'grabbing'
    // Disable orbit so the map doesn't rotate/pan during drag
    if (orbitRef?.current) orbitRef.current.enabled = false
    // Store the offset between the click point on the floor and the machine center
    if (groupRef.current && e.point) {
      pickOffset.current.set(
        groupRef.current.position.x - e.point.x,
        0,
        groupRef.current.position.z - e.point.z,
      )
    } else {
      pickOffset.current.set(0, 0, 0)
    }
  }, [isEditMode, machine.id, draggingId, pickOffset, glDomElement])

  // Clear local isDragging when global drag ends
  useFrame(() => {
    if (isDragging && draggingId.current !== machine.id) {
      setIsDragging(false)
    }
  })

  const statusColor = getStatusColor(currentStatus)

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (isEditMode) {
          glDomElement.style.cursor = draggingId.current === machine.id ? 'grabbing' : 'grab'
        } else {
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        if (draggingId.current !== machine.id) {
          document.body.style.cursor = 'default'
          glDomElement.style.cursor = 'default'
        }
      }}
    >
      {/* Drag highlight ring in edit mode */}
      {isEditMode && (
        <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.1, 32]} />
          <meshBasicMaterial
            color={isDragging ? '#60a5fa' : '#3b82f6'}
            transparent
            opacity={isDragging ? 0.9 : 0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

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
            if (isEditMode || draggingId.current === machine.id) { e.stopPropagation(); return }
            e.stopPropagation()
            onMachineSelect?.(machine.id)
          }}
        >
          <boxGeometry args={[1, 0.8, 0.7]} />
          <meshStandardMaterial
            color={isDragging ? '#60a5fa' : statusColor}
            metalness={0.5}
            roughness={0.4}
            emissive={isProblem && !isDragging ? '#ef4444' : (isDragging ? '#1d4ed8' : '#000000')}
            emissiveIntensity={isProblem ? 0.4 : (isDragging ? 0.3 : 0)}
          />
        </mesh>
      </Float>

      {/* Status indicator light */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={isProblem ? 1 : 0.5}
        />
      </mesh>

      {/* Label + Remove button */}
      <Html
        position={[0, 1.4, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: isEditMode ? 'auto' : 'none', userSelect: 'none' }}
      >
        <div className="relative bg-card/95 backdrop-blur-sm px-2 py-1 rounded text-xs whitespace-nowrap border border-border flex items-center gap-2">
          <div>
            <div className="font-medium">{machine.name}</div>
            <div className="text-muted-foreground">
              RUL: <span className={
                currentRul > 80 ? 'text-success' :
                currentRul > 30 ? 'text-warning' :
                'text-destructive'
              }>{currentRul} Days</span>
            </div>
          </div>
          {isEditMode && (
            <button
              onPointerDown={(e) => { e.stopPropagation() }}
              onClick={(e) => {
                e.stopPropagation()
                onRemoveMachine?.(machine.id)
              }}
              className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-destructive/20 hover:bg-destructive text-destructive hover:text-white transition-colors"
              title={`Remove ${machine.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </Html>
    </group>
  )
}

interface MachineGLTFModelProps {
  machine: Machine
  isExploded: boolean
  setIsExploded: (v: boolean) => void
  onComponentSelect: (component: MachineComponent | null) => void
  selectedComponent: MachineComponent | null
}

function MachineGLTFModel({ machine, isExploded, setIsExploded, onComponentSelect, selectedComponent }: MachineGLTFModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  
  const modelUrl = useMemo(() => {
    if (machine.id === 'machine-1') return '/models/machine1.glb'
    if (machine.id === 'machine-2') return '/models/machine2.glb'
    if (machine.id === 'machine-3') return '/models/machine3.glb'
    return '/models/machine1.glb'
  }, [machine.id])

  const { scene, animations } = useGLTF(modelUrl)
  const { actions, names } = useAnimations(animations, groupRef)

  useFrame((state, delta) => {
    if (groupRef.current && !isExploded) {
      groupRef.current.rotation.y += delta * 0.2
    }
  })

  useEffect(() => {
    if (names.length > 0) {
      const action = actions[names[0]]
      if (action) {
        if (isExploded) {
          action.paused = false
          action.timeScale = 1
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
          action.play()
        } else {
          if (action.time > 0) {
            action.paused = false
            action.timeScale = -1
            action.setLoop(THREE.LoopOnce, 1)
            action.clampWhenFinished = true
            action.play()
          } else {
            action.stop()
          }
        }
      }
    }
  }, [isExploded, actions, names])

  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2.5 / maxDim
      scene.position.x = -center.x
      scene.position.y = -center.y
      scene.position.z = -center.z
      scene.scale.set(scale, scale, scale)
    }
  }, [scene])

  const handleClick = (e: any) => {
    e.stopPropagation()
    if (!isExploded) setIsExploded(true)
    const clickedMeshName = e.object.name || ''
    const matched = machine.components.find(c => 
      clickedMeshName.toLowerCase().includes(c.name.toLowerCase()) || 
      c.name.toLowerCase().includes(clickedMeshName.toLowerCase())
    )
    if (matched) {
      onComponentSelect(matched)
    } else {
      onComponentSelect({
        id: e.object.uuid,
        name: clickedMeshName || 'Machine Part',
        status: 'healthy',
        health: 100,
        lastMaintenance: new Date().toISOString(),
        predictedFailure: null,
        position: [0, 0, 0],
        repairTime: 1,
        replacementCost: 100,
        contributionToRUL: 0
      })
    }
  }

  useEffect(() => {
    if (scene) {
      scene.traverse((child: any) => {
        if (child.isMesh) {
          const isSelected = selectedComponent && (
            child.name.toLowerCase().includes(selectedComponent.name.toLowerCase()) ||
            selectedComponent.name.toLowerCase().includes(child.name.toLowerCase()) ||
            child.uuid === selectedComponent.id
          )
          if (isSelected) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material
            }
            child.material = new THREE.MeshStandardMaterial({
              color: '#3b82f6',
              emissive: '#1d4ed8',
              emissiveIntensity: 0.8,
              metalness: 0.2,
              roughness: 0.1,
              transparent: true,
              opacity: 0.9
            })
          } else if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial
          }
        }
      })
    }
  }, [selectedComponent, scene])

  return (
    <group ref={groupRef} position={[0, 0.8, 0]}>
      <primitive 
        object={scene} 
        onClick={handleClick}
        onPointerOver={(e: any) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      />
    </group>
  )
}

useGLTF.preload('/models/machine1.glb')
useGLTF.preload('/models/machine2.glb')
useGLTF.preload('/models/machine3.glb')
