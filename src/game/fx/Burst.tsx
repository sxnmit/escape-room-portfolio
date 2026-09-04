import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * A pooled confetti burst. Call `spawnBurst(position, color)` from anywhere
 * (no React needed); mount one <Bursts/> inside the Canvas to render them.
 */
const MAX = 420
const PER_BURST = 70
const GRAVITY = -13

interface Particle {
  born: number
  life: number
  p0: THREE.Vector3
  v: THREE.Vector3
  color: THREE.Color
  size: number
  spin: number
}

const pool: Particle[] = Array.from({ length: MAX }, () => ({
  born: -100,
  life: 1,
  p0: new THREE.Vector3(),
  v: new THREE.Vector3(),
  color: new THREE.Color('#ffd166'),
  size: 0.1,
  spin: 0,
}))
let head = 0
let now = 0
const palette = ['#ffffff', '#ffd166', '#7cf5c4']

export function spawnBurst(position: THREE.Vector3 | [number, number, number], color = '#ffd166', count = PER_BURST) {
  const px = Array.isArray(position) ? position[0] : position.x
  const py = Array.isArray(position) ? position[1] : position.y
  const pz = Array.isArray(position) ? position[2] : position.z
  for (let i = 0; i < count; i++) {
    const p = pool[head++ % MAX]
    p.born = now
    p.life = 0.9 + Math.random() * 0.8
    p.p0.set(px + (Math.random() - 0.5) * 0.4, py + (Math.random() - 0.5) * 0.4, pz + (Math.random() - 0.5) * 0.4)
    const a = Math.random() * Math.PI * 2
    const r = 1.5 + Math.random() * 4.5
    p.v.set(Math.cos(a) * r, 3.5 + Math.random() * 6, Math.sin(a) * r)
    const pick = Math.random()
    p.color.set(pick < 0.45 ? color : palette[Math.floor(Math.random() * palette.length)])
    p.size = 0.07 + Math.random() * 0.09
    p.spin = (Math.random() - 0.5) * 12
  }
}

export function Bursts() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ obj: new THREE.Object3D(), zero: new THREE.Matrix4().makeScale(0, 0, 0) }), [])

  useFrame((st) => {
    now = st.clock.elapsedTime
    const m = mesh.current
    if (!m) return
    let any = false
    for (let i = 0; i < MAX; i++) {
      const p = pool[i]
      const t = now - p.born
      if (t < 0 || t > p.life) {
        m.setMatrixAt(i, tmp.zero)
        continue
      }
      any = true
      const k = 1 - t / p.life
      tmp.obj.position.set(p.p0.x + p.v.x * t, p.p0.y + p.v.y * t + 0.5 * GRAVITY * t * t, p.p0.z + p.v.z * t)
      tmp.obj.rotation.set(p.spin * t, p.spin * 0.7 * t, p.spin * 0.4 * t)
      const s = p.size * (0.4 + k * 0.6)
      tmp.obj.scale.set(s, s * 0.6, s * 0.25)
      tmp.obj.updateMatrix()
      m.setMatrixAt(i, tmp.obj.matrix)
      m.setColorAt(i, p.color)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.visible = any
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
