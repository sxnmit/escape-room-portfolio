import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

/**
 * Subtle procedural floor tile: a base colour with faint grid lines and a dot
 * at each intersection. Repeat-wrapped, cached per parameter set.
 */
export function makeGridTexture({
  base = '#3a4160',
  line = 'rgba(255,255,255,0.075)',
  dot = 'rgba(255,255,255,0.16)',
  size = 256,
  cells = 2,
  repeat = [8, 8] as [number, number],
} = {}): THREE.CanvasTexture {
  const key = JSON.stringify([base, line, dot, size, cells, repeat])
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  const step = size / cells
  ctx.strokeStyle = line
  ctx.lineWidth = Math.max(1, size / 128)
  for (let i = 0; i <= cells; i++) {
    const p = Math.round(i * step) + 0.5
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, size)
    ctx.moveTo(0, p)
    ctx.lineTo(size, p)
    ctx.stroke()
  }
  ctx.fillStyle = dot
  for (let i = 0; i <= cells; i++)
    for (let j = 0; j <= cells; j++) {
      ctx.beginPath()
      ctx.arc(i * step, j * step, size / 64, 0, Math.PI * 2)
      ctx.fill()
    }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}
