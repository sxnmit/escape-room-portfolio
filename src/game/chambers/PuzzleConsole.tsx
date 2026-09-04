import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { useInteractable } from '@/state/interactables'
import { TextPlane } from '@/utils/TextPlane'
import { sfx } from '@/audio/sfx'

/**
 * A generic interactable console/pedestal. Used as the placeholder puzzle
 * object in chambers until each chamber gets its bespoke set-piece.
 * Opens either the puzzle overlay or (for in-world puzzles) the briefing card.
 */
export function PuzzleConsole({ chamber, position, label }: { chamber: ChamberId; position: [number, number, number]; label?: string }) {
  const c = CHAMBERS[chamber]
  const anchor = useRef<THREE.Group>(null)
  const screen = useRef<THREE.MeshStandardMaterial>(null)
  const solved = useGame((s) => !!s.solved[chamber])
  const inWorld = c.puzzle === 'blocks' || c.puzzle === 'lanterns'

  const near = useInteractable(
    {
      id: `console:${chamber}`,
      radius: 2.8,
      prompt: solved ? 'Solved ✓' : inWorld ? 'Read the briefing' : label ?? 'Use console',
      onInteract: () => {
        const g = useGame.getState()
        sfx.play('ui')
        if (solved) {
          g.showToast(`Chamber ${c.numeral} is complete — the ${c.name} vault awaits in the hub.`, 'success')
          return
        }
        g.openOverlay(inWorld ? { kind: 'briefing', chamber } : { kind: 'puzzle', chamber })
      },
    },
    anchor,
  )

  useFrame((st) => {
    if (screen.current) {
      const t = st.clock.elapsedTime
      screen.current.emissiveIntensity = solved ? 1.6 : 0.8 + Math.sin(t * 3) * 0.3 + (near ? 0.8 : 0)
    }
  })

  return (
    <group position={position}>
      <group ref={anchor} position={[0, 0, 1.2]} />
      <mesh position-y={0.55} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.1, 0.8]} />
        <meshStandardMaterial color="#1b2030" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.35, 0.1]} rotation-x={-0.35} castShadow>
        <boxGeometry args={[1.5, 0.9, 0.12]} />
        <meshStandardMaterial color="#0f1220" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.36, 0.17]} rotation-x={-0.35}>
        <planeGeometry args={[1.3, 0.7]} />
        <meshStandardMaterial ref={screen} color={solved ? '#7cf5c4' : c.accent} emissive={solved ? '#7cf5c4' : c.accent} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <TextPlane text={solved ? 'COMPLETE' : label?.toUpperCase() ?? 'CONSOLE'} size={[1.2, 0.3]} position={[0, 1.36, 0.19]} rotation={[-0.35, 0, 0]} width={512} height={128} font='bold 64px "Inter", system-ui, sans-serif' color="#0b0e17" />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 0.8, 0.45]} position={[0, 0.8, 0]} />
      </RigidBody>
    </group>
  )
}
