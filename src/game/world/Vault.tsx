import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { VAULT_ANGLES, WALL_T, faceFrame } from './layout'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

const housingMat = new THREE.MeshStandardMaterial({ color: '#1b2030', roughness: 0.5, metalness: 0.5 })
const doorMat = new THREE.MeshStandardMaterial({ color: '#4b5478', roughness: 0.35, metalness: 0.75 })
const ringMat = new THREE.MeshStandardMaterial({ color: '#8a93b8', roughness: 0.3, metalness: 0.9 })

/**
 * A wall-mounted circular vault in the hub. Sealed until the matching chamber
 * is solved; then the wheel spins, the door swings open and a glowing artifact
 * floats out. Interacting shows that chapter of the resume.
 */
export function ResumeVault({ chamber }: { chamber: ChamberId }) {
  const content = CHAMBERS[chamber]
  const frame = faceFrame(VAULT_ANGLES[chamber])
  const solved = useGame((s) => !!s.solved[chamber])
  const revealed = useGame((s) => !!s.revealed[chamber])
  const anchor = useRef<THREE.Group>(null)
  const hinge = useRef<THREE.Group>(null)
  const wheel = useRef<THREE.Mesh>(null)
  const artifact = useRef<THREE.Group>(null)
  const inner = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const wasSolved = useRef(solved)

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

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    if (solved && !wasSolved.current) {
      wasSolved.current = true
    }
    // door swings open around its left hinge
    if (hinge.current) easing.damp(hinge.current.rotation, 'y', solved ? -1.9 : 0, 0.6, dt)
    if (wheel.current) {
      wheel.current.rotation.z += dt * (solved ? 0.6 : 0.05)
    }
    if (artifact.current) {
      const target = solved ? 1 : 0
      easing.damp(artifact.current.scale, 'x', target, 0.5, dt)
      artifact.current.scale.y = artifact.current.scale.z = artifact.current.scale.x
      artifact.current.rotation.y = t * 0.8
      artifact.current.position.y = 1.7 + Math.sin(t * 1.6) * 0.12
    }
    if (inner.current) {
      inner.current.emissiveIntensity = solved ? 1.2 + Math.sin(t * 2) * 0.4 + (near ? 0.8 : 0) : 0.05
    }
    if (light.current) light.current.intensity = solved ? 2.2 + Math.sin(t * 2) * 0.6 : 0
  })

  const D = 1.15 // depth of the housing that protrudes into the hub
  const face = WALL_T / 2 + D // local z of the housing's front

  return (
    <group position={frame.origin} rotation-y={frame.rotationY}>
      <group ref={anchor} position={[0, 0, face + 1.2]} />
      {/* housing */}
      <mesh position={[0, 1.75, WALL_T / 2 + D / 2]} material={housingMat} castShadow receiveShadow>
        <boxGeometry args={[3.4, 3.5, D]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.7, 1.75, D / 2]} position={[0, 1.75, WALL_T / 2 + D / 2]} />
      </RigidBody>
      {/* glowing interior disc (visible once the door swings) */}
      <mesh position={[0, 1.7, face - 0.3]}>
        <circleGeometry args={[1.05, 40]} />
        <meshStandardMaterial ref={inner} color={content.accent} emissive={content.accent} emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      {/* concentric ring frame */}
      <mesh position={[0, 1.7, face - 0.02]} material={ringMat}>
        <torusGeometry args={[1.18, 0.09, 12, 48]} />
      </mesh>
      {/* the door on a hinge at its left edge */}
      <group ref={hinge} position={[-1.15, 1.7, face + 0.06]}>
        <group position={[1.15, 0, 0]}>
          <mesh rotation-x={Math.PI / 2} material={doorMat} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 0.16, 48]} />
          </mesh>
          <mesh ref={wheel} position-z={0.12} material={ringMat}>
            <torusGeometry args={[0.45, 0.05, 10, 32]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position-z={0.12} rotation-z={(i * Math.PI) / 3} material={ringMat}>
              <boxGeometry args={[0.95, 0.06, 0.06]} />
            </mesh>
          ))}
          <mesh position-z={0.12} material={ringMat}>
            <sphereGeometry args={[0.1, 12, 12]} />
          </mesh>
          {/* numeral engraved on the door */}
          <TextPlane text={content.numeral} size={[0.9, 0.9]} position={[0, -0.55, 0.09]} width={256} height={256} font='bold 170px "Georgia", serif' color="#c9d0f0" />
        </group>
      </group>
      {/* floating artifact once open */}
      <group ref={artifact} position={[0, 1.7, face + 0.9]} scale={0}>
        <mesh castShadow>
          <octahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color={content.accent} emissive={content.accent} emissiveIntensity={1.4} roughness={0.2} metalness={0.4} toneMapped={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.55, 0.02, 8, 40]} />
          <meshBasicMaterial color={content.accent} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 1.9, face + 1]} color={content.accent} intensity={0} distance={7} decay={2} />
      {/* label */}
      <TextPlane text={[`VAULT ${content.numeral}`, content.name.toUpperCase()]} size={[2.8, 0.75]} position={[0, 3.95, face + 0.02]} width={768} height={200} font='bold 66px "Inter", system-ui, sans-serif' color="#e8ecff" glow={8} />
    </group>
  )
}
