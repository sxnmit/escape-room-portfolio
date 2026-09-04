import { Suspense } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Stars } from '@react-three/drei'
import { Player } from './Player'
import { World } from './World'
import { Effects } from './fx/Effects'
import { useGame } from '@/state/gameStore'
import { LITE } from '@/utils/perf'
import { DebugBridge } from './DebugBridge'
import { Bursts } from './fx/Burst'

export function Game() {
  return (
    <Canvas
      shadows={!LITE}
      dpr={LITE ? 1 : [1, 1.75]}
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
      <FxGate />
      <DebugBridge />
    </Canvas>
  )
}

function FxGate() {
  const fx = useGame((s) => s.fx)
  return fx && !LITE ? <Effects /> : null
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} color="#b9c4ff" />
      <hemisphereLight args={['#8ea2ff', '#1a1530', 0.9]} />
      <directionalLight
        position={[18, 28, 12]}
        intensity={1.6}
        color="#fff4e0"
        castShadow={!LITE}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
      />
    </>
  )
}
