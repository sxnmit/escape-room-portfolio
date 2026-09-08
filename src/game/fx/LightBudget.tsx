import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { playerSnapshot } from '../Player'

/**
 * The world keeps every room mounted, which means every point light in the
 * building — corridor accents, door strips, vault glows, lamps, set dressing —
 * is live at once. three.js forward-renders lights, so each material's shader
 * loops over *all* of them for every pixel it draws: lights in a chamber on the
 * far side of the map cost exactly as much as the one over your head.
 *
 * This keeps only the lights that can actually be seen. Every frame it ranks
 * the point lights by whether they are emitting and how far away they are, and
 * leaves the nearest `budget` visible.
 *
 * The count it enables is deliberately constant. A varying light count changes
 * the shader's compile-time constants, so letting it drift would recompile
 * every material in the scene each time the player crossed a threshold —
 * trading a steady cost for a stutter. Holding the count fixed means one
 * shader variant and no recompiles, no matter where the player walks.
 */
export function LightBudget({ budget = 8, interval = 0.1 }: { budget?: number; interval?: number }) {
  const scene = useThree((s) => s.scene)
  const lights = useRef<THREE.PointLight[]>([])
  const ranked = useRef<{ light: THREE.PointLight; dark: number; d: number }[]>([])
  const sinceScan = useRef(99)
  const sinceRank = useRef(99)

  // Everything here is timed in seconds, not frames. A frame counter would make
  // the work rarer exactly on the machines that need it most: at 2 fps, "every
  // 120 frames" is once a minute.
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 10)
    sinceScan.current += dt
    sinceRank.current += dt

    // rooms mount their lights as the world builds, so refresh the roster
    if (lights.current.length === 0 || sinceScan.current > 2) {
      sinceScan.current = 0
      const found: THREE.PointLight[] = []
      scene.traverse((o) => {
        if ((o as THREE.PointLight).isPointLight) found.push(o as THREE.PointLight)
      })
      lights.current = found
    }
    if (sinceRank.current < interval) return
    sinceRank.current = 0

    const all = lights.current
    if (all.length <= budget) {
      for (const l of all) l.visible = true
      return
    }

    const p = playerSnapshot.position
    const list = ranked.current
    list.length = 0
    for (const l of all) {
      // world position without allocating: lights live directly under their room group
      l.getWorldPosition(tmp)
      list.push({ light: l, dark: l.intensity <= 0.02 ? 1 : 0, d: tmp.distanceToSquared(p) })
    }
    // emitting lights first, then nearest — a dark light contributes nothing, so
    // it should never hold a slot that a visible one could use
    list.sort((a, b) => a.dark - b.dark || a.d - b.d)
    for (let i = 0; i < list.length; i++) list[i].light.visible = i < budget
  })

  return null
}

const tmp = new THREE.Vector3()
