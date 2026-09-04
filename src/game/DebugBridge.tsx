import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/** Exposes a few renderer knobs to the automation harness (window.__game). */
export function DebugBridge() {
  const setDpr = useThree((s) => s.setDpr)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const w = window as unknown as { __game?: Record<string, unknown> }
    const patch = () => {
      if (!w.__game) return false
      w.__game.setDpr = (d: number) => setDpr(d)
      w.__game.renderer = () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, programs: gl.info.programs?.length })
      return true
    }
    if (!patch()) {
      const id = setInterval(() => patch() && clearInterval(id), 100)
      return () => clearInterval(id)
    }
  }, [setDpr, gl])
  return null
}
