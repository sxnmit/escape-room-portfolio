import { useMemo } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { WALLS, type WallSeg } from './layout'

const wallMat = new THREE.MeshStandardMaterial({ color: '#2b3147', roughness: 0.85, metalness: 0.08 })
const lintelMat = new THREE.MeshStandardMaterial({ color: '#232839', roughness: 0.8, metalness: 0.1 })
const trimMat = new THREE.MeshStandardMaterial({ color: '#3b4260', roughness: 0.6, metalness: 0.2 })

/**
 * All static walls: visual boxes + one fixed rigid body with a cuboid collider
 * per segment (world-space transforms, so nothing depends on parent groups).
 */
export function Walls() {
  const segs = useMemo(() => WALLS, [])
  return (
    <group>
      <RigidBody type="fixed" colliders={false} name="walls">
        {/* the ground */}
        <CuboidCollider args={[90, 0.5, 90]} position={[0, -0.5, 0]} friction={0.9} />
        {segs.map((s, i) => (
          <CuboidCollider key={i} args={[s.size[0] / 2, s.size[1] / 2, s.size[2] / 2]} position={s.position} rotation={[0, s.rotationY, 0]} friction={0} />
        ))}
      </RigidBody>
      {segs.map((s, i) => (
        <WallMesh key={i} seg={s} />
      ))}
    </group>
  )
}

function WallMesh({ seg }: { seg: WallSeg }) {
  const [w, h, t] = seg.size
  return (
    <group position={seg.position} rotation={[0, seg.rotationY, 0]}>
      <mesh material={seg.kind === 'lintel' ? lintelMat : wallMat} castShadow receiveShadow>
        <boxGeometry args={[w, h, t]} />
      </mesh>
      {/* top trim */}
      {seg.kind !== 'lintel' && (
        <mesh position-y={h / 2 + 0.06} material={trimMat}>
          <boxGeometry args={[w + 0.06, 0.12, t + 0.16]} />
        </mesh>
      )}
      {/* base skirting on both sides */}
      {seg.kind !== 'lintel' && (
        <mesh position-y={-h / 2 + 0.12} material={trimMat}>
          <boxGeometry args={[w + 0.04, 0.24, t + 0.12]} />
        </mesh>
      )}
    </group>
  )
}
