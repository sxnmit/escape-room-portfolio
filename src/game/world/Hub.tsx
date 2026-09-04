import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CHAMBER_ORDER, GAME_SUBTITLE, GAME_TITLE } from '@/data/resume'
import { HUB_APOTHEM, HUB_RADIUS, HUB_SIDES, PLAQUE_ANGLE, WALL_T, faceFrame } from './layout'
import { ChamberDoor, FinalDoor } from './Door'
import { ResumeVault } from './Vault'
import { TextPlane } from '@/utils/TextPlane'
import { useGame, progressCount } from '@/state/gameStore'
import { makeGridTexture } from '@/utils/textures'

const floorMat = new THREE.MeshStandardMaterial({ color: '#4a5278', roughness: 0.9, metalness: 0.05, map: makeGridTexture({ base: '#3f4769', repeat: [12, 12] }) })
const floorInsetMat = new THREE.MeshStandardMaterial({ color: '#333a5a', roughness: 0.95 })

export function Hub() {
  const thetaStart = Math.PI / HUB_SIDES // faces centred on multiples of 30°
  const plaque = useMemo(() => faceFrame(PLAQUE_ANGLE), [])
  const progress = useGame((s) => progressCount(s))

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} material={floorMat} receiveShadow>
        <circleGeometry args={[HUB_RADIUS, HUB_SIDES, thetaStart]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} material={floorInsetMat} receiveShadow>
        <ringGeometry args={[4.2, HUB_APOTHEM - 1.4, HUB_SIDES, 1, thetaStart]} />
      </mesh>
      <CenterEmblem />

      {/* title plaque on the spare wall face */}
      <group position={plaque.origin} rotation-y={plaque.rotationY}>
        <mesh position={[0, 2.6, WALL_T / 2 + 0.08]}>
          <boxGeometry args={[5.4, 2.6, 0.16]} />
          <meshStandardMaterial color="#12151f" roughness={0.4} metalness={0.5} />
        </mesh>
        <TextPlane text={GAME_TITLE} size={[4.6, 0.9]} position={[0, 3.2, WALL_T / 2 + 0.18]} width={1024} height={200} font='bold 120px "Georgia", serif' color="#ffd166" glow={10} />
        <TextPlane text={[GAME_SUBTITLE, `${progress} / ${CHAMBER_ORDER.length} vaults opened`]} size={[4.6, 0.9]} position={[0, 2.15, WALL_T / 2 + 0.18]} width={1024} height={200} font='500 52px "Inter", system-ui, sans-serif' color="#c9d0f0" />
        <pointLight position={[0, 3.5, 2]} color="#ffd166" intensity={1.5} distance={8} decay={2} />
      </group>

      {/* doors + vaults */}
      {CHAMBER_ORDER.map((id) => (
        <ChamberDoor key={id} chamber={id} />
      ))}
      <FinalDoor />
      {CHAMBER_ORDER.map((id) => (
        <ResumeVault key={id} chamber={id} />
      ))}

      {/* ambient hub lighting */}
      <pointLight position={[0, 7, 0]} intensity={40} distance={30} decay={2} color="#cfd8ff" />
    </group>
  )
}

function CenterEmblem() {
  const ring = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Mesh>(null)
  useFrame((st) => {
    const t = st.clock.elapsedTime
    if (ring.current) ring.current.rotation.z = t * 0.15
    if (beam.current) {
      const m = beam.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.08 + Math.sin(t * 1.2) * 0.03
    }
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[3.6, 48]} />
        <meshStandardMaterial color="#1f2438" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[3.2, 3.5, 64]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[1.2, 1.35, 48]} />
        <meshBasicMaterial color="#7cf5c4" toneMapped={false} transparent opacity={0.7} />
      </mesh>
      {/* soft light column */}
      <mesh ref={beam} position-y={4}>
        <cylinderGeometry args={[1.3, 2.2, 8, 24, 1, true]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
