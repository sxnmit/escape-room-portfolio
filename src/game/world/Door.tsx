import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame, isChamberUnlocked, isFinalUnlocked, lockReason } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { DOOR_H, DOOR_W, SPOKES, WALL_T, frameToWorld, type Frame } from './layout'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'
import { spawnBurst } from '@/game/fx/Burst'

type DoorState = 'locked' | 'unlocked' | 'open'

const LOCKED_COLOR = '#8a2230'
const OPEN_COLOR = '#7cf5c4'
const WHITE = new THREE.Color('#ffffff')

interface DoorAssemblyProps {
  frame: Frame
  id: string
  accent: string
  numeral: string
  label: string
  state: DoorState
  lockedMessage: string
  onOpen: () => void
  /** Makes the final door grander. */
  grand?: boolean
}

const frameMat = new THREE.MeshStandardMaterial({ color: '#1c2131', roughness: 0.4, metalness: 0.6 })
const panelMat = new THREE.MeshStandardMaterial({ color: '#4a5378', roughness: 0.45, metalness: 0.4 })
const grandPanelMat = new THREE.MeshStandardMaterial({ color: '#5a4a28', roughness: 0.35, metalness: 0.7 })
const insetMat = new THREE.MeshStandardMaterial({ color: '#2a3049', roughness: 0.5, metalness: 0.5 })

/** Underdamped spring step — gives door slides a touch of overshoot. */
function spring(x: number, v: number, target: number, dt: number, stiffness = 110, damping = 11): [number, number] {
  const a = stiffness * (target - x) - damping * v
  v += a * dt
  x += v * dt
  return [x, v]
}

export function DoorAssembly({ frame, id, accent, numeral, label, state, lockedMessage, onOpen, grand }: DoorAssemblyProps) {
  const anchor = useRef<THREE.Group>(null)
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const strip = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useRef<THREE.PointLight>(null)
  const open = state === 'open'
  const fx = useRef({ slide: open ? 1 : 0, v: 0, wasOpen: open, shakeT: 10, flashT: 10 })
  const worldCenter = useMemo(() => frameToWorld(frame, [0, 1.9, 0]), [frame])

  const near = useInteractable(
    {
      id,
      radius: 3.2,
      prompt: state === 'open' ? '' : state === 'unlocked' ? `Open Chamber ${numeral}` : 'Sealed',
      enabled: () => state !== 'open',
      onInteract: () => {
        if (state === 'unlocked') {
          sfx.play('open')
          onOpen()
        } else {
          sfx.play('locked')
          fx.current.shakeT = 0
          fx.current.flashT = 0
          useGame.getState().showToast(lockedMessage, 'locked')
        }
      },
    },
    anchor,
  )

  const color = state === 'locked' ? LOCKED_COLOR : state === 'unlocked' ? accent : OPEN_COLOR
  const colorObj = useRef(new THREE.Color(color))

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = st.clock.elapsedTime
    const f = fx.current
    if (open && !f.wasOpen) {
      f.wasOpen = true
      f.flashT = 0
      spawnBurst([worldCenter.x, worldCenter.y, worldCenter.z], accent, 40)
    }
    f.shakeT += dt
    f.flashT += dt
    ;[f.slide, f.v] = spring(f.slide, f.v, open ? 1 : 0, dt)
    const slide = f.slide * (DOOR_W / 2 + 0.25)
    const shake = f.shakeT < 0.45 ? Math.sin(f.shakeT * 48) * 0.05 * (1 - f.shakeT / 0.45) : 0
    if (left.current) left.current.position.x = -DOOR_W / 4 - slide + shake
    if (right.current) right.current.position.x = DOOR_W / 4 + slide + shake
    colorObj.current.set(color)
    if (strip.current) {
      const flash = f.flashT < 0.3 ? 1 - f.flashT / 0.3 : 0
      strip.current.color.lerp(colorObj.current, 0.1).lerp(WHITE, flash)
      strip.current.emissive.copy(strip.current.color)
      const pulse = state === 'unlocked' ? 1.6 + Math.sin(t * 4) * 0.8 + (near ? 1 : 0) : state === 'locked' ? 0.9 + Math.sin(t * 1.5) * 0.2 : 1.4
      strip.current.emissiveIntensity = pulse + flash * 4
    }
    if (glow.current) {
      glow.current.color.lerp(colorObj.current, 0.1)
      glow.current.intensity = (state === 'unlocked' ? 2.5 + Math.sin(t * 4) * 1 : 1.2) + (f.flashT < 0.3 ? 8 * (1 - f.flashT / 0.3) : 0)
    }
  })

  const postW = 0.34
  const depth = WALL_T + 0.24
  const H = DOOR_H
  const W = DOOR_W

  return (
    <group position={frame.origin} rotation-y={frame.rotationY}>
      <group ref={anchor} />
      {/* frame */}
      <mesh position={[-(W / 2 + postW / 2), H / 2 + 0.15, 0]} material={frameMat} castShadow>
        <boxGeometry args={[postW, H + 0.3, depth]} />
      </mesh>
      <mesh position={[W / 2 + postW / 2, H / 2 + 0.15, 0]} material={frameMat} castShadow>
        <boxGeometry args={[postW, H + 0.3, depth]} />
      </mesh>
      <mesh position={[0, H + 0.3, 0]} material={frameMat} castShadow>
        <boxGeometry args={[W + postW * 2, 0.6, depth]} />
      </mesh>
      {/* status strip on both faces of the top beam */}
      <mesh position={[0, H + 0.3, 0]}>
        <boxGeometry args={[W + postW * 2 + 0.02, 0.1, depth + 0.06]} />
        <meshStandardMaterial ref={strip} color={color} emissive={color} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* sliding panels with an inset detail */}
      <mesh ref={left} position={[-W / 4, H / 2, 0]} material={grand ? grandPanelMat : panelMat} castShadow>
        <boxGeometry args={[W / 2, H, 0.24]} />
        <mesh position={[0, 0, 0.13]} material={insetMat}>
          <boxGeometry args={[W / 2 - 0.4, H - 0.5, 0.02]} />
        </mesh>
        <mesh position={[0, 0, -0.13]} material={insetMat}>
          <boxGeometry args={[W / 2 - 0.4, H - 0.5, 0.02]} />
        </mesh>
      </mesh>
      <mesh ref={right} position={[W / 4, H / 2, 0]} material={grand ? grandPanelMat : panelMat} castShadow>
        <boxGeometry args={[W / 2, H, 0.24]} />
        <mesh position={[0, 0, 0.13]} material={insetMat}>
          <boxGeometry args={[W / 2 - 0.4, H - 0.5, 0.02]} />
        </mesh>
        <mesh position={[0, 0, -0.13]} material={insetMat}>
          <boxGeometry args={[W / 2 - 0.4, H - 0.5, 0.02]} />
        </mesh>
      </mesh>
      {/* label plates on both sides */}
      <TextPlane text={[`CHAMBER ${numeral}`, label.toUpperCase()]} size={[3.4, 0.9]} position={[0, H + 1.05, WALL_T / 2 + 0.16]} width={768} height={200} font='bold 72px "Inter", system-ui, sans-serif' color="#e8ecff" glow={8} />
      <TextPlane text={[`CHAMBER ${numeral}`, label.toUpperCase()]} size={[3.4, 0.9]} position={[0, H + 1.05, -WALL_T / 2 - 0.16]} rotation={[0, Math.PI, 0]} width={768} height={200} font='bold 72px "Inter", system-ui, sans-serif' color="#e8ecff" glow={8} />
      <pointLight ref={glow} position={[0, H + 0.6, 1.2]} color={color} intensity={1.2} distance={7} decay={2} />
      {/* physical block while closed */}
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[W / 2, H / 2, 0.16]} position={[0, H / 2, 0]} />
        </RigidBody>
      )}
    </group>
  )
}

export function ChamberDoor({ chamber }: { chamber: ChamberId }) {
  const spoke = SPOKES[chamber]
  const content = CHAMBERS[chamber]
  const doorId = `door:${chamber}`
  const unlocked = useGame((s) => isChamberUnlocked(s, chamber))
  const opened = useGame((s) => !!s.openedDoors[doorId])
  const reason = useGame((s) => lockReason(s, chamber))
  const openDoor = useGame((s) => s.openDoor)
  const state: DoorState = opened ? 'open' : unlocked ? 'unlocked' : 'locked'
  return (
    <DoorAssembly
      frame={spoke.frame}
      id={doorId}
      accent={content.accent}
      numeral={content.numeral}
      label={content.name}
      state={state}
      lockedMessage={reason}
      onOpen={() => openDoor(doorId)}
    />
  )
}

export function FinalDoor() {
  const spoke = SPOKES.about
  const doorId = 'door:about'
  const unlocked = useGame((s) => isFinalUnlocked(s))
  const opened = useGame((s) => !!s.openedDoors[doorId])
  const openDoor = useGame((s) => s.openDoor)
  const state: DoorState = opened ? 'open' : unlocked ? 'unlocked' : 'locked'
  return (
    <DoorAssembly
      frame={spoke.frame}
      id={doorId}
      accent="#ffd166"
      numeral="VI"
      label="The finale"
      state={state}
      lockedMessage="Sealed — open all five vaults to unseal the finale."
      onOpen={() => openDoor(doorId)}
      grand
    />
  )
}
