import { useMemo } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CHAMBERS } from '@/data/resume'
import { WALLS, type WallSeg } from './layout'

const GOLD = '#ffd166'
const wallMat = new THREE.MeshStandardMaterial({ color: '#3a4266', roughness: 0.82, metalness: 0.08 })
const lintelMat = new THREE.MeshStandardMaterial({ color: '#2c3350', roughness: 0.8, metalness: 0.1 })
const trimMat = new THREE.MeshStandardMaterial({ color: '#4a5380', roughness: 0.55, metalness: 0.25 })
const accentMats = new Map<string, THREE.MeshStandardMaterial>()
function accentMat(color: string) {
  let m = accentMats.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, toneMapped: false })
    accentMats.set(color, m)
  }
  return m
}
function accentFor(seg: WallSeg) {
  if (!seg.room || seg.room === 'about') return GOLD
  return CHAMBERS[seg.room].accent
}

/**
 * All static walls: visual boxes + one fixed rigid body with a cuboid collider
 * per segment (world-space transforms, so nothing depends on parent groups).
 * Each segment carries a thin emissive trim along its top edge in its room's
 * accent colour, which is what makes the map readable from the camera's height.
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
  const lintel = seg.kind === 'lintel'
  return (
    <group position={seg.position} rotation={[0, seg.rotationY, 0]}>
      <mesh material={lintel ? lintelMat : wallMat} castShadow receiveShadow>
        <boxGeometry args={[w, h, t]} />
      </mesh>
      {!lintel && (
        <>
          {/* top trim + accent light line */}
          <mesh position-y={h / 2 + 0.06} material={trimMat}>
            <boxGeometry args={[w + 0.06, 0.12, t + 0.16]} />
          </mesh>
          <mesh position-y={h / 2 + 0.135} material={accentMat(accentFor(seg))}>
            <boxGeometry args={[w + 0.08, 0.035, t + 0.2]} />
          </mesh>
          {/* base skirting */}
          <mesh position-y={-h / 2 + 0.12} material={trimMat}>
            <boxGeometry args={[w + 0.04, 0.24, t + 0.12]} />
          </mesh>
        </>
      )}
    </group>
  )
}
