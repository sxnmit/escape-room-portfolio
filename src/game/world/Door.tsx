import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame, isChamberUnlocked, isFinalUnlocked, lockReason } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { DOOR_H, DOOR_W, SPOKES, WALL_T, type Frame } from './layout'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

type DoorState = 'locked' | 'unlocked' | 'open'

const LOCKED_COLOR = '#ff3b4a'
const OPEN_COLOR = '#7cf5c4'

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

const frameMat = new THREE.MeshStandardMaterial({ color: '#161a26', roughness: 0.4, metalness: 0.6 })
const panelMat = new THREE.MeshStandardMaterial({ color: '#3a4160', roughness: 0.45, metalness: 0.4 })
const grandPanelMat = new THREE.MeshStandardMaterial({ color: '#4a3c20', roughness: 0.35, metalness: 0.7 })

export function DoorAssembly({ frame, id, accent, numeral, label, state, lockedMessage, onOpen, grand }: DoorAssemblyProps) {
  const anchor = useRef<THREE.Group>(null)
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const strip = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useRef<THREE.PointLight>(null)
  const open = state === 'open'

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
          useGame.getState().showToast(lockedMessage, 'locked')
        }
      },
    },
    anchor,
  )

  const color = state === 'locked' ? LOCKED_COLOR : state === 'unlocked' ? accent : OPEN_COLOR
  const colorObj = useRef(new THREE.Color(color))

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    const slide = open ? DOOR_W / 2 + 0.25 : 0
    if (left.current) easing.damp(left.current.position, 'x', -DOOR_W / 4 - slide, 0.35, dt)
    if (right.current) easing.damp(right.current.position, 'x', DOOR_W / 4 + slide, 0.35, dt)
    colorObj.current.set(color)
    if (strip.current) {
      strip.current.color.lerp(colorObj.current, 0.1)
      strip.current.emissive.copy(strip.current.color)
      const pulse = state === 'unlocked' ? 1.6 + Math.sin(t * 4) * 0.8 + (near ? 1 : 0) : state === 'locked' ? 0.9 + Math.sin(t * 1.5) * 0.2 : 1.4
      strip.current.emissiveIntensity = pulse
    }
    if (glow.current) {
      glow.current.color.lerp(colorObj.current, 0.1)
      glow.current.intensity = state === 'unlocked' ? 2.5 + Math.sin(t * 4) * 1 : 1.2
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
      {/* status strip on both faces of the top beam + posts */}
      <mesh position={[0, H + 0.3, 0]}>
        <boxGeometry args={[W + postW * 2 + 0.02, 0.1, depth + 0.06]} />
        <meshStandardMaterial ref={strip} color={color} emissive={color} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* sliding panels */}
      <mesh ref={left} position={[-W / 4, H / 2, 0]} material={grand ? grandPanelMat : panelMat} castShadow>
        <boxGeometry args={[W / 2, H, 0.24]} />
      </mesh>
      <mesh ref={right} position={[W / 4, H / 2, 0]} material={grand ? grandPanelMat : panelMat} castShadow>
        <boxGeometry args={[W / 2, H, 0.24]} />
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
