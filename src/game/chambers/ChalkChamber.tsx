import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { CHAMBERS, PIPELINE_PUZZLE } from '@/data/resume'
import { SPOKES } from '@/game/world/layout'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

/**
 * Chamber II — Chalk. A pool hall: two tables under billiard lights, a bar
 * along the right wall, a neon sign, a live table-timer board, and — at the
 * puzzle anchor — a standing holographic pipeline board that opens the
 * overlay puzzle. Everything is procedural; repeated parts are instanced so
 * the whole room stays well under ~50 draw calls.
 */

const ACCENT = CHAMBERS.chalk.accent
const HOLO = '#5ec8ff'
const FELT = new THREE.Color(ACCENT).multiplyScalar(0.34).lerp(new THREE.Color('#0d4a3a'), 0.45)

// ── shared materials / geometries (module-level, reused by every instance) ──
const feltMat = new THREE.MeshStandardMaterial({ color: FELT, roughness: 0.95 })
const woodMat = new THREE.MeshStandardMaterial({ color: '#7a4f2e', roughness: 0.55, metalness: 0.08 })
const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#3a2416', roughness: 0.6 })
const pocketMat = new THREE.MeshStandardMaterial({ color: '#06080c', roughness: 0.9 })
const metalMat = new THREE.MeshStandardMaterial({ color: '#1b2030', roughness: 0.4, metalness: 0.7 })
const chromeMat = new THREE.MeshStandardMaterial({ color: '#8f9ab0', roughness: 0.25, metalness: 0.9 })
const leatherMat = new THREE.MeshStandardMaterial({ color: '#3b1f1a', roughness: 0.7 })
const ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18, metalness: 0.05 })
const lampShadeMat = new THREE.MeshStandardMaterial({ color: '#0f3b2c', roughness: 0.5, metalness: 0.3 })
const lampGlowMat = new THREE.MeshStandardMaterial({ color: '#ffe6c0', emissive: '#ffd9a0', emissiveIntensity: 2.4, toneMapped: false })
const cordMat = new THREE.MeshStandardMaterial({ color: '#0c0e14', roughness: 0.8 })
const chalkMat = new THREE.MeshStandardMaterial({ color: '#3b7ddd', roughness: 0.95 })
const stripMat = new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false })
const bottleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 })
const mirrorMat = new THREE.MeshStandardMaterial({ color: '#26304a', roughness: 0.12, metalness: 0.95 })
const cueMat = new THREE.MeshStandardMaterial({ color: '#c9a36b', roughness: 0.5 })
const plateMat = new THREE.MeshStandardMaterial({ color: '#0b0f18', roughness: 0.6, metalness: 0.4 })
const rugMat = new THREE.MeshStandardMaterial({ color: '#1a1f2e', roughness: 1 })
const neonTubeMat = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false })

const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14)
const unitSphere = new THREE.SphereGeometry(1, 12, 9)
const cueGeo = new THREE.CylinderGeometry(0.007, 0.015, 1.45, 10)
const nodeGeo = new THREE.BoxGeometry(0.28, 0.16, 0.05)
const dashGeo = new THREE.BoxGeometry(0.09, 0.02, 0.02)

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

// ── room plan (spoke-local: −z away from the hub, x right) ─────────────────
const TABLES: { x: number; z: number }[] = [
  { x: -4.1, z: -13.6 },
  { x: 4.1, z: -13.6 },
]
const BAR = { x: 6.85, z: -14.5, len: 9 }
const STOOL_Z = [-13.5, -15.2, -16.9]
const BOARD_Z = -20.6

const BALL_R = 0.057
const BALL_COLORS = ['#f5c400', '#1f4fd6', '#d6281f', '#6b2ea8', '#ff7a00', '#1a8a3c', '#7a1d2a', '#111111', '#f5c400', '#1f4fd6', '#d6281f', '#6b2ea8', '#ff7a00', '#1a8a3c', '#7a1d2a']

function tableItems() {
  const bodies: Item[] = []
  const legs: Item[] = []
  const rails: Item[] = []
  const pockets: Item[] = []
  const chalk: Item[] = []
  for (const t of TABLES) {
    bodies.push({ p: [t.x, 0.6, t.z], s: [1.5, 0.34, 2.8] })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push({ p: [t.x + sx * 0.6, 0.22, t.z + sz * 1.25], s: [0.16, 0.44, 0.16] })
    for (const sx of [-1, 1]) rails.push({ p: [t.x + sx * 0.715, 0.825, t.z], s: [0.13, 0.09, 2.86] })
    for (const sz of [-1, 1]) rails.push({ p: [t.x, 0.825, t.z + sz * 1.365], s: [1.56, 0.09, 0.13] })
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 0, 1]) pockets.push({ p: [t.x + sx * (sz === 0 ? 0.72 : 0.7), 0.835, t.z + sz * 1.33], s: [0.085, 0.1, 0.085] })
    }
    chalk.push({ p: [t.x + 0.715, 0.895, t.z + 0.9], s: [0.05, 0.05, 0.05], r: [0, 0.4, 0] })
  }
  chalk.push({ p: [TABLES[1].x - 0.715, 0.895, TABLES[1].z - 0.6], s: [0.05, 0.05, 0.05], r: [0, -0.3, 0] })
  return { bodies, legs, rails, pockets, chalk }
}

function ballItems(): Item[] {
  const items: Item[] = []
  const y = 0.8 + BALL_R
  const s: [number, number, number] = [BALL_R, BALL_R, BALL_R]
  // racked triangle on table 1
  const t1 = TABLES[0]
  let n = 0
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const x = t1.x + (i - row / 2) * (BALL_R * 2.04)
      const z = t1.z + 0.55 + row * (BALL_R * 2.04 * 0.87)
      const color = row === 2 && i === 1 ? '#111111' : BALL_COLORS[n % BALL_COLORS.length]
      items.push({ p: [x, y, z], s, c: color })
      n++
    }
  }
  items.push({ p: [t1.x + 0.06, y, t1.z - 0.8], s, c: '#fff8e8' })
  // a game in progress on table 2
  const t2 = TABLES[1]
  items.push({ p: [t2.x - 0.2, y, t2.z - 0.4], s, c: '#fff8e8' })
  items.push({ p: [t2.x + 0.3, y, t2.z + 0.5], s, c: '#1f4fd6' })
  items.push({ p: [t2.x - 0.45, y, t2.z + 0.95], s, c: '#d6281f' })
  items.push({ p: [t2.x + 0.15, y, t2.z - 0.95], s, c: '#f5c400' })
  items.push({ p: [t2.x + 0.5, y, t2.z - 0.1], s, c: '#111111' })
  items.push({ p: [t2.x - 0.1, y, t2.z + 0.15], s, c: '#6b2ea8' })
  return items
}

const TABLE_ITEMS = tableItems()
const BALL_ITEMS = ballItems()

const LAMP_ITEMS = {
  housing: TABLES.map<Item>((t) => ({ p: [t.x, 2.35, t.z], s: [0.56, 0.14, 1.9] })),
  panel: TABLES.map<Item>((t) => ({ p: [t.x, 2.27, t.z], s: [0.4, 0.02, 1.7] })),
  cord: TABLES.flatMap<Item>((t) => [-0.6, 0.6].map((dz) => ({ p: [t.x, 3.45, t.z + dz], s: [0.012, 2.1, 0.012] }))),
}

const BOTTLE_COLORS = ['#ffb347', '#3fbf7f', '#e6f0ff', '#4f7fff', '#ff6b6b', '#ffd166', '#b28dff', '#66d9e8', '#f4a261']
const BAR_ITEMS = {
  bottles: BOTTLE_COLORS.map<Item>((c, i) => ({ p: [7.55, 1.73, -17.0 + i * 0.6], s: [0.045, 0.32, 0.045], c })),
  necks: BOTTLE_COLORS.map<Item>((c, i) => ({ p: [7.55, 1.95, -17.0 + i * 0.6], s: [0.018, 0.12, 0.018], c })),
  seats: STOOL_Z.map<Item>((z) => ({ p: [5.9, 0.74, z], s: [0.2, 0.07, 0.2] })),
  posts: STOOL_Z.map<Item>((z) => ({ p: [5.9, 0.37, z], s: [0.03, 0.68, 0.03] })),
  bases: STOOL_Z.map<Item>((z) => ({ p: [5.9, 0.015, z], s: [0.19, 0.03, 0.19] })),
}

const RACK_ITEMS = {
  cues: [0, 1, 2, 3, 4].map<Item>((i) => ({ p: [-7.55, 0.95, -16.4 - i * 0.36], r: [0, 0, i % 2 ? 0.02 : -0.02] })),
  bars: [0.42, 1.5].map<Item>((y) => ({ p: [-7.6, y, -17.12], s: [0.1, 0.05, 1.8] })),
}

// ── pipeline board node slots (same "U" layout as the overlay) ─────────────
const NODE_COLS = [-0.95, 0, 0.95]
const NODE_ROWS = [1.8, 1.2]
const NODE_SLOTS: [number, number][] = [
  [NODE_COLS[0], NODE_ROWS[0]],
  [NODE_COLS[0], NODE_ROWS[1]],
  [NODE_COLS[1], NODE_ROWS[1]],
  [NODE_COLS[2], NODE_ROWS[1]],
  [NODE_COLS[1], NODE_ROWS[0]],
  [NODE_COLS[2], NODE_ROWS[0]],
]
const DASHES_PER_SEG = 5

export function ChalkChamber() {
  const spoke = SPOKES.chalk
  const [ax] = spoke.puzzleAnchorLocal
  return (
    <group>
      <PoolTables />
      <BilliardLights />
      <Bar />
      <CueRack />
      <NeonSign />
      <LiveTimerBoard />
      <PipelineBoard x={ax} />

      {/* fixed colliders — a clear lane stays open from the corridor to the board */}
      <RigidBody type="fixed" colliders={false}>
        {TABLES.map((t, i) => (
          <CuboidCollider key={i} args={[0.8, 0.45, 1.45]} position={[t.x, 0.45, t.z]} />
        ))}
        <CuboidCollider args={[0.55, 0.55, BAR.len / 2 + 0.1]} position={[BAR.x + 0.05, 0.55, BAR.z]} />
        {STOOL_Z.map((z) => (
          <CuboidCollider key={z} args={[0.22, 0.4, 0.22]} position={[5.9, 0.4, z]} />
        ))}
        <CuboidCollider args={[1.75, 1.35, 0.5]} position={[0, 1.35, BOARD_Z]} />
      </RigidBody>
    </group>
  )
}

function PoolTables() {
  return (
    <group>
      {TABLES.map((t, i) => (
        <group key={i}>
          <mesh position={[t.x, 0.025, t.z]} rotation-x={-Math.PI / 2} material={rugMat} receiveShadow>
            <planeGeometry args={[2.9, 4.4]} />
          </mesh>
          <mesh position={[t.x, 0.78, t.z]} material={feltMat} receiveShadow>
            <boxGeometry args={[1.3, 0.04, 2.6]} />
          </mesh>
        </group>
      ))}
      <Instanced geometry={unitBox} material={darkWoodMat} items={TABLE_ITEMS.bodies} castShadow receiveShadow />
      <Instanced geometry={unitBox} material={metalMat} items={TABLE_ITEMS.legs} castShadow />
      <Instanced geometry={unitBox} material={woodMat} items={TABLE_ITEMS.rails} castShadow />
      <Instanced geometry={unitCyl} material={pocketMat} items={TABLE_ITEMS.pockets} />
      <Instanced geometry={unitBox} material={chalkMat} items={TABLE_ITEMS.chalk} />
      <Instanced geometry={unitSphere} material={ballMat} items={BALL_ITEMS} castShadow />
      {/* a cue resting against table 2 */}
      <mesh geometry={cueGeo} material={cueMat} position={[TABLES[1].x + 1.22, 0.45, TABLES[1].z + 1.2]} rotation={[0, 0, 0.9]} castShadow />
    </group>
  )
}

function BilliardLights() {
  return (
    <group>
      <Instanced geometry={unitBox} material={lampShadeMat} items={LAMP_ITEMS.housing} castShadow />
      <Instanced geometry={unitBox} material={lampGlowMat} items={LAMP_ITEMS.panel} />
      <Instanced geometry={unitBox} material={cordMat} items={LAMP_ITEMS.cord} />
      {TABLES.map((t, i) => (
        <pointLight key={i} position={[t.x, 2.05, t.z]} color="#ffd9a8" intensity={9} distance={8.5} decay={2} />
      ))}
    </group>
  )
}

function Bar() {
  return (
    <group>
      <mesh position={[BAR.x, 0.525, BAR.z]} material={darkWoodMat} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.05, BAR.len]} />
      </mesh>
      <mesh position={[BAR.x, 1.08, BAR.z]} material={woodMat} castShadow>
        <boxGeometry args={[1.06, 0.06, BAR.len + 0.2]} />
      </mesh>
      {/* warm LED kick strip along the floor */}
      <mesh position={[BAR.x - 0.46, 0.1, BAR.z]} material={stripMat}>
        <boxGeometry args={[0.02, 0.03, BAR.len - 0.3]} />
      </mesh>
      {/* back bar: mirror, shelf, under-shelf strip, bottles */}
      <mesh position={[7.68, 2.0, BAR.z]} rotation-y={-Math.PI / 2} material={mirrorMat}>
        <planeGeometry args={[6.6, 1.7]} />
      </mesh>
      <mesh position={[7.55, 1.55, BAR.z]} material={woodMat} castShadow>
        <boxGeometry args={[0.3, 0.04, 6.4]} />
      </mesh>
      <mesh position={[7.55, 1.52, BAR.z]} material={stripMat}>
        <boxGeometry args={[0.22, 0.015, 6.2]} />
      </mesh>
      <Instanced geometry={unitCyl} material={bottleMat} items={BAR_ITEMS.bottles} />
      <Instanced geometry={unitCyl} material={bottleMat} items={BAR_ITEMS.necks} />
      <Instanced geometry={unitCyl} material={leatherMat} items={BAR_ITEMS.seats} castShadow />
      <Instanced geometry={unitCyl} material={chromeMat} items={BAR_ITEMS.posts} />
      <Instanced geometry={unitCyl} material={chromeMat} items={BAR_ITEMS.bases} />
    </group>
  )
}

function CueRack() {
  return (
    <group>
      <Instanced geometry={cueGeo} material={cueMat} items={RACK_ITEMS.cues} />
      <Instanced geometry={unitBox} material={woodMat} items={RACK_ITEMS.bars} />
    </group>
  )
}

function NeonSign() {
  const glow = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => neonTexture(), [])
  useFrame((st) => {
    if (!glow.current) return
    // gentle neon flicker
    const t = st.clock.elapsedTime
    const f = 0.86 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 23.7) * 0.04 + (Math.sin(t * 1.3) > 0.985 ? -0.25 : 0)
    ;(glow.current.material as THREE.MeshBasicMaterial).opacity = f
  })
  return (
    <group position={[0, 0, -22.66]}>
      <mesh position={[0, 3.45, 0]} material={plateMat}>
        <boxGeometry args={[4.2, 1.5, 0.05]} />
      </mesh>
      <group position={[0, 0, 0.04]}>
        <mesh ref={glow} position={[0, 3.58, 0.02]}>
          <planeGeometry args={[3.6, 1.0]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, 3.02, 0.01]} material={neonTubeMat}>
          <boxGeometry args={[2.7, 0.035, 0.035]} />
        </mesh>
        <TextPlane text={CHAMBERS.chalk.theme.toUpperCase()} size={[3.4, 0.28]} position={[0, 2.84, 0.02]} width={1024} height={84} font='600 40px "Inter", system-ui, sans-serif' color="#bfe9d9" />
      </group>
    </group>
  )
}

function neonTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 288
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'italic 900 190px "Georgia", "Times New Roman", serif'
  // halo, then tube core
  ctx.shadowColor = ACCENT
  ctx.shadowBlur = 48
  ctx.fillStyle = ACCENT
  ctx.fillText(CHAMBERS.chalk.name.toUpperCase(), 512, 150)
  ctx.fillText(CHAMBERS.chalk.name.toUpperCase(), 512, 150)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#eafff6'
  ctx.font = 'italic 900 182px "Georgia", "Times New Roman", serif'
  ctx.fillText(CHAMBERS.chalk.name.toUpperCase(), 512, 150)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** LED table-timer board on the left wall: redraws its canvas once per second. */
function LiveTimerBoard() {
  const { texture, ctx, canvas } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return { texture, ctx, canvas }
  }, [])

  useEffect(() => {
    const t0 = performance.now()
    const BASE_SEC = 134 // the session on table 1 was already 02:14 in when you walked in
    const BASE_REV = 18.5
    const RATE_PER_SEC = 9 / 3600
    let tick = 0
    const draw = () => {
      const el = Math.floor((performance.now() - t0) / 1000)
      const total = BASE_SEC + el
      const mm = String(Math.floor(total / 60)).padStart(2, '0')
      const ss = String(total % 60).padStart(2, '0')
      const rev = (BASE_REV + el * RATE_PER_SEC).toFixed(2)
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#04100a'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(46,229,157,0.45)'
      ctx.lineWidth = 4
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.textBaseline = 'middle'
      ctx.fillStyle = ACCENT
      ctx.shadowColor = ACCENT
      ctx.shadowBlur = 16
      ctx.font = 'bold 66px "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'
      ctx.textAlign = 'left'
      ctx.fillText('TABLE 1', 36, 62)
      ctx.textAlign = 'right'
      ctx.fillText(`${mm}:${ss}`, w - 36, 62)
      ctx.textAlign = 'left'
      ctx.font = 'bold 50px "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'
      ctx.fillStyle = '#d7fff0'
      ctx.shadowBlur = 8
      ctx.fillText(`$${rev}`, 36, 142)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ffd166'
      ctx.shadowColor = '#ffd166'
      ctx.fillText('PEAK · $9/hr', w - 36, 142)
      // blinking LIVE dot
      ctx.shadowBlur = tick % 2 ? 14 : 0
      ctx.fillStyle = tick % 2 ? '#ff5c6a' : '#5a2a30'
      ctx.shadowColor = '#ff5c6a'
      ctx.beginPath()
      ctx.arc(w / 2, 142, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      texture.needsUpdate = true
      tick++
    }
    draw()
    const id = window.setInterval(draw, 1000)
    return () => {
      clearInterval(id)
    }
  }, [canvas, ctx, texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group position={[-7.66, 2.35, TABLES[0].z]} rotation-y={Math.PI / 2}>
      <mesh material={plateMat} position={[0, 0, -0.03]}>
        <boxGeometry args={[2.05, 0.72, 0.06]} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[1.9, 0.6]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Canvas texture for the holographic panel: dot grid, title and status line. */
function panelTexture(solved: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 620
  const ctx = canvas.getContext('2d')!
  const col = solved ? ACCENT : HOLO
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = solved ? 'rgba(10, 44, 32, 0.62)' : 'rgba(10, 30, 52, 0.58)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = col
  ctx.globalAlpha = 0.32
  for (let y = 24; y < h; y += 32) for (let x = 24; x < w; x += 32) ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
  ctx.globalAlpha = 1
  ctx.strokeStyle = col
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.9
  ctx.strokeRect(8, 8, w - 16, h - 16)
  // corner brackets
  ctx.lineWidth = 8
  const L = 60
  for (const [cx, cy, sx, sy] of [
    [8, 8, 1, 1],
    [w - 8, 8, -1, 1],
    [8, h - 8, 1, -1],
    [w - 8, h - 8, -1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + sy * L)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + sx * L, cy)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#eef6ff'
  ctx.font = '700 34px "Inter", system-ui, sans-serif'
  ctx.shadowColor = col
  ctx.shadowBlur = 12
  ctx.fillText(PIPELINE_PUZZLE.title.toUpperCase(), 44, 58)
  ctx.textAlign = 'right'
  ctx.fillStyle = col
  ctx.font = '800 28px "Inter", system-ui, sans-serif'
  ctx.fillText(`${PIPELINE_PUZZLE.nodes.length} NODES`, w - 44, 58)
  ctx.textAlign = 'center'
  ctx.font = '900 62px "Inter", system-ui, sans-serif'
  ctx.shadowBlur = 26
  ctx.fillStyle = solved ? ACCENT : '#cfe9ff'
  ctx.fillText(solved ? 'DEPLOYED' : 'AWAITING WIRING', w / 2, h - 66)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function PipelineBoard({ x }: { x: number }) {
  const solved = useGame((s) => !!s.solved.chalk)
  const anchor = useRef<THREE.Group>(null)
  const panel = useRef<THREE.Mesh>(null)
  const nodes = useRef<THREE.InstancedMesh>(null)
  const dashes = useRef<THREE.InstancedMesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const z = BOARD_Z

  const near = useInteractable(
    {
      id: 'console:chalk',
      radius: 2.6,
      prompt: solved ? 'Pipeline · deployed' : 'Open pipeline board',
      onInteract: () => {
        sfx.play('ui')
        useGame.getState().openOverlay({ kind: 'puzzle', chamber: 'chalk' })
      },
    },
    anchor,
  )

  const mats = useMemo(
    () => ({
      node: new THREE.MeshStandardMaterial({ color: HOLO, emissive: HOLO, emissiveIntensity: 1.5, roughness: 0.3, toneMapped: false }),
      dash: new THREE.MeshBasicMaterial({ color: HOLO, toneMapped: false }),
      edge: new THREE.MeshStandardMaterial({ color: HOLO, emissive: HOLO, emissiveIntensity: 1.8, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false }),
      panel: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }),
    }),
    [],
  )
  const texture = useMemo(() => panelTexture(solved), [solved])
  useEffect(() => {
    mats.panel.map = texture
    mats.panel.needsUpdate = true
    return () => texture.dispose()
  }, [texture, mats])

  // chain segments in panel space (x, y), built from the U layout
  const segs = useMemo(() => {
    const out: { a: [number, number]; b: [number, number]; ang: number }[] = []
    for (let i = 0; i < NODE_SLOTS.length - 1; i++) {
      const a = NODE_SLOTS[i]
      const b = NODE_SLOTS[i + 1]
      out.push({ a, b, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) })
    }
    return out
  }, [])
  const target = useRef(new THREE.Color(solved ? ACCENT : HOLO))
  useEffect(() => {
    target.current.set(solved ? ACCENT : HOLO)
  }, [solved])

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    // colour cross-fade (blue hologram → deployed green)
    easing.dampC(mats.node.emissive, target.current, 0.5, dt)
    mats.node.color.copy(mats.node.emissive)
    easing.dampC(mats.dash.color, target.current, 0.5, dt)
    easing.dampC(mats.edge.emissive, target.current, 0.5, dt)
    mats.edge.color.copy(mats.edge.emissive)
    mats.edge.emissiveIntensity = (solved ? 2.2 : 1.6) + Math.sin(t * 2.2) * 0.3 + (near ? 1.2 : 0)
    mats.node.emissiveIntensity = (solved ? 2.4 : 1.5) + Math.sin(t * 3) * 0.25

    if (panel.current) {
      panel.current.position.y = 1.5 + Math.sin(t * 1.1) * 0.02
      panel.current.rotation.y = Math.sin(t * 0.6) * 0.012
    }
    if (nodes.current) {
      NODE_SLOTS.forEach(([nx, ny], i) => {
        tmpObj.position.set(nx, ny + Math.sin(t * 1.7 + i * 1.1) * 0.012, 0.06)
        tmpObj.rotation.set(0, 0, 0)
        const s = 1 + (solved ? Math.max(0, Math.sin(t * 4 - i * 0.9)) * 0.12 : 0)
        tmpObj.scale.set(s, s, 1)
        tmpObj.updateMatrix()
        nodes.current!.setMatrixAt(i, tmpObj.matrix)
      })
      nodes.current.instanceMatrix.needsUpdate = true
    }
    if (dashes.current) {
      const speed = solved ? 0.55 : 0.18
      let k = 0
      for (let j = 0; j < segs.length; j++) {
        const { a, b, ang } = segs[j]
        for (let i = 0; i < DASHES_PER_SEG; i++) {
          const u = (i / DASHES_PER_SEG + t * speed + j * 0.13) % 1
          tmpObj.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0.05)
          tmpObj.rotation.set(0, 0, ang)
          const fade = Math.sin(u * Math.PI)
          tmpObj.scale.set(0.5 + fade * 0.7, 1, 1)
          tmpObj.updateMatrix()
          dashes.current.setMatrixAt(k++, tmpObj.matrix)
        }
      }
      dashes.current.instanceMatrix.needsUpdate = true
    }
    if (ring.current) {
      const p = near ? 0.55 + Math.sin(t * 5) * 0.2 : solved ? 0.35 : 0.22
      easing.damp(mats.ring, 'opacity', p, 0.15, dt)
      const s = near ? 1 + Math.sin(t * 5) * 0.04 : 1
      ring.current.scale.setScalar(s)
    }
  })

  return (
    <group position={[x, 0, 0]}>
      {/* interaction spot in front of the board */}
      <group ref={anchor} position={[0, 0, z + 1.4]} />
      <mesh ref={ring} position={[0, 0.02, z + 1.4]} rotation-x={-Math.PI / 2} material={mats.ring}>
        <ringGeometry args={[0.72, 0.86, 48]} />
      </mesh>

      {/* frame */}
      <mesh position={[0, 0.08, z]} material={metalMat} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.16, 0.9]} />
      </mesh>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * 1.62, 1.35, z]} material={metalMat} castShadow>
          <boxGeometry args={[0.12, 2.55, 0.14]} />
        </mesh>
      ))}
      <mesh position={[0, 2.66, z]} material={metalMat} castShadow>
        <boxGeometry args={[3.36, 0.1, 0.14]} />
      </mesh>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * 1.55, 1.42, z + 0.02]} material={mats.edge}>
          <boxGeometry args={[0.025, 2.25, 0.05]} />
        </mesh>
      ))}

      {/* floating holographic panel + nodes + flowing dashes */}
      <group position={[0, 0, z]}>
        <mesh ref={panel} position={[0, 1.5, 0]} material={mats.panel} renderOrder={2}>
          <planeGeometry args={[2.95, 1.78]} />
        </mesh>
        <instancedMesh ref={nodes} args={[nodeGeo, mats.node, NODE_SLOTS.length]} renderOrder={3} />
        <instancedMesh ref={dashes} args={[dashGeo, mats.dash, segs.length * DASHES_PER_SEG]} renderOrder={3} />
      </group>
    </group>
  )
}
