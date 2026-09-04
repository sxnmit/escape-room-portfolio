import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { CHAMBERS, TERMINAL_PUZZLE } from '@/data/resume'
import { SPOKES } from '@/game/world/layout'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

/**
 * Chamber I — Scotiabank · Global Wealth Engineering.
 * A secure terminal desk at the puzzle anchor (facing the hub), server racks
 * along the far wall with blinking LEDs, cable bundles, a holographic
 * onboarding funnel and a wall log panel. Rendered inside the spoke's local
 * frame: −z is away from the hub, the room spans z ∈ [−7, −23], x ∈ [−8, 8].
 */

const ACCENT = CHAMBERS.scotiabank.accent
const MINT = '#7cf5c4'
const MONO = '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif'

// ── shared geometry / materials (module-level so nothing is re-allocated) ────
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const darkMetal = new THREE.MeshStandardMaterial({ color: '#141826', roughness: 0.45, metalness: 0.55 })
const deskTopMat = new THREE.MeshStandardMaterial({ color: '#1c2233', roughness: 0.35, metalness: 0.4 })
const bezelMat = new THREE.MeshStandardMaterial({ color: '#0c0f18', roughness: 0.3, metalness: 0.65 })
const keySlabMat = new THREE.MeshStandardMaterial({ color: '#10141f', roughness: 0.5, metalness: 0.3 })
const keyMat = new THREE.MeshStandardMaterial({ color: '#2a3149', roughness: 0.6, metalness: 0.2 })
const faceplateMat = new THREE.MeshStandardMaterial({ color: '#1f2537', roughness: 0.5, metalness: 0.45 })
const cableMat = new THREE.MeshStandardMaterial({ color: '#1b2030', roughness: 0.65, metalness: 0.25 })
const cableAccentMat = new THREE.MeshStandardMaterial({ color: '#5a1f28', roughness: 0.6, metalness: 0.25 })
const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
const accentGlowMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2, toneMapped: false })
const holoAccentMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.5, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
const holoMintMat = new THREE.MeshStandardMaterial({ color: MINT, emissive: MINT, emissiveIntensity: 1.7, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
const holoGhostMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.9, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
const beamMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
const panelMat = new THREE.MeshStandardMaterial({ color: '#0d1019', roughness: 0.35, metalness: 0.5 })

/** "41% → 23%" pulled out of the onboarding log so the hologram never drifts from the copy. */
const FUNNEL = (() => {
  const m = /(\d+)%\s*→\s*(\d+)%/.exec(TERMINAL_PUZZLE.files['onboarding.log']?.join(' ') ?? '')
  const before = m ? parseInt(m[1], 10) : 41
  const after = m ? parseInt(m[2], 10) : 23
  return { before, after, label: `${before}% → ${after}%` }
})()

export function ScotiabankChamber() {
  const spoke = SPOKES.scotiabank
  const solved = useGame((s) => !!s.solved.scotiabank)
  const [ax, ay, az] = spoke.puzzleAnchorLocal
  return (
    <group>
      <TerminalDesk position={[ax, ay, az]} solved={solved} />
      <ServerRacks z={spoke.roomFarZ + 0.75} solved={solved} />
      <Cables />
      <FunnelHologram position={[4.6, 0, -16.4]} rotationY={-0.45} solved={solved} />
      <LogPanel />
      {/* company sign above the racks */}
      <TextPlane text={TERMINAL_PUZZLE.banner[0]} size={[7.2, 0.6]} position={[0, 3.85, spoke.roomFarZ + 0.32]} width={1536} height={128} font={`bold 64px ${SANS}`} color="#f1f3ff" glow={10} />
      <mesh position={[0, 3.5, spoke.roomFarZ + 0.32]} material={accentGlowMat}>
        <boxGeometry args={[7.4, 0.03, 0.03]} />
      </mesh>
    </group>
  )
}

// ── Terminal desk ────────────────────────────────────────────────────────────
function TerminalDesk({ position, solved }: { position: [number, number, number]; solved: boolean }) {
  const anchor = useRef<THREE.Group>(null)
  const screenMat = useRef<THREE.MeshStandardMaterial>(null)
  const stripMat = useRef<THREE.MeshStandardMaterial>(null)
  const scanBar = useRef<THREE.Mesh>(null)
  const scanMat = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const keys = useRef<THREE.InstancedMesh>(null)
  const solvedT = useRef({ v: solved ? 1 : 0 })
  const target = useMemo(() => new THREE.Color(), [])

  const near = useInteractable(
    {
      id: 'console:scotiabank',
      radius: 2.8,
      prompt: solved ? 'Terminal · unlocked' : 'Use terminal',
      onInteract: () => {
        sfx.play('ui')
        useGame.getState().openOverlay({ kind: 'puzzle', chamber: 'scotiabank' })
      },
    },
    anchor,
  )

  // keyboard keys: 4 rows × 14 keys, one instanced draw
  useLayoutEffect(() => {
    const m = keys.current
    if (!m) return
    const tmp = new THREE.Object3D()
    let i = 0
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 14; c++) {
        const wide = r === 3 && c >= 4 && c <= 9 // space bar run
        tmp.position.set(-0.5525 + c * 0.085, 0.036, -0.1275 + r * 0.085)
        tmp.scale.set(wide && c === 7 ? 0.5 : 0.07, 0.022, 0.07)
        tmp.updateMatrix()
        m.setMatrixAt(i++, tmp.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  }, [])

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    easing.damp(solvedT.current, 'v', solved ? 1 : 0, 0.55, dt)
    const s = solvedT.current.v
    // flicker: a slow sine + a little noise, with a bump mid-transition
    const flicker = 0.9 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 23.7) * 0.03 + (Math.random() - 0.5) * 0.05
    const surge = Math.sin(Math.min(1, s) * Math.PI) * 2.2
    target.set(solved ? MINT : ACCENT)
    if (screenMat.current) {
      easing.dampC(screenMat.current.emissive, target, 0.4, dt)
      screenMat.current.emissiveIntensity = (0.22 + s * 0.12) * flicker + surge * 0.15
    }
    if (stripMat.current) {
      easing.dampC(stripMat.current.emissive, target, 0.4, dt)
      stripMat.current.color.copy(stripMat.current.emissive)
      stripMat.current.emissiveIntensity = 1.6 + Math.sin(t * 2.4) * 0.5 + (near ? 1.2 : 0) + surge
    }
    if (light.current) {
      easing.dampC(light.current.color, target, 0.4, dt)
      light.current.intensity = (2.4 + (near ? 0.9 : 0)) * flicker + surge
    }
    if (scanBar.current) {
      scanBar.current.position.y = 0.56 - ((t * 0.55) % 1.12)
    }
    if (scanMat.current) {
      easing.dampC(scanMat.current.color, target, 0.4, dt)
    }
  })

  return (
    <group position={position}>
      {/* interaction point just in front of the desk */}
      <group ref={anchor} position={[0, 0, 1.35]} />

      {/* pedestal */}
      <mesh position={[0, 0.38, 0]} material={darkMetal} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.76, 0.86]} />
      </mesh>
      <mesh position={[0, 0.06, 0.02]} material={bezelMat}>
        <boxGeometry args={[2.5, 0.12, 1.0]} />
      </mesh>

      {/* angled desk top + keyboard */}
      <group position={[0, 0.8, 0]} rotation-x={0.12}>
        <mesh material={deskTopMat} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.08, 1.15]} />
        </mesh>
        {/* accent edge strip along the front */}
        <mesh position={[0, 0.02, 0.57]} material={accentGlowMat}>
          <boxGeometry args={[2.76, 0.025, 0.025]} />
        </mesh>
        {/* keyboard slab */}
        <group position={[0, 0.065, 0.2]}>
          <mesh material={keySlabMat} castShadow>
            <boxGeometry args={[1.28, 0.05, 0.44]} />
          </mesh>
          <instancedMesh ref={keys} args={[unitBox, keyMat, 56]} castShadow />
        </group>
        {/* a small side deck: dark "mouse" puck */}
        <mesh position={[0.95, 0.06, 0.24]} material={keySlabMat}>
          <boxGeometry args={[0.18, 0.04, 0.26]} />
        </mesh>
      </group>

      {/* monitor neck + angled screen */}
      <mesh position={[0, 1.05, -0.36]} material={bezelMat} castShadow>
        <boxGeometry args={[0.2, 0.55, 0.12]} />
      </mesh>
      <group position={[0, 1.68, -0.4]} rotation-x={-0.16}>
        <mesh material={bezelMat} castShadow>
          <boxGeometry args={[2.34, 1.42, 0.1]} />
        </mesh>
        {/* the glass */}
        <mesh position={[0, 0.02, 0.053]}>
          <planeGeometry args={[2.12, 1.22]} />
          <meshStandardMaterial ref={screenMat} color="#04080a" emissive={solved ? MINT : ACCENT} emissiveIntensity={0.25} roughness={0.25} metalness={0.1} toneMapped={false} />
        </mesh>
        {/* scan bar drifting down the glass */}
        <mesh ref={scanBar} position={[0, 0.3, 0.058]}>
          <planeGeometry args={[2.12, 0.05]} />
          <meshBasicMaterial ref={scanMat} color={solved ? MINT : ACCENT} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* on-screen text */}
        <TextPlane text="ONBOARDING GATEWAY" size={[1.9, 0.3]} position={[0, 0.33, 0.062]} width={1024} height={160} font={`bold 88px ${SANS}`} color="#eef4ff" glow={8} />
        <TextPlane text={`${TERMINAL_PUZZLE.user}@${TERMINAL_PUZZLE.hostname}`} size={[1.7, 0.16]} position={[0, 0.1, 0.062]} width={1024} height={96} font={`58px ${MONO}`} color="#7c8aa8" />
        <TextPlane
          text={solved ? 'ACCESS GRANTED' : 'STATUS: LOCKED'}
          size={[1.9, 0.34]}
          position={[0, -0.24, 0.062]}
          width={1024}
          height={180}
          font={`bold 96px ${MONO}`}
          color={solved ? MINT : ACCENT}
          glow={16}
        />
        {/* status light bar under the glass */}
        <mesh position={[0, -0.665, 0.06]}>
          <boxGeometry args={[2.2, 0.035, 0.035]} />
          <meshStandardMaterial ref={stripMat} color={solved ? MINT : ACCENT} emissive={solved ? MINT : ACCENT} emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      </group>

      <pointLight ref={light} position={[0, 1.7, 0.9]} color={solved ? MINT : ACCENT} intensity={2.4} distance={6.5} decay={2} />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.42, 0.7, 0.62]} position={[0, 0.7, -0.02]} />
      </RigidBody>
    </group>
  )
}

// ── Server racks along the far wall ──────────────────────────────────────────
const RACK_X = [-5.8, -4.5, -3.2, 3.2, 4.5, 5.8]
const UNITS = 8
const LEDS_PER_UNIT = 6
const LED_COUNT = RACK_X.length * UNITS * LEDS_PER_UNIT

function ServerRacks({ z, solved }: { z: number; solved: boolean }) {
  const cabinets = useRef<THREE.InstancedMesh>(null)
  const plates = useRef<THREE.InstancedMesh>(null)
  const strips = useRef<THREE.InstancedMesh>(null)
  const leds = useRef<THREE.InstancedMesh>(null)
  const nextFlip = useMemo(() => new Float32Array(LED_COUNT), [])
  const solvedT = useRef({ v: solved ? 1 : 0 })
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const cab = cabinets.current
    const pl = plates.current
    const st = strips.current
    const led = leds.current
    if (!cab || !pl || !st || !led) return
    let pi = 0
    let li = 0
    RACK_X.forEach((x, ri) => {
      o.position.set(x, 1.35, 0)
      o.scale.set(1.1, 2.7, 0.9)
      o.updateMatrix()
      cab.setMatrixAt(ri, o.matrix)

      o.position.set(x, 2.71, 0.44)
      o.scale.set(1.06, 0.03, 0.03)
      o.updateMatrix()
      st.setMatrixAt(ri, o.matrix)

      for (let u = 0; u < UNITS; u++) {
        const y = 0.36 + u * 0.28
        o.position.set(x, y, 0.46)
        o.scale.set(0.98, 0.22, 0.04)
        o.updateMatrix()
        pl.setMatrixAt(pi++, o.matrix)
        for (let k = 0; k < LEDS_PER_UNIT; k++) {
          o.position.set(x - 0.41 + k * 0.062, y, 0.49)
          o.scale.set(0.036, 0.036, 0.03)
          o.updateMatrix()
          led.setMatrixAt(li, o.matrix)
          led.setColorAt(li, tmpColor.setRGB(0.05, 0.35, 0.12))
          nextFlip[li] = Math.random() * 1.5
          li++
        }
      }
    })
    cab.instanceMatrix.needsUpdate = true
    pl.instanceMatrix.needsUpdate = true
    st.instanceMatrix.needsUpdate = true
    led.instanceMatrix.needsUpdate = true
    if (led.instanceColor) led.instanceColor.needsUpdate = true
  }, [nextFlip, tmpColor])

  useFrame((st, dt) => {
    const led = leds.current
    if (!led) return
    const t = st.clock.elapsedTime
    easing.damp(solvedT.current, 'v', solved ? 1 : 0, 0.7, dt)
    const s = solvedT.current.v
    const transitioning = s > 0.02 && s < 0.98
    let changed = false
    for (let i = 0; i < LED_COUNT; i++) {
      if (t < nextFlip[i]) continue
      nextFlip[i] = t + (transitioning ? 0.08 + Math.random() * 0.25 : 0.15 + Math.random() * 1.6)
      const r = Math.random()
      if (Math.random() < s) {
        // unsealed palette: mint, with occasional bright white-mint pulses
        if (r < 0.5) tmpColor.setRGB(0.08, 0.45, 0.3)
        else if (r < 0.92) tmpColor.setRGB(0.35, 1.7, 1.05)
        else tmpColor.setRGB(1.2, 2.0, 1.6)
      } else {
        // locked palette: dim/bright green, amber, the odd red fault
        if (r < 0.5) tmpColor.setRGB(0.05, 0.35, 0.12)
        else if (r < 0.82) tmpColor.setRGB(0.2, 1.5, 0.45)
        else if (r < 0.94) tmpColor.setRGB(1.5, 0.85, 0.12)
        else tmpColor.setRGB(1.9, 0.18, 0.25)
      }
      led.setColorAt(i, tmpColor)
      changed = true
    }
    if (changed && led.instanceColor) led.instanceColor.needsUpdate = true
  })

  return (
    <group position={[0, 0, z]}>
      <instancedMesh ref={cabinets} args={[unitBox, darkMetal, RACK_X.length]} castShadow receiveShadow />
      <instancedMesh ref={plates} args={[unitBox, faceplateMat, RACK_X.length * UNITS]} />
      <instancedMesh ref={strips} args={[unitBox, accentGlowMat, RACK_X.length]} />
      <instancedMesh ref={leds} args={[unitBox, ledMat, LED_COUNT]} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.0, 1.4, 0.5]} position={[-4.5, 1.4, 0]} />
        <CuboidCollider args={[2.0, 1.4, 0.5]} position={[4.5, 1.4, 0]} />
      </RigidBody>
    </group>
  )
}

// ── Cable bundles from the racks down to the desk ────────────────────────────
function Cables() {
  const tubes = useMemo(() => {
    const mk = (pts: [number, number, number][], r = 0.035) =>
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 48, r, 6, false)
    return [
      mk([[-4.5, 2.72, -22.2], [-3.2, 3.15, -22.45], [-1.1, 3.05, -22.45], [-0.35, 2.0, -21.6], [-0.25, 0.1, -20.7]]),
      mk([[4.5, 2.72, -22.2], [3.1, 3.25, -22.45], [1.0, 3.1, -22.45], [0.35, 2.1, -21.6], [0.25, 0.1, -20.7]], 0.03),
      mk([[-5.8, 2.72, -22.2], [-5.2, 3.4, -22.5], [-2.2, 3.42, -22.5], [0.55, 2.9, -22.3], [0.5, 0.1, -20.75]], 0.028),
      mk([[5.8, 2.72, -22.2], [5.0, 3.35, -22.5], [2.4, 3.36, -22.5], [-0.55, 2.7, -22.3], [-0.5, 0.1, -20.75]], 0.026),
    ]
  }, [])
  return (
    <group>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={i === 2 ? cableAccentMat : cableMat} />
      ))}
      {/* floor cable channel between desk and wall */}
      <mesh position={[0, 0.02, -21.6]} material={bezelMat} receiveShadow>
        <boxGeometry args={[0.7, 0.04, 2.3]} />
      </mesh>
    </group>
  )
}

// ── Holographic onboarding funnel ────────────────────────────────────────────
const BAR_ROWS = [
  { y: 0.72, w: 1.7, mat: holoAccentMat },
  { y: 0.32, w: 1.42, mat: holoAccentMat },
  { y: -0.08, w: 1.42 * (1 - FUNNEL.after / 100), mat: holoMintMat },
  { y: -0.48, w: 1.42 * (1 - FUNNEL.after / 100) * 0.86, mat: holoMintMat },
]

function FunnelHologram({ position, rotationY, solved }: { position: [number, number, number]; rotationY: number; solved: boolean }) {
  const cloud = useRef<THREE.Group>(null)
  const bars = useRef<(THREE.Mesh | null)[]>([])
  const beam = useRef<THREE.MeshBasicMaterial>(null)
  const ring = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((st) => {
    const t = st.clock.elapsedTime
    if (cloud.current) {
      cloud.current.position.y = 2.05 + Math.sin(t * 1.1) * 0.06
      cloud.current.rotation.y = Math.sin(t * 0.35) * 0.12
    }
    bars.current.forEach((b, i) => {
      if (!b) b = null
      if (!b) return
      b.position.y = BAR_ROWS[i].y + Math.sin(t * 1.6 + i * 0.9) * 0.018
      const pulse = 1 + Math.sin(t * 2.2 + i) * 0.012
      b.scale.set(BAR_ROWS[i].w * pulse, 0.17, 0.32)
    })
    if (beam.current) beam.current.opacity = 0.06 + Math.sin(t * 3.1) * 0.015 + (solved ? 0.02 : 0)
    if (ring.current) ring.current.emissiveIntensity = 1.8 + Math.sin(t * 2.6) * 0.5
  })

  return (
    <group position={position} rotation-y={rotationY}>
      {/* projector base */}
      <mesh position={[0, 0.09, 0]} material={darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.66, 0.18, 28]} />
      </mesh>
      <mesh position={[0, 0.185, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.44, 0.03, 8, 40]} />
        <meshStandardMaterial ref={ring} color={ACCENT} emissive={ACCENT} emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      {/* light cone */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[1.05, 0.2, 2.3, 28, 1, true]} />
        <meshBasicMaterial ref={beam} color={ACCENT} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.35, 0]} material={beamMat}>
        <cylinderGeometry args={[0.5, 0.12, 2.2, 20, 1, true]} />
      </mesh>
      {/* the floating funnel */}
      <group ref={cloud} position={[0, 2.05, 0]}>
        {BAR_ROWS.map((row, i) => (
          <mesh
            key={i}
            ref={(el) => {
              bars.current[i] = el
            }}
            geometry={unitBox}
            material={row.mat}
            position={[0, row.y, 0]}
            scale={[row.w, 0.17, 0.32]}
          />
        ))}
        {/* ghost of the old drop-off on step 3 */}
        <mesh geometry={unitBox} material={holoGhostMat} position={[0, BAR_ROWS[2].y, -0.02]} scale={[1.42 * (1 - FUNNEL.before / 100), 0.21, 0.3]} />
        <TextPlane text="ONBOARDING FUNNEL" size={[1.8, 0.22]} position={[0, 1.05, 0]} width={1024} height={128} font={`bold 76px ${SANS}`} color={ACCENT} glow={10} />
        <TextPlane text={FUNNEL.label} size={[1.3, 0.24]} position={[1.35, BAR_ROWS[2].y, 0]} width={768} height={144} font={`bold 84px ${MONO}`} color="#ffffff" glow={12} />
        <TextPlane text="STEP 3 · DROP-OFF" size={[1.3, 0.14]} position={[1.35, BAR_ROWS[2].y - 0.2, 0]} width={768} height={96} font={`bold 56px ${SANS}`} color="#9aa3c7" />
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.62, 0.5, 0.62]} position={[0, 0.5, 0]} />
      </RigidBody>
    </group>
  )
}

// ── Wall-mounted log panel on the left wall ──────────────────────────────────
function LogPanel() {
  const lines = TERMINAL_PUZZLE.files['onboarding.log'] ?? []
  return (
    <group position={[-7.66, 2.25, -15.6]} rotation-y={Math.PI / 2}>
      <mesh material={panelMat} castShadow>
        <boxGeometry args={[4.2, 1.7, 0.08]} />
      </mesh>
      <mesh position={[0, 0.78, 0.045]} material={accentGlowMat}>
        <boxGeometry args={[4.1, 0.025, 0.02]} />
      </mesh>
      <TextPlane text="GWE · ONBOARDING LOG" size={[2.4, 0.2]} position={[-0.85, 0.6, 0.05]} width={1024} height={96} font={`bold 62px ${SANS}`} color={ACCENT} glow={8} align="left" />
      <TextPlane text={lines} size={[4.0, 1.1]} position={[0, -0.12, 0.05]} width={1536} height={420} font={`44px ${MONO}`} color="#9dffb8" align="left" lineHeight={1.5} padding={28} glow={4} />
    </group>
  )
}
