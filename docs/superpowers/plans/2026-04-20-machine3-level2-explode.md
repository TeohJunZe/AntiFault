# Machine3 Level-2 Explode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user clicks a module in the exploded view, the camera smoothly zooms to that module and its meshes spread out in an assembly-line (linear) layout. A Back button returns to the full exploded view.

**Architecture:** Three targeted changes to `components/machine-viewer-3d.tsx` only. (1) Add `makeDefault` to the single-machine OrbitControls so `useThree` can access it as `state.controls`. (2) Extend `ModuleState` with `centroid` + `subMeshes`, extend scene setup to populate them. (3) Add `focusedModuleIndex` state + camera animation refs + `focusModule`/`handleBack` functions + update `useFrame` + update click handler + add Back button `<Html>`.

**Tech Stack:** React Three Fiber (`useThree`, `useFrame`), Three.js, @react-three/drei (`OrbitControls makeDefault`)

---

## File Map

| File | Change |
|---|---|
| `components/machine-viewer-3d.tsx` | All changes — three tasks below |

---

## Task 1: Add `makeDefault` to OrbitControls in single-machine view

**Files:**
- Modify: `components/machine-viewer-3d.tsx:479-485`

This allows `useThree(state => state.controls)` inside `ModularMachineGLTFModel` to access the OrbitControls instance for target animation.

- [ ] **Step 1: Add `makeDefault` prop to the single-machine OrbitControls**

Find this block (around line 479):
```tsx
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
        />
```

Replace with:
```tsx
        <OrbitControls
          makeDefault
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
        />
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/User/Documents/ClaudeVHACK/AntiFault" && npx tsc --noEmit
```
Expected: no errors.

---

## Task 2: Extend types, constants, and scene setup

**Files:**
- Modify: `components/machine-viewer-3d.tsx` — constants block (~line 34) and `ModuleState` interface (~line 85) and `ModularMachineGLTFModel` scene setup useEffect

### Step 1: Add new constants

- [ ] **Add three constants after the existing `STAGGER_MS = 70` line (~line 36)**

Find:
```typescript
const STAGGER_MS = 70
```

Replace with:
```typescript
const STAGGER_MS = 70
const FOCUS_CAMERA_DIST = 1.5   // how far camera sits from module centroid when focused
const MESH_SPACING = 0.35       // gap between meshes in assembly-line spread (scene-local units)
const CAMERA_LERP_SPEED = 3     // slower than LERP_SPEED for cinematic feel
```

### Step 2: Add `SubMesh` interface and extend `ModuleState`

- [ ] **Add `SubMesh` interface and update `ModuleState`**

Find:
```typescript
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

Replace with:
```typescript
interface SubMesh {
  obj: THREE.Object3D
  originalLocalPos: THREE.Vector3
  targetLocalPos: THREE.Vector3
}

interface ModuleState {
  group: THREE.Group
  radialDir: THREE.Vector3
  currentOffset: number
  targetOffset: number
  delayRemaining: number
  labelPos: THREE.Vector3
  label: string
  centroid: THREE.Vector3   // world centroid, used for camera focus target
  subMeshes: SubMesh[]      // individual meshes for level-2 assembly-line spread
}
```

### Step 3: Extend scene setup in `ModularMachineGLTFModel`

- [ ] **Add `scaleValRef` ref declaration** — insert immediately after `const [setupDone, setSetupDone] = useState(false)` inside `ModularMachineGLTFModel`:

```typescript
  const scaleValRef = useRef(1)
```

- [ ] **Update the `return` statement inside the `MACHINE3_MODULE_CONFIG.map(cfg =>` callback** — the current return is:

```typescript
      return {
        group,
        radialDir: new THREE.Vector3(),
        currentOffset: 0,
        targetOffset: 0,
        delayRemaining: 0,
        labelPos: new THREE.Vector3(),
        label: cfg.label,
      }
```

Replace with:
```typescript
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
      }
```

- [ ] **Populate `subMeshes` and store `scaleValRef`** — insert this block immediately before `moduleStatesRef.current = states` in the scene setup useEffect:

```typescript
    // Populate sub-meshes for level-2 assembly-line explode
    states.forEach(s => {
      const children: THREE.Object3D[] = []
      s.group.traverse(child => {
        if (child !== s.group && (child as THREE.Mesh).isMesh) children.push(child)
      })
      children.sort((a, b) => a.position.x - b.position.x)
      s.subMeshes = children.map(obj => ({
        obj,
        originalLocalPos: obj.position.clone(),
        targetLocalPos: obj.position.clone(),
      }))
    })
    scaleValRef.current = scaleVal
```

- [ ] **Verify TypeScript compiles**

```bash
cd "c:/Users/User/Documents/ClaudeVHACK/AntiFault" && npx tsc --noEmit
```
Expected: no errors.

---

## Task 3: Add focused state, handlers, update useFrame, update click handler, add Back button

All changes are inside `ModularMachineGLTFModel`.

### Step 1: Add new state and refs

- [ ] **Insert after `const scaleValRef = useRef(1)`:**

```typescript
  const [focusedModuleIndex, setFocusedModuleIndex] = useState<number | null>(null)
  const focusedIdxRef = useRef<number | null>(null)
  const cameraAnimRef = useRef({
    active: false,
    returningHome: false,
    targetPos: new THREE.Vector3(3, 2, 3),
    targetLookAt: new THREE.Vector3(0, 0, 0),
    originalPos: new THREE.Vector3(3, 2, 3),
    originalTarget: new THREE.Vector3(0, 0, 0),
  })
  const { camera } = useThree()
  const controls = useThree(state => state.controls) as any
```

### Step 2: Add `focusModule` and `handleBack` functions

- [ ] **Insert these two functions after the `controls` line (still inside `ModularMachineGLTFModel`, before the first `useEffect`):**

```typescript
  const focusModule = (idx: number) => {
    const s = moduleStatesRef.current[idx]
    const anim = cameraAnimRef.current

    // Save camera state before first focus
    anim.originalPos.copy(camera.position)
    if (controls?.target) anim.originalTarget.copy(controls.target)

    // Camera flies to: centroid + radialDir * dist, looks at centroid
    const dist = FOCUS_CAMERA_DIST * scaleValRef.current
    anim.targetLookAt.copy(s.centroid)
    anim.targetPos.copy(s.centroid).add(s.radialDir.clone().multiplyScalar(dist))
    anim.active = true
    anim.returningHome = false

    // Spread sub-meshes along X axis in group-local space
    const n = s.subMeshes.length
    s.subMeshes.forEach((sm, i) => {
      sm.targetLocalPos.copy(sm.originalLocalPos)
      sm.targetLocalPos.x += (i - (n - 1) / 2) * MESH_SPACING
    })

    focusedIdxRef.current = idx
    setFocusedModuleIndex(idx)
  }

  const handleBack = () => {
    const anim = cameraAnimRef.current
    anim.targetPos.copy(anim.originalPos)
    anim.targetLookAt.copy(anim.originalTarget)
    anim.active = true
    anim.returningHome = true

    // Reset sub-mesh targets to original positions
    const idx = focusedIdxRef.current
    if (idx !== null) {
      moduleStatesRef.current[idx].subMeshes.forEach(sm => {
        sm.targetLocalPos.copy(sm.originalLocalPos)
      })
    }
  }
```

### Step 3: Replace `useFrame`

- [ ] **Replace the entire existing `useFrame` block:**

Find:
```typescript
  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (groupRef.current && !isExploded) {
      groupRef.current.rotation.y += delta * 0.2
    }
    const deltaMs = delta * 1000
    moduleStatesRef.current.forEach(s => {
      if (s.delayRemaining > 0) {
        s.delayRemaining = Math.max(0, s.delayRemaining - deltaMs)
        return
      }
      s.currentOffset = THREE.MathUtils.lerp(s.currentOffset, s.targetOffset, delta * LERP_SPEED)
      // Move module group along its radial direction by currentOffset (scene-local units)
      s.group.position.copy(s.radialDir).multiplyScalar(s.currentOffset)
    })
  })
```

Replace with:
```typescript
  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const focused = focusedIdxRef.current

    // Auto-rotate only when not exploded and nothing focused
    if (groupRef.current && !isExploded && focused === null) {
      groupRef.current.rotation.y += delta * 0.2
    }

    // Camera animation (zoom in / back out)
    const anim = cameraAnimRef.current
    if (anim.active && controls) {
      camera.position.lerp(anim.targetPos, delta * CAMERA_LERP_SPEED)
      controls.target.lerp(anim.targetLookAt, delta * CAMERA_LERP_SPEED)
      controls.update()

      // Detect back-home completion
      if (anim.returningHome && camera.position.distanceTo(anim.originalPos) < 0.05) {
        camera.position.copy(anim.originalPos)
        controls.target.copy(anim.originalTarget)
        controls.update()
        anim.active = false
        // Snap sub-meshes to original positions and clear focus
        if (focusedIdxRef.current !== null) {
          moduleStatesRef.current[focusedIdxRef.current].subMeshes.forEach(sm => {
            sm.obj.position.copy(sm.originalLocalPos)
          })
        }
        focusedIdxRef.current = null
        setFocusedModuleIndex(null)
      }
    }

    // Level-1 module explode
    const deltaMs = delta * 1000
    moduleStatesRef.current.forEach(s => {
      if (s.delayRemaining > 0) {
        s.delayRemaining = Math.max(0, s.delayRemaining - deltaMs)
        return
      }
      s.currentOffset = THREE.MathUtils.lerp(s.currentOffset, s.targetOffset, delta * LERP_SPEED)
      s.group.position.copy(s.radialDir).multiplyScalar(s.currentOffset)
    })

    // Level-2 sub-mesh spread (only for focused module)
    if (focused !== null) {
      moduleStatesRef.current[focused].subMeshes.forEach(sm => {
        sm.obj.position.lerp(sm.targetLocalPos, delta * LERP_SPEED)
      })
    }
  })
```

### Step 4: Replace the click handler

- [ ] **Replace the entire `handleClick` function:**

Find:
```typescript
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
```

Replace with:
```typescript
  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = (e: any) => {
    e.stopPropagation()

    // Level 0: trigger module explode if not yet exploded
    if (!isExploded) {
      setIsExploded(true)
      return
    }

    // Level 2: ignore mesh clicks while a module is already focused
    if (focusedIdxRef.current !== null) return

    const meshName: string = e.object.name || ''
    const modIdx = MACHINE3_MODULE_CONFIG.findIndex(m => m.meshNames.includes(meshName))

    if (modIdx !== -1) {
      const comp = machine.components.find(
        c => c.name.toLowerCase() === MACHINE3_MODULE_CONFIG[modIdx].label.toLowerCase()
      )
      if (comp) onComponentSelect(comp)
      focusModule(modIdx)
      return
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
```

### Step 5: Add Back button to JSX

- [ ] **Replace the closing JSX of `ModularMachineGLTFModel`:**

Find:
```tsx
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

Replace with:
```tsx
      {isExploded && setupDone && focusedModuleIndex === null && moduleStatesRef.current.map((s) => (
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
      {focusedModuleIndex !== null && setupDone && (() => {
        const s = moduleStatesRef.current[focusedModuleIndex]
        return (
          <Html
            position={[s.labelPos.x, s.labelPos.y + 0.3, s.labelPos.z]}
            center
          >
            <button
              onClick={handleBack}
              style={{
                background: 'rgba(15,23,42,0.9)',
                color: '#f1f5f9',
                border: '1px solid rgba(148,163,184,0.4)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              ← Back
            </button>
          </Html>
        )
      })()}
    </group>
  )
}
```

- [ ] **Final TypeScript check**

```bash
cd "c:/Users/User/Documents/ClaudeVHACK/AntiFault" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Start dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000`, navigate to **Hydraulic Press #2**.

Check:
1. Existing explode still works (Explode View button fans modules out with stagger)
2. Click any module while exploded → camera smoothly zooms to that module + its meshes spread into a line
3. "← Back" button appears near the focused module
4. Clicking Back → meshes return to cluster + camera smoothly returns to original position
5. Module labels disappear while a module is focused, reappear on Back
6. Machine1/2 explode unaffected

---

## Tuning Notes

| What looks wrong | Fix |
|---|---|
| Camera ends up inside the module | Increase `FOCUS_CAMERA_DIST` (try `2.5`) |
| Camera barely moves closer | Decrease `FOCUS_CAMERA_DIST` (try `1.0`) |
| Assembly-line meshes overlap | Increase `MESH_SPACING` (try `0.5`) |
| Assembly-line meshes too far apart | Decrease `MESH_SPACING` (try `0.2`) |
| Camera zoom feels too fast | Decrease `CAMERA_LERP_SPEED` (try `2`) |
| Back button is hard to find | Increase the `+ 0.3` Y offset on the Back button Html position |
