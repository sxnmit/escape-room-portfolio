import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { ABOUT } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { ChamberShell } from './Chamber'
import { SPOKES } from './layout'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

const GOLD = '#ffd166'

/** The closing room behind the final door. A monolith opens the About panel. */
export function AboutRoom() {
  const spoke = SPOKES.about
  const [, , cz] = spoke.roomCenterLocal
  return (
    <ChamberShell id="about" accent={GOLD}>
      <Monolith position={[0, 0, cz - 1]} />
      {/* orbiting rings of light */}
      <Orbits position={[0, 2.6, cz - 1]} />
    </ChamberShell>
  )
}

function Monolith({ position }: { position: [number, number, number] }) {
  const anchor = useRef<THREE.Group>(null)
  const glow = useRef<THREE.MeshStandardMaterial>(null)
  const near = useInteractable(
    {
      id: 'about:monolith',
      radius: 3.2,
      prompt: 'Meet Sunny',
      onInteract: () => {
        sfx.play('unlock')
        useGame.getState().openOverlay({ kind: 'about' })
      },
    },
    anchor,
  )
  useFrame((st) => {
    if (glow.current) glow.current.emissiveIntensity = 0.9 + Math.sin(st.clock.elapsedTime * 2) * 0.3 + (near ? 0.8 : 0)
  })
  return (
    <group position={position}>
      <group ref={anchor} position={[0, 0, 1.6]} />
      <mesh position-y={0.15} receiveShadow>
        <cylinderGeometry args={[2.2, 2.4, 0.3, 32]} />
        <meshStandardMaterial color="#1f2438" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position-y={1.9} castShadow>
        <boxGeometry args={[1.4, 3.2, 0.5]} />
        <meshStandardMaterial color="#0f1220" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.9, 0.27]}>
        <planeGeometry args={[1.0, 2.6]} />
        <meshStandardMaterial ref={glow} color={GOLD} emissive={GOLD} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <TextPlane text={ABOUT.name.toUpperCase()} size={[3.6, 0.6]} position={[0, 3.9, 0.3]} width={1024} height={170} font='bold 90px "Georgia", serif' color={GOLD} glow={10} />
      <pointLight position={[0, 2.5, 1.5]} color={GOLD} intensity={4} distance={10} decay={2} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 1.7, 0.4]} position={[0, 1.7, 0]} />
        <CuboidCollider args={[2.2, 0.15, 2.2]} position={[0, 0.15, 0]} />
      </RigidBody>
    </group>
  )
}

function Orbits({ position }: { position: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  useFrame((st) => {
    if (!g.current) return
    const t = st.clock.elapsedTime
    g.current.rotation.y = t * 0.25
    g.current.rotation.x = Math.sin(t * 0.3) * 0.3
  })
  return (
    <group ref={g} position={position}>
      {[3.2, 4.1, 5].map((r, i) => (
        <mesh key={r} rotation-x={Math.PI / 2 + i * 0.4}>
          <torusGeometry args={[r, 0.02, 8, 80]} />
          <meshBasicMaterial color={GOLD} toneMapped={false} transparent opacity={0.5 - i * 0.12} />
        </mesh>
      ))}
    </group>
  )
}
