import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

/** Exposes a few renderer knobs to the automation harness (window.__game). */
export function DebugBridge() {
  const setDpr = useThree((s) => s.setDpr)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const w = window as unknown as { __game?: Record<string, unknown> }
    const patch = () => {
      if (!w.__game) return false
      w.__game.setDpr = (d: number) => {
        // pin the resolution: the adaptive quality monitor must stop fighting it
        ;(window as unknown as { __autoDpr?: boolean }).__autoDpr = false
        setDpr(d)
      }
      w.__game.gl = () => gl
      /** perf experiments: after flipping a renderer-level flag, materials must recompile */
      w.__game.forceMaterialUpdate = () => {
        scene.traverse((o: THREE.Object3D) => {
          const m = (o as unknown as { material?: THREE.Material | THREE.Material[] }).material
          if (!m) return
          ;(Array.isArray(m) ? m : [m]).forEach((mat) => (mat.needsUpdate = true))
        })
      }
      w.__game.renderer = () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, programs: gl.info.programs?.length })
      /** What the scene actually asks of the GPU — the numbers that explain frame time. */
      w.__game.sceneStats = () => {
        const lights: Record<string, number> = {}
        const visibleLights: Record<string, number> = {}
        let meshes = 0
        let casters = 0
        let receivers = 0
        let visibleMeshes = 0
        const materials = new Set<unknown>()
        const geometries = new Set<unknown>()
        scene.traverse((o: THREE.Object3D) => {
          const any = o as unknown as { isLight?: boolean; isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean; material?: unknown; geometry?: unknown; visible?: boolean }
          if (any.isLight) {
            lights[o.type] = (lights[o.type] ?? 0) + 1
            // only visible lights reach the shader, and that count is what costs
            if (o.visible) visibleLights[o.type] = (visibleLights[o.type] ?? 0) + 1
          }
          if (any.isMesh) {
            meshes++
            if (any.visible) visibleMeshes++
            if (any.castShadow) casters++
            if (any.receiveShadow) receivers++
            if (any.material) (Array.isArray(any.material) ? any.material : [any.material]).forEach((m) => materials.add(m))
            if (any.geometry) geometries.add(any.geometry)
          }
        })
        const totalLights = Object.values(lights).reduce((a, b) => a + b, 0)
        return {
          lights,
          visibleLights,
          visiblePointLights: visibleLights.PointLight ?? 0,
          totalLights,
          meshes,
          visibleMeshes,
          shadowCasters: casters,
          shadowReceivers: receivers,
          materials: materials.size,
          geometries: geometries.size,
          programs: gl.info.programs?.length,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          shadowMapEnabled: gl.shadowMap.enabled,
          pixelRatio: gl.getPixelRatio(),
        }
      }
      return true
    }
    if (!patch()) {
      const id = setInterval(() => patch() && clearInterval(id), 100)
      return () => clearInterval(id)
    }
  }, [setDpr, gl, scene])
  return null
}
