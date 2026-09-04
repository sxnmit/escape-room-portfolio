import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

/** Persisted flag key for a lamp — survives reloads via the store's `flags`. */
export const lampFlag = (id: string) => `lamp:mcmaster:${id}`

const WARM = '#ffd9a0'
const postMat = new THREE.MeshStandardMaterial({ color: '#2a2f45', roughness: 0.35, metalness: 0.7 })
const brassMat = new THREE.MeshStandardMaterial({ color: '#c8a45a', roughness: 0.35, metalness: 0.8 })
const plateMat = new THREE.MeshStandardMaterial({ color: '#12151f', roughness: 0.4, metalness: 0.5 })
const shadeGeo = new THREE.ConeGeometry(0.46, 0.52, 24, 1, true)
const bulbGeo = new THREE.SphereGeometry(0.13, 16, 12)
const ringGeo = new THREE.RingGeometry(0.55, 0.85, 40)

export interface LampProps {
  id: string
  label: string
  position: [number, number, number]
  /** +1 if the aisle (room centre) is toward +x, −1 if toward −x. */
  facing: 1 | -1
  accent: string
}

/**
 * A standing study lamp. Press E to light it: the bulb warms up with a little
 * flicker, the point light rises, a glow ring blooms on the floor and the
 * label plate brightens. Lit state lives in the store so it survives reload.
 */
export function Lamp({ id, label, position, facing, accent }: LampProps) {
  const key = lampFlag(id)
  const lit = useGame((s) => !!s.flags[key])
  const anchor = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const bulb = useRef<THREE.MeshStandardMaterial>(null)
  const shadeInner = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  const plateGlow = useRef<THREE.MeshStandardMaterial>(null)
  const anim = useRef({ glow: lit ? 1 : 0, wasLit: lit, flicker: lit ? 10 : 0 })

  const near = useInteractable(
    {
      id: `lamp:mcmaster:${id}`,
      radius: 2.4,
      prompt: `Light · ${label}`,
      enabled: () => !useGame.getState().flags[key],
      onInteract: () => {
        const g = useGame.getState()
        if (g.flags[key]) return
        sfx.play('lamp')
        g.setFlag(key, true)
      },
    },
    anchor,
  )

  const shadeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c2033', roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), [])

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const a = anim.current
    if (lit !== a.wasLit) {
      a.wasLit = lit
      if (lit) a.flicker = 0
    }
    a.glow = THREE.MathUtils.damp(a.glow, lit ? 1 : 0, 4, dt)
    a.flicker += dt
    const warmup = a.flicker < 0.7 ? Math.sin(a.flicker * 42) * 0.5 * (1 - a.flicker / 0.7) : 0
    const g = Math.max(0, a.glow + warmup * a.glow)
    const t = st.clock.elapsedTime
    const breathe = 1 + Math.sin(t * 1.8 + position[0]) * 0.04
    if (light.current) light.current.intensity = g * 7 * breathe
    if (bulb.current) bulb.current.emissiveIntensity = 0.05 + g * 3.2 * breathe
    if (shadeInner.current) shadeInner.current.emissiveIntensity = g * 1.6
    if (ring.current) ring.current.opacity = g * 0.75
    if (plateGlow.current) plateGlow.current.emissiveIntensity = 0.15 + g * 1.8 + (near && !lit ? 0.9 + Math.sin(t * 6) * 0.4 : 0)
  })

  const px = facing * 0.36

  return (
    <group position={position}>
      <group ref={anchor} position={[facing * 0.6, 0, 0]} />
      {/* base + post */}
      <mesh position-y={0.05} material={brassMat} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.1, 20]} />
      </mesh>
      <mesh position-y={1.15} material={postMat} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 2.1, 10]} />
      </mesh>
      <mesh position-y={2.16} material={brassMat}>
        <cylinderGeometry args={[0.08, 0.05, 0.14, 12]} />
      </mesh>
      {/* shade (open cone, apex up) with a glowing inner cone */}
      <mesh position-y={2.42} geometry={shadeGeo} material={shadeMat} castShadow />
      <mesh position-y={2.4} scale={[0.94, 0.94, 0.94]} geometry={shadeGeo}>
        <meshStandardMaterial ref={shadeInner} color={WARM} emissive={WARM} emissiveIntensity={0} side={THREE.BackSide} toneMapped={false} />
      </mesh>
      <mesh position-y={2.24} geometry={bulbGeo}>
        <meshStandardMaterial ref={bulb} color="#fff1cf" emissive={WARM} emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 2.05, 0]} color={WARM} intensity={0} distance={11} decay={2} />
      {/* floor glow ring */}
      <mesh position-y={0.02} rotation-x={-Math.PI / 2} geometry={ringGeo}>
        <meshBasicMaterial ref={ring} color={accent} transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* label plate facing the aisle */}
      <group position={[px, 1.28, 0]} rotation-y={facing * Math.PI / 2}>
        <mesh material={plateMat} castShadow>
          <boxGeometry args={[1.05, 0.36, 0.06]} />
        </mesh>
        <mesh position={[0, -0.16, 0.035]}>
          <boxGeometry args={[1.0, 0.03, 0.01]} />
          <meshStandardMaterial ref={plateGlow} color={accent} emissive={accent} emissiveIntensity={0.15} toneMapped={false} />
        </mesh>
        <TextPlane text={label} size={[1.0, 0.3]} position={[0, 0.01, 0.04]} width={512} height={150} font='600 54px "Inter", system-ui, sans-serif' color="#f4f1ea" />
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 1.2, 0.3]} position={[0, 1.2, 0]} />
      </RigidBody>
    </group>
  )
}
