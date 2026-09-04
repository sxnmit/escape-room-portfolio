import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame } from '@react-three/fiber'
import { CoefficientCombineRule, CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { BLOCKS_PUZZLE, CHAMBERS } from '@/data/resume'
import { SPOKES, frameToWorld } from '@/game/world/layout'
import { playerSnapshot } from '@/game/Player'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane, makeTextTexture } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

/**
 * Chamber III — the crates & pads puzzle, fully in 3D.
 *
 * Three intake pads sit in a row near the far wall; three input crates spawn
 * scattered around the room centre. The player (a dynamic capsule) shoves the
 * crates around; a pad "fills" when its matching crate's centre is within
 * PAD_RADIUS of it. When all three are filled the chamber is solved, the
 * crates lock and snap to their pads, and the client deliverable rises out of
 * the generator behind them.
 *
 * Everything here is in the spoke's local frame (−z = away from the hub).
 */

const C = CHAMBERS.tetratech
const ACCENT = C.accent
const ITEMS = BLOCKS_PUZZLE.items
const N = ITEMS.length
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif'
const MONO = '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'

export const CRATE = 1.1
const HALF = CRATE / 2
/** The physics box is a hair smaller than the visual so corners never snag on the capsule. */
const COLLIDER_HALF = 0.52
export const PAD_Z = -18.4
export const PAD_X = [-3.2, 0, 3.2]
export const PAD_RADIUS = 0.75
/** Within this distance of a pad, a crate that is not being pushed glides onto the pad centre. */
export const MAGNET_RADIUS = 1.2
/** Deterministic spawn points, ~5 units from their pads, clear of the corridor mouth. */
export const CRATE_START: [number, number][] = [
  [-4.3, -13.4],
  [0.9, -13.2],
  [4.3, -14.0],
]
export const GENERATOR_Z = -21.3
const RESET_Z = -19.4
/** Player capsule radius (Player.tsx) + a small contact margin, used by the push assist. */
const PLAYER_R = 0.35
const PUSH_REACH = COLLIDER_HALF + PLAYER_R + 0.12
/** How hard the push assist steers a crate back to the sideways offset it had at first contact (1/s). */
const PUSH_HOLD = 7
const PUSH_HOLD_MAX = 1.6
const litTint = new THREE.Color(1.6, 1.4, 1.1)

// ── shared geometry / materials (module-level: allocated once) ───────────────
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const darkMetal = new THREE.MeshStandardMaterial({ color: '#151a28', roughness: 0.45, metalness: 0.6 })
const crateMat = new THREE.MeshStandardMaterial({ color: '#2a3145', roughness: 0.55, metalness: 0.35 })
const crateFrameMat = new THREE.MeshStandardMaterial({ color: '#0f121c', roughness: 0.4, metalness: 0.7 })
const panelMat = new THREE.MeshStandardMaterial({ color: '#0d1019', roughness: 0.35, metalness: 0.5 })
const accentGlowMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2, toneMapped: false })
const stripMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
const beamMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending })
const baseGlowMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false })
const zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })

const padDiscGeo = new THREE.CylinderGeometry(0.82, 0.88, 0.05, 40)
const padRingGeo = mergeGeometries([new THREE.RingGeometry(0.72, 0.84, 56), new THREE.RingGeometry(0.28, 0.34, 40)]).rotateX(-Math.PI / 2)
const pulseGeo = new THREE.RingGeometry(0.8, 0.92, 56).rotateX(-Math.PI / 2)
const columnGeo = new THREE.CylinderGeometry(0.5, 0.68, 2.4, 24, 1, true).translate(0, 1.2, 0)
const sheetGeo = new THREE.PlaneGeometry(1.2, 1.55)
const dotGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16)
const ledGeo = new THREE.BoxGeometry(0.09, 0.09, 0.03)

function crateFrameGeometry() {
  const t = 0.075
  const s = CRATE + 0.02
  const h = s / 2
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.BoxGeometry(t, s, t).translate(sx * (h - t / 2), 0, sz * (h - t / 2)))
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.BoxGeometry(s, t, t).translate(0, sy * (h - t / 2), sz * (h - t / 2)))
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) parts.push(new THREE.BoxGeometry(t, t, s).translate(sx * (h - t / 2), sy * (h - t / 2), 0))
  return mergeGeometries(parts)
}
const crateFrameGeo = crateFrameGeometry()

/** One label quad on each of the four vertical faces, merged into a single draw. */
function crateLabelGeometry() {
  const w = 0.9
  const h = 0.28
  const y = 0.27
  const off = HALF + 0.014
  const faces: [number, number, number][] = [
    [0, 0, off],
    [Math.PI, 0, -off],
    [Math.PI / 2, off, 0],
    [-Math.PI / 2, -off, 0],
  ]
  return mergeGeometries(faces.map(([ry, px, pz]) => new THREE.PlaneGeometry(w, h).rotateY(ry).translate(px, y, pz)))
}
const crateLabelGeo = crateLabelGeometry()

/** Generator gate: two posts + a top bar, merged. */
const gateGeo = mergeGeometries([
  new THREE.BoxGeometry(0.16, 3.2, 0.16).translate(-1.15, 1.6, -0.55),
  new THREE.BoxGeometry(0.16, 3.2, 0.16).translate(1.15, 1.6, -0.55),
  new THREE.BoxGeometry(2.46, 0.16, 0.16).translate(0, 3.2, -0.55),
  new THREE.BoxGeometry(0.5, 0.12, 0.5).translate(-1.15, 0.06, -0.55),
  new THREE.BoxGeometry(0.5, 0.12, 0.5).translate(1.15, 0.06, -0.55),
])

const easeOutBack = (u: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// ── canvas textures ──────────────────────────────────────────────────────────
/** Crate side label: the item name with a thin underline in the item colour. */
function crateLabelTexture(label: string, color: string) {
  const tex = makeTextTexture({ text: label, width: 768, height: 240, font: `bold 88px ${SANS}`, color: '#f4f6ff', glow: 10, padding: 24 })
  const canvas = tex.image as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  ctx.shadowBlur = 0
  ctx.fillStyle = color
  ctx.fillRect(96, 196, canvas.width - 192, 8)
  tex.needsUpdate = true
  return tex
}

/** The floating holo-sheet: title, the three inputs it was built from, a bar chart, and the headline number. */
function deliverableTexture() {
  const w = 512
  const h = 680
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const r = 22
  ctx.fillStyle = 'rgba(10, 16, 30, 0.78)'
  ctx.beginPath()
  ctx.roundRect(4, 4, w - 8, h - 8, r)
  ctx.fill()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 5
  ctx.stroke()
  // header
  ctx.fillStyle = ACCENT
  ctx.beginPath()
  ctx.roundRect(4, 4, w - 8, 92, [r, r, 0, 0])
  ctx.fill()
  ctx.fillStyle = '#1a1200'
  ctx.font = `900 40px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(BLOCKS_PUZZLE.deliverableLabel, w / 2, 50, w - 40)
  // inputs
  ctx.textAlign = 'left'
  ITEMS.forEach((it, i) => {
    const y = 140 + i * 58
    ctx.fillStyle = it.color
    ctx.shadowColor = it.color
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.roundRect(40, y - 14, 28, 28, 6)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#eef2ff'
    ctx.font = `700 27px ${SANS}`
    ctx.fillText(it.label, 88, y)
    ctx.fillStyle = '#7cf5c4'
    ctx.font = `800 26px ${MONO}`
    ctx.textAlign = 'right'
    ctx.fillText('OK', w - 40, y)
    ctx.textAlign = 'left'
  })
  // bar chart
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    const y = 330 + i * 46
    ctx.beginPath()
    ctx.moveTo(40, y)
    ctx.lineTo(w - 40, y)
    ctx.stroke()
  }
  const bars = [0.35, 0.55, 0.42, 0.7, 0.62, 0.9]
  bars.forEach((v, i) => {
    const bw = 52
    const x = 46 + i * 72
    const bh = v * 180
    ctx.fillStyle = i === bars.length - 1 ? ACCENT : `rgba(255,176,32,${0.28 + i * 0.09})`
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = i === bars.length - 1 ? 18 : 0
    ctx.fillRect(x, 514 - bh, bw, bh)
  })
  ctx.shadowBlur = 0
  // headline
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = ACCENT
  ctx.shadowBlur = 18
  ctx.font = `900 64px ${SANS}`
  ctx.fillText(C.highlight.value, w / 2, 578)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#c9d0ea'
  ctx.font = `600 21px ${SANS}`
  ctx.fillText(C.highlight.label, w / 2, 630, w - 48)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Dashed "intake zone" floor marking around the pads. */
function zoneTexture() {
  const w = 1024
  const h = 400
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,176,32,0.55)'
  ctx.lineWidth = 6
  ctx.setLineDash([34, 22])
  ctx.beginPath()
  ctx.roundRect(10, 10, w - 20, h - 20, 26)
  ctx.stroke()
  ctx.setLineDash([])
  // corner brackets
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 10
  const L = 60
  for (const [cx, cy, sx, sy] of [
    [10, 10, 1, 1],
    [w - 10, 10, -1, 1],
    [10, h - 10, 1, -1],
    [w - 10, h - 10, -1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + sy * L)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + sx * L, cy)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,176,32,0.85)'
  ctx.font = `800 30px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('INTAKE ZONE', w / 2, 46)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface PuzzleRefs {
  /** push assist: whether the player is currently shoving crate i, and the sideways offset to hold */
  pushing: boolean[]
  pushOff: number[]
  filled: boolean[]
  fill: number[]
  pulse: number[]
  locked: boolean
  fixed: boolean[]
  /** seconds since the lock began (large when solved on mount so every animation is complete) */
  lockT: number
  solveT: number
  frame: number
  snapFrom: THREE.Vector3[]
  stripsDirty: boolean
}

const STRIPS_PER_SIDE = 14
const STRIP_Z0 = -8.2
const STRIP_DZ = 1.05

export function BlocksPuzzle() {
  const spoke = SPOKES.tetratech
  const { rapier } = useRapier()
  const initialSolved = useMemo(() => !!useGame.getState().solved.tetratech, [])
  const solved = useGame((s) => !!s.solved.tetratech)
  const bodies = useRef<(RapierRigidBody | null)[]>(Array(N).fill(null))

  const st = useRef<PuzzleRefs>({
    pushing: Array(N).fill(false),
    pushOff: Array(N).fill(0),
    filled: Array(N).fill(initialSolved),
    fill: Array(N).fill(initialSolved ? 1 : 0),
    pulse: Array(N).fill(1),
    locked: initialSolved,
    fixed: Array(N).fill(initialSolved),
    lockT: initialSolved ? 20 : 0,
    solveT: initialSolved ? 1 : 0,
    frame: 0,
    snapFrom: Array.from({ length: N }, () => new THREE.Vector3()),
    stripsDirty: true,
  })

  // world-space targets (bodies report world translations)
  const padWorld = useMemo(() => PAD_X.map((x) => frameToWorld(spoke.frame, [x, HALF, PAD_Z])), [spoke])
  const startWorld = useMemo(() => CRATE_START.map(([x, z]) => frameToWorld(spoke.frame, [x, HALF + 0.02, z])), [spoke])

  // per-item materials
  const mats = useMemo(
    () =>
      ITEMS.map((it) => {
        const col = new THREE.Color(it.color)
        return {
          ring: new THREE.MeshStandardMaterial({ color: it.color, emissive: it.color, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.2, toneMapped: false }),
          disc: new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.16), toneMapped: false }),
          discDim: col.clone().multiplyScalar(0.16),
          discLit: col.clone().multiplyScalar(0.72),
          column: new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }),
          pulse: new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
          band: new THREE.MeshStandardMaterial({ color: it.color, emissive: it.color, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.2, toneMapped: false }),
          dot: new THREE.MeshStandardMaterial({ color: it.color, emissive: it.color, emissiveIntensity: 0.3, toneMapped: false }),
          label: new THREE.MeshBasicMaterial({ map: crateLabelTexture(it.label, it.color), transparent: true, depthWrite: false, toneMapped: false }),
        }
      }),
    [],
  )
  const genMats = useMemo(
    () => ({
      ring: new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.2, toneMapped: false }),
      sheet: new THREE.MeshBasicMaterial({ map: deliverableTexture(), transparent: true, opacity: 0.96, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      button: new THREE.MeshStandardMaterial({ color: '#ff5c5c', emissive: '#ff5c5c', emissiveIntensity: 1.2, roughness: 0.3, toneMapped: false }),
    }),
    [],
  )
  const zoneTex = useMemo(() => zoneTexture(), [])
  useEffect(() => {
    zoneMat.map = zoneTex
    zoneMat.needsUpdate = true
    return () => {
      zoneTex.dispose()
      mats.forEach((m) => {
        m.label.map?.dispose()
        Object.values(m).forEach((v) => {
          if (v instanceof THREE.Material) v.dispose()
        })
      })
      genMats.sheet.map?.dispose()
      Object.values(genMats).forEach((m) => m.dispose())
    }
  }, [zoneTex, mats, genMats])

  // scene refs
  const columns = useRef<(THREE.Mesh | null)[]>(Array(N).fill(null))
  const pulses = useRef<(THREE.Mesh | null)[]>(Array(N).fill(null))
  const deliverable = useRef<THREE.Group>(null)
  const sheet = useRef<THREE.Mesh>(null)
  const genLight = useRef<THREE.PointLight>(null)
  const strips = useRef<THREE.InstancedMesh>(null)
  const resetAnchor = useRef<THREE.Group>(null)
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const accentColor = useMemo(() => new THREE.Color(ACCENT), [])

  // ── lock: called from the detector or when the store says solved ──────────
  const beginLock = useCallback(
    (announce: boolean) => {
      const s = st.current
      if (s.locked) return
      s.locked = true
      s.lockT = 0
      for (let i = 0; i < N; i++) {
        s.filled[i] = true
        const b = bodies.current[i]
        if (!b) continue
        const t = b.translation()
        s.snapFrom[i].set(t.x, t.y, t.z)
        b.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
        b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
      const g = useGame.getState()
      g.solve('tetratech')
      if (announce) {
        sfx.play('success')
        g.showToast(BLOCKS_PUZZLE.successText, 'success')
        window.setTimeout(() => useGame.getState().showToast(`Vault ${C.numeral} · ${C.name} has unsealed in the hub.`, 'success'), 2600)
      }
    },
    [rapier],
  )
  useEffect(() => {
    if (solved) beginLock(false)
  }, [solved, beginLock])

  const resetCrates = useCallback(() => {
    const s = st.current
    if (s.locked) return
    for (let i = 0; i < N; i++) {
      const b = bodies.current[i]
      if (!b) continue
      const p = startWorld[i]
      b.setTranslation({ x: p.x, y: p.y, z: p.z }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
      b.wakeUp()
      s.filled[i] = false
    }
    sfx.play('ui')
    useGame.getState().showToast('Crates returned to their start positions.', 'info')
  }, [startWorld])

  const nearReset = useInteractable(
    {
      id: 'console:tetratech:reset',
      radius: 2.4,
      prompt: 'Reset crates',
      enabled: () => !st.current.locked,
      onInteract: resetCrates,
    },
    resetAnchor,
  )

  // ── automation hook: window.__game.crates() ───────────────────────────────
  useEffect(() => {
    const w = window as unknown as { __game?: Record<string, unknown> }
    const crates = () =>
      bodies.current.map((b, i) => {
        const t = b ? b.translation() : { x: NaN, z: NaN }
        return { id: ITEMS[i].id, x: t.x, z: t.z, px: padWorld[i].x, pz: padWorld[i].z, sx: startWorld[i].x, sz: startWorld[i].z, placed: st.current.filled[i] }
      })
    const blocks = () => ({ crates: crates(), locked: st.current.locked, solved: !!useGame.getState().solved.tetratech, filled: [...st.current.filled], fill: st.current.fill.map((v) => Math.round(v * 100) / 100), lockT: st.current.lockT })
    const attach = () => {
      if (!w.__game) return false
      w.__game.crates = crates
      w.__game.blocks = blocks
      return true
    }
    let id = 0
    if (!attach()) id = window.setInterval(() => attach() && clearInterval(id), 100)
    return () => {
      clearInterval(id)
      if (w.__game) {
        delete w.__game.crates
        delete w.__game.blocks
      }
    }
  }, [padWorld, startWorld])

  // ── strips: 2 × 14 wall segments, coloured per instance ───────────────────
  useLayoutEffect(() => {
    const m = strips.current
    if (!m) return
    const o = new THREE.Object3D()
    let k = 0
    for (const side of [-1, 1]) {
      for (let i = 0; i < STRIPS_PER_SIDE; i++) {
        o.position.set(side * 7.64, 3.3, STRIP_Z0 - i * STRIP_DZ)
        o.scale.set(0.05, 0.09, 0.8)
        o.updateMatrix()
        m.setMatrixAt(k++, o.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
    st.current.stripsDirty = true
  }, [])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = state.clock.elapsedTime
    const s = st.current
    s.frame++

    // ── push assist ─────────────────────────────────────────────────────────
    // Rapier resolves the capsule/crate contact, but the player only sets its
    // velocity once per render frame while physics sub-steps, so at low frame
    // rates a shove is a single tap and the capsule slides around the crate's
    // face. While the player is touching a crate and moving into it, drive the
    // crate with the player's velocity and hold the sideways offset it had at
    // first contact, so pushes are deliberate, frame-rate independent and
    // crates can be steered diagonally. Let go and the crate glides to a stop.
    if (!s.locked) {
      const pv = playerSnapshot.debug
      const speed = Math.hypot(pv.vx, pv.vz)
      const pp = playerSnapshot.position
      for (let i = 0; i < N; i++) {
        const b = bodies.current[i]
        if (!b) continue
        let engaged = false
        if (speed > 0.3) {
          const tr = b.translation()
          const dx = tr.x - pp.x
          const dz = tr.z - pp.z
          if (Math.abs(dx) <= PUSH_REACH && Math.abs(dz) <= PUSH_REACH) {
            const nx = pv.vx / speed
            const nz = pv.vz / speed
            const d = Math.hypot(dx, dz) || 1
            const toward = (dx * nx + dz * nz) / d
            // sideways offset of the crate relative to the push direction
            const lat = -dx * nz + dz * nx
            // engage only for a reasonably head-on shove; a corner brush is left to the contact solver
            if (toward >= 0.6 && (s.pushing[i] || Math.abs(lat) <= 0.72)) {
              engaged = true
              if (!s.pushing[i]) s.pushOff[i] = THREE.MathUtils.clamp(lat, -0.35, 0.35)
              const corr = THREE.MathUtils.clamp((s.pushOff[i] - lat) * PUSH_HOLD, -PUSH_HOLD_MAX, PUSH_HOLD_MAX)
              const lv = b.linvel()
              b.setLinvel({ x: pv.vx - nz * corr, y: lv.y, z: pv.vz + nx * corr }, true)
            }
          }
        }
        s.pushing[i] = engaged
        // magnet: once a crate is left near its pad, ease it onto the centre so
        // "close enough" counts and the final placement always looks deliberate
        if (!engaged) {
          const tr = b.translation()
          const p = padWorld[i]
          const mx = p.x - tr.x
          const mz = p.z - tr.z
          const md = Math.hypot(mx, mz)
          if (md < MAGNET_RADIUS && md > 0.03) {
            const lv = b.linvel()
            if (Math.hypot(lv.x, lv.z) < 1.6) b.setLinvel({ x: mx * 2.6, y: lv.y, z: mz * 2.6 }, true)
          }
        }
      }
    }

    // ── detection (every 4th frame, no React state) ─────────────────────────
    if (!s.locked && s.frame % 4 === 0) {
      let all = true
      for (let i = 0; i < N; i++) {
        const b = bodies.current[i]
        if (!b) {
          all = false
          continue
        }
        const tr = b.translation()
        const p = padWorld[i]
        const on = Math.hypot(tr.x - p.x, tr.z - p.z) < PAD_RADIUS
        if (on !== s.filled[i]) {
          s.filled[i] = on
          if (on) {
            sfx.play('place')
            s.pulse[i] = 0
          }
        }
        if (!on) all = false
      }
      if (all) beginLock(true)
    }

    // ── snap + lock animation ───────────────────────────────────────────────
    if (s.locked && s.lockT < 6) {
      s.lockT += dt
      for (let i = 0; i < N; i++) {
        if (s.fixed[i]) continue
        const b = bodies.current[i]
        if (!b) continue
        const u = clamp01((s.lockT - i * 0.12) / 0.55)
        const e = easeOutBack(u)
        const from = s.snapFrom[i]
        const to = padWorld[i]
        const x = from.x + (to.x - from.x) * e
        const z = from.z + (to.z - from.z) * e
        const y = HALF + Math.sin(u * Math.PI) * 0.22
        if (u < 1) {
          b.setNextKinematicTranslation({ x, y, z })
        } else if (s.lockT > i * 0.12 + 0.55 + 0.12) {
          b.setTranslation({ x: to.x, y: HALF, z: to.z }, true)
          b.setBodyType(rapier.RigidBodyType.Fixed, true)
          s.fixed[i] = true
        } else {
          b.setNextKinematicTranslation({ x: to.x, y: HALF, z: to.z })
        }
      }
    }
    easing.damp(s, 'solveT', s.locked ? 1 : 0, 0.6, dt)

    // ── pads + crates ───────────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const m = mats[i]
      s.fill[i] = THREE.MathUtils.damp(s.fill[i], s.filled[i] ? 1 : 0, 14, dt)
      const f = s.fill[i]
      const breathe = 0.5 + Math.sin(t * 2.4 + i * 1.3) * 0.5
      m.ring.emissiveIntensity = 0.45 + breathe * 0.25 + f * (2.1 + breathe * 0.5) + s.solveT * 0.6
      m.disc.color.copy(m.discDim).lerp(m.discLit, f)
      m.column.opacity = f * (0.13 + breathe * 0.05 + s.solveT * 0.05)
      const col = columns.current[i]
      if (col) {
        col.visible = f > 0.01
        col.scale.set(1, Math.max(0.001, f) * (1 + Math.sin(t * 1.7 + i) * 0.03), 1)
      }
      m.band.emissiveIntensity = 0.8 + f * 1.6 + s.solveT * 0.3
      m.dot.emissiveIntensity = 0.3 + f * 2.7
      // one-shot expanding pulse ring when a pad fills
      if (s.pulse[i] < 1) {
        s.pulse[i] = Math.min(1, s.pulse[i] + dt / 0.7)
        const p = s.pulse[i]
        const mesh = pulses.current[i]
        if (mesh) {
          mesh.visible = p < 1
          const sc = 1 + p * 1.7
          mesh.scale.set(sc, 1, sc)
          m.pulse.opacity = (1 - p) * (1 - p) * 0.9
        }
      }
    }

    // ── generator + deliverable ─────────────────────────────────────────────
    const rise = easeOutBack(clamp01((s.lockT - 0.55) / 1.1))
    const gen = deliverable.current
    if (gen) {
      gen.visible = rise > 0.01
      gen.position.y = 0.95 + rise * 1.25 + Math.sin(t * 1.3) * 0.04 * rise
      gen.rotation.y = t * 0.45
      const sc = Math.max(0.001, rise)
      gen.scale.set(sc, sc, sc)
    }
    if (sheet.current) sheet.current.rotation.z = Math.sin(t * 0.8) * 0.02
    genMats.ring.emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.35 + s.solveT * 2.2
    beamMat.opacity = 0.03 + s.solveT * (0.1 + Math.sin(t * 3.1) * 0.02)
    baseGlowMat.opacity = 0.18 + s.solveT * 0.4
    if (genLight.current) genLight.current.intensity = 0.8 + s.solveT * 7 + (s.locked && s.lockT < 2 ? Math.sin(Math.min(1, s.lockT / 2) * Math.PI) * 6 : 0)

    // reset console button
    genMats.button.emissiveIntensity = s.locked ? 0 : 0.9 + Math.sin(t * 3) * 0.3 + (nearReset ? 1.4 : 0)
    if (s.locked) genMats.button.color.set('#4a4f60')

    // ── wall strips: chase from the far wall toward the entrance ─────────────
    if (strips.current && (s.stripsDirty || (s.locked && s.lockT < 3.2))) {
      const m = strips.current
      let k = 0
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i < STRIPS_PER_SIDE; i++) {
          const delay = 0.35 + (STRIPS_PER_SIDE - 1 - i) * 0.065
          const lit = s.locked ? clamp01((s.lockT - delay) / 0.25) : 0
          const flash = lit > 0 && lit < 1 ? 1.2 : 0
          const v = 0.12 + lit * 2.3 + flash
          tmpColor.copy(accentColor).multiplyScalar(v)
          if (lit >= 1) tmpColor.lerp(litTint, 0.18)
          m.setColorAt(k++, tmpColor)
        }
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      s.stripsDirty = false
    }
  })

  return (
    <group>
      {/* intake zone floor marking */}
      <mesh position={[0, 0.022, PAD_Z + 0.2]} rotation-x={-Math.PI / 2} material={zoneMat} renderOrder={1}>
        <planeGeometry args={[9.6, 3.75]} />
      </mesh>

      {/* ── pads ── */}
      {ITEMS.map((it, i) => (
        <group key={it.id} position={[PAD_X[i], 0, PAD_Z]}>
          <mesh geometry={padDiscGeo} material={mats[i].disc} position-y={0.025} receiveShadow />
          <mesh geometry={padRingGeo} material={mats[i].ring} position-y={0.056} />
          <mesh
            ref={(el) => {
              pulses.current[i] = el
            }}
            geometry={pulseGeo}
            material={mats[i].pulse}
            position-y={0.06}
            visible={false}
          />
          <mesh
            ref={(el) => {
              columns.current[i] = el
            }}
            geometry={columnGeo}
            material={mats[i].column}
            position-y={0.06}
            visible={false}
            renderOrder={3}
          />
          <TextPlane text={it.label} size={[1.7, 0.26]} position={[0, 0.03, 1.22]} rotation={[-Math.PI / 2, 0, 0]} width={768} height={120} font={`bold 74px ${SANS}`} color={it.color} glow={8} renderOrder={2} />
        </group>
      ))}

      {/* ── crates ── */}
      {ITEMS.map((it, i) => {
        const [sx, sz] = CRATE_START[i]
        const pos: [number, number, number] = initialSolved ? [PAD_X[i], HALF, PAD_Z] : [sx, HALF + 0.02, sz]
        return (
          <RigidBody
            key={it.id}
            ref={(b) => {
              bodies.current[i] = b
            }}
            type={initialSolved ? 'fixed' : 'dynamic'}
            colliders={false}
            position={pos}
            enabledRotations={[false, false, false]}
            linearDamping={3.5}
            angularDamping={2}
            ccd
            name={`crate:${it.id}`}
            userData={{ crate: it.id }}
          >
            <CuboidCollider args={[COLLIDER_HALF, HALF, COLLIDER_HALF]} mass={1.5} friction={0.35} frictionCombineRule={CoefficientCombineRule.Min} restitution={0} />
            <mesh geometry={unitBox} material={crateMat} scale={[CRATE - 0.02, CRATE - 0.02, CRATE - 0.02]} castShadow receiveShadow />
            <mesh geometry={crateFrameGeo} material={crateFrameMat} castShadow />
            <mesh geometry={unitBox} material={mats[i].band} scale={[CRATE + 0.04, 0.22, CRATE + 0.04]} position-y={-0.06} />
            <mesh geometry={crateLabelGeo} material={mats[i].label} renderOrder={2} />
            <mesh geometry={dotGeo} material={mats[i].dot} position-y={HALF + 0.02} />
          </RigidBody>
        )
      })}

      {/* ── generator + deliverable ── */}
      <group position={[0, 0, GENERATOR_Z]}>
        <mesh position-y={0.45} material={darkMetal} castShadow receiveShadow>
          <cylinderGeometry args={[0.7, 0.82, 0.9, 32]} />
        </mesh>
        <mesh position-y={0.905} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[0.56, 0.035, 10, 48]} />
          <primitive object={genMats.ring} attach="material" />
        </mesh>
        <mesh position-y={0.905} rotation-x={-Math.PI / 2} material={baseGlowMat} renderOrder={2}>
          <circleGeometry args={[0.5, 32]} />
        </mesh>
        <mesh geometry={gateGeo} material={darkMetal} castShadow />
        <mesh position={[0, 3.1, -0.55]} material={accentGlowMat}>
          <boxGeometry args={[2.3, 0.03, 0.04]} />
        </mesh>
        <mesh position-y={2.05} material={beamMat} renderOrder={3}>
          <cylinderGeometry args={[0.62, 0.34, 2.3, 28, 1, true]} />
        </mesh>
        <group ref={deliverable} position-y={0.95} visible={false}>
          <mesh ref={sheet} geometry={sheetGeo} material={genMats.sheet} renderOrder={4} />
        </group>
        <pointLight ref={genLight} position={[0, 2.2, 0.6]} color={ACCENT} intensity={0.8} distance={9} decay={2} />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.84, 0.5, 0.84]} position={[0, 0.5, 0]} />
          <CuboidCollider args={[1.3, 1.6, 0.2]} position={[0, 1.6, -0.55]} />
        </RigidBody>
      </group>

      {/* ── wall accent strips ── */}
      <instancedMesh ref={strips} args={[unitBox, stripMat, STRIPS_PER_SIDE * 2]} />

      {/* ── reset console on the right wall ── */}
      <group position={[7.66, 0, RESET_Z]} rotation-y={-Math.PI / 2}>
        <group ref={resetAnchor} position={[0, 0, 0.9]} />
        <mesh position={[0, 1.4, 0]} material={panelMat} castShadow>
          <boxGeometry args={[1.24, 0.98, 0.09]} />
        </mesh>
        <mesh position={[0, 1.84, 0.05]} material={accentGlowMat}>
          <boxGeometry args={[1.16, 0.022, 0.02]} />
        </mesh>
        <TextPlane text="CRATE RESET" size={[1.1, 0.16]} position={[0, 1.7, 0.05]} width={704} height={104} font={`bold 66px ${SANS}`} color={ACCENT} glow={6} />
        <mesh position={[0, 1.38, 0.07]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.15, 0.165, 0.06, 28]} />
          <primitive object={genMats.button} attach="material" />
        </mesh>
        {ITEMS.map((it, i) => (
          <mesh key={it.id} geometry={ledGeo} material={mats[i].dot} position={[-0.26 + i * 0.26, 1.06, 0.05]} scale={[1.4, 1.4, 1]} />
        ))}
      </group>
    </group>
  )
}
