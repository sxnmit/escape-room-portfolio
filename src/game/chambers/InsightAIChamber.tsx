import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { CHAMBERS, KEYPAD_PUZZLE } from '@/data/resume'
import { SPOKES } from '@/game/world/layout'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

/**
 * Chamber IV — InsightAI · knowledge-base vault.
 *
 * Four wall-mounted retrieval monitors each show one digit of the access code
 * and its position; a glass "vector store" column hums off the corridor line
 * with shards orbiting it; PCB-style data traces run across the floor from the
 * column to every monitor, the keypad pedestal and two server towers in the
 * far corners; a sealed hatch waits on the far wall. Solving the keypad
 * cross-fades the whole room from violet to mint: monitors reboot into ✓,
 * packets speed up, the hatch rings spin and the pedestal LED turns green.
 *
 * Rendered inside the spoke's local frame: −z is away from the hub, the room
 * spans z ∈ [−7, −23] and x ∈ [−8, 8]. Every piece of on-screen copy comes
 * from KEYPAD_PUZZLE / CHAMBERS in src/data/resume.ts.
 */

const ACCENT = CHAMBERS.insightai.accent
const MINT = '#7cf5c4'
const RED = '#ff3b4a'
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif'
const MONO = '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'
const CODE = KEYPAD_PUZZLE.code
const CAPTIONS = KEYPAD_PUZZLE.monitorCaptions

// ── room plan (spoke-local) ──────────────────────────────────────────────────
const WALL_X = 7.7 // inner face of the side walls
const COLUMN = { x: -3.9, z: -14.4 }
const PEDESTAL_Z = SPOKES.insightai.puzzleAnchorLocal[2]
const TOWERS = [
  { x: -6.1, z: -21.7 },
  { x: 6.1, z: -21.7 },
]
/** Monitor i shows digit i of the code (position i + 1). Zig-zag reading order from the door. */
const MONITORS: { side: -1 | 1; z: number; y: number }[] = [
  { side: -1, z: -11.6, y: 2.35 },
  { side: 1, z: -11.6, y: 2.65 },
  { side: -1, z: -17.4, y: 2.7 },
  { side: 1, z: -17.4, y: 2.4 },
]
/** Frame centre stands this far off the wall face; a bracket bridges the gap behind it. */
const FRAME_OFF = 0.26
const SCREEN_W = 2.2
const SCREEN_H = 1.3

// ── shared geometry / materials (module-level so nothing is re-allocated) ────
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const shardGeo = new THREE.OctahedronGeometry(0.15, 0)
const darkMetal = new THREE.MeshStandardMaterial({ color: '#141826', roughness: 0.45, metalness: 0.55 })
const bezelMat = new THREE.MeshStandardMaterial({ color: '#0c0f18', roughness: 0.3, metalness: 0.65 })
const plateMat = new THREE.MeshStandardMaterial({ color: '#1f2537', roughness: 0.5, metalness: 0.45 })
const keyMat = new THREE.MeshStandardMaterial({ color: '#2a3149', roughness: 0.6, metalness: 0.2 })
const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
const packetMat = new THREE.MeshBasicMaterial({ color: '#f1ecff', toneMapped: false })
const scanMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.09, depthWrite: false, toneMapped: false })
/** Tinted materials: <Palette/> cross-fades these violet → mint when the chamber is solved. */
const glowMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2, toneMapped: false })
const coreMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.6, toneMapped: false })
const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(0.85), toneMapped: false })
const glassMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide })
const pointsMat = new THREE.PointsMaterial({ color: ACCENT, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })
const beamMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })

/** Solve progress shared by every part of the room (written once per frame by <Palette/>). */
const solveAnim = { v: 0, surge: 0 }

const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()

interface Item {
  p: [number, number, number]
  s?: [number, number, number]
  r?: [number, number, number]
  c?: string
}

/** Static instanced mesh built once from an item list. */
function Instanced({ geometry, material, items, castShadow, receiveShadow }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Item[]; castShadow?: boolean; receiveShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      tmpObj.position.set(...it.p)
      tmpObj.rotation.set(...(it.r ?? [0, 0, 0]))
      tmpObj.scale.set(...(it.s ?? [1, 1, 1]))
      tmpObj.updateMatrix()
      m.setMatrixAt(i, tmpObj.matrix)
      if (it.c) m.setColorAt(i, tmpColor.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />
}

export function InsightAIChamber() {
  const spoke = SPOKES.insightai
  const solved = useGame((s) => !!s.solved.insightai)
  // seed the shared solve progress before any child's first frame so a solved room never flashes violet
  useState(() => {
    solveAnim.v = solved ? 1 : 0
    return null
  })
  const [ax, ay, az] = spoke.puzzleAnchorLocal
  return (
    <group>
      <Palette solved={solved} />
      <Monitors solved={solved} />
      <VectorColumn />
      <EmbeddingCloud position={[4.6, 0, -13.4]} />
      <FloorTraces />
      <ServerTowers />
      <KeypadPedestal position={[ax, ay, az]} solved={solved} />
      <VaultHatch z={spoke.roomFarZ + 0.34} />
    </group>
  )
}

// ── Palette: one place that drives the violet → mint cross-fade ──────────────
function Palette({ solved }: { solved: boolean }) {
  const target = useMemo(() => new THREE.Color(ACCENT), [])
  useFrame((_, dt) => {
    easing.damp(solveAnim, 'v', solved ? 1 : 0, 0.6, dt)
    solveAnim.surge = Math.sin(Math.min(1, solveAnim.v) * Math.PI)
    target.set(solved ? MINT : ACCENT)
    easing.dampC(glowMat.emissive, target, 0.45, dt)
    glowMat.color.copy(glowMat.emissive)
    easing.dampC(coreMat.emissive, target, 0.45, dt)
    coreMat.color.copy(coreMat.emissive)
    easing.dampC(lineMat.color, target, 0.45, dt)
    easing.dampC(pointsMat.color, target, 0.45, dt)
    easing.dampC(glassMat.color, target, 0.45, dt)
    easing.dampC(beamMat.color, target, 0.45, dt)
  })
  return null
}

// ── Retrieval monitors ───────────────────────────────────────────────────────
/** One baked screen per monitor: header, big glyph, caption bar, grid + scanlines. */
function monitorTexture(index: number, solved: boolean): THREE.CanvasTexture {
  const W = 1024
  const H = 608
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  if (solved) {
    bg.addColorStop(0, '#0f5540')
    bg.addColorStop(1, '#052a20')
  } else {
    bg.addColorStop(0, '#4a2ea6')
    bg.addColorStop(1, '#201250')
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // faint grid
  ctx.strokeStyle = solved ? 'rgba(124,245,196,0.12)' : 'rgba(214,196,255,0.12)'
  ctx.lineWidth = 2
  for (let x = 32; x < W; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 32; y < H; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  // header
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = solved ? '#bff7e2' : '#dcd0ff'
  ctx.font = `700 34px ${SANS}`
  ctx.fillText(`${CHAMBERS.insightai.name.toUpperCase()} · RETRIEVAL MONITOR 0${index + 1}`, 44, 58)
  ctx.textAlign = 'right'
  ctx.fillStyle = solved ? MINT : '#ff9fb8'
  ctx.font = `800 30px ${SANS}`
  ctx.fillText(solved ? 'SYNCED' : '● LIVE', W - 44, 58)
  // the digit
  ctx.textAlign = 'center'
  ctx.shadowColor = solved ? MINT : '#d5c6ff'
  ctx.shadowBlur = 44
  ctx.fillStyle = solved ? MINT : '#ffffff'
  ctx.font = `900 ${solved ? 360 : 430}px ${SANS}`
  ctx.fillText(solved ? '✓' : CODE[index], W / 2, H / 2 + 12)
  ctx.shadowBlur = 0
  // caption bar
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillRect(0, H - 104, W, 104)
  ctx.fillStyle = solved ? '#dffff1' : '#f3eeff'
  ctx.font = `800 44px ${SANS}`
  ctx.fillText(`POSITION ${index + 1} · ${CAPTIONS[index].toUpperCase()}`, W / 2, H - 52)
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.17)'
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Screens tilt ~6° down toward the floor; the frame tilts with them (about the wall axis). */
const TILT = 0.14
const FRAME_ITEMS: Item[] = MONITORS.map((m) => ({ p: [m.side * (WALL_X - FRAME_OFF), m.y, m.z], s: [0.14, SCREEN_H + 0.3, SCREEN_W + 0.3], r: [0, 0, m.side * TILT] }))
const BRACKET_ITEMS: Item[] = MONITORS.map((m) => ({ p: [m.side * (WALL_X - FRAME_OFF / 2 + 0.06), m.y - 0.06, m.z], s: [FRAME_OFF + 0.1, 0.4, 0.5] }))
const STRIP_ITEMS: Item[] = MONITORS.map((m) => ({ p: [m.side * (WALL_X - FRAME_OFF - 0.02), m.y - SCREEN_H / 2 - 0.24, m.z], s: [0.03, 0.03, SCREEN_W + 0.1] }))

function Monitors({ solved }: { solved: boolean }) {
  const shown = useRef<boolean[]>(MONITORS.map(() => solved))
  const { mats, textures } = useMemo(() => {
    const textures = MONITORS.map((_, i) => ({ locked: monitorTexture(i, false), open: monitorTexture(i, true) }))
    const mats = textures.map((t, i) => {
      const tex = shown.current[i] ? t.open : t.locked
      return new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.05, toneMapped: false, map: tex, emissiveMap: tex })
    })
    return { mats, textures }
  }, [])
  const scanBars = useRef<(THREE.Mesh | null)[]>([])

  useEffect(
    () => () => {
      textures.forEach((t) => {
        t.locked.dispose()
        t.open.dispose()
      })
      mats.forEach((m) => m.dispose())
    },
    [textures, mats],
  )

  useFrame((st) => {
    const t = st.clock.elapsedTime
    const s = solveAnim.v
    // reboot: brightness dips to black at the midpoint of the transition, the texture swaps there, then surges back
    const dip = Math.abs(1 - 2 * s)
    const bump = Math.max(0, 1 - Math.abs(s - 0.68) * 7) * 0.9
    const wantOpen = s > 0.5
    for (let i = 0; i < MONITORS.length; i++) {
      const mat = mats[i]
      if (shown.current[i] !== wantOpen) {
        shown.current[i] = wantOpen
        const tex = wantOpen ? textures[i].open : textures[i].locked
        mat.map = tex
        mat.emissiveMap = tex
      }
      const flicker = 0.95 + Math.sin(t * 7.1 + i * 1.7) * 0.03 + Math.sin(t * 19.3 + i * 0.6) * 0.02 + (Math.random() - 0.5) * 0.035
      mat.emissiveIntensity = (1.2 + (wantOpen ? 0.2 : 0)) * flicker * (0.08 + 0.92 * dip) + bump
      const bar = scanBars.current[i]
      if (bar) bar.position.y = SCREEN_H / 2 - ((t * 0.45 + i * 0.37) % 1) * SCREEN_H
    }
  })

  return (
    <group>
      <Instanced geometry={unitBox} material={bezelMat} items={FRAME_ITEMS} castShadow />
      <Instanced geometry={unitBox} material={darkMetal} items={BRACKET_ITEMS} />
      <Instanced geometry={unitBox} material={glowMat} items={STRIP_ITEMS} />
      {MONITORS.map((m, i) => (
        <group key={i} position={[m.side * (WALL_X - FRAME_OFF), m.y, m.z]} rotation-y={-m.side * (Math.PI / 2)}>
          {/* pivot matches the frame's centre so screen and bezel tilt together */}
          <group rotation-x={TILT}>
            <mesh material={mats[i]} position={[0, 0, 0.076]}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            </mesh>
            <mesh
              ref={(el) => {
                scanBars.current[i] = el
              }}
              position={[0, 0, 0.08]}
              material={scanMat}
            >
              <planeGeometry args={[SCREEN_W, 0.06]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

// ── Vector-store column ──────────────────────────────────────────────────────
const SHARDS = [
  { r: 1.05, h: 1.15, speed: 0.55, phase: 0.0, tilt: 0.16 },
  { r: 1.35, h: 1.75, speed: -0.4, phase: 2.1, tilt: -0.22 },
  { r: 1.2, h: 2.4, speed: 0.7, phase: 4.0, tilt: 0.12 },
  { r: 1.48, h: 2.95, speed: -0.3, phase: 1.0, tilt: 0.26 },
  { r: 0.95, h: 3.35, speed: 0.9, phase: 3.2, tilt: -0.1 },
  { r: 1.4, h: 0.75, speed: 0.45, phase: 5.2, tilt: 0.3 },
]
const RINGS = [
  { y: 1.05, r: 0.8, tilt: 0.3, speed: 0.5 },
  { y: 1.95, r: 0.94, tilt: -0.24, speed: -0.35 },
  { y: 2.85, r: 0.8, tilt: 0.36, speed: 0.65 },
]
const pointsGeo = (() => {
  const N = 340
  const arr = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt(Math.random()) * 0.52
    const a = Math.random() * Math.PI * 2
    arr[i * 3] = Math.cos(a) * r
    arr[i * 3 + 1] = (Math.random() - 0.5) * 2.7
    arr[i * 3 + 2] = Math.sin(a) * r
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return g
})()

function VectorColumn() {
  const shards = useRef<THREE.InstancedMesh>(null)
  const rings = useRef<(THREE.Group | null)[]>([])
  const points = useRef<THREE.Points>(null)
  const light = useRef<THREE.PointLight>(null)
  const lightTarget = useMemo(() => new THREE.Color(ACCENT), [])

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    const s = solveAnim.v
    const surge = solveAnim.surge
    const speedMul = 1 + surge * 5 + s * 0.4
    if (shards.current) {
      SHARDS.forEach((sh, i) => {
        const a = sh.phase + t * sh.speed * speedMul
        tmpObj.position.set(Math.cos(a) * sh.r, sh.h + Math.sin(t * 1.4 + sh.phase) * 0.1 + Math.sin(a) * sh.tilt, Math.sin(a) * sh.r)
        tmpObj.rotation.set(t * 1.2 + sh.phase, t * 0.8 + i, 0)
        const sc = 1 + surge * 0.6 + (s > 0.9 ? Math.max(0, Math.sin(t * 3 + i)) * 0.15 : 0)
        tmpObj.scale.setScalar(sc)
        tmpObj.updateMatrix()
        shards.current!.setMatrixAt(i, tmpObj.matrix)
      })
      shards.current.instanceMatrix.needsUpdate = true
    }
    rings.current.forEach((g, i) => {
      if (g) g.rotation.y = t * RINGS[i].speed * speedMul
    })
    if (points.current) {
      points.current.rotation.y = t * 0.25 * (1 + surge * 3)
      points.current.position.y = 1.95 + Math.sin(t * 0.8) * 0.04
    }
    coreMat.emissiveIntensity = 1.5 + Math.sin(t * 2.1) * 0.35 + surge * 2.5
    if (light.current) {
      lightTarget.set(s > 0.5 ? MINT : ACCENT)
      easing.dampC(light.current.color, lightTarget, 0.45, dt)
      light.current.intensity = 6 + Math.sin(t * 2.1) * 1.2 + surge * 10
    }
  })

  return (
    <group position={[COLUMN.x, 0, COLUMN.z]}>
      {/* base */}
      <mesh position-y={0.14} material={darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.28, 32]} />
      </mesh>
      <mesh position-y={0.285} rotation-x={-Math.PI / 2} material={glowMat}>
        <torusGeometry args={[0.7, 0.025, 8, 48]} />
      </mesh>
      {/* glowing core + glass shell with the embedding cloud inside */}
      <mesh position-y={1.95} material={coreMat}>
        <cylinderGeometry args={[0.24, 0.24, 3.05, 24]} />
      </mesh>
      <points ref={points} geometry={pointsGeo} material={pointsMat} position-y={1.95} renderOrder={1} />
      <mesh position-y={1.95} material={glassMat} renderOrder={2}>
        <cylinderGeometry args={[0.62, 0.62, 2.95, 32, 1, true]} />
      </mesh>
      {/* cap */}
      <mesh position-y={3.55} material={darkMetal} castShadow>
        <cylinderGeometry args={[0.7, 0.62, 0.22, 32]} />
      </mesh>
      <mesh position-y={3.67} rotation-x={-Math.PI / 2} material={glowMat}>
        <torusGeometry args={[0.5, 0.02, 8, 40]} />
      </mesh>
      {/* index rings */}
      {RINGS.map((r, i) => (
        <group
          key={i}
          ref={(el) => {
            rings.current[i] = el
          }}
          position-y={r.y}
        >
          <mesh rotation-x={Math.PI / 2 + r.tilt} material={glowMat}>
            <torusGeometry args={[r.r, 0.028, 8, 56]} />
          </mesh>
        </group>
      ))}
      {/* orbiting shards */}
      <instancedMesh ref={shards} args={[shardGeo, glowMat, SHARDS.length]} />
      <TextPlane text={CAPTIONS[2].toUpperCase()} size={[2.0, 0.22]} position={[0, 4.0, 0]} width={1024} height={112} font={`800 72px ${SANS}`} color="#e9e2ff" glow={10} />
      <pointLight ref={light} position={[0, 2.3, 0]} color={ACCENT} intensity={6} distance={9.5} decay={2} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.85, 1.0]} position={[0, 1.85, 0]} />
      </RigidBody>
    </group>
  )
}

// ── Embedding-index projector: a hovering point cloud on the right of the room ──
const cloudGeo = (() => {
  const N = 240
  const arr = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = Math.cbrt(Math.random()) * 0.72
    const u = Math.random() * 2 - 1
    const a = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    arr[i * 3] = Math.cos(a) * s * r
    arr[i * 3 + 1] = u * r * 0.8
    arr[i * 3 + 2] = Math.sin(a) * s * r
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return g
})()

function EmbeddingCloud({ position }: { position: [number, number, number] }) {
  const pts = useRef<THREE.Points>(null)
  const beam = useRef<THREE.Mesh>(null)
  useFrame((st) => {
    const t = st.clock.elapsedTime
    const surge = solveAnim.surge
    if (pts.current) {
      pts.current.rotation.y = t * 0.35 * (1 + surge * 4)
      pts.current.rotation.x = Math.sin(t * 0.5) * 0.22
      pts.current.position.y = 1.55 + Math.sin(t * 1.1) * 0.06
      pts.current.scale.setScalar(1 + Math.sin(t * 1.7) * 0.05 + surge * 0.5)
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.06 + Math.sin(t * 2.7) * 0.015 + surge * 0.08
  })
  return (
    <group position={position}>
      <mesh position-y={0.1} material={darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.58, 0.2, 28]} />
      </mesh>
      <mesh position-y={0.21} rotation-x={-Math.PI / 2} material={glowMat}>
        <torusGeometry args={[0.38, 0.022, 8, 40]} />
      </mesh>
      <mesh ref={beam} position-y={1.0} material={beamMat}>
        <cylinderGeometry args={[0.74, 0.14, 1.6, 24, 1, true]} />
      </mesh>
      <points ref={pts} geometry={cloudGeo} material={pointsMat} position-y={1.55} />
      <TextPlane text={CAPTIONS[1].toUpperCase()} size={[2.0, 0.22]} position={[0, 2.55, 0]} width={1024} height={112} font={`800 72px ${SANS}`} color="#e9e2ff" glow={10} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.15, 0.6]} position={[0, 0.15, 0]} />
      </RigidBody>
    </group>
  )
}

// ── Floor data traces (PCB-style, with packets flowing outward from the column) ──
type P2 = [number, number]
const C0: P2 = [COLUMN.x, COLUMN.z]
const BUS_Z = -19.0
const RISER_X = 2.4
const TRACES: P2[][] = [
  [C0, [C0[0], MONITORS[0].z], [-WALL_X + 0.12, MONITORS[0].z]],
  [C0, [RISER_X, C0[1]], [RISER_X, MONITORS[1].z], [WALL_X - 0.12, MONITORS[1].z]],
  [C0, [C0[0], MONITORS[2].z], [-WALL_X + 0.12, MONITORS[2].z]],
  [C0, [RISER_X, C0[1]], [RISER_X, MONITORS[3].z], [WALL_X - 0.12, MONITORS[3].z]],
  [C0, [C0[0], BUS_Z], [0, BUS_Z], [0, PEDESTAL_Z + 0.4]],
  [[0, BUS_Z], [TOWERS[0].x, BUS_Z], [TOWERS[0].x, TOWERS[0].z + 0.55]],
  [[0, BUS_Z], [TOWERS[1].x, BUS_Z], [TOWERS[1].x, TOWERS[1].z + 0.55]],
]
const LINE_Y = 0.026
const LINE_W = 0.06
const PACKETS_PER_TRACE = 2
const packetGeo = new THREE.BoxGeometry(1, 0.008, 0.075)

const LINE_ITEMS: Item[] = (() => {
  const seen = new Set<string>()
  const items: Item[] = []
  for (const poly of TRACES) {
    for (let i = 0; i < poly.length - 1; i++) {
      const [ax, az] = poly[i]
      const [bx, bz] = poly[i + 1]
      const key = [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)].map((n) => n.toFixed(2)).join(',')
      if (seen.has(key)) continue
      seen.add(key)
      const len = Math.hypot(bx - ax, bz - az)
      items.push({ p: [(ax + bx) / 2, LINE_Y, (az + bz) / 2], s: [len + LINE_W, 0.006, LINE_W], r: [0, Math.atan2(-(bz - az), bx - ax), 0] })
    }
  }
  return items
})()
const PAD_ITEMS: Item[] = (() => {
  const seen = new Set<string>()
  const items: Item[] = []
  for (const poly of TRACES) {
    poly.forEach((pt, i) => {
      if (i === 0 && pt === C0) return
      const key = `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`
      if (seen.has(key)) return
      seen.add(key)
      items.push({ p: [pt[0], LINE_Y + 0.002, pt[1]], s: [0.17, 0.008, 0.17] })
    })
  }
  return items
})()
/** Per-trace cumulative lengths so packets can be placed by arc length. */
const TRACE_LEN = TRACES.map((poly) => {
  const cum = [0]
  for (let i = 0; i < poly.length - 1; i++) cum.push(cum[i] + Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]))
  return cum
})

function FloorTraces() {
  const packets = useRef<THREE.InstancedMesh>(null)
  const target = useMemo(() => new THREE.Color('#f1ecff'), [])
  useFrame((st, dt) => {
    const m = packets.current
    if (!m) return
    const t = st.clock.elapsedTime
    const s = solveAnim.v
    const speed = 1.7 + s * 1.8 + solveAnim.surge * 6
    target.set(s > 0.5 ? '#d9fff0' : '#f1ecff')
    easing.dampC(packetMat.color, target, 0.4, dt)
    let k = 0
    for (let j = 0; j < TRACES.length; j++) {
      const poly = TRACES[j]
      const cum = TRACE_LEN[j]
      const len = cum[cum.length - 1]
      for (let p = 0; p < PACKETS_PER_TRACE; p++) {
        const u = (((t * speed) / len + p / PACKETS_PER_TRACE + j * 0.19) % 1 + 1) % 1
        const d = u * len
        let i = 0
        while (i < cum.length - 2 && d > cum[i + 1]) i++
        const [ax, az] = poly[i]
        const [bx, bz] = poly[i + 1]
        const segLen = cum[i + 1] - cum[i] || 1
        const f = (d - cum[i]) / segLen
        tmpObj.position.set(ax + (bx - ax) * f, LINE_Y + 0.004, az + (bz - az) * f)
        tmpObj.rotation.set(0, Math.atan2(-(bz - az), bx - ax), 0)
        const fade = 0.45 + Math.sin(u * Math.PI) * 0.55
        tmpObj.scale.set(0.34 * fade, 1, 1)
        tmpObj.updateMatrix()
        m.setMatrixAt(k++, tmpObj.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <Instanced geometry={unitBox} material={lineMat} items={LINE_ITEMS} />
      <Instanced geometry={unitBox} material={lineMat} items={PAD_ITEMS} />
      <instancedMesh ref={packets} args={[packetGeo, packetMat, TRACES.length * PACKETS_PER_TRACE]} />
    </group>
  )
}

// ── Server towers in the far corners ─────────────────────────────────────────
const TOWER_UNITS = 7
const LEDS_PER_UNIT = 5
const TOWER_LED_COUNT = TOWERS.length * TOWER_UNITS * LEDS_PER_UNIT
const CABINET_ITEMS: Item[] = TOWERS.map((t) => ({ p: [t.x, 1.45, t.z], s: [1.3, 2.9, 1.0] }))
const TOWER_STRIP_ITEMS: Item[] = TOWERS.flatMap<Item>((t) => [
  { p: [t.x, 2.92, t.z + 0.5], s: [1.26, 0.03, 0.03] },
  { p: [t.x, 0.06, t.z + 0.5], s: [1.26, 0.03, 0.03] },
  { p: [t.x - 0.63, 1.49, t.z + 0.5], s: [0.025, 2.84, 0.025] },
  { p: [t.x + 0.63, 1.49, t.z + 0.5], s: [0.025, 2.84, 0.025] },
])
const TOWER_PLATE_ITEMS: Item[] = TOWERS.flatMap<Item>((t) => Array.from({ length: TOWER_UNITS }, (_, u) => ({ p: [t.x, 0.42 + u * 0.34, t.z + 0.52], s: [1.14, 0.26, 0.05] })))
const towerPlateMat = new THREE.MeshStandardMaterial({ color: '#2a3148', roughness: 0.45, metalness: 0.5 })
const TOWER_LED_ITEMS: Item[] = TOWERS.flatMap<Item>((t) =>
  Array.from({ length: TOWER_UNITS }, (_, u) =>
    Array.from({ length: LEDS_PER_UNIT }, (_, k): Item => ({ p: [t.x - 0.44 + k * 0.075, 0.42 + u * 0.34, t.z + 0.555], s: [0.04, 0.04, 0.02], c: '#2a1a5e' })),
  ).flat(),
)

function ServerTowers() {
  const leds = useRef<THREE.InstancedMesh>(null)
  const nextFlip = useMemo(() => new Float32Array(TOWER_LED_COUNT), [])
  useLayoutEffect(() => {
    const m = leds.current
    if (!m) return
    TOWER_LED_ITEMS.forEach((it, i) => {
      tmpObj.position.set(...it.p)
      tmpObj.rotation.set(0, 0, 0)
      tmpObj.scale.set(...(it.s ?? [1, 1, 1]))
      tmpObj.updateMatrix()
      m.setMatrixAt(i, tmpObj.matrix)
      m.setColorAt(i, tmpColor.set(it.c ?? '#ffffff'))
      nextFlip[i] = Math.random() * 1.5
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [nextFlip])

  useFrame((st) => {
    const m = leds.current
    if (!m) return
    const t = st.clock.elapsedTime
    const s = solveAnim.v
    const busy = s > 0.02 && s < 0.98
    let changed = false
    for (let i = 0; i < TOWER_LED_COUNT; i++) {
      if (t < nextFlip[i]) continue
      nextFlip[i] = t + (busy ? 0.06 + Math.random() * 0.2 : 0.2 + Math.random() * 1.7)
      const r = Math.random()
      if (Math.random() < s) {
        if (r < 0.5) tmpColor.setRGB(0.1, 0.5, 0.35)
        else if (r < 0.93) tmpColor.setRGB(0.4, 1.8, 1.15)
        else tmpColor.setRGB(1.2, 2.0, 1.6)
      } else {
        if (r < 0.5) tmpColor.setRGB(0.22, 0.14, 0.5)
        else if (r < 0.86) tmpColor.setRGB(1.1, 0.85, 2.0)
        else if (r < 0.95) tmpColor.setRGB(0.5, 1.6, 2.0)
        else tmpColor.setRGB(2.0, 0.3, 0.5)
      }
      m.setColorAt(i, tmpColor)
      changed = true
    }
    if (changed && m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <Instanced geometry={unitBox} material={darkMetal} items={CABINET_ITEMS} castShadow receiveShadow />
      <Instanced geometry={unitBox} material={towerPlateMat} items={TOWER_PLATE_ITEMS} />
      <Instanced geometry={unitBox} material={glowMat} items={TOWER_STRIP_ITEMS} />
      <instancedMesh ref={leds} args={[unitBox, ledMat, TOWER_LED_COUNT]} />
      <RigidBody type="fixed" colliders={false}>
        {TOWERS.map((t, i) => (
          <CuboidCollider key={i} args={[0.68, 1.45, 0.53]} position={[t.x, 1.45, t.z]} />
        ))}
      </RigidBody>
    </group>
  )
}

// ── Keypad pedestal (the interactable) ───────────────────────────────────────
const PAD_KEY_ITEMS: Item[] = Array.from({ length: 12 }, (_, i): Item => ({ p: [-0.16 + (i % 3) * 0.16, 0.06 - Math.floor(i / 3) * 0.155, 0.04], s: [0.12, 0.115, 0.024] }))

function KeypadPedestal({ position, solved }: { position: [number, number, number]; solved: boolean }) {
  const anchor = useRef<THREE.Group>(null)
  const led = useRef<THREE.MeshBasicMaterial>(null)
  const halo = useRef<THREE.MeshBasicMaterial>(null)
  const displayMat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const ledTarget = useMemo(() => new THREE.Color(RED), [])
  const ledBase = useMemo(() => new THREE.Color(RED), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }), [])

  const near = useInteractable(
    {
      id: 'console:insightai',
      radius: 2.6,
      prompt: solved ? 'Keypad · unlocked' : 'Use keypad',
      onInteract: () => {
        sfx.play('ui')
        useGame.getState().openOverlay({ kind: 'puzzle', chamber: 'insightai' })
      },
    },
    anchor,
  )

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    const s = solveAnim.v
    const surge = solveAnim.surge
    ledTarget.set(s > 0.5 ? MINT : RED)
    easing.dampC(ledBase, ledTarget, 0.3, dt)
    if (led.current) {
      // locked: slow red breathing; unlocked: steady bright green (blooms)
      const blink = s > 0.5 ? 1 : 0.55 + Math.max(0, Math.sin(t * 2.6)) * 0.45
      led.current.color.copy(ledBase).multiplyScalar(1 + blink * 1.4)
    }
    if (halo.current) {
      easing.dampC(halo.current.color, ledTarget, 0.3, dt)
      halo.current.opacity = s > 0.5 ? 0.35 : 0.12 + Math.max(0, Math.sin(t * 2.6)) * 0.22
    }
    if (displayMat.current) {
      easing.dampC(displayMat.current.emissive, ledTarget, 0.3, dt)
      displayMat.current.emissiveIntensity = 0.35 + surge * 1.5 + (near ? 0.15 : 0)
    }
    if (light.current) {
      easing.dampC(light.current.color, ringMat.color, 0.3, dt)
      light.current.intensity = 2.2 + (near ? 1.2 : 0) + surge * 6
    }
    easing.dampC(ringMat.color, s > 0.5 ? ledTarget : glowMat.emissive, 0.3, dt)
    if (ring.current) {
      const p = near ? 0.6 + Math.sin(t * 5) * 0.2 : s > 0.5 ? 0.35 : 0.2
      easing.damp(ringMat, 'opacity', p, 0.15, dt)
      ring.current.scale.setScalar(near ? 1 + Math.sin(t * 5) * 0.04 : 1)
    }
  })

  return (
    <group position={position}>
      {/* interaction spot in front of the pedestal */}
      <group ref={anchor} position={[0, 0, 1.3]} />
      <mesh ref={ring} position={[0, 0.03, 1.3]} rotation-x={-Math.PI / 2} material={ringMat}>
        <ringGeometry args={[0.68, 0.82, 48]} />
      </mesh>

      {/* foot + stem */}
      <mesh position={[0, 0.04, 0]} material={bezelMat} receiveShadow>
        <boxGeometry args={[0.76, 0.08, 0.6]} />
      </mesh>
      <mesh position={[0, 0.56, -0.04]} material={darkMetal} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.98, 0.3]} />
      </mesh>
      <mesh position={[0, 0.56, 0.115]} material={glowMat}>
        <boxGeometry args={[0.03, 0.9, 0.012]} />
      </mesh>

      {/* angled plate with the keypad pattern */}
      <group position={[0, 1.1, 0.06]} rotation-x={-0.62}>
        <mesh material={plateMat} castShadow>
          <boxGeometry args={[0.66, 0.9, 0.06]} />
        </mesh>
        {/* status display */}
        <mesh position={[-0.05, 0.31, 0.032]}>
          <planeGeometry args={[0.42, 0.13]} />
          <meshStandardMaterial ref={displayMat} color="#04060c" emissive={RED} emissiveIntensity={0.35} roughness={0.3} toneMapped={false} />
        </mesh>
        <TextPlane text={solved ? 'OPEN' : 'LOCKED'} size={[0.4, 0.1]} position={[-0.05, 0.31, 0.036]} width={512} height={128} font={`bold 84px ${MONO}`} color={solved ? MINT : '#ffb3ba'} glow={10} />
        {/* status LED + halo */}
        <mesh position={[0.24, 0.31, 0.04]}>
          <sphereGeometry args={[0.028, 12, 10]} />
          <meshBasicMaterial ref={led} color={RED} toneMapped={false} />
        </mesh>
        <mesh position={[0.24, 0.31, 0.036]}>
          <circleGeometry args={[0.07, 20]} />
          <meshBasicMaterial ref={halo} color={RED} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
        <Instanced geometry={unitBox} material={keyMat} items={PAD_KEY_ITEMS} />
      </group>

      <pointLight ref={light} position={[0, 1.7, 0.9]} color={ACCENT} intensity={2.2} distance={6} decay={2} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 0.75, 0.34]} position={[0, 0.75, 0]} />
      </RigidBody>
    </group>
  )
}

// ── Sealed hatch on the far wall ─────────────────────────────────────────────
const HATCH_RINGS = [
  { r: 1.42, speed: 0.12, tube: 0.035 },
  { r: 1.02, speed: -0.2, tube: 0.03 },
  { r: 0.64, speed: 0.32, tube: 0.026 },
]
const HATCH_NOTCH_ITEMS: Item[] = Array.from({ length: 8 }, (_, i): Item => {
  const a = (i / 8) * Math.PI * 2
  return { p: [Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0.06], s: [0.06, 0.2, 0.03], r: [0, 0, a] }
})

function VaultHatch({ z }: { z: number }) {
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const core = useRef<THREE.MeshStandardMaterial>(null)
  const coreTarget = useMemo(() => new THREE.Color(ACCENT), [])
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    const s = solveAnim.v
    const surge = solveAnim.surge
    rings.current.forEach((m, i) => {
      if (m) m.rotation.z = t * HATCH_RINGS[i].speed * (1 + surge * 8 + s * 0.6)
    })
    if (core.current) {
      coreTarget.set(s > 0.5 ? MINT : ACCENT)
      easing.dampC(core.current.emissive, coreTarget, 0.45, dt)
      core.current.color.copy(core.current.emissive)
      core.current.emissiveIntensity = 0.9 + Math.sin(t * 1.8) * 0.25 + s * 1.2 + surge * 3
    }
  })
  return (
    <group position={[0, 2.05, z]}>
      <mesh rotation-x={Math.PI / 2} material={darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 0.1, 48]} />
      </mesh>
      <mesh position-z={0.05} rotation-x={Math.PI / 2} material={bezelMat}>
        <cylinderGeometry args={[1.5, 1.5, 0.04, 48]} />
      </mesh>
      {HATCH_RINGS.map((r, i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el
          }}
          position-z={0.09}
          material={glowMat}
        >
          <torusGeometry args={[r.r, r.tube, 8, 64, Math.PI * 1.7]} />
        </mesh>
      ))}
      <Instanced geometry={unitBox} material={plateMat} items={HATCH_NOTCH_ITEMS} />
      <mesh position-z={0.08}>
        <circleGeometry args={[0.42, 40]} />
        <meshStandardMaterial ref={core} color={ACCENT} emissive={ACCENT} emissiveIntensity={0.9} roughness={0.3} toneMapped={false} />
      </mesh>
      {/* signage */}
      <TextPlane text={CHAMBERS.insightai.name.toUpperCase()} size={[3.6, 0.5]} position={[0, 1.95, 0.02]} width={1024} height={160} font={`900 118px ${SANS}`} color="#f4f0ff" glow={12} />
      <TextPlane text={CHAMBERS.insightai.theme.toUpperCase()} size={[5.6, 0.24]} position={[0, 1.6, 0.02]} width={1536} height={72} font={`600 44px ${SANS}`} color="#c9bcff" />
      <mesh position={[0, 1.46, 0.02]} material={glowMat}>
        <boxGeometry args={[5.8, 0.025, 0.025]} />
      </mesh>
    </group>
  )
}
