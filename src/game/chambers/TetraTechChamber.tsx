import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CHAMBERS } from '@/data/resume'
import { SPOKES } from '@/game/world/layout'
import { useGame } from '@/state/gameStore'
import { TextPlane } from '@/utils/TextPlane'
import { PuzzleConsole } from './PuzzleConsole'
import { BlocksPuzzle } from '@/game/puzzles3d/BlocksPuzzle'

/**
 * Chamber III — Tetra Tech · engineering workshop / automation floor.
 * A conveyor runs along the left wall, workbenches and a tooling board line
 * the right wall, the far wall carries a spreadsheet monitor bank and a
 * shelving unit, pipes run along the ceiling line. The crates & pads puzzle
 * (BlocksPuzzle) owns the centre of the room. Rendered inside the spoke's
 * local frame: −z away from the hub, x ∈ [−8, 8], z ∈ [−7, −23].
 */

const C = CHAMBERS.tetratech
const ACCENT = C.accent
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif'
const MONO = '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'

// ── shared geometry / materials ──────────────────────────────────────────────
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14)
const unitTorus = new THREE.TorusGeometry(1, 0.16, 8, 20)
const darkMetal = new THREE.MeshStandardMaterial({ color: '#151a28', roughness: 0.45, metalness: 0.6 })
const benchTopMat = new THREE.MeshStandardMaterial({ color: '#3b4358', roughness: 0.4, metalness: 0.55 })
const shelfMat = new THREE.MeshStandardMaterial({ color: '#232a3c', roughness: 0.5, metalness: 0.5 })
const slabMat = new THREE.MeshStandardMaterial({ color: '#1a1f2c', roughness: 0.6, metalness: 0.4 })
const railMat = new THREE.MeshStandardMaterial({ color: '#4a5268', roughness: 0.35, metalness: 0.75 })
const pipeMat = new THREE.MeshStandardMaterial({ color: '#333b50', roughness: 0.35, metalness: 0.75 })
const valveMat = new THREE.MeshStandardMaterial({ color: '#c2432f', roughness: 0.5, metalness: 0.3 })
const boxMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0.05 })
const panelMat = new THREE.MeshStandardMaterial({ color: '#0d1019', roughness: 0.35, metalness: 0.5 })
const accentGlowMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2, toneMapped: false })
const screenGlowMat = new THREE.MeshStandardMaterial({ color: '#8fd3ff', emissive: '#8fd3ff', emissiveIntensity: 1.4, toneMapped: false })

interface Item {
  p: [number, number, number]
  s?: [number, number, number]
  r?: [number, number, number]
  c?: string
}
const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()

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

// ── room plan ────────────────────────────────────────────────────────────────
const BELT = { x: -6.55, z: -15.3, len: 12.6, w: 1.3 }
const BENCH_Z = [-10.6, -14.4]
const BENCH_X = 7.05
const SHELF = { x: 5.2, z: -22.2, w: 3.0, d: 0.7 }
const MONITOR = { x: -4.6, z: -22.62, y: 2.55 }

const BENCH_ITEMS = (() => {
  const tops: Item[] = []
  const legs: Item[] = []
  const stuff: Item[] = []
  for (const z of BENCH_Z) {
    tops.push({ p: [BENCH_X, 0.9, z], s: [0.9, 0.08, 2.8] })
    tops.push({ p: [BENCH_X, 0.32, z], s: [0.8, 0.04, 2.7], c: '#2b3247' })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push({ p: [BENCH_X + sx * 0.38, 0.45, z + sz * 1.3], s: [0.07, 0.9, 0.07] })
  }
  // clutter: toolbox, parts bins, a folded blueprint, a spare crate lid
  stuff.push({ p: [BENCH_X - 0.05, 1.06, BENCH_Z[1] + 0.8], s: [0.46, 0.24, 0.3], c: '#c2432f' })
  stuff.push({ p: [BENCH_X + 0.15, 1.0, BENCH_Z[1] - 0.6], s: [0.3, 0.12, 0.3], c: '#3a86ff' })
  stuff.push({ p: [BENCH_X - 0.15, 1.0, BENCH_Z[1] - 0.95], s: [0.3, 0.12, 0.3], c: '#ffb020' })
  stuff.push({ p: [BENCH_X, 0.975, BENCH_Z[0] - 0.9], s: [0.5, 0.03, 0.7], c: '#d8dcf0' })
  stuff.push({ p: [BENCH_X - 0.1, 0.42, BENCH_Z[0] + 0.4], s: [0.5, 0.16, 0.6], c: '#6b4f2e' })
  stuff.push({ p: [BENCH_X + 0.1, 0.42, BENCH_Z[1] + 0.2], s: [0.4, 0.16, 0.5], c: '#5b4126' })
  return { tops, legs, stuff }
})()

const SHELF_ITEMS = (() => {
  const frame: Item[] = []
  const boxes: Item[] = []
  const { x, z, w, d } = SHELF
  for (const y of [0.35, 1.25, 2.15, 3.0]) frame.push({ p: [x, y, z], s: [w, 0.05, d] })
  for (const sx of [-1, 1]) frame.push({ p: [x + sx * (w / 2 - 0.03), 1.55, z], s: [0.06, 3.1, d] })
  const cols = ['#6b4f2e', '#7a5a36', '#3a4a6a', '#5a3a3a', '#6b4f2e', '#2f4d5a', '#7a5a36', '#4a3a5a', '#6b4f2e']
  const layout: [number, number, number, number, number][] = [
    // dx, y, sx, sy, sz
    [-0.95, 0.35, 0.7, 0.55, 0.55],
    [-0.15, 0.35, 0.6, 0.45, 0.5],
    [0.75, 0.35, 0.8, 0.7, 0.55],
    [-1.0, 1.25, 0.55, 0.5, 0.5],
    [-0.35, 1.25, 0.5, 0.35, 0.45],
    [0.55, 1.25, 0.9, 0.55, 0.55],
    [-0.8, 2.15, 0.75, 0.45, 0.5],
    [0.15, 2.15, 0.5, 0.6, 0.5],
    [0.95, 2.15, 0.6, 0.4, 0.5],
  ]
  layout.forEach(([dx, y, sx, sy, sz], i) => boxes.push({ p: [x + dx, y + 0.025 + sy / 2, z + 0.02], s: [sx, sy, sz], c: cols[i] }))
  return { frame, boxes }
})()

const BELT_ITEMS = (() => {
  const rails: Item[] = [
    { p: [BELT.x - 0.66, 0.2, BELT.z], s: [0.08, 0.4, BELT.len] },
    { p: [BELT.x + 0.66, 0.2, BELT.z], s: [0.08, 0.4, BELT.len] },
  ]
  const rollers: Item[] = [-1, 1].map((sgn) => ({ p: [BELT.x, 0.18, BELT.z + sgn * (BELT.len / 2 - 0.1)], s: [0.17, 1.2, 0.17], r: [0, 0, Math.PI / 2] }))
  const cargo: Item[] = [
    { p: [BELT.x, 0.63, BELT.z + 4.4], s: [0.7, 0.66, 0.7], c: '#6b4f2e' },
    { p: [BELT.x + 0.05, 0.56, BELT.z + 0.2], s: [0.8, 0.52, 0.6], c: '#3a4a6a' },
    { p: [BELT.x - 0.05, 0.6, BELT.z - 3.9], s: [0.6, 0.6, 0.6], c: '#7a5a36' },
  ]
  return { rails, rollers, cargo }
})()

const PIPE_ITEMS = (() => {
  const pipes: Item[] = []
  const collars: Item[] = []
  const valves: Item[] = []
  for (const sgn of [-1, 1]) {
    pipes.push({ p: [sgn * 7.45, 4.05, -15], s: [0.09, 15.4, 0.09], r: [Math.PI / 2, 0, 0] })
    pipes.push({ p: [sgn * 7.45, 3.78, -15], s: [0.06, 15.4, 0.06], r: [Math.PI / 2, 0, 0] })
    for (const z of [-9.5, -13.5, -17.5, -21.5]) collars.push({ p: [sgn * 7.45, 4.05, z], s: [0.12, 0.18, 0.12], r: [Math.PI / 2, 0, 0] })
  }
  // cross pipe along the far wall + two drops into the generator gate
  pipes.push({ p: [0, 4.15, -22.45], s: [0.09, 15.1, 0.09], r: [0, 0, Math.PI / 2] })
  for (const sgn of [-1, 1]) {
    pipes.push({ p: [sgn * 1.15, 3.7, -22.45], s: [0.07, 0.95, 0.07] })
    collars.push({ p: [sgn * 1.15, 4.15, -22.45], s: [0.13, 0.2, 0.13] })
  }
  valves.push({ p: [-7.28, 4.05, -12.2], s: [0.16, 0.16, 0.16], r: [0, Math.PI / 2, 0] })
  valves.push({ p: [7.28, 4.05, -18.6], s: [0.16, 0.16, 0.16], r: [0, Math.PI / 2, 0] })
  valves.push({ p: [-2.6, 4.15, -22.28], s: [0.16, 0.16, 0.16] })
  return { pipes, collars, valves }
})()

// ── textures ─────────────────────────────────────────────────────────────────
function chevronTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1b1f2b'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = '#3c435a'
  ctx.lineWidth = 14
  ctx.lineCap = 'butt'
  for (const y of [-64, 0, 64, 128]) {
    ctx.beginPath()
    ctx.moveTo(6, y + 40)
    ctx.lineTo(64, y)
    ctx.lineTo(122, y + 40)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,176,32,0.28)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(4, 0)
  ctx.lineTo(4, 128)
  ctx.moveTo(124, 0)
  ctx.lineTo(124, 128)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 9)
  tex.anisotropy = 4
  return tex
}

/** A spreadsheet: column letters, row numbers, a formula block and some figures. */
function spreadsheetTexture() {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, w, h)
  // title bar
  ctx.fillStyle = 'rgba(255,176,32,0.14)'
  ctx.fillRect(0, 0, w, 66)
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 64, w, 3)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `800 34px ${SANS}`
  ctx.shadowColor = ACCENT
  ctx.shadowBlur = 12
  ctx.fillText('EXCEL AUTOMATION', 28, 34)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#8b93b3'
  ctx.font = `600 20px ${MONO}`
  ctx.fillText(`${C.name.toLowerCase().replace(/\s+/g, '-')}-deliverables.xlsx`, 380, 34)
  // grid
  const x0 = 60
  const y0 = 100
  const cw = 106
  const rh = 30
  const cols = 9
  const rows = 13
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(0, y0 - rh, w, rh)
  ctx.fillRect(0, y0 - rh, x0, rows * rh + rh)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 1
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath()
    ctx.moveTo(x0 + c * cw, y0 - rh)
    ctx.lineTo(x0 + c * cw, y0 + rows * rh)
    ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath()
    ctx.moveTo(0, y0 + r * rh)
    ctx.lineTo(w, y0 + r * rh)
    ctx.stroke()
  }
  ctx.fillStyle = '#7f88a8'
  ctx.font = `700 18px ${MONO}`
  ctx.textAlign = 'center'
  for (let c = 0; c < cols; c++) ctx.fillText(String.fromCharCode(65 + c), x0 + c * cw + cw / 2, y0 - rh / 2)
  for (let r = 0; r < rows; r++) ctx.fillText(String(r + 1), x0 / 2, y0 + r * rh + rh / 2)
  // deterministic pseudo-random figures
  let seed = 7
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const labels = ['input', 'qty', 'rate', 'hours', 'cost', 'total', 'status']
  ctx.textAlign = 'right'
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x0 + c * cw
      const cy = y0 + r * rh + rh / 2
      if (r === 0) {
        ctx.fillStyle = '#c9d0ea'
        ctx.font = `700 16px ${MONO}`
        ctx.textAlign = 'left'
        if (c < labels.length) ctx.fillText(labels[c], cx + 10, cy)
        ctx.textAlign = 'right'
        continue
      }
      const v = rnd()
      if (c >= 4 && c <= 5 && r >= 2 && r <= 10) {
        ctx.fillStyle = 'rgba(255,176,32,0.22)'
        ctx.fillRect(cx + 1, cy - rh / 2 + 1, cw - 2, rh - 2)
      }
      if (v < 0.62) {
        ctx.fillStyle = c >= 4 && c <= 5 ? '#ffd48a' : '#b6bedc'
        ctx.font = `500 16px ${MONO}`
        ctx.fillText((Math.floor(v * 9000) / (c % 3 === 0 ? 1 : 10)).toFixed(c % 3 === 0 ? 0 : 1), cx + cw - 10, cy)
      }
    }
  }
  // a mint "auto" row and a formula bar readout
  ctx.fillStyle = 'rgba(124,245,196,0.18)'
  ctx.fillRect(x0 + 1, y0 + 11 * rh + 1, cols * cw - 2, rh - 2)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#7cf5c4'
  ctx.font = `700 16px ${MONO}`
  ctx.fillText('=GENERATE(inputs, template)', x0 + 10, y0 + 11 * rh + rh / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Tooling board: a title and the chamber's stack rendered as chips. */
function chipsTexture(title: string, chips: string[]) {
  const w = 1024
  const h = 300
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0c101a'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 0, w, 6)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = ACCENT
  ctx.font = `800 30px ${SANS}`
  ctx.shadowColor = ACCENT
  ctx.shadowBlur = 10
  ctx.fillText(title, 30, 46)
  ctx.shadowBlur = 0
  ctx.font = `700 26px ${SANS}`
  let x = 30
  let y = 112
  for (const chip of chips) {
    const tw = ctx.measureText(chip).width + 40
    if (x + tw > w - 30) {
      x = 30
      y += 64
    }
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.strokeStyle = 'rgba(255,176,32,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x, y - 24, tw, 48, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#eef2ff'
    ctx.fillText(chip, x + 20, y)
    x += tw + 16
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function TetraTechChamber() {
  const spoke = SPOKES.tetratech
  return (
    <group>
      <BlocksPuzzle />
      {/* briefing lectern just inside the entrance, turned toward the corridor mouth */}
      <group position={[-3.4, 0, -9.6]} rotation-y={0.9}>
        <PuzzleConsole chamber="tetratech" position={[0, 0, 0]} label="Briefing" />
      </group>

      <Conveyor />
      <Workbenches />
      <Shelving />
      <MonitorBank />
      <Pipes />

      {/* company sign over the generator gate */}
      <TextPlane text={`${C.name.toUpperCase()} · ${C.theme.split('—')[0].trim().toUpperCase()}`} size={[7.4, 0.5]} position={[0, 3.62, spoke.roomFarZ + 0.32]} width={1536} height={112} font={`bold 62px ${SANS}`} color="#f1f3ff" glow={10} />
      <mesh position={[0, 3.32, spoke.roomFarZ + 0.32]} material={accentGlowMat}>
        <boxGeometry args={[7.6, 0.03, 0.03]} />
      </mesh>

      {/* fixed colliders for the furniture that hugs the walls — the centre stays clear for pushing */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.72, 0.22, BELT.len / 2]} position={[BELT.x, 0.22, BELT.z]} />
        {BENCH_Z.map((z) => (
          <CuboidCollider key={z} args={[0.5, 0.5, 1.45]} position={[BENCH_X, 0.5, z]} />
        ))}
        <CuboidCollider args={[SHELF.w / 2 + 0.05, 1.55, SHELF.d / 2 + 0.05]} position={[SHELF.x, 1.55, SHELF.z]} />
        <CuboidCollider args={[2.3, 0.65, 0.36]} position={[MONITOR.x, 0.65, -22.36]} />
      </RigidBody>
    </group>
  )
}

function Conveyor() {
  const tex = useMemo(() => chevronTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  useFrame((_, dt) => {
    tex.offset.y = (tex.offset.y - Math.min(dt, 0.05) * 0.35) % 1
  })
  return (
    <group>
      <mesh position={[BELT.x, 0.14, BELT.z]} material={slabMat} castShadow receiveShadow>
        <boxGeometry args={[BELT.w, 0.28, BELT.len]} />
      </mesh>
      <mesh position={[BELT.x, 0.285, BELT.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[BELT.w - 0.2, BELT.len - 0.3]} />
        <meshStandardMaterial map={tex} roughness={0.8} metalness={0.1} />
      </mesh>
      <Instanced geometry={unitBox} material={railMat} items={BELT_ITEMS.rails} castShadow />
      <Instanced geometry={unitCyl} material={railMat} items={BELT_ITEMS.rollers} />
      <Instanced geometry={unitBox} material={boxMat} items={BELT_ITEMS.cargo} castShadow />
      {/* amber kick light along the belt's inner edge */}
      <mesh position={[BELT.x + 0.72, 0.06, BELT.z]} material={accentGlowMat}>
        <boxGeometry args={[0.02, 0.025, BELT.len - 0.4]} />
      </mesh>
    </group>
  )
}

function Workbenches() {
  const tex = useMemo(() => chipsTexture('TOOLING', C.stack), [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group>
      <Instanced geometry={unitBox} material={benchTopMat} items={BENCH_ITEMS.tops} castShadow receiveShadow />
      <Instanced geometry={unitBox} material={darkMetal} items={BENCH_ITEMS.legs} castShadow />
      <Instanced geometry={unitBox} material={boxMat} items={BENCH_ITEMS.stuff} castShadow />
      {/* a small bench monitor */}
      <group position={[BENCH_X - 0.05, 1.18, BENCH_Z[0] + 0.5]} rotation-y={-Math.PI / 2 - 0.2}>
        <mesh material={panelMat} castShadow>
          <boxGeometry args={[0.62, 0.4, 0.05]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={screenGlowMat}>
          <planeGeometry args={[0.54, 0.32]} />
        </mesh>
        <mesh position={[0, -0.24, -0.03]} material={darkMetal}>
          <boxGeometry args={[0.12, 0.1, 0.1]} />
        </mesh>
      </group>
      {/* tooling board on the wall above the benches */}
      <group position={[7.66, 2.45, -12.5]} rotation-y={-Math.PI / 2}>
        <mesh material={panelMat} position={[0, 0, -0.03]} castShadow>
          <boxGeometry args={[3.7, 1.1, 0.06]} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[3.6, 1.05]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function Shelving() {
  return (
    <group>
      <Instanced geometry={unitBox} material={shelfMat} items={SHELF_ITEMS.frame} castShadow receiveShadow />
      <Instanced geometry={unitBox} material={boxMat} items={SHELF_ITEMS.boxes} castShadow />
    </group>
  )
}

function MonitorBank() {
  const solved = useGame((s) => !!s.solved.tetratech)
  const tex = useMemo(() => spreadsheetTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  const scan = useRef<THREE.Mesh>(null)
  useFrame((st) => {
    if (scan.current) scan.current.position.y = 0.95 - ((st.clock.elapsedTime * 0.35) % 1.9)
  })
  return (
    <group position={[MONITOR.x, MONITOR.y, MONITOR.z]}>
      {/* bezel + screen */}
      <mesh material={panelMat} castShadow>
        <boxGeometry args={[4.7, 2.5, 0.12]} />
      </mesh>
      <mesh position={[0, 0.05, 0.065]}>
        <planeGeometry args={[4.4, 2.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh ref={scan} position={[0, 0.3, 0.07]}>
        <planeGeometry args={[4.4, 0.05]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* status readout under the screen */}
      <mesh position={[0, -1.12, 0.065]} material={solved ? accentGlowMat : darkMetal}>
        <boxGeometry args={[4.4, 0.03, 0.02]} />
      </mesh>
      <TextPlane
        text={solved ? 'DELIVERABLE READY' : 'AWAITING 3 INPUTS'}
        size={[2.6, 0.2]}
        position={[0, -1.26, 0.07]}
        width={1024}
        height={80}
        font={`bold 54px ${MONO}`}
        color={solved ? '#7cf5c4' : ACCENT}
        glow={8}
      />
      {/* cabinet under the bank */}
      <mesh position={[0, -1.95, 0.26]} material={darkMetal} castShadow receiveShadow>
        <boxGeometry args={[4.4, 1.2, 0.6]} />
      </mesh>
      <mesh position={[0, -1.42, 0.57]} material={accentGlowMat}>
        <boxGeometry args={[4.2, 0.02, 0.02]} />
      </mesh>
    </group>
  )
}

function Pipes() {
  return (
    <group>
      <Instanced geometry={unitCyl} material={pipeMat} items={PIPE_ITEMS.pipes} castShadow />
      <Instanced geometry={unitCyl} material={pipeMat} items={PIPE_ITEMS.collars} />
      <Instanced geometry={unitTorus} material={valveMat} items={PIPE_ITEMS.valves} />
    </group>
  )
}
