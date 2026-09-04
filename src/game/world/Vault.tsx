import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { VAULT_ANGLES, WALL_T, faceFrame, frameToWorld } from './layout'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'
import { spawnBurst } from '@/game/fx/Burst'
import { playerSnapshot } from '@/game/Player'

const housingMat = new THREE.MeshStandardMaterial({ color: '#232a3f', roughness: 0.5, metalness: 0.5 })
const doorMat = new THREE.MeshStandardMaterial({ color: '#59638c', roughness: 0.35, metalness: 0.75 })
const ringMat = new THREE.MeshStandardMaterial({ color: '#9aa3c8', roughness: 0.3, metalness: 0.9 })

const D = 1.15 // depth of the housing that protrudes into the hub
const FACE = WALL_T / 2 + D // local z of the housing's front
/** How close the player must be for the opening sequence to play (so they actually see it). */
const SEQUENCE_RANGE = 15

/**
 * A wall-mounted circular vault in the hub. Sealed until the matching chamber
 * is solved. When the player then comes back within range, the wheel spins
 * up, the door swings open with a burst and a glowing artifact floats out.
 * Interacting shows that chapter of the resume.
 */
export function ResumeVault({ chamber }: { chamber: ChamberId }) {
  const content = CHAMBERS[chamber]
  const frame = useMemo(() => faceFrame(VAULT_ANGLES[chamber]), [chamber])
  const solved = useGame((s) => !!s.solved[chamber])
  const revealed = useGame((s) => !!s.revealed[chamber])
  const anchor = useRef<THREE.Group>(null)
  const hinge = useRef<THREE.Group>(null)
  const wheel = useRef<THREE.Mesh>(null)
  const artifact = useRef<THREE.Group>(null)
  const inner = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  // solved on mount (reload) → already open; otherwise wait for the player to come see it
  const seq = useRef({ played: solved, start: -100, burst: solved })
  const worldArtifact = useMemo(() => frameToWorld(frame, [0, 1.7, FACE + 0.9]), [frame])
  const worldCenter = useMemo(() => frameToWorld(frame, [0, 0, FACE]), [frame])

  const near = useInteractable(
    {
      id: `vault:${chamber}`,
      radius: 3,
      prompt: solved ? (revealed ? `Re-read · ${content.name}` : `Open the ${content.name} vault`) : 'Sealed',
      onInteract: () => {
        const g = useGame.getState()
        if (!solved) {
          sfx.play('locked')
          g.showToast(`Sealed — solve Chamber ${content.numeral} · ${content.name} to unlock this vault.`, 'locked')
          return
        }
        sfx.play('vault')
        g.openOverlay({ kind: 'resume', chamber })
      },
    },
    anchor,
  )

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = st.clock.elapsedTime
    const s = seq.current
    if (solved && !s.played && playerSnapshot.position.distanceTo(worldCenter) < SEQUENCE_RANGE) {
      s.played = true
      s.start = t
      sfx.play('vault')
    }
    // wall-clock phase so the sequence keeps its timing even when frames are slow
    const phase = s.played ? t - s.start : 0
    // 0 – 0.9 s: the wheel spins up; then the door swings; then the artifact pops out
    const spinning = phase > 0 && phase < 0.9
    if (wheel.current) wheel.current.rotation.z += dt * (spinning ? 14 * THREE.MathUtils.smoothstep(phase, 0, 0.25) : phase >= 0.9 ? 0.6 : 0.05)
    const swing = phase >= 0.9
    const overshoot = phase >= 0.9 && phase < 1.6 ? -2.15 : -1.9
    if (hinge.current) easing.damp(hinge.current.rotation, 'y', swing ? overshoot : 0, 0.28, dt)
    const popped = phase >= 1.35
    if (popped && !s.burst) {
      s.burst = true
      spawnBurst([worldArtifact.x, worldArtifact.y, worldArtifact.z], content.accent, 60)
    }
    if (artifact.current) {
      easing.damp(artifact.current.scale, 'x', popped ? 1 : 0, 0.3, dt)
      artifact.current.scale.y = artifact.current.scale.z = artifact.current.scale.x
      artifact.current.rotation.y = t * 0.8
      artifact.current.position.y = 1.7 + Math.sin(t * 1.6) * 0.12
    }
    if (inner.current) {
      inner.current.emissiveIntensity = swing ? 1.2 + Math.sin(t * 2) * 0.4 + (near ? 0.8 : 0) + (phase < 2.2 ? (2.2 - phase) * 2 : 0) : 0.05
    }
    if (light.current) light.current.intensity = swing ? 2.2 + Math.sin(t * 2) * 0.6 + (phase < 2.2 ? (2.2 - phase) * 6 : 0) : 0
  })

  return (
    <group position={frame.origin} rotation-y={frame.rotationY}>
      <group ref={anchor} position={[0, 0, FACE + 1.2]} />
      {/* housing */}
      <mesh position={[0, 1.75, WALL_T / 2 + D / 2]} material={housingMat} castShadow receiveShadow>
        <boxGeometry args={[3.4, 3.5, D]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.7, 1.75, D / 2]} position={[0, 1.75, WALL_T / 2 + D / 2]} />
      </RigidBody>
      {/* glowing interior disc (visible once the door swings) */}
      <mesh position={[0, 1.7, FACE - 0.3]}>
        <circleGeometry args={[1.05, 40]} />
        <meshStandardMaterial ref={inner} color={content.accent} emissive={content.accent} emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      {/* concentric ring frame */}
      <mesh position={[0, 1.7, FACE - 0.02]} material={ringMat}>
        <torusGeometry args={[1.18, 0.09, 12, 48]} />
      </mesh>
      {/* the door on a hinge at its left edge */}
      <group ref={hinge} position={[-1.15, 1.7, FACE + 0.06]}>
        <group position={[1.15, 0, 0]}>
          <mesh rotation-x={Math.PI / 2} material={doorMat} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 0.16, 48]} />
          </mesh>
          <mesh ref={wheel} position-z={0.12} material={ringMat}>
            <torusGeometry args={[0.45, 0.05, 10, 32]} />
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation-z={(i * Math.PI) / 3} material={ringMat}>
                <boxGeometry args={[0.95, 0.06, 0.06]} />
              </mesh>
            ))}
            <mesh material={ringMat}>
              <sphereGeometry args={[0.1, 12, 12]} />
            </mesh>
          </mesh>
          {/* numeral engraved on the door */}
          <TextPlane text={content.numeral} size={[0.9, 0.9]} position={[0, -0.55, 0.09]} width={256} height={256} font='bold 170px "Georgia", serif' color="#c9d0f0" />
        </group>
      </group>
      {/* floating artifact once open */}
      <group ref={artifact} position={[0, 1.7, FACE + 0.9]} scale={0}>
        <mesh castShadow>
          <octahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color={content.accent} emissive={content.accent} emissiveIntensity={1.4} roughness={0.2} metalness={0.4} toneMapped={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.55, 0.02, 8, 40]} />
          <meshBasicMaterial color={content.accent} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 1.9, FACE + 1]} color={content.accent} intensity={0} distance={7} decay={2} />
      {/* label */}
      <TextPlane text={[`VAULT ${content.numeral}`, content.name.toUpperCase()]} size={[2.8, 0.75]} position={[0, 3.95, FACE + 0.02]} width={768} height={200} font='bold 66px "Inter", system-ui, sans-serif' color="#e8ecff" glow={8} />
    </group>
  )
}
