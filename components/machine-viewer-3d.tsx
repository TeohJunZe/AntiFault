'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Environment, Float, useGLTF, useAnimations } from '@react-three/drei'
import { Machine, MachineComponent } from '@/lib/data'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Box, Layers, RotateCcw } from 'lucide-react'

import mockRul10 from '../backend/mock_data/mock_payload_rul_10.json'
import mockRul40 from '../backend/mock_data/mock_payload_rul_40.json'
import mockRul100 from '../backend/mock_data/mock_payload_rul_100.json'

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
  const [predictions, setPredictions] = useState<Record<string, {rul: number, status: Machine['status']}>>({})

  const hasFetchedOnce = useRef(false)

  useEffect(() => {
    async function fetchPredictions() {
      const machinesToProcess = isFleetView ? machines : (machine ? [machine] : [])
      
      try {
        const cached = localStorage.getItem('enginePredictions')
        if (cached) {
          const parsed = JSON.parse(cached)
          // Simple check to see if we have predictions cached for our view target
          const allCached = machinesToProcess.every(m => parsed[m.id] !== undefined)
          if (allCached) {
            setPredictions(prev => {
              if (JSON.stringify(prev) === cached) return prev;
              return parsed;
            });
            
            // Only bailout of the network request if we have already fetched dynamically this session
            if (hasFetchedOnce.current) {
              return;
            }
          }
        }
      } catch (e) {
        console.warn("Failed to parse cached predictions", e)
      }

      hasFetchedOnce.current = true;

      const newPredictions: Record<string, {rul: number, status: Machine['status']}> = {}

      for (const m of machinesToProcess) {
        try {
          // Distribute distinct mocked degradation histories per machine to output varying realistic parameters
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
            
            newPredictions[m.id] = {
              rul: data.predicted_rul,
              status: newStatus
            };
          }
        } catch (error) {
          console.error("Failed to fetch prediction for", m.id, error)
        }
      }

      if (Object.keys(newPredictions).length > 0) {
        // Safe access to localStorage outside of React's synchronous render loops
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
          
          <FleetModel machines={machines} onMachineSelect={onMachineSelect} predictions={predictions} />
          
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
}

function FleetModel({ machines, onMachineSelect, predictions = {} }: FleetModelProps) {
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
        
        const currentStatus = predictions[machine.id]?.status || machine.status
        const currentRul = predictions[machine.id]?.rul ?? machine.rul
        const isProblem = currentStatus === 'critical'

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
                  color={getStatusColor(currentStatus)}
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
                color={getStatusColor(currentStatus)}
                emissive={getStatusColor(currentStatus)}
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
                    currentRul > 80 ? 'text-success' :
                    currentRul > 30 ? 'text-warning' :
                    'text-destructive'
                  }>{currentRul} Days</span>
                </div>
              </div>
            </Html>
          </group>
        )
      })}
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
  
  // Dynamic model mapping
  const modelUrl = useMemo(() => {
    if (machine.id === 'machine-1') return '/models/machine1.glb'
    if (machine.id === 'machine-2') return '/models/machine2.glb'
    if (machine.id === 'machine-3') return '/models/machine3.glb'
    return '/models/machine1.glb' // Fallback
  }, [machine.id])

  const { scene, animations } = useGLTF(modelUrl)
  const { actions, names } = useAnimations(animations, groupRef)

  // Auto rotation when assembled
  useFrame((state, delta) => {
    if (groupRef.current && !isExploded) {
      groupRef.current.rotation.y += delta * 0.2
    }
  })

  // Animation handling
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

  // Center and scale the model so it fits
  useEffect(() => {
    if (scene) {
      // Create a bounding box to find the center
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2.5 / maxDim // Normalize scale to fit viewer
      
      scene.position.x = -center.x
      scene.position.y = -center.y
      scene.position.z = -center.z
      
      scene.scale.set(scale, scale, scale)
    }
  }, [scene])

  // Click handling
  const handleClick = (e: any) => {
    e.stopPropagation()
    
    // Auto-explode on click if not exploded
    if (!isExploded) {
      setIsExploded(true)
    }

    const clickedMeshName = e.object.name || ''
    
    // Try to find matching component
    const matched = machine.components.find(c => 
      clickedMeshName.toLowerCase().includes(c.name.toLowerCase()) || 
      c.name.toLowerCase().includes(clickedMeshName.toLowerCase())
    )

    if (matched) {
      onComponentSelect(matched)
    } else {
      // Display dummy component for unknown parts
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

  // Highlight selected component
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
            // Completely replace material for guaranteed color change
            child.material = new THREE.MeshStandardMaterial({
              color: '#3b82f6', // bright blue
              emissive: '#1d4ed8', // deeper blue glow
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
