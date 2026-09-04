import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export interface CharacterAnim {
  /** 0..1 normalised horizontal speed. */
  speed: number
  running: boolean
  moving: boolean
  /** anim.time at which the last celebration started. */
  celebrateAt: number
  time: number
  /** World position the character should glance at (nearest interactable), or null. */
  lookAt: THREE.Vector3 | null
}

const ACCENT = '#22d3ee'
const BODY = '#f3efe6'
const DARK = '#1a1f2e'

/**
 * A procedural low-poly "explorer bot". No external assets: every part is a
 * primitive, and all motion (walk cycle, idle breathing, look-around, blink,
 * celebration hop) is driven in useFrame from the shared anim ref.
 */
export function Character({ anim, headingRef }: { anim: React.RefObject<CharacterAnim>; headingRef: React.RefObject<number> }) {
  const root = useRef<THREE.Group>(null)
  const bodyG = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const antenna = useRef<THREE.Group>(null)
  const antennaTip = useRef<THREE.Mesh>(null)
  const eyes = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const phase = useRef(0)
  const blink = useRef({ next: 2, until: 0 })
  const headWorld = useRef(new THREE.Vector3())

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.05 }),
      dark: new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.35, metalness: 0.5 }),
      visor: new THREE.MeshStandardMaterial({ color: '#0b0f1a', roughness: 0.15, metalness: 0.7 }),
      accent: new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.6, roughness: 0.3 }),
      eye: new THREE.MeshBasicMaterial({ color: '#9ff5ff' }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [],
  )

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)
    const a = anim.current
    if (!a || !root.current) return
    const t = a.time

    // heading
    root.current.rotation.y = headingRef.current ?? 0

    // walk cycle phase advances with speed
    const sp = a.speed
    phase.current += delta * (6 + sp * 10) * (a.moving ? 1 : 0)
    const ph = phase.current
    const swing = Math.sin(ph)
    const amp = THREE.MathUtils.smoothstep(sp, 0, 0.35) * (0.55 + sp * 0.45)

    // celebration hop + spin
    const ct = t - a.celebrateAt
    const celebrating = ct >= 0 && ct < 1.1
    let hop = 0
    let spin = 0
    if (celebrating) {
      const u = ct / 1.1
      hop = Math.sin(u * Math.PI) * 0.9
      spin = THREE.MathUtils.smoothstep(u, 0.05, 0.95) * Math.PI * 2
    }

    // body bob / lean / breathe
    if (bodyG.current) {
      const bob = Math.abs(Math.sin(ph)) * 0.07 * amp
      const breathe = Math.sin(t * 2.1) * 0.012
      bodyG.current.position.y = bob + hop
      bodyG.current.rotation.x = 0.16 * amp
      bodyG.current.rotation.y = spin
      bodyG.current.rotation.z = Math.sin(ph) * 0.04 * amp
      bodyG.current.scale.set(1 - breathe * 0.4, 1 + breathe, 1 - breathe * 0.4)
    }

    // limbs
    if (legL.current && legR.current) {
      legL.current.rotation.x = swing * 0.8 * amp
      legR.current.rotation.x = -swing * 0.8 * amp
    }
    if (armL.current && armR.current) {
      const armSwing = -swing * 0.7 * amp
      armL.current.rotation.x = armSwing
      armR.current.rotation.x = -armSwing
      // arms out a little when running, up in the air when celebrating
      const flare = 0.15 + sp * 0.25
      const cheer = celebrating ? Math.sin((ct / 1.1) * Math.PI) * 2.4 : 0
      armL.current.rotation.z = flare + cheer
      armR.current.rotation.z = -flare - cheer
    }

    // head: glance at the nearest interactable, otherwise look around when idle
    if (head.current) {
      const idle = 1 - THREE.MathUtils.smoothstep(sp, 0, 0.2)
      let targetYaw = Math.sin(t * 0.6) * 0.35 * idle + Math.sin(ph * 0.5) * 0.05 * amp
      let targetPitch = Math.sin(t * 0.9) * 0.06 * idle - 0.05 * amp
      if (a.lookAt) {
        root.current.getWorldPosition(headWorld.current)
        const dx = a.lookAt.x - headWorld.current.x
        const dz = a.lookAt.z - headWorld.current.z
        const dy = a.lookAt.y - (headWorld.current.y + 1.6)
        // desired yaw relative to the body heading, wrapped to [-π, π]
        let rel = Math.atan2(dx, dz) - root.current.rotation.y
        rel = Math.atan2(Math.sin(rel), Math.cos(rel))
        if (Math.abs(rel) < 1.35) {
          targetYaw = rel
          targetPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.35, 0.35)
        }
      }
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, targetYaw, 6, delta)
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, targetPitch, 6, delta)
      head.current.rotation.z = Math.sin(t * 0.45) * 0.05 * idle
    }

    // antenna sway (lags behind motion)
    if (antenna.current) {
      antenna.current.rotation.x = -Math.sin(ph + 0.6) * 0.25 * amp - 0.25 * amp + Math.sin(t * 1.7) * 0.06
      antenna.current.rotation.z = Math.sin(t * 1.3) * 0.08
    }
    if (antennaTip.current) {
      const m = antennaTip.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.5 + (celebrating ? 3 : 0)
    }

    // blink
    if (eyes.current) {
      if (t > blink.current.next) {
        blink.current.until = t + 0.12
        blink.current.next = t + 2.5 + Math.random() * 3
      }
      const closed = t < blink.current.until
      eyes.current.scale.y = closed ? 0.12 : 1
    }

    // ground blob shadow shrinks when hopping
    if (shadow.current) {
      const k = 1 - hop * 0.5
      shadow.current.scale.set(k, k, k)
      ;(shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * k
    }
    if (light.current) light.current.intensity = 1.2 + sp * 0.6 + (celebrating ? 3 : 0)
  })

  return (
    <group ref={root}>
      {/* soft blob shadow */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.02} material={mats.shadow}>
        <circleGeometry args={[0.42, 24]} />
      </mesh>

      <group ref={bodyG}>
        {/* legs */}
        <group ref={legL} position={[-0.16, 0.6, 0]}>
          <mesh position-y={-0.2} material={mats.dark} castShadow>
            <capsuleGeometry args={[0.11, 0.3, 4, 10]} />
          </mesh>
          <mesh position={[0, -0.42, 0.05]} material={mats.body} castShadow>
            <boxGeometry args={[0.22, 0.12, 0.34]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.16, 0.6, 0]}>
          <mesh position-y={-0.2} material={mats.dark} castShadow>
            <capsuleGeometry args={[0.11, 0.3, 4, 10]} />
          </mesh>
          <mesh position={[0, -0.42, 0.05]} material={mats.body} castShadow>
            <boxGeometry args={[0.22, 0.12, 0.34]} />
          </mesh>
        </group>

        {/* torso */}
        <mesh position-y={0.95} material={mats.body} castShadow>
          <capsuleGeometry args={[0.32, 0.45, 6, 16]} />
        </mesh>
        {/* belt */}
        <mesh position-y={0.68} material={mats.dark}>
          <cylinderGeometry args={[0.31, 0.33, 0.1, 18]} />
        </mesh>
        {/* chest core */}
        <mesh position={[0, 1.02, 0.31]} material={mats.accent}>
          <cylinderGeometry args={[0.09, 0.09, 0.06, 16]} />
        </mesh>
        {/* backpack */}
        <mesh position={[0, 1.0, -0.36]} material={mats.dark} castShadow>
          <boxGeometry args={[0.42, 0.5, 0.22]} />
        </mesh>
        <mesh position={[0, 1.0, -0.48]} material={mats.accent}>
          <boxGeometry args={[0.2, 0.26, 0.04]} />
        </mesh>
        <pointLight ref={light} position={[0, 1.1, 0.4]} color={ACCENT} intensity={1.2} distance={4.5} decay={2} />

        {/* arms */}
        <group ref={armL} position={[-0.42, 1.15, 0]}>
          <mesh position-y={-0.22} material={mats.body} castShadow>
            <capsuleGeometry args={[0.09, 0.32, 4, 10]} />
          </mesh>
          <mesh position-y={-0.46} material={mats.dark}>
            <sphereGeometry args={[0.11, 12, 12]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.42, 1.15, 0]}>
          <mesh position-y={-0.22} material={mats.body} castShadow>
            <capsuleGeometry args={[0.09, 0.32, 4, 10]} />
          </mesh>
          <mesh position-y={-0.46} material={mats.dark}>
            <sphereGeometry args={[0.11, 12, 12]} />
          </mesh>
        </group>

        {/* head */}
        <group ref={head} position-y={1.62}>
          <mesh material={mats.body} castShadow>
            <sphereGeometry args={[0.34, 24, 18]} />
          </mesh>
          {/* visor */}
          <mesh position={[0, 0.02, 0.2]} material={mats.visor} scale={[1, 0.72, 0.55]}>
            <sphereGeometry args={[0.3, 24, 16]} />
          </mesh>
          <group ref={eyes} position={[0, 0.05, 0.42]}>
            <mesh position-x={-0.09} material={mats.eye}>
              <sphereGeometry args={[0.045, 10, 10]} />
            </mesh>
            <mesh position-x={0.09} material={mats.eye}>
              <sphereGeometry args={[0.045, 10, 10]} />
            </mesh>
          </group>
          {/* ear pods */}
          <mesh position={[-0.33, 0, 0]} rotation-z={Math.PI / 2} material={mats.dark}>
            <cylinderGeometry args={[0.1, 0.1, 0.08, 14]} />
          </mesh>
          <mesh position={[0.33, 0, 0]} rotation-z={Math.PI / 2} material={mats.dark}>
            <cylinderGeometry args={[0.1, 0.1, 0.08, 14]} />
          </mesh>
          {/* antenna */}
          <group ref={antenna} position-y={0.3}>
            <mesh position-y={0.14} material={mats.dark}>
              <cylinderGeometry args={[0.02, 0.025, 0.28, 8]} />
            </mesh>
            <mesh ref={antennaTip} position-y={0.32} material={mats.accent.clone()}>
              <sphereGeometry args={[0.07, 12, 12]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
