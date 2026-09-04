import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGame } from './gameStore'

/**
 * Lightweight registry of things the player can press E on.
 * Registration is non-reactive (a Map) so the per-frame nearest-search is cheap;
 * only the *result* (nearest id + prompt) goes through the store.
 */
export interface Interactable {
  id: string
  /** World-space position. May be updated by the owner for moving objects. */
  position: THREE.Vector3
  /** Interaction radius in world units. */
  radius: number
  /** Prompt shown in the HUD, e.g. "Open door". */
  prompt: string | (() => string)
  /** Return false to make the object ignorable for now (it will not be highlighted). */
  enabled?: () => boolean
  onInteract: () => void
}

const registry = new Map<string, Interactable>()

export function registerInteractable(item: Interactable) {
  registry.set(item.id, item)
  return () => {
    registry.delete(item.id)
  }
}

export function getInteractable(id: string) {
  return registry.get(id)
}

export function allInteractables() {
  return registry.values()
}

/** Find the closest enabled interactable within its radius of `p`. */
export function findNearest(p: THREE.Vector3): Interactable | null {
  let best: Interactable | null = null
  let bestD = Infinity
  for (const item of registry.values()) {
    if (item.enabled && !item.enabled()) continue
    const d = item.position.distanceTo(p)
    if (d <= item.radius && d < bestD) {
      bestD = d
      best = item
    }
  }
  return best
}

export function interactWith(id: string) {
  const item = registry.get(id)
  if (!item) return
  if (item.enabled && !item.enabled()) return
  item.onInteract()
}

/**
 * Hook: register an interactable anchored to a mesh/group ref. The world
 * position is read once after mount (objects in rotated groups are fine).
 */
export function useInteractable(
  spec: Omit<Interactable, 'position'> & { offset?: [number, number, number] },
  ref: React.RefObject<THREE.Object3D | null>,
) {
  const specRef = useRef(spec)
  specRef.current = spec

  useEffect(() => {
    const obj = ref.current
    if (!obj) return
    obj.updateWorldMatrix(true, false)
    const position = new THREE.Vector3()
    obj.getWorldPosition(position)
    if (spec.offset) position.add(new THREE.Vector3(...spec.offset))
    const item: Interactable = {
      id: spec.id,
      position,
      radius: spec.radius,
      prompt: () => {
        const p = specRef.current.prompt
        return typeof p === 'function' ? p() : p
      },
      enabled: () => (specRef.current.enabled ? specRef.current.enabled() : true),
      onInteract: () => specRef.current.onInteract(),
    }
    return registerInteractable(item)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, spec.radius, ref])

  const nearestId = useGame((s) => s.nearestId)
  return nearestId === spec.id
}
