# Machine3 Module Grouping — Design Spec
_Date: 2026-04-20_

## Overview

Add module-level grouping to the Hydraulic Press #2 (machine3.glb) 3D detail view. Parts belonging to the same module explode as one rigid cluster with a radial direction and 70ms stagger between modules. Floating labels identify each module by name. Data model is updated so machine3's components align with the 7 physical modules.

---

## 1. Data Model (`lib/data.ts`)

Replace the current machine3 `components` array (Hydraulic Cylinder, Pump Assembly, Valve Block, Pressure Sensor) with the 7 modules that match the actual GLB mesh groupings:

| id | name | initial status |
|----|------|---------------|
| m3-motor | Motor Assembly | healthy (health: 78) |
| m3-coupling | Coupling | healthy |
| m3-bearing | Bearing Assembly | degraded |
| m3-casing | Pump Casing | healthy |
| m3-rotor | Rotor Assembly | failing |
| m3-sealing | Sealing System | degraded |
| m3-wear | Wear Parts | degraded |

These become the single source of truth for component cards, health gauges, and Neo's fault reports.

---

## 2. MODULE_CONFIG (`components/machine-viewer-3d.tsx`)

A typed config array scoped to machine3. Array order defines stagger order (index 0 explodes first).

```ts
const MACHINE3_MODULE_CONFIG = [
  {
    id: 'motor',
    label: 'Motor Assembly',
    meshNames: [
      'Motor_Frame','Motor_Stator','Motor_Rotor','Motor_Shaft',
      'Motor_EndShield_DE','Motor_EndShield_NDE','Motor_Fan','Motor_Fan_Cover',
      'Motor_Terminal_Box','Motor_Terminal_Box_Lid','Motor_Bearing_DE',
      'Motor_Bearing_NDE','Motor_Bearing_Cover_DE','Motor_Bearing_Cover_NDE',
      'Motor_Feet','Motor_Lifting_Eye','Motor_Nameplate',
      // GRP_Motor omitted — empty group node, no geometry
    ],
  },
  {
    id: 'coupling',
    label: 'Coupling',
    meshNames: ['Coupling_Hub_Pump','Coupling_Hub_Motor','Coupling_Element','Coupling_Guard'],
    // GRP_Coupling omitted — empty group node, no geometry
  },
  {
    id: 'bearing',
    label: 'Bearing Assembly',
    meshNames: ['Bearing_DE','Bearing_NDE','Bearing_Housing','Bearing_Cover_DE'],
  },
  {
    id: 'casing',
    label: 'Pump Casing',
    meshNames: ['Casing_Volute','Casing_Cover_Rear','Casing_Pipe_Clamp'],
  },
  {
    id: 'rotor',
    label: 'Rotor Assembly',
    meshNames: ['Rotor_Impeller','Rotor_Shaft','Rotor_Shaft_Key'],
  },
  {
    id: 'sealing',
    label: 'Sealing System',
    meshNames: ['Seal_Packing_Rings','Seal_Gland','Seal_Lantern_Ring'],
  },
  {
    id: 'wear',
    label: 'Wear Parts',
    meshNames: [
      'Wear_Ring_001','Wear_Ring_002','Wear_Ring_003',
      'Wear_Ring_004','Wear_Ring_005','Wear_Ring_006',
    ],
  },
]
```

**Fixed parts (not listed = stay in place):**
- `GRP_Base_Support`, `Centrifugal_Pump_Assembly`
- All 22 `Base_Fastener_*` meshes

---

## 3. New Component: `ModularMachineGLTFModel`

A self-contained React Three Fiber component that replaces `MachineGLTFModel` for machine3 only.

### Responsibilities
- Load machine3.glb via `useGLTF`
- Ignore any baked GLB animations (do not call `useAnimations` actions)
- On scene ready: traverse scene graph, build a mesh registry keyed by mesh name
- Compute per-module centroid and machine center point
- Animate via `useFrame` lerp with stagger delay
- Render `<Html>` labels at module centroids when exploded

### Scene Setup (once, on mount)
```
for each mesh in GLTF scene (traverse):
  find matching module in MACHINE3_MODULE_CONFIG by meshName
  store: { mesh, originalPosition: mesh.position.clone(), moduleIndex }

for each module:
  centroid = average(originalPositions of member meshes)
  radialDir = normalize(centroid - machineCenter)
  explodeTarget = radialDir * EXPLODE_DISTANCE   // EXPLODE_DISTANCE ≈ 1.2 units
```

### Animation State (useRef, not useState — no re-renders)
```
moduleState[i] = {
  currentOffset: Vector3(0,0,0),
  targetOffset:  Vector3(0,0,0),
  delayTimer:    number,          // countdown ms before lerp starts
  active:        boolean,
}
```

### useFrame tick
```
each frame (delta in seconds):
  for each module i:
    if delayTimer[i] > 0:
      delayTimer[i] -= delta * 1000
      skip lerp this frame
    else:
      currentOffset[i].lerp(targetOffset[i], delta * LERP_SPEED)  // LERP_SPEED = 8
      for each mesh in module i:
        mesh.position = originalPosition + currentOffset[i]
```

### Explode Toggle
```
when isExploded changes to true:
  for each module i:
    delayTimer[i] = i * 70          // ms
    targetOffset[i] = radialDir[i] * EXPLODE_DISTANCE

when isExploded changes to false:
  for each module i (reverse order for reassemble stagger):
    delayTimer[i] = (moduleCount - 1 - i) * 70
    targetOffset[i] = Vector3(0,0,0)
```

### Labels
- One `<Html>` per module, anchored at `moduleCentroid + Vector3(0, 0.15, 0)`
- Visible only when `isExploded === true`
- Style: small dark pill, white text, `pointer-events: none`
- Text: `module.label`

---

## 4. Integration in `machine-viewer-3d.tsx`

In the render branch where `MachineGLTFModel` is currently used, detect machine3:

```tsx
{modelUrl.includes('machine3')
  ? <ModularMachineGLTFModel modelUrl={modelUrl} isExploded={isExploded} ... />
  : <MachineGLTFModel modelUrl={modelUrl} isExploded={isExploded} ... />
}
```

`MachineGLTFModel` (machine1, machine2) is **not modified**.

---

## 5. Constants (tunable)

| Constant | Value | Purpose |
|---|---|---|
| `EXPLODE_DISTANCE` | `1.2` | How far each module flies from center (units) |
| `LERP_SPEED` | `8` | Smoothing speed (higher = snappier) |
| `STAGGER_MS` | `70` | Delay between each module starting its explode |

---

## 6. Files Changed

| File | Change |
|---|---|
| `lib/data.ts` | Replace machine3 components (4 items → 7 modules) |
| `components/machine-viewer-3d.tsx` | Add `MACHINE3_MODULE_CONFIG`, new `ModularMachineGLTFModel` component, render branch |

No new files, no new dependencies.

---

## 7. Out of Scope

- Machine1 / Machine2 are not changed
- No health status colour on labels (name only)
- No click-to-select on labels (existing mesh-click handler is unchanged)
