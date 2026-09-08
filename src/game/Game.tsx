import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PerformanceMonitor, Stars } from '@react-three/drei'
import { Player, playerSnapshot } from './Player'
import { World } from './World'
import { Effects } from './fx/Effects'
import { useGame } from '@/state/gameStore'
import { LITE } from '@/utils/perf'
import { DebugBridge } from './DebugBridge'
import { Bursts } from './fx/Burst'
import { LightBudget } from './fx/LightBudget'

export function Game() {
  // Quality tier: 2 = comfortable, 0 = struggling. Drives resolution, the light
  // budget and whether the bloom pass runs at all.
  const [tier, setTier] = useState(TIERS.length - 1)
  return (
    <Canvas
      shadows={!LITE}
      dpr={LITE ? 1 : [0.8, 1.5]}
      camera={{ fov: 48, near: 0.1, far: 220, position: [0, 6, 11] }}
      gl={{ antialias: !LITE, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        if (!LITE) gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach="background" args={['#0b0e17']} />
      <fog attach="fog" args={['#0b0e17', 38, 110]} />
      <Lights />
      <Stars radius={140} depth={80} count={LITE ? 400 : 2500} factor={5} saturation={0.4} fade speed={0.4} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -22, 0]}>
          <Player />
          <World />
        </Physics>
        <Bursts />
      </Suspense>
      <FxGate bloom={TIERS[tier].bloom} />
      <Quality onTier={setTier} />
      {/* the strongest lever there is: fewer live lights, fewer per-pixel loops.
          8 keeps every glow you can actually see; a struggling machine gets 4. */}
      <LightBudget budget={TIERS[tier].budget} />
      <DebugBridge />
    </Canvas>
  )
}

function FxGate({ bloom }: { bloom: boolean }) {
  const fx = useGame((s) => s.fx)
  // bloom is a full-screen pass; on a machine that is already behind it is the
  // first thing to go, whatever the player's preference
  return fx && !LITE && bloom ? <Effects /> : null
}

/** Resolution and light budget per tier: 0 = struggling, 2 = comfortable. */
const TIERS = [
  { dpr: 0.8, budget: 4, bloom: false },
  { dpr: 1.1, budget: 6, bloom: true },
  { dpr: 1.5, budget: 8, bloom: true },
]

/**
 * Watches the real frame rate and steps quality up or down a tier at a time.
 *
 * Deliberately coarse and sticky. Changing the light budget changes the
 * shaders' compile-time constants, so a quality signal that tracked frame rate
 * continuously would recompile every material each time it wobbled across a
 * threshold — and each recompile is a stutter, which is exactly the thing it is
 * meant to prevent. Tiers move one step at a time, only on drei's sustained
 * decline/incline signals, and `onFallback` pins the lowest tier for good once
 * the machine has flip-flopped enough to prove it cannot hold a middle setting.
 *
 * Automation pins the resolution itself (see DebugBridge), so it leaves the DPR
 * alone once window.__game.setDpr has been called.
 */
function Quality({ onTier }: { onTier: (tier: number) => void }) {
  const setDpr = useThree((s) => s.setDpr)
  const tier = useRef(2)
  const apply = (next: number) => {
    const clamped = Math.max(0, Math.min(TIERS.length - 1, next))
    if (clamped === tier.current) return
    tier.current = clamped
    onTier(clamped)
    if ((window as unknown as { __autoDpr?: boolean }).__autoDpr !== false) setDpr(TIERS[clamped].dpr)
  }
  if (LITE) return null
  return (
    <PerformanceMonitor
      flipflops={3}
      onDecline={() => apply(tier.current - 1)}
      onIncline={() => apply(tier.current + 1)}
      onFallback={() => apply(0)}
    />
  )
}

/**
 * A key light that follows the player. The shadow camera only has to cover what
 * is near them, so a 1024 map here has far better texel density than the 2048
 * one that used to stretch across the whole 96-unit map.
 */
function SunWithShadow() {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useFrame(() => {
    const p = playerSnapshot.position
    if (light.current) light.current.position.set(p.x + 14, p.y + 24, p.z + 10)
    if (target.current) {
      target.current.position.set(p.x, p.y, p.z)
      target.current.updateMatrixWorld()
    }
  })
  return (
    <>
      <object3D ref={target} />
      <directionalLight
        ref={light}
        position={[18, 28, 12]}
        intensity={1.6}
        color="#fff4e0"
        castShadow={!LITE}
        target={target.current ?? undefined}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
    </>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} color="#b9c4ff" />
      <hemisphereLight args={['#8ea2ff', '#1a1530', 0.9]} />
      <SunWithShadow />
    </>
  )
}
