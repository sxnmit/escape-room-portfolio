import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { CORRIDOR_LEN, CORRIDOR_W, ROOM_SIZE, SPOKES, WALL_H } from './layout'
import { useGame } from '@/state/gameStore'
import { makeGridTexture } from '@/utils/textures'

const corridorMat = new THREE.MeshStandardMaterial({ color: '#3b4363', roughness: 0.9, map: makeGridTexture({ base: '#363e5c', repeat: [2, 4] }) })
const roomMat = new THREE.MeshStandardMaterial({ color: '#434b70', roughness: 0.9, map: makeGridTexture({ base: '#3d4566', repeat: [8, 8] }) })
const pillarMat = new THREE.MeshStandardMaterial({ color: '#232839', roughness: 0.5, metalness: 0.3 })

/**
 * Generic chamber shell: corridor + room floors, corner pillars, an accent
 * floor inset and lights. Children are rendered in the spoke's local frame
 * (−z = away from the hub, room centre at SPOKES[id].roomCenterLocal).
 */
export function ChamberShell({ id, accent, children }: { id: ChamberId | 'about'; accent: string; children?: ReactNode }) {
  const spoke = SPOKES[id]
  const f = spoke.frame
  const [, , cz] = spoke.roomCenterLocal
  const insetMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).multiplyScalar(0.32), roughness: 0.8 }), [accent])
  const stripMat = useMemo(() => new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }), [accent])
  const half = ROOM_SIZE / 2

  return (
    <group position={f.origin} rotation-y={f.rotationY}>
      {/* corridor floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -CORRIDOR_LEN / 2]} material={corridorMat} receiveShadow>
        <planeGeometry args={[CORRIDOR_W, CORRIDOR_LEN + 0.6]} />
      </mesh>
      {/* corridor light strips */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * (CORRIDOR_W / 2 - 0.08), 0.02, -CORRIDOR_LEN / 2]} rotation-x={-Math.PI / 2} material={stripMat}>
          <planeGeometry args={[0.08, CORRIDOR_LEN]} />
        </mesh>
      ))}
      {/* room floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, cz]} material={roomMat} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, cz]} material={insetMat} receiveShadow>
        <planeGeometry args={[ROOM_SIZE - 3, ROOM_SIZE - 3]} />
      </mesh>
      {/* corner pillars */}
      {[
        [-half + 0.6, spoke.roomNearZ - 0.6],
        [half - 0.6, spoke.roomNearZ - 0.6],
        [-half + 0.6, spoke.roomFarZ + 0.6],
        [half - 0.6, spoke.roomFarZ + 0.6],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={WALL_H / 2} material={pillarMat} castShadow>
            <boxGeometry args={[0.7, WALL_H, 0.7]} />
          </mesh>
          <mesh position-y={WALL_H / 2}>
            <boxGeometry args={[0.74, WALL_H - 0.6, 0.1]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.36, WALL_H / 2, 0.36]} position={[0, WALL_H / 2, 0]} />
          </RigidBody>
        </group>
      ))}
      {/* lighting */}
      <pointLight position={[0, 4.2, cz]} intensity={30} distance={22} decay={2} color="#dfe6ff" />
      <pointLight position={[0, 3, cz - 5]} intensity={12} distance={16} decay={2} color={accent} />
      {/* entry sensor: fires the chamber banner */}
      <EntrySensor id={id} z={-CORRIDOR_LEN / 2} />
      {children}
    </group>
  )
}

function EntrySensor({ id, z }: { id: ChamberId | 'about'; z: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        sensor
        args={[CORRIDOR_W / 2, 2, 0.5]}
        position={[0, 2, z]}
        onIntersectionEnter={({ other }) => {
          if (!other.rigidBodyObject?.userData?.player) return
          const g = useGame.getState()
          if (id === 'about') {
            g.showBanner({ numeral: 'VI', title: 'The finale', subtitle: 'About Sunny', accent: '#ffd166' })
            return
          }
          const c = CHAMBERS[id]
          g.showBanner({ numeral: c.numeral, title: c.name, subtitle: c.objective, accent: c.accent })
        }}
      />
    </RigidBody>
  )
}
