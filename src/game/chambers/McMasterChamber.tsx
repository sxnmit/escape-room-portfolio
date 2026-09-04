import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CHAMBERS, LANTERNS_PUZZLE } from '@/data/resume'
import { SPOKES } from '@/game/world/layout'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'
import { Lamp, lampFlag } from '@/game/puzzles3d/Lanterns'

/**
 * Chamber V — McMaster · lecture hall.
 * Tiered bench rows flank a central aisle, a chalkboard fills the far wall,
 * a lectern (the briefing) stands at the puzzle anchor and four study lamps
 * wait in the corners. Light all four and the hall wakes up: the chalkboard
 * reveals the class year and a graduation cap floats above the lectern.
 * Rendered inside the spoke's local frame: −z away from the hub,
 * x ∈ [−8, 8], z ∈ [−7, −23].
 */

const C = CHAMBERS.mcmaster
const ACCENT = C.accent
const SERIF = '"Georgia", "Times New Roman", serif'
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif'
const CHALK = '#f1ecdd'

const woodMat = new THREE.MeshStandardMaterial({ color: '#5a3b23', roughness: 0.7, metalness: 0.05 })
const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#3a2415', roughness: 0.75, metalness: 0.05 })
const seatMat = new THREE.MeshStandardMaterial({ color: '#2b3350', roughness: 0.8 })
const stepMat = new THREE.MeshStandardMaterial({ color: '#2a3047', roughness: 0.9 })
const boardMat = new THREE.MeshStandardMaterial({ color: '#1c3a31', roughness: 0.95 })
const frameMat = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.6, metalness: 0.1 })
const brassMat = new THREE.MeshStandardMaterial({ color: '#c8a45a', roughness: 0.35, metalness: 0.8 })
const capMat = new THREE.MeshStandardMaterial({ color: '#111522', roughness: 0.5, metalness: 0.3 })
const bannerMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.8, side: THREE.DoubleSide })

const classYear = (/(\d{4})\D*$/.exec(C.dates)?.[1] ?? '').trim()

/** Lamp placement: front pair by the entrance, back pair by the chalkboard; labels come from the data file. */
const LAMP_SPOTS: { position: [number, number, number]; facing: 1 | -1 }[] = [
  { position: [-6.3, 0, -9.3], facing: 1 },
  { position: [6.3, 0, -9.3], facing: -1 },
  { position: [-6.3, 0, -20.7], facing: 1 },
  { position: [6.3, 0, -20.7], facing: -1 },
]

export function McMasterChamber() {
  const spoke = SPOKES.mcmaster
  const solved = useGame((s) => !!s.solved.mcmaster)
  const litCount = useGame((s) => LANTERNS_PUZZLE.lamps.filter((l) => !!s.flags[lampFlag(l.id)]).length)
  const total = LANTERNS_PUZZLE.lamps.length

  // all lamps lit → solve once
  useEffect(() => {
    if (litCount < total || solved) return
    const g = useGame.getState()
    g.solve('mcmaster')
    sfx.play('success')
    g.showToast(LANTERNS_PUZZLE.successText, 'success')
  }, [litCount, total, solved])

  return (
    <group>
      <Chalkboard solved={solved} />
      <Lectern position={spoke.puzzleAnchorLocal} solved={solved} litCount={litCount} total={total} />
      <Benches solved={solved} />
      <Banner x={-7.62} rotationY={Math.PI / 2} />
      <Banner x={7.62} rotationY={-Math.PI / 2} />
      {LANTERNS_PUZZLE.lamps.map((lamp, i) => (
        <Lamp key={lamp.id} id={lamp.id} label={lamp.label} position={LAMP_SPOTS[i % LAMP_SPOTS.length].position} facing={LAMP_SPOTS[i % LAMP_SPOTS.length].facing} accent={ACCENT} />
      ))}
    </group>
  )
}

function Chalkboard({ solved }: { solved: boolean }) {
  const reveal = useRef<THREE.Group>(null)
  const underline = useRef<THREE.MeshStandardMaterial>(null)
  const boardLight = useRef<THREE.PointLight>(null)
  const s = useRef(solved ? 1 : 0)
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    s.current = THREE.MathUtils.damp(s.current, solved ? 1 : 0, 3, dt)
    const k = s.current
    if (reveal.current) {
      const bounce = solved ? 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.12 : 1
      reveal.current.scale.setScalar(Math.max(0.0001, k * bounce))
    }
    if (underline.current) underline.current.emissiveIntensity = k * (2 + Math.sin(st.clock.elapsedTime * 2) * 0.5)
    if (boardLight.current) boardLight.current.intensity = k * 6
  })
  const z = -22.56
  return (
    <group position={[0, 0, z]}>
      {/* frame + board */}
      <mesh position={[0, 2.55, -0.05]} material={frameMat} castShadow>
        <boxGeometry args={[10.2, 3.7, 0.12]} />
      </mesh>
      <mesh position={[0, 2.55, 0.02]} material={boardMat}>
        <boxGeometry args={[9.7, 3.2, 0.04]} />
      </mesh>
      {/* chalk tray */}
      <mesh position={[0, 0.9, 0.12]} material={frameMat}>
        <boxGeometry args={[9.7, 0.08, 0.22]} />
      </mesh>
      {[-3.2, -2.6, 2.9].map((x, i) => (
        <mesh key={i} position={[x, 0.97, 0.12]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <meshStandardMaterial color={i === 2 ? ACCENT : CHALK} roughness={0.9} />
        </mesh>
      ))}
      {/* chalk writing — derived from the data file, never retyped */}
      <TextPlane text={C.org.toUpperCase()} size={[7.6, 0.7]} position={[0, 3.55, 0.06]} width={1536} height={140} font={`bold 100px ${SERIF}`} color={CHALK} />
      <TextPlane text={C.role} size={[7.0, 0.5]} position={[0, 2.9, 0.06]} width={1536} height={110} font={`italic 76px ${SERIF}`} color={CHALK} opacity={0.9} />
      <TextPlane text={LANTERNS_PUZZLE.lamps.map((l) => l.label).join('   ·   ')} size={[8.6, 0.32]} position={[0, 2.3, 0.06]} width={2048} height={76} font={`500 46px ${SANS}`} color={CHALK} opacity={0.75} />
      {/* doodles */}
      <TextPlane text="O(n log n)" size={[1.6, 0.4]} position={[-3.6, 1.6, 0.06]} rotation={[0, 0, 0.08]} width={512} height={128} font={`italic 70px ${SERIF}`} color={CHALK} opacity={0.6} />
      <TextPlane text="∀x ∃y : f(x) = y" size={[2.0, 0.4]} position={[3.4, 1.65, 0.06]} rotation={[0, 0, -0.06]} width={640} height={128} font={`italic 64px ${SERIF}`} color={CHALK} opacity={0.6} />
      {/* revealed once the hall is lit */}
      <group ref={reveal} position={[0, 1.55, 0.07]} scale={0.0001}>
        <TextPlane text={`CLASS OF ${classYear} ✓`} size={[4.6, 0.7]} width={1024} height={160} font={`bold 118px ${SERIF}`} color={ACCENT} glow={14} />
        <mesh position={[0, -0.38, 0]}>
          <boxGeometry args={[3.8, 0.05, 0.01]} />
          <meshStandardMaterial ref={underline} color={ACCENT} emissive={ACCENT} emissiveIntensity={0} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={boardLight} position={[0, 2.4, 1.6]} color={ACCENT} intensity={0} distance={9} decay={2} />
    </group>
  )
}

function Lectern({ position, solved, litCount, total }: { position: [number, number, number]; solved: boolean; litCount: number; total: number }) {
  const anchor = useRef<THREE.Group>(null)
  const cap = useRef<THREE.Group>(null)
  const dots = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const crest = useRef<THREE.MeshStandardMaterial>(null)
  const capScale = useRef(solved ? 1 : 0)
  const near = useInteractable(
    {
      id: 'console:mcmaster',
      radius: 2.6,
      prompt: solved ? 'Lecture hall · lit' : 'Read the briefing',
      onInteract: () => {
        const g = useGame.getState()
        sfx.play('ui')
        if (solved) {
          g.showToast(`Chamber ${C.numeral} is complete — the ${C.name} vault awaits in the hub.`, 'success')
          return
        }
        g.openOverlay({ kind: 'briefing', chamber: 'mcmaster' })
      },
    },
    anchor,
  )
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = st.clock.elapsedTime
    capScale.current = THREE.MathUtils.damp(capScale.current, solved ? 1 : 0, 3, dt)
    if (cap.current) {
      const k = capScale.current
      cap.current.scale.setScalar(Math.max(0.0001, k))
      cap.current.rotation.y = t * 0.7
      cap.current.position.y = 2.75 + Math.sin(t * 1.5) * 0.12 + (1 - k) * -0.6
    }
    dots.current.forEach((m, i) => {
      if (!m) return
      const on = i < litCount
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, on ? 2.2 + Math.sin(t * 3 + i) * 0.3 : 0.08, 6, dt)
    })
    if (crest.current) crest.current.emissiveIntensity = 0.5 + (near ? 1.2 + Math.sin(t * 5) * 0.4 : 0) + (solved ? 1.5 : 0)
  })
  return (
    <group position={position}>
      <group ref={anchor} position={[0, 0, 1.3]} />
      <mesh position-y={0.4} material={darkWoodMat} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.8, 0.8]} />
      </mesh>
      <mesh position-y={0.95} material={woodMat} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.6]} />
      </mesh>
      <mesh position={[0, 1.28, 0.05]} rotation-x={0.42} material={woodMat} castShadow>
        <boxGeometry args={[1.2, 0.08, 0.8]} />
      </mesh>
      {/* crest + progress dots on the front face */}
      <mesh position={[0, 0.62, 0.41]}>
        <circleGeometry args={[0.16, 24]} />
        <meshStandardMaterial ref={crest} color={ACCENT} emissive={ACCENT} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {Array.from({ length: total }, (_, i) => (
        <mesh key={i} position={[-0.3 + (i * 0.6) / Math.max(1, total - 1), 0.25, 0.41]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial
            ref={(m) => {
              dots.current[i] = m
            }}
            color="#ffd9a0"
            emissive="#ffd9a0"
            emissiveIntensity={0.08}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* graduation cap, rises once the hall is lit */}
      <group ref={cap} position={[0, 2.75, 0]} scale={0.0001}>
        <mesh position-y={0.18} material={capMat} castShadow>
          <boxGeometry args={[1.0, 0.06, 1.0]} />
        </mesh>
        <mesh material={capMat} castShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.3, 20]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} material={brassMat}>
          <sphereGeometry args={[0.05, 10, 10]} />
        </mesh>
        <mesh position={[0.42, 0.02, 0.42]} rotation-z={0.15} material={brassMat}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        </mesh>
        <mesh position={[0.46, -0.24, 0.42]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.4, 0]} color={ACCENT} intensity={3} distance={6} decay={2} />
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.6, 0.75, 0.45]} position={[0, 0.75, 0]} />
      </RigidBody>
    </group>
  )
}

/** Three stepped rows of benches per side, facing the chalkboard. The central aisle stays clear. */
function Benches({ solved }: { solved: boolean }) {
  const strip = useRef<THREE.MeshStandardMaterial>(null)
  const rows = useMemo(() => [0, 1, 2].map((k) => ({ z: -10.9 - k * 2.3, h: 0.2 * k })), [])
  useFrame((st, rawDt) => {
    if (!strip.current) return
    const dt = Math.min(rawDt, 1 / 20)
    strip.current.emissiveIntensity = THREE.MathUtils.damp(strip.current.emissiveIntensity, solved ? 1.8 + Math.sin(st.clock.elapsedTime * 2) * 0.3 : 0.12, 3, dt)
  })
  const stripMat = (
    <meshStandardMaterial ref={strip} color={ACCENT} emissive={ACCENT} emissiveIntensity={0.12} toneMapped={false} />
  )
  return (
    <group>
      {[-1, 1].map((side) =>
        rows.map(({ z, h }, k) => {
          const cx = side * 4.85
          return (
            <group key={`${side}-${k}`} position={[cx, 0, z]}>
              {h > 0 && (
                <mesh position-y={h / 2} material={stepMat} receiveShadow>
                  <boxGeometry args={[4.9, h, 2.2]} />
                </mesh>
              )}
              {/* seat */}
              <mesh position={[0, h + 0.28, 0.35]} material={seatMat} castShadow receiveShadow>
                <boxGeometry args={[4.7, 0.16, 0.5]} />
              </mesh>
              <mesh position={[0, h + 0.55, 0.58]} material={seatMat} castShadow>
                <boxGeometry args={[4.7, 0.5, 0.08]} />
              </mesh>
              {/* desk */}
              <mesh position={[0, h + 0.8, -0.35]} material={woodMat} castShadow receiveShadow>
                <boxGeometry args={[4.9, 0.08, 0.6]} />
              </mesh>
              <mesh position={[0, h + 0.55, -0.62]} material={darkWoodMat} castShadow>
                <boxGeometry args={[4.9, 0.5, 0.06]} />
              </mesh>
              {/* edge light strip on the desk front */}
              <mesh position={[0, h + 0.82, -0.66]}>
                <boxGeometry args={[4.8, 0.03, 0.03]} />
                {k === 0 && side === -1 ? stripMat : <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={solved ? 1.8 : 0.12} toneMapped={false} />}
              </mesh>
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[2.45, (h + 0.9) / 2, 0.85]} position={[0, (h + 0.9) / 2, -0.05]} />
              </RigidBody>
            </group>
          )
        }),
      )}
    </group>
  )
}

function Banner({ x, rotationY }: { x: number; rotationY: number }) {
  return (
    <group position={[x, 3.1, -15]} rotation-y={rotationY}>
      <mesh material={bannerMat}>
        <planeGeometry args={[3.4, 1.3]} />
      </mesh>
      <mesh position-y={0.72} rotation-z={Math.PI / 2} material={brassMat}>
        <cylinderGeometry args={[0.04, 0.04, 3.6, 8]} />
      </mesh>
      <TextPlane text={C.name.toUpperCase()} size={[3.0, 0.7]} position={[0, 0.1, 0.02]} width={1024} height={240} font={`bold 150px ${SERIF}`} color="#1a0b12" />
      <TextPlane text={C.theme.split('—')[0].trim().toUpperCase()} size={[3.0, 0.3]} position={[0, -0.4, 0.02]} width={1024} height={100} font={`600 54px ${SANS}`} color="#1a0b12" opacity={0.8} />
    </group>
  )
}
