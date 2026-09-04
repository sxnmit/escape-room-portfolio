import { useEffect } from 'react'
import { useGame } from '@/state/gameStore'
import { CHAMBER_ORDER, type ChamberId } from '@/data/resume'
import { SPOKES, frameToWorld } from '@/game/world/layout'
import { playerSnapshot } from '@/game/Player'
import { allInteractables, interactWith } from '@/state/interactables'

/**
 * `window.__game` — a small automation surface used by the Playwright
 * playthrough tests and handy for manual debugging from the console.
 */
export function useDebugApi() {
  useEffect(() => {
    const api = {
      store: useGame,
      get state() {
        return useGame.getState()
      },
      player: playerSnapshot,
      start: () => useGame.getState().start(),
      teleport: (x: number, z: number, yaw?: number) => useGame.getState().requestTeleport(x, z, yaw),
      /** Teleport into a chamber (just inside the room, facing the puzzle). */
      goto: (id: ChamberId | 'about' | 'hub') => {
        if (id === 'hub') return useGame.getState().requestTeleport(0, 2.5, 0)
        const spoke = SPOKES[id]
        const p = frameToWorld(spoke.frame, [0, 0, spoke.roomNearZ - 2.5])
        useGame.getState().requestTeleport(p.x, p.z, spoke.frame.rotationY)
      },
      solve: (id: ChamberId) => useGame.getState().solve(id),
      reveal: (id: ChamberId) => useGame.getState().reveal(id),
      solveAll: () => {
        const g = useGame.getState()
        CHAMBER_ORDER.forEach((c) => {
          g.solve(c)
          g.reveal(c)
        })
      },
      interact: () => {
        const id = useGame.getState().nearestId
        if (id) interactWith(id)
        return id
      },
      interactables: () => Array.from(allInteractables()).map((i) => ({ id: i.id, x: i.position.x, z: i.position.z, r: i.radius })),
      reset: () => useGame.getState().resetProgress(),
    }
    ;(window as unknown as { __game: typeof api }).__game = api
  }, [])
}
