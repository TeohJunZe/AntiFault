# Machine3 Module Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group machine3.glb meshes into 7 named modules that explode as rigid clusters with radial direction, 70ms stagger, and floating module-name labels.

**Architecture:** Replace the GLB baked-animation path for machine3 with a new `ModularMachineGLTFModel` component. On scene load it reparents meshes into `THREE.Group`s per module (preserving world transform via `attach()`), computes radial directions, then animates group positions via `useFrame` lerp with per-module stagger delay. Machine1/2 are untouched.

**Tech Stack:** React Three Fiber, @react-three/drei (`useGLTF`, `Html`), Three.js (`THREE.Group.attach`, `THREE.MathUtils.lerp`), TypeScript

---

## File Map

| File | Change |
|---|---|
| `lib/data.ts` | Replace machine3 `components` (4 items → 7 modules) |
| `components/machine-viewer-3d.tsx` | Add `ModuleConfig` type + `MACHINE3_MODULE_CONFIG` + constants; add `ModularMachineGLTFModel` component; update render branch |

---

## Task 1: Update machine3 components in `lib/data.ts`

**Files:**
- Modify: `lib/data.ts:128-133`

- [ ] **Step 1: Replace the machine3 components array**

In `lib/data.ts`, find the machine3 `components` array (lines 128–133) and replace it with:

```typescript
components: [
  { id: 'm3-motor',    name: 'Motor Assembly',   status: 'healthy',  health: 78, lastMaintenance: '2025-12-01', predictedFailure: null,         position: [0.8, 0, 0],   repairTime: 6, replacementCost: 22000, contributionToRUL: 5  },
  { id: 'm3-coupling', name: 'Coupling',          status: 'healthy',  health: 82, lastMaintenance: '2025-12-01', predictedFailure: null,         position: [0.4, 0, 0],   repairTime: 2, replacementCost: 3500,  contributionToRUL: 5  },
  { id: 'm3-bearing',  name: 'Bearing Assembly',  status: 'degraded', health: 45, lastMaintenance: '2025-12-01', predictedFailure: '2026-04-25', position: [0, 0.3, 0],   repairTime: 3, replacementCost: 5000,  contributionToRUL: 20 },
  { id: 'm3-casing',   name: 'Pump Casing',       status: 'healthy',  health: 75, lastMaintenance: '2025-12-01', predictedFailure: null,         position: [0, 0, 0],     repairTime: 4, replacementCost: 12000, contributionToRUL: 5  },
  { id: 'm3-rotor',    name: 'Rotor Assembly',    status: 'failing',  health: 22, lastMaintenance: '2025-12-01', predictedFailure: '2026-04-23', position: [0, -0.3, 0],  repairTime: 5, replacementCost: 18000, contributionToRUL: 40 },
  { id: 'm3-sealing',  name: 'Sealing System',    status: 'degraded', health: 38, lastMaintenance: '2025-12-01', predictedFailure: '2026-04-28', position: [-0.2, 0, 0],  repairTime: 2, replacementCost: 4000,  contributionToRUL: 15 },
  { id: 'm3-wear',     name: 'Wear Parts',        status: 'degraded', health: 30, lastMaintenance: '2025-12-01', predictedFailure: '2026-04-26', position: [-0.5, 0, 0],  repairTime: 1, replacementCost: 2000,  contributionToRUL: 10 },
],
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors (or only pre-existing errors unrelated to data.ts).

---

## Task 2: Add MODULE_CONFIG and constants to `machine-viewer-3d.tsx`

**Files:**
- Modify: `components/machine-viewer-3d.tsx` — insert after the existing imports block (after line 24, before the `interface MachineViewer3DProps` declaration)

- [ ] **Step 1: Insert the type, constants, and config after line 24**

Insert this block between the `MACHINE_TYPES` array and `interface MachineViewer3DProps`:

```typescript
// ── Machine3 module grouping ──────────────────────────────────────────────

interface ModuleConfig {
  id: string
  label: string
  meshNames: string[]
}

const EXPLODE_DISTANCE = 1.2  // scene-local units per module
const LERP_SPEED = 8
const STAGGER_MS = 70

const MACHINE3_MODULE_CONFIG: ModuleConfig[] = [
  {
    id: 'motor',
    label: 'Motor Assembly',
    meshNames: [
      'Motor_Frame', 'Motor_Stator', 'Motor_Rotor', 'Motor_Shaft',
      'Motor_EndShield_DE', 'Motor_EndShield_NDE', 'Motor_Fan', 'Motor_Fan_Cover',
      'Motor_Terminal_Box', 'Motor_Terminal_Box_Lid', 'Motor_Bearing_DE',
      'Motor_Bearing_NDE', 'Motor_Bearing_Cover_DE', 'Motor_Bearing_Cover_NDE',
      'Motor_Feet', 'Motor_Lifting_Eye', 'Motor_Nameplate',
    ],
  },
  {
    id: 'coupling',
    label: 'Coupling',
    meshNames: ['Coupling_Hub_Pump', 'Coupling_Hub_Motor', 'Coupling_Element', 'Coupling_Guard'],
  },
  {
    id: 'bearing',
    label: 'Bearing Assembly',
    meshNames: ['Bearing_DE', 'Bearing_NDE', 'Bearing_Housing', 'Bearing_Cover_DE'],
  },
  {
    id: 'casing',
    label: 'Pump Casing',
    meshNames: ['Casing_Volute', 'Casing_Cover_Rear', 'Casing_Pipe_Clamp'],
  },
  {
    id: 'rotor',
    label: 'Rotor Assembly',
    meshNames: ['Rotor_Impeller', 'Rotor_Shaft', 'Rotor_Shaft_Key'],
  },
  {
    id: 'sealing',
    label: 'Sealing System',
    meshNames: ['Seal_Packing_Rings', 'Seal_Gland', 'Seal_Lantern_Ring'],
  },
  {
    id: 'wear',
    label: 'Wear Parts',
    meshNames: [
      'Wear_Ring_001', 'Wear_Ring_002', 'Wear_Ring_003',
      'Wear_Ring_004', 'Wear_Ring_005', 'Wear_Ring_006',
    ],
  },
]

interface ModuleState {
  group: THREE.Group
  radialDir: THREE.Vector3
  currentOffset: number
  targetOffset: number
  delayRemaining: number  // ms countdown before lerp starts
  labelPos: THREE.Vector3  // in groupRef local space
  label: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no new errors.

---

## Task 3: Write `ModularMachineGLTFModel` component

**Files:**
- Modify: `components/machine-viewer-3d.tsx` — insert the new component immediately before the existing `MachineGLTFModel` function (before line 778)

- [ ] **Step 1: Insert `ModularMachineGLTFModel` before `MachineGLTFModel`**

Insert this entire function before `function MachineGLTFModel(`:

```typescript
function ModularMachineGLTFModel({ machine, isExploded, setIsExploded, onComponentSelect, selectedComponent }: MachineGLTFModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/machine3.glb')
  const moduleStatesRef = useRef<ModuleState[]>([])
  const [setupDone, setSetupDone] = useState(false)

  // ── Scene setup: runs once when scene loads (or on remount with cached GLB) ──
  useEffect(() => {
    if (!scene || !groupRef.current) return

    // Safety: restore meshes from any module groups left by a previous mount
    ;[...scene.children]
      .filter(c => c.name.startsWith('module_'))
      .forEach(oldGroup => {
        ;[...oldGroup.children].forEach(child => scene.attach(child))
        scene.remove(oldGroup)
      })

    // Centre + scale scene (identical to MachineGLTFModel)
    scene.position.set(0, 0, 0)
    scene.scale.set(1, 1, 1)
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const scaleVal = 2.5 / maxDim
    scene.scale.set(scaleVal, scaleVal, scaleVal)
    scene.position.set(-center.x * scaleVal, -center.y * scaleVal, -center.z * scaleVal)

    // Propagate full world matrices so getWorldPosition is accurate
    groupRef.current.updateWorldMatrix(true, true)

    // Build name → object registry
    const registry = new Map<string, THREE.Object3D>()
    scene.traverse(obj => { if (obj.name) registry.set(obj.name, obj) })

    const allCentroids: THREE.Vector3[] = []

    const states: ModuleState[] = MACHINE3_MODULE_CONFIG.map(cfg => {
      const group = new THREE.Group()
      group.name = `module_${cfg.id}`
      scene.add(group)

      // Reparent meshes into module group — THREE.attach() preserves world transform
      cfg.meshNames.forEach(name => {
        const obj = registry.get(name)
        if (obj) group.attach(obj)
      })

      // Centroid = average world position of all meshes in this group
      const centroid = new THREE.Vector3()
      let count = 0
      group.traverse(child => {
        if (child !== group && (child as THREE.Mesh).isMesh) {
          const wp = new THREE.Vector3()
          child.getWorldPosition(wp)
          centroid.add(wp)
          count++
        }
      })
      if (count > 0) centroid.divideScalar(count)
      allCentroids.push(centroid.clone())

      return {
        group,
        radialDir: new THREE.Vector3(),
        currentOffset: 0,
        targetOffset: 0,
        delayRemaining: 0,
        labelPos: new THREE.Vector3(),
        label: cfg.label,
      }
    })

    // Machine centre = average of all module centroids (world space)
    const machineCenter = new THREE.Vector3()
    allCentroids.forEach(c => machineCenter.add(c))
    machineCenter.divideScalar(allCentroids.length)

    // Radial direction + label target position per module
    states.forEach((s, i) => {
      s.radialDir = allCentroids[i].clone().sub(machineCenter).normalize()
      if (s.radialDir.lengthSq() < 0.0001) s.radialDir.set(1, 0, 0)

      // Label lives at the fully-exploded centroid position (world), with a small upward nudge
      // EXPLODE_DISTANCE * scaleVal converts scene-local units to world units
      const labelWorld = allCentroids[i].clone()
        .add(s.radialDir.clone().multiplyScalar(EXPLODE_DISTANCE * scaleVal + 0.15))
      const labelLocal = labelWorld.clone()
      groupRef.current!.worldToLocal(labelLocal)
      s.labelPos = labelLocal
    })

    moduleStatesRef.current = states
    setSetupDone(true)
  }, [scene])

  // ── Trigger stagger whenever isExploded toggles ───────────────────────────
  useEffect(() => {
    const states = moduleStatesRef.current
    if (!states.length) return
    const n = states.length
    if (isExploded) {
      states.forEach((s, i) => {
        s.delayRemaining = i * STAGGER_MS
        s.targetOffset = EXPLODE_DISTANCE
      })
    } else {
      // Reverse stagger order for reassembly
      states.forEach((s, i) => {
        s.delayRemaining = (n - 1 - i) * STAGGER_MS
        s.targetOffset = 0
      })
    }
  }, [isExploded])

  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (groupRef.current && !isExploded) {
      groupRef.current.rotation.y += delta * 0.2
    }
    const deltaMs = delta * 1000
    moduleStatesRef.current.forEach(s => {
      if (s.delayRemaining > 0) {
        s.delayRemaining -= deltaMs
        return
      }
      s.currentOffset = THREE.MathUtils.lerp(s.currentOffset, s.targetOffset, delta * LERP_SPEED)
      // Move module group along its radial direction by currentOffset (scene-local units)
      s.group.position.copy(s.radialDir).multiplyScalar(s.currentOffset)
    })
  })

  // ── Material highlighting (health colours + selected state) ───────────────
  useEffect(() => {
    if (!scene) return
    scene.traverse((child: any) => {
      if (!child.isMesh) return
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material
      }

      // Match mesh → module → machine component via exact label comparison
      const mod = MACHINE3_MODULE_CONFIG.find(m => m.meshNames.includes(child.name))
      const comp = mod
        ? machine.components.find(c => c.name.toLowerCase() === mod.label.toLowerCase())
        : undefined

      let isSelected = false
      if (selectedComponent) {
        if (child.uuid === selectedComponent.id) {
          isSelected = true
        } else if (mod && selectedComponent.name.toLowerCase() === mod.label.toLowerCase()) {
          isSelected = true
        }
      }

      if (isSelected) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#3b82f6', emissive: '#1d4ed8', emissiveIntensity: 0.8,
          metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.9,
        })
      } else if (isExploded && comp) {
        const h = comp.health
        const [color, emissive] = h >= 80
          ? ['#22c55e', '#15803d']
          : h >= 60
          ? ['#eab308', '#a16207']
          : ['#ef4444', '#b91c1c']
        child.material = new THREE.MeshStandardMaterial({
          color, emissive, emissiveIntensity: 0.6,
          metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.85,
        })
      } else {
        child.material = child.userData.originalMaterial
      }
    })
  }, [selectedComponent, scene, isExploded, machine.components])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = (e: any) => {
    e.stopPropagation()
    if (!isExploded) setIsExploded(true)
    const meshName: string = e.object.name || ''
    const mod = MACHINE3_MODULE_CONFIG.find(m => m.meshNames.includes(meshName))
    if (mod) {
      const comp = machine.components.find(
        c => c.name.toLowerCase() === mod.label.toLowerCase()
      )
      if (comp) { onComponentSelect(comp); return }
    }
    onComponentSelect({
      id: e.object.uuid,
      name: meshName || 'Machine Part',
      status: 'healthy',
      health: 100,
      lastMaintenance: new Date().toISOString(),
      predictedFailure: null,
      position: [0, 0, 0],
      repairTime: 1,
      replacementCost: 100,
      contributionToRUL: 0,
    })
  }

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'default' }}
      />
      {isExploded && setupDone && moduleStatesRef.current.map((s) => (
        <Html
          key={s.label}
          position={[s.labelPos.x, s.labelPos.y, s.labelPos.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(15,23,42,0.85)',
            color: '#f1f5f9',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(148,163,184,0.3)',
            backdropFilter: 'blur(4px)',
          }}>
            {s.label}
          </div>
        </Html>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no new errors. If you see "Property 'isMesh' does not exist on type 'Object3D'", add `as THREE.Mesh` cast or use `(child as any).isMesh`.

---

## Task 4: Wire render branch to use `ModularMachineGLTFModel` for machine3

**Files:**
- Modify: `components/machine-viewer-3d.tsx:393-399`

- [ ] **Step 1: Replace the `<MachineGLTFModel>` JSX in the single-machine Canvas**

Find this block (around line 393):

```tsx
        <MachineGLTFModel
          machine={machine}
          isExploded={isExploded}
          setIsExploded={setIsExploded}
          onComponentSelect={onComponentSelect}
          selectedComponent={selectedComponent}
        />
```

Replace it with:

```tsx
        {machine.id === 'machine-3'
          ? <ModularMachineGLTFModel
              machine={machine}
              isExploded={isExploded}
              setIsExploded={setIsExploded}
              onComponentSelect={onComponentSelect}
              selectedComponent={selectedComponent}
            />
          : <MachineGLTFModel
              machine={machine}
              isExploded={isExploded}
              setIsExploded={setIsExploded}
              onComponentSelect={onComponentSelect}
              selectedComponent={selectedComponent}
            />
        }
```

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Start dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000`, navigate to **Hydraulic Press #2**.

Check:
1. Model renders correctly at rest (auto-rotating)
2. Click **Explode View** — modules fan out radially with visible stagger (motor first, wear parts last)
3. Each exploded module shows its name label (Motor Assembly, Coupling, Bearing Assembly, Pump Casing, Rotor Assembly, Sealing System, Wear Parts)
4. Clicking a mesh selects the correct module component card in the right panel
5. Meshes in the same module move together as a rigid cluster — no individual scatter
6. Click **Assemble** — modules return in reverse stagger order
7. Navigate to **Boiler Pump #1** or **Compressor Unit #3** — their explode behaviour is unchanged (baked GLB animation still works)

---

## Tuning Notes

If any of these look off after visual verification, adjust the constants at the top of the config block:

| What looks wrong | Fix |
|---|---|
| Modules barely move | Increase `EXPLODE_DISTANCE` (try `2.0`) |
| Modules fly way off screen | Decrease `EXPLODE_DISTANCE` (try `0.8`) |
| Animation too snappy / instant | Decrease `LERP_SPEED` (try `4`) |
| Animation too sluggish | Increase `LERP_SPEED` (try `12`) |
| Labels not aligned with modules | The label position is computed at setup time using `scaleVal`. If the GLB has unexpected internal scale, increase the `+ 0.15` nudge or multiply `EXPLODE_DISTANCE * scaleVal` by a correction factor |
| Some meshes don't move | Mesh names in the GLB don't match `MACHINE3_MODULE_CONFIG`. Open browser devtools and add `console.log` inside `scene.traverse` to print all mesh names, then update `meshNames` arrays to match |
