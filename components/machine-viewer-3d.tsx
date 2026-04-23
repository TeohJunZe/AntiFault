"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Environment,
  Float,
  useGLTF,
  useAnimations,
  Center,
  Clone,
} from "@react-three/drei";
import {
  Machine,
  MachineComponent,
  generateSensorHistoryForHealth,
} from "@/lib/data";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import {
  Box,
  Layers,
  RotateCcw,
  PencilLine,
  PencilOff,
  Plus,
  X,
  GripVertical,
  Save,
} from "lucide-react";

import mockRul10 from "../lib/mock_data/mock_payload_rul_10.json";
import mockRul40 from "../lib/mock_data/mock_payload_rul_40.json";
import mockRul100 from "../lib/mock_data/mock_payload_rul_100.json";

const MACHINE_TYPES = [
  "Industrial Pump",
  "Air Compressor",
  "Hydraulic System",
  "CNC Machine",
  "Material Handling",
  "Conveyor Belt",
  "Robotic Arm",
  "Welding Station",
];

// ── Machine3 module grouping ──────────────────────────────────────────────

interface ModuleConfig {
  id: string;
  label: string;
  meshNames: string[];
}

const EXPLODE_DISTANCE = 1.2; // scene-local units per module
const LERP_SPEED = 4;
const STAGGER_MS = 70;
const MESH_SPACING = 0.15;
const FOCUSED_LERP_SPEED = 1;
const LEVEL2_DELAY_MS = 600; // delay before sub-mesh spread animation starts

const MACHINE3_MODULE_CONFIG: ModuleConfig[] = [
  {
    id: "motor",
    label: "Motor Assembly",
    meshNames: [
      "Motor_Frame",
      "Motor_Stator",
      "Motor_Rotor",
      "Motor_Shaft",
      "Motor_EndShield_DE",
      "Motor_EndShield_NDE",
      "Motor_Fan",
      "Motor_Fan_Cover",
      "Motor_Terminal_Box",
      "Motor_Terminal_Box_Lid",
      "Motor_Bearing_DE",
      "Motor_Bearing_NDE",
      "Motor_Bearing_Cover_DE",
      "Motor_Bearing_Cover_NDE",
      "Motor_Feet",
      "Motor_Lifting_Eye",
      "Motor_Nameplate",
    ],
  },
  {
    id: "coupling",
    label: "Coupling",
    meshNames: [
      "Coupling_Hub_Pump",
      "Coupling_Hub_Motor",
      "Coupling_Element",
      "Coupling_Guard",
    ],
  },
  {
    id: "bearing",
    label: "Bearing Assembly",
    meshNames: [
      "Bearing_DE",
      "Bearing_NDE",
      "Bearing_Housing",
      "Bearing_Cover_DE",
    ],
  },
  {
    id: "casing",
    label: "Pump Casing",
    meshNames: ["Casing_Volute", "Casing_Cover_Rear", "Casing_Pipe_Clamp"],
  },
  {
    id: "rotor",
    label: "Rotor Assembly",
    meshNames: ["Rotor_Impeller", "Rotor_Shaft", "Rotor_Shaft_Key"],
  },
  {
    id: "sealing",
    label: "Sealing System",
    meshNames: ["Seal_Packing_Rings", "Seal_Gland", "Seal_Lantern_Ring"],
  },
  {
    id: "wear",
    label: "Wear Parts",
    meshNames: [
      "Wear_Ring_001",
      "Wear_Ring_002",
      "Wear_Ring_003",
      "Wear_Ring_004",
      "Wear_Ring_005",
      "Wear_Ring_006",
    ],
  },
];

interface SubMesh {
  obj: THREE.Object3D;
  originalLocalPos: THREE.Vector3;
  targetLocalPos: THREE.Vector3;
}

interface ModuleState {
  group: THREE.Group;
  radialDir: THREE.Vector3;
  currentOffset: number;
  targetOffset: number;
  delayRemaining: number;
  labelPos: THREE.Vector3;
  label: string;
  centroid: THREE.Vector3;
  subMeshes: SubMesh[];
}

interface MachineViewer3DProps {
  machine: Machine | null;
  onComponentSelect: (component: MachineComponent | null) => void;
  selectedComponent: MachineComponent | null;
  onModuleFocus?: (info: { label: string; meshNames: string[] } | null) => void;
  onMeshSelect?: (meshName: string | null) => void;
  selectedMeshName?: string | null;
  isFleetView?: boolean;
  machines?: Machine[];
  onMachineSelect?: (id: string) => void;
  // Edit mode
  isEditMode?: boolean;
  onEditModeChange?: (v: boolean) => void;
  onAddMachine?: (m: Machine) => void;
  onUpdateMachinePosition?: (
    id: string,
    location: { x: number; y: number },
  ) => void;
  onRemoveMachine?: (id: string) => void;
  refreshToken?: number;
}

export function MachineViewer3D({
  machine,
  onComponentSelect,
  selectedComponent,
  onModuleFocus,
  onMeshSelect,
  selectedMeshName,
  isFleetView = false,
  machines = [],
  onMachineSelect,
  isEditMode = false,
  onEditModeChange,
  onAddMachine,
  onUpdateMachinePosition,
  onRemoveMachine,
  refreshToken = 0,
}: MachineViewer3DProps) {
  const [isExploded, setIsExploded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [backTrigger, setBackTrigger] = useState(0);

  // Reset view state when switching machines
  useEffect(() => {
    setIsExploded(false);
    setIsFocused(false);
  }, [machine?.id]);
  const [predictions, setPredictions] = useState<
    Record<string, { rul: number; status: Machine["status"] }>
  >({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(MACHINE_TYPES[0]);
  const [newPosX, setNewPosX] = useState("50");
  const [newPosY, setNewPosY] = useState("50");

  const hasFetchedOnce = useRef(false);
  const orbitRef = useRef<any>(null);

  useEffect(() => {
    async function fetchPredictions() {
      const machinesToProcess = isFleetView
        ? machines
        : machine
          ? [machine]
          : [];

      try {
        const cached = localStorage.getItem("enginePredictions");
        if (cached && refreshToken === 0) {
          const parsed = JSON.parse(cached);
          const allCached = machinesToProcess.every(
            (m) => parsed[m.id] !== undefined,
          );
          if (allCached) {
            setPredictions((prev) => {
              if (JSON.stringify(prev) === cached) return prev;
              return parsed;
            });
            if (hasFetchedOnce.current) return;
          }
        }
      } catch (e) {
        console.warn("Failed to parse cached predictions", e);
      }

      hasFetchedOnce.current = true;
      const newPredictions: Record<
        string,
        { rul: number; status: Machine["status"] }
      > = {};
      const newChangepoints: Record<
        string,
        {
          isImpaired: boolean;
          impairedCycle: number | null;
          reason: string;
          totalFlights: number;
        }
      > = {};

      for (const m of machinesToProcess) {
        let payload;
          if (m.id === "machine-1" || m.id === "machine-4") payload = mockRul40;
          else if (m.id === "machine-2" || m.id === "machine-5")
            payload = mockRul100;
          else payload = mockRul10;
          payload = { ...payload, engine_id: m.id };

          // Call /predict with a local fallback
          try {
            const response = await fetch("http://localhost:8000/predict", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              const data = await response.json();
              let newStatus: Machine["status"] = "optimal";
              if (data.predicted_rul < 30) newStatus = "critical";
              else if (data.predicted_rul <= 80) newStatus = "impaired";
              newPredictions[m.id] = {
                rul: data.predicted_rul,
                status: newStatus,
              };

              // Store explainability data for the XAI panel
              if (data.top_sensors || data.attn_peak_cycle !== undefined) {
                try {
                  const stored = localStorage.getItem("engineExplainability");
                  const existing = stored ? JSON.parse(stored) : {};
                  existing[m.id] = {
                    top_sensors: data.top_sensors || [],
                    attn_peak_cycle: data.attn_peak_cycle ?? 0,
                    status: data.status || "",
                    predicted_rul: data.predicted_rul,
                    risk_level: data.risk_level || "",
                    recommendation: data.recommendation || "",
                    confidence_note: data.confidence_note || "",
                    report_text: data.report_text || "",
                    uncertainty_sigma: data.uncertainty_sigma ?? 0,
                    anomaly_z: data.anomaly_z ?? 0,
                    suspected_components: data.suspected_components || [],
                  };
                  localStorage.setItem(
                    "engineExplainability",
                    JSON.stringify(existing),
                  );
                } catch (e) {
                  console.warn("Failed to store explainability data", e);
                }
              }
            } else {
              throw new Error("Backend responded with error");
            }

            // Call /detect_changepoint with the SAME payload
            const cpResponse = await fetch(
              "http://localhost:8000/detect_changepoint",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );

            if (cpResponse.ok) {
              const cpData = await cpResponse.json();
              newChangepoints[m.id] = {
                isImpaired: cpData.is_impaired,
                impairedCycle: cpData.impaired_flight_cycle,
                reason: cpData.transition_reason,
                totalFlights: cpData.total_flights_analyzed,
              };
            }
          } catch (error) {
            console.warn("Backend unavailable, using local fallback for", m.id);
            // Local fallback logic
            let fallbackRul = 90;
            let fallbackStatus: Machine["status"] = "optimal";
            
            if (m.id === "machine-1" || m.id === "machine-4") {
              fallbackRul = 40;
              fallbackStatus = "impaired";
            } else if (m.id === "machine-2" || m.id === "machine-5") {
              fallbackRul = 100;
              fallbackStatus = "optimal";
            } else {
              fallbackRul = 10;
              fallbackStatus = "critical";
            }
            
            newPredictions[m.id] = {
              rul: fallbackRul,
              status: fallbackStatus,
            };
          }
      } // Close the for loop

      if (Object.keys(newPredictions).length > 0) {
          const stored = localStorage.getItem("enginePredictions");
          const currentData = stored ? JSON.parse(stored) : {};
          const mergedObj = { ...currentData, ...newPredictions };
          localStorage.setItem("enginePredictions", JSON.stringify(mergedObj));
        }

        if (Object.keys(newChangepoints).length > 0) {
          const stored = localStorage.getItem("engineChangepoints");
          const currentData = stored ? JSON.parse(stored) : {};
          const mergedObj = { ...currentData, ...newChangepoints };
          localStorage.setItem("engineChangepoints", JSON.stringify(mergedObj));
        }

        window.dispatchEvent(new Event("predictionsUpdated"));
        if (Object.keys(newPredictions).length > 0) {
          setPredictions((prev) => ({ ...prev, ...newPredictions }));
        }
    } // Close fetchPredictions function

    fetchPredictions();
  }, [isFleetView, machines, machine, refreshToken]);

  const handleAddMachine = () => {
    if (!newName.trim() || !onAddMachine) return;
    const x = Math.min(95, Math.max(5, parseFloat(newPosX) || 50));
    const y = Math.min(95, Math.max(5, parseFloat(newPosY) || 50));
    const id = `machine-custom-${Date.now()}`;
    const newMachine: Machine = {
      id,
      name: newName.trim(),
      type: newType,
      status: "optimal",
      location: { x, y },
      healthIndex: 100,
      rul: 90,
      lastMaintenance: new Date().toISOString().split("T")[0],
      nextScheduledMaintenance: new Date(Date.now() + 60 * 86400000)
        .toISOString()
        .split("T")[0],
      changePointDate: null,
      financialImpactPerDay: 5000,
      components: [],
      sensorHistory: generateSensorHistoryForHealth(100),
    };
    onAddMachine(newMachine);
    setNewName("");
    setNewPosX("50");
    setNewPosY("50");
    setShowAddForm(false);
  };

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
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="w-4 h-4" /> Add Machine
                </Button>
              ) : (
                <>
                  <div className="text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                    <span>New Machine</span>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Machine name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMachine()}
                    autoFocus
                  />
                  <select
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    {MACHINE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">
                        X Position (%)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="95"
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={newPosX}
                        onChange={(e) => setNewPosX(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">
                        Y Position (%)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="95"
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={newPosY}
                        onChange={(e) => setNewPosY(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleAddMachine}
                    disabled={!newName.trim()}
                  >
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
            variant={isEditMode ? "default" : "secondary"}
            size="sm"
            className="gap-2 shadow-md"
            onClick={() => {
              onEditModeChange?.(!isEditMode);
              setShowAddForm(false);
            }}
          >
            {isEditMode ? (
              <>
                <PencilOff className="w-4 h-4" /> Done
              </>
            ) : (
              <>
                <PencilLine className="w-4 h-4" /> Edit Layout
              </>
            )}
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
          <gridHelper
            args={[20, 20, "#334155", "#1e293b"]}
            position={[0, -0.5, 0]}
          />
        </Canvas>

        {/* Machine count indicator in edit mode */}
        {isEditMode && (
          <div className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-sm px-2 py-1 rounded border border-border text-xs text-muted-foreground">
            {machines.length} machine{machines.length !== 1 ? "s" : ""} on floor
          </div>
        )}
      </div>
    );
  }

  // Single Machine View
  if (!machine) {
    return (
      <div className="relative w-full h-full min-h-[400px] bg-muted/20 rounded-lg overflow-hidden flex items-center justify-center">
        <p className="text-muted-foreground">Select a machine to view</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
      {/* Controls overlay */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        {isFocused ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBackTrigger((t) => t + 1)}
            className="gap-2"
          >
            ← Back
          </Button>
        ) : (
          <>
            <Button
              variant={isExploded ? "default" : "secondary"}
              size="sm"
              onClick={() => setIsExploded(!isExploded)}
              className="gap-2"
            >
              <Layers className="w-4 h-4" />
              {isExploded ? "Assemble" : "Explode View"}
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
          </>
        )}
      </div>

      {/* Machine status badge */}
      <div className="absolute top-3 right-3 z-10">
        <div
          className={`
          px-3 py-1.5 rounded-full text-xs font-medium
          ${((predictions || {})[machine.id]?.status || machine.status) ===
              "optimal"
              ? "bg-success/20 text-success"
              : ((predictions || {})[machine.id]?.status || machine.status) ===
                "impaired"
                ? "bg-warning/20 text-warning"
                : "bg-destructive/20 text-destructive animate-pulse"
            }
        `}
        >
          {(
            (predictions || {})[machine.id]?.status || machine.status
          ).toUpperCase()}{" "}
          - RUL: {(predictions || {})[machine.id]?.rul ?? machine.rul} Days
        </div>
      </div>

      <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        {machine.id === "machine-3" ? (
          <ModularMachineGLTFModel
            machine={machine}
            isExploded={isExploded}
            setIsExploded={setIsExploded}
            onComponentSelect={onComponentSelect}
            selectedComponent={selectedComponent}
            onModuleFocus={(info) => {
              setIsFocused(info !== null);
              onModuleFocus?.(info);
              if (info === null) onMeshSelect?.(null);
            }}
            onMeshSelect={onMeshSelect}
            selectedMeshName={selectedMeshName}
            triggerBack={backTrigger}
          />
        ) : (
          <MachineGLTFModel
            machine={machine}
            isExploded={isExploded}
            setIsExploded={setIsExploded}
            onComponentSelect={onComponentSelect}
            selectedComponent={selectedComponent}
          />
        )}

        <OrbitControls
          makeDefault
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
        />
        <Environment preset="warehouse" />
      </Canvas>
    </div>
  );
}

// Fleet Model - shows all machines in 3D grid
interface FleetModelProps {
  machines: Machine[];
  onMachineSelect?: (id: string) => void;
  predictions?: Record<string, { rul: number; status: Machine["status"] }>;
  isEditMode?: boolean;
  onUpdateMachinePosition?: (
    id: string,
    location: { x: number; y: number },
  ) => void;
  onRemoveMachine?: (id: string) => void;
  orbitRef?: React.RefObject<any>;
}

// Convert floor 3D position to percentage location
function posToLocation(
  x: number,
  z: number,
  gridExtent: number,
): { x: number; y: number } {
  const px = ((x + gridExtent / 2) / gridExtent) * 100;
  const py = ((z + gridExtent / 2) / gridExtent) * 100;
  return {
    x: Math.min(95, Math.max(5, px)),
    y: Math.min(95, Math.max(5, py)),
  };
}

// Convert percentage location to 3D position
function locationToPos(
  location: { x: number; y: number },
  gridExtent: number,
): [number, number] {
  const x = (location.x / 100) * gridExtent - gridExtent / 2;
  const z = (location.y / 100) * gridExtent - gridExtent / 2;
  return [x, z];
}

const GRID_EXTENT = 16;

function FleetModel({
  machines,
  onMachineSelect,
  predictions = {},
  isEditMode = false,
  onUpdateMachinePosition,
  onRemoveMachine,
  orbitRef,
}: FleetModelProps) {
  // Shared drag state — only one machine can be dragged at a time
  const draggingId = useRef<string | null>(null);
  // Per-machine refs so the floor plane can move them without re-renders
  const machineRefs = useRef<Record<string, THREE.Group | null>>({});
  // Offset from click point to machine center (so it doesn't snap to center)
  const pickOffset = useRef(new THREE.Vector3());
  const { gl } = useThree();

  const getStatusColor = (status: Machine["status"]) => {
    switch (status) {
      case "optimal":
        return "#22c55e";
      case "impaired":
        return "#eab308";
      case "critical":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  // Floor plane pointer events — the source of truth while dragging
  const handleFloorMove = useCallback((e: any) => {
    if (!draggingId.current) return;
    e.stopPropagation();
    const group = machineRefs.current[draggingId.current];
    if (!group) return;
    const { x, z } = e.point;
    const newX = Math.max(
      -GRID_EXTENT / 2 + 0.5,
      Math.min(GRID_EXTENT / 2 - 0.5, x + pickOffset.current.x),
    );
    const newZ = Math.max(
      -GRID_EXTENT / 2 + 0.5,
      Math.min(GRID_EXTENT / 2 - 0.5, z + pickOffset.current.z),
    );
    group.position.set(newX, 0, newZ);
  }, []);

  const handleFloorUp = useCallback(
    (e: any) => {
      if (!draggingId.current) return;
      const id = draggingId.current;
      const group = machineRefs.current[id];
      draggingId.current = null;
      gl.domElement.style.cursor = "grab";
      // Re-enable orbit now that drag is done
      if (orbitRef?.current) orbitRef.current.enabled = true;
      if (group && onUpdateMachinePosition) {
        const newLocation = posToLocation(
          group.position.x,
          group.position.z,
          GRID_EXTENT,
        );
        onUpdateMachinePosition(id, newLocation);
      }
    },
    [gl, onUpdateMachinePosition, orbitRef],
  );

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
        const [x, z] = locationToPos(machine.location, GRID_EXTENT);
        const currentStatus = predictions[machine.id]?.status || machine.status;
        const currentRul = predictions[machine.id]?.rul ?? machine.rul;
        const isProblem = currentStatus === "critical";

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
        );
      })}
    </group>
  );
}

interface DraggableMachineProps {
  machine: Machine;
  x: number;
  z: number;
  currentStatus: Machine["status"];
  currentRul: number;
  isProblem: boolean;
  getStatusColor: (s: Machine["status"]) => string;
  isEditMode: boolean;
  onMachineSelect?: (id: string) => void;
  onRemoveMachine?: (id: string) => void;
  // Shared drag state from FleetModel
  draggingId: React.MutableRefObject<string | null>;
  pickOffset: React.MutableRefObject<THREE.Vector3>;
  machineRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  glDomElement: HTMLElement;
  orbitRef?: React.RefObject<any>;
}

// Loads and auto-scales the GLTF model for the factory floor view
function DraggableMachineModel({
  machine,
  isDragging,
  isProblem,
  statusColor,
}: {
  machine: Machine;
  isDragging: boolean;
  isProblem: boolean;
  statusColor: string;
}) {
  const modelUrl = useMemo(() => {
    if (machine.id.includes("machine-1")) return "/models/machine1.glb";
    if (machine.id.includes("machine-2")) return "/models/machine2.glb";
    if (machine.id.includes("machine-3")) return "/models/machine3.glb";
    return "/models/machine1.glb";
  }, [machine.id]);

  const { scene } = useGLTF(modelUrl);

  const emissiveColor =
    isProblem && !isDragging ? "#ef4444" : isDragging ? "#1d4ed8" : "#000000";
  const emissiveIntensity = isProblem ? 0.4 : isDragging ? 0.3 : 0;

  return (
    <Center
      onCentered={({ container, width, height, depth }) => {
        const maxDim = Math.max(width, height, depth) || 1;
        const scale = 1.2 / maxDim;
        container.scale.set(scale, scale, scale);
      }}
    >
      <Clone
        object={scene}
        inject={
          <meshStandardMaterial
            color={isDragging ? "#60a5fa" : statusColor}
            metalness={0.5}
            roughness={0.4}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
          />
        }
      />
    </Center>
  );
}

function DraggableMachine({
  machine,
  x,
  z,
  currentStatus,
  currentRul,
  isProblem,
  getStatusColor,
  isEditMode,
  onMachineSelect,
  onRemoveMachine,
  draggingId,
  pickOffset,
  machineRefs,
  glDomElement,
  orbitRef,
}: DraggableMachineProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Register this group in shared machineRefs
  useEffect(() => {
    machineRefs.current[machine.id] = groupRef.current;
    return () => {
      delete machineRefs.current[machine.id];
    };
  }, [machine.id, machineRefs]);

  // Sync position from props when not being dragged
  useEffect(() => {
    if (draggingId.current !== machine.id && groupRef.current) {
      groupRef.current.position.set(x, 0, z);
    }
  }, [x, z, machine.id, draggingId]);

  const handlePointerDown = useCallback(
    (e: any) => {
      if (!isEditMode) return;
      e.stopPropagation();
      draggingId.current = machine.id;
      setIsDragging(true);
      glDomElement.style.cursor = "grabbing";
      // Disable orbit so the map doesn't rotate/pan during drag
      if (orbitRef?.current) orbitRef.current.enabled = false;
      // Store the offset between the click point on the floor and the machine center
      if (groupRef.current && e.point) {
        pickOffset.current.set(
          groupRef.current.position.x - e.point.x,
          0,
          groupRef.current.position.z - e.point.z,
        );
      } else {
        pickOffset.current.set(0, 0, 0);
      }
    },
    [isEditMode, machine.id, draggingId, pickOffset, glDomElement],
  );

  // Clear local isDragging when global drag ends
  useFrame(() => {
    if (isDragging && draggingId.current !== machine.id) {
      setIsDragging(false);
    }
  });

  const statusColor = getStatusColor(currentStatus);

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (isEditMode) {
          glDomElement.style.cursor =
            draggingId.current === machine.id ? "grabbing" : "grab";
        } else {
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        if (draggingId.current !== machine.id) {
          document.body.style.cursor = "default";
          glDomElement.style.cursor = "default";
        }
      }}
    >
      {/* Drag highlight ring in edit mode */}
      {isEditMode && (
        <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.1, 32]} />
          <meshBasicMaterial
            color={isDragging ? "#60a5fa" : "#3b82f6"}
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
        <group
          position={[0, 0.3, 0]}
          onClick={(e) => {
            if (isEditMode || draggingId.current === machine.id) {
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            onMachineSelect?.(machine.id);
          }}
        >
          <mesh visible={false}>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          <DraggableMachineModel
            machine={machine}
            isDragging={isDragging}
            isProblem={isProblem}
            statusColor={statusColor}
          />

          {(isDragging || isProblem) && (
            <mesh>
              <boxGeometry args={[1.3, 1.3, 1.3]} />
              <meshStandardMaterial
                color={isDragging ? "#60a5fa" : "#ef4444"}
                transparent
                opacity={0.3}
                emissive={isDragging ? "#1d4ed8" : "#ef4444"}
                emissiveIntensity={0.5}
                wireframe
              />
            </mesh>
          )}
        </group>
      </Float>

      {/* Status indicator light */}
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={isProblem ? 1 : 0.5}
        />
      </mesh>

      {/* Label + Remove button */}
      <Html
        position={[0, 1.5, 0]}
        center
        distanceFactor={10}
        style={{
          pointerEvents: isEditMode ? "auto" : "none",
          userSelect: "none",
        }}
      >
        <div className="relative bg-card/95 backdrop-blur-sm px-2 py-1 rounded text-xs whitespace-nowrap border border-border flex items-center gap-2">
          <div>
            <div className="font-medium">{machine.name}</div>
            <div className="text-muted-foreground">
              RUL:{" "}
              <span
                className={
                  currentRul > 80
                    ? "text-success"
                    : currentRul > 30
                      ? "text-warning"
                      : "text-destructive"
                }
              >
                {currentRul} Days
              </span>
            </div>
          </div>
          {isEditMode && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveMachine?.(machine.id);
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
  );
}

interface MachineGLTFModelProps {
  machine: Machine;
  isExploded: boolean;
  setIsExploded: (v: boolean) => void;
  onComponentSelect: (component: MachineComponent | null) => void;
  selectedComponent: MachineComponent | null;
  onModuleFocus?: (info: { label: string; meshNames: string[] } | null) => void;
  onMeshSelect?: (meshName: string | null) => void;
  selectedMeshName?: string | null;
  triggerBack?: number;
}

function ModularMachineGLTFModel({
  machine,
  isExploded,
  setIsExploded,
  onComponentSelect,
  selectedComponent,
  onModuleFocus,
  onMeshSelect,
  selectedMeshName,
  triggerBack,
}: MachineGLTFModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/machine3.glb");
  const moduleStatesRef = useRef<ModuleState[]>([]);
  const [setupDone, setSetupDone] = useState(false);
  const scaleValRef = useRef(1);
  const [focusedModuleIndex, setFocusedModuleIndex] = useState<number | null>(
    null,
  );
  const focusedIdxRef = useRef<number | null>(null);
  const focusStartTimeRef = useRef<number | null>(null);
  const selectedMeshUUIDRef = useRef<string | null>(null);
  const isExplodedRef = useRef(isExploded);
  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as any;
  const cameraDistRef = useRef({ original: { min: 2, max: 10 } });

  useEffect(() => { isExplodedRef.current = isExploded; }, [isExploded]);

  const focusModule = (idx: number) => {
    const s = moduleStatesRef.current[idx];
    // Center selected module: targetOffset=0 → group.position lerps to origin
    s.targetOffset = 0;
    // Assembly-line spread targets (but don't animate yet - wait for delay)
    const n = s.subMeshes.length;
    s.subMeshes.forEach((sm, i) => {
      sm.targetLocalPos.copy(sm.originalLocalPos);
      sm.targetLocalPos.x += (i - (n - 1) / 2) * MESH_SPACING;
    });

    // Zoom camera in for focused module
    if (controls) {
      cameraDistRef.current.original = { min: controls.minDistance, max: controls.maxDistance };
      controls.minDistance = 1.5;
      controls.maxDistance = 6;
      controls.autoRotate = false;
      controls.dampingFactor = 0.08;
      controls.enableDamping = true;
    }

    focusedIdxRef.current = idx;
    focusStartTimeRef.current = Date.now(); // mark when focus started
    setFocusedModuleIndex(idx);
    onModuleFocus?.({ label: s.label, meshNames: MACHINE3_MODULE_CONFIG[idx].meshNames });
  };

  const handleBack = () => {
    const idx = focusedIdxRef.current;
    if (idx !== null) {
      const s = moduleStatesRef.current[idx];
      // Snap sub-meshes back to their original local positions
      s.subMeshes.forEach((sm) => {
        sm.obj.position.copy(sm.originalLocalPos);
        sm.targetLocalPos.copy(sm.originalLocalPos);
      });
      // Animate the module group back out to its level-1 exploded position
      s.targetOffset = EXPLODE_DISTANCE;
    }

    // Restore camera zoom settings
    if (controls) {
      controls.minDistance = cameraDistRef.current.original.min;
      controls.maxDistance = cameraDistRef.current.original.max;
      controls.dampingFactor = 0.05;
    }

    selectedMeshUUIDRef.current = null;
    focusStartTimeRef.current = null;
    focusedIdxRef.current = null;
    setFocusedModuleIndex(null);
    // Stay in level 1 — keep isExploded true so all modules remain spread out
    onModuleFocus?.(null);
    onMeshSelect?.(null);
  };

  // Fire handleBack when parent increments the triggerBack counter
  useEffect(() => {
    if (!triggerBack) return;
    handleBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerBack]);

  // ── Unmount cleanup: snap any spread sub-meshes back so the cached GLB stays clean ──
  useEffect(() => {
    return () => {
      const idx = focusedIdxRef.current;
      if (idx !== null) {
        moduleStatesRef.current[idx]?.subMeshes.forEach((sm) => {
          sm.obj.position.copy(sm.originalLocalPos);
        });
      }
    };
  }, []);

  // ── Scene setup: runs once when scene loads (or on remount with cached GLB) ──
  useEffect(() => {
    if (!scene || !groupRef.current) return; // Safety: restore meshes from any module groups left by a previous mount
    [...scene.children]
      .filter((c) => c.name.startsWith("module_"))
      .forEach((oldGroup) => {
        [...oldGroup.children].forEach((child) => scene.attach(child));
        scene.remove(oldGroup);
      });

    // Centre + scale scene (identical to MachineGLTFModel)
    scene.position.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scaleVal = 2.5 / maxDim;
    scene.scale.set(scaleVal, scaleVal, scaleVal);
    scene.position.set(
      -center.x * scaleVal,
      -center.y * scaleVal,
      -center.z * scaleVal,
    );

    // Propagate full world matrices so getWorldPosition is accurate
    groupRef.current.updateWorldMatrix(true, true);

    // Build name → object registry
    const registry = new Map<string, THREE.Object3D>();
    scene.traverse((obj) => {
      if (obj.name) registry.set(obj.name, obj);
    });

    const allCentroids: THREE.Vector3[] = [];

    const states: ModuleState[] = MACHINE3_MODULE_CONFIG.map((cfg) => {
      const group = new THREE.Group();
      group.name = `module_${cfg.id}`;
      scene.add(group);

      // Reparent meshes into module group — THREE.attach() preserves world transform
      cfg.meshNames.forEach((name) => {
        const obj = registry.get(name);
        if (obj) group.attach(obj);
      });

      // Centroid = average world position of all meshes in this group
      const centroid = new THREE.Vector3();
      let count = 0;
      group.traverse((child) => {
        if (child !== group && (child as THREE.Mesh).isMesh) {
          const wp = new THREE.Vector3();
          child.getWorldPosition(wp);
          centroid.add(wp);
          count++;
        }
      });
      if (count > 0) centroid.divideScalar(count);
      allCentroids.push(centroid.clone());

      return {
        group,
        radialDir: new THREE.Vector3(),
        currentOffset: 0,
        targetOffset: 0,
        delayRemaining: 0,
        labelPos: new THREE.Vector3(),
        label: cfg.label,
        centroid: centroid.clone(),
        subMeshes: [],
      };
    });

    // Machine centre = average of all module centroids (world space)
    const machineCenter = new THREE.Vector3();
    allCentroids.forEach((c) => machineCenter.add(c));
    machineCenter.divideScalar(allCentroids.length);

    // Radial direction + label target position per module
    states.forEach((s, i) => {
      s.radialDir = allCentroids[i].clone().sub(machineCenter).normalize();
      if (s.radialDir.lengthSq() < 0.0001) s.radialDir.set(1, 0, 0);

      // Label lives at the fully-exploded centroid position, pushed further outward to avoid blocking models
      // EXPLODE_DISTANCE * scaleVal converts scene-local units to world units
      const labelWorld = allCentroids[i]
        .clone()
        .add(
          s.radialDir
            .clone()
            .multiplyScalar(EXPLODE_DISTANCE * scaleVal + 1.3),
        );
      const labelLocal = labelWorld.clone();
      groupRef.current!.worldToLocal(labelLocal);
      s.labelPos = labelLocal;
    });

    // Populate sub-meshes for level-2 assembly-line explode
    states.forEach((s) => {
      const children: THREE.Object3D[] = [];
      s.group.traverse((child) => {
        if (child !== s.group && (child as THREE.Mesh).isMesh)
          children.push(child);
      });
      children.sort((a, b) => a.position.x - b.position.x);
      s.subMeshes = children.map((obj) => ({
        obj,
        originalLocalPos: obj.position.clone(),
        targetLocalPos: obj.position.clone(),
      }));
    });
    scaleValRef.current = scaleVal;
    moduleStatesRef.current = states;
    setSetupDone(true);
  }, [scene]);

  // ── Trigger stagger whenever isExploded toggles ───────────────────────────
  useEffect(() => {
    const states = moduleStatesRef.current;
    if (!states.length) return;
    const n = states.length;
    if (isExploded) {
      states.forEach((s, i) => {
        s.delayRemaining = i * STAGGER_MS;
        s.targetOffset = EXPLODE_DISTANCE;
      });
    } else {
      // Reverse stagger order for reassembly
      states.forEach((s, i) => {
        s.delayRemaining = (n - 1 - i) * STAGGER_MS;
        s.targetOffset = 0;
      });
    }
  }, [isExploded]);

  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const focused = focusedIdxRef.current;

    if (groupRef.current && !isExploded && focused === null) {
      groupRef.current.rotation.y += delta * 0.2;
    }

    const deltaMs = delta * 1000;
    moduleStatesRef.current.forEach((s) => {
      if (s.delayRemaining > 0) {
        s.delayRemaining = Math.max(0, s.delayRemaining - deltaMs);
        return;
      }
      s.currentOffset = THREE.MathUtils.lerp(
        s.currentOffset,
        s.targetOffset,
        delta * LERP_SPEED,
      );
      s.group.position.copy(s.radialDir).multiplyScalar(s.currentOffset);
    });

    if (focused !== null) {
      // Only animate sub-meshes after the delay has passed
      const timeSinceFocus = focusStartTimeRef.current ? Date.now() - focusStartTimeRef.current : 0;
      if (timeSinceFocus >= LEVEL2_DELAY_MS) {
        moduleStatesRef.current[focused].subMeshes.forEach((sm) => {
          sm.obj.position.lerp(sm.targetLocalPos, delta * FOCUSED_LERP_SPEED);
        });
      }
    }
  });

  // ── Material highlighting (health colours + selected state + module focus) ──
  useEffect(() => {
    if (!scene) return;
    scene.traverse((child: any) => {
      if (!child.isMesh) return;
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material;
      }

      const modIdx = MACHINE3_MODULE_CONFIG.findIndex((m) =>
        m.meshNames.includes(child.name),
      );
      const mod = modIdx !== -1 ? MACHINE3_MODULE_CONFIG[modIdx] : undefined;
      const comp = mod
        ? machine.components.find(
          (c) => c.name.toLowerCase() === mod.label.toLowerCase(),
        )
        : undefined;

      let isSelected = false;
      if (selectedComponent && mod) {
        isSelected =
          selectedComponent.name.toLowerCase() === mod.label.toLowerCase();
      }
      // In level 2, select by name (from 3D click or list click)
      if (focusedModuleIndex !== null) {
        isSelected = !!(selectedMeshName && child.name === selectedMeshName);
      }

      // When a module is focused: fade all other modules, highlight focused one
      if (focusedModuleIndex !== null) {
        if (modIdx === -1) {
          // Fixed base parts — fade same as non-focused modules
          child.material = new THREE.MeshStandardMaterial({
            color: "#0f172a",
            transparent: true,
            opacity: 0.08,
          });
          return;
        }
        if (modIdx !== focusedModuleIndex) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#0f172a",
            transparent: true,
            opacity: 0.08,
          });
          return;
        }
        // Focused module meshes
        if (isSelected) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#3b82f6",
            emissive: "#1d4ed8",
            emissiveIntensity: 0.8,
            metalness: 0.2,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9,
          });
        } else {
          // Keep colorless/original material until component is selected
          child.material = child.userData.originalMaterial;
        }
        return;
      }

      // No module focused: normal health-colour logic
      if (isSelected) {
        child.material = new THREE.MeshStandardMaterial({
          color: "#3b82f6",
          emissive: "#1d4ed8",
          emissiveIntensity: 0.8,
          metalness: 0.2,
          roughness: 0.1,
          transparent: true,
          opacity: 0.9,
        });
      } else if (isExploded && comp) {
        const h = comp.health;
        const [color, emissive] =
          h >= 80
            ? ["#22c55e", "#15803d"]
            : h >= 60
              ? ["#eab308", "#a16207"]
              : ["#ef4444", "#b91c1c"];
        child.material = new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.6,
          metalness: 0.3,
          roughness: 0.4,
          transparent: true,
          opacity: 0.85,
        });
      } else {
        child.material = child.userData.originalMaterial;
      }
    });
  }, [selectedComponent, scene, isExploded, machine.components, focusedModuleIndex, selectedMeshName]);

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = (e: any) => {
    e.stopPropagation();

    if (!isExploded) {
      setIsExploded(true);
      return;
    }

    const meshName: string = e.object.name || "";

    if (focusedIdxRef.current !== null) {
      // In level-2: clicking a mesh of the focused module selects it
      const focusedCfg = MACHINE3_MODULE_CONFIG[focusedIdxRef.current];
      if (focusedCfg.meshNames.includes(meshName)) {
        selectedMeshUUIDRef.current = e.object.uuid;
        onMeshSelect?.(meshName);
        // Select the module component so UI panels work
        const comp = machine.components.find(
          (c) => c.name.toLowerCase() === focusedCfg.label.toLowerCase(),
        );
        if (comp) onComponentSelect(comp);
      }
      return;
    }
    const modIdx = MACHINE3_MODULE_CONFIG.findIndex((m) =>
      m.meshNames.includes(meshName),
    );

    if (modIdx !== -1) {
      const comp = machine.components.find(
        (c) =>
          c.name.toLowerCase() ===
          MACHINE3_MODULE_CONFIG[modIdx].label.toLowerCase(),
      );
      if (comp) onComponentSelect(comp);
      focusModule(modIdx);
      return;
    }

    onComponentSelect({
      id: e.object.uuid,
      name: meshName || "Machine Part",
      status: "healthy",
      health: 100,
      lastMaintenance: new Date().toISOString(),
      predictedFailure: null,
      position: [0, 0, 0],
      repairTime: 1,
      replacementCost: 100,
      contributionToRUL: 0,
    });
  };

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      />
      {isExploded &&
        setupDone &&
        focusedModuleIndex === null &&
        moduleStatesRef.current.map((s) => (
          <Html
            key={s.label}
            position={[s.labelPos.x, s.labelPos.y, s.labelPos.z]}
            center
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                background: "rgba(15,23,42,0.85)",
                color: "#f1f5f9",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                border: "1px solid rgba(148,163,184,0.3)",
                backdropFilter: "blur(4px)",
              }}
            >
              {s.label}
            </div>
          </Html>
        ))}
    </group>
  );
}

function MachineGLTFModel({
  machine,
  isExploded,
  setIsExploded,
  onComponentSelect,
  selectedComponent,
}: MachineGLTFModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  const modelUrl = useMemo(() => {
    if (machine.id === "machine-1") return "/models/machine1.glb";
    if (machine.id === "machine-2") return "/models/machine2.glb";
    return "/models/machine1.glb";
  }, [machine.id]);

  const { scene, animations } = useGLTF(modelUrl);
  const { actions, names } = useAnimations(animations, groupRef);

  useFrame((state, delta) => {
    if (groupRef.current && !isExploded) {
      groupRef.current.rotation.y += delta * 0.2;
    }
  });

  useEffect(() => {
    if (names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        if (isExploded) {
          action.paused = false;
          action.timeScale = 1;
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
        } else {
          if (action.time > 0) {
            action.paused = false;
            action.timeScale = -1;
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();
          } else {
            action.stop();
          }
        }
      }
    }
  }, [isExploded, actions, names]);

  useEffect(() => {
    if (scene) {
      // Reset position and scale to calculate the true original bounding box
      scene.position.set(0, 0, 0);
      scene.scale.set(1, 1, 1);
      scene.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.5 / maxDim;

      // Apply correct centered and scaled position
      scene.scale.set(scale, scale, scale);
      scene.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale,
      );
      scene.updateMatrixWorld(true);
    }
  }, [scene]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!isExploded) setIsExploded(true);
    const clickedMeshName = e.object.name || "";

    const matched = clickedMeshName
      ? machine.components.find((c) => {
        const cName = c.name.toLowerCase();
        const clickName = clickedMeshName.toLowerCase();
        if (cName.length < 3) return false;
        return (
          clickName.includes(cName) ||
          (clickName.length >= 3 && cName.includes(clickName))
        );
      })
      : undefined;

    if (matched) {
      onComponentSelect(matched);
    } else {
      onComponentSelect({
        id: e.object.uuid,
        name: clickedMeshName || "Machine Part",
        status: "healthy",
        health: 100,
        lastMaintenance: new Date().toISOString(),
        predictedFailure: null,
        position: [0, 0, 0],
        repairTime: 1,
        replacementCost: 100,
        contributionToRUL: 0,
      });
    }
  };

  useEffect(() => {
    if (scene) {
      scene.traverse((child: any) => {
        if (child.isMesh) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }

          let isSelected = false;
          let matchedComponent: MachineComponent | undefined;

          if (child.name) {
            const cName = child.name.toLowerCase();
            matchedComponent = machine.components.find((c) => {
              const sName = c.name.toLowerCase();
              if (sName.length < 3) return false;
              return (
                cName.includes(sName) ||
                (cName.length >= 3 && sName.includes(cName))
              );
            });
          }

          if (selectedComponent) {
            if (child.uuid === selectedComponent.id) {
              isSelected = true;
            } else if (child.name && selectedComponent.name) {
              const cName = child.name.toLowerCase();
              const sName = selectedComponent.name.toLowerCase();
              if (sName.length >= 3 && cName.includes(sName)) {
                isSelected = true;
              }
            }
          }

          if (isSelected) {
            child.material = new THREE.MeshStandardMaterial({
              color: "#3b82f6",
              emissive: "#1d4ed8",
              emissiveIntensity: 0.8,
              metalness: 0.2,
              roughness: 0.1,
              transparent: true,
              opacity: 0.9,
            });
          } else if (isExploded && matchedComponent) {
            let color = "#ef4444"; // red
            let emissive = "#b91c1c";
            if (matchedComponent.health >= 80) {
              color = "#22c55e"; // green
              emissive = "#15803d";
            } else if (matchedComponent.health >= 60) {
              color = "#eab308"; // orange/yellow
              emissive = "#a16207";
            }

            child.material = new THREE.MeshStandardMaterial({
              color: color,
              emissive: emissive,
              emissiveIntensity: 0.6,
              metalness: 0.3,
              roughness: 0.4,
              transparent: true,
              opacity: 0.85,
            });
          } else {
            child.material = child.userData.originalMaterial;
          }
        }
      });
    }
  }, [selectedComponent, scene, isExploded, machine.components]);

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      />
    </group>
  );
}

useGLTF.preload("/models/machine1.glb");
useGLTF.preload("/models/machine2.glb");
useGLTF.preload("/models/machine3.glb");
