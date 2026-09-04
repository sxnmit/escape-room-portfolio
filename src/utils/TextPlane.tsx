import { useMemo } from 'react'
import * as THREE from 'three'

export interface TextTextureOptions {
  text: string | string[]
  /** canvas px */
  width?: number
  height?: number
  font?: string
  color?: string
  background?: string
  align?: CanvasTextAlign
  lineHeight?: number
  padding?: number
  /** Optional glow (shadowBlur) in the text colour. */
  glow?: number
}

/**
 * Renders text onto a CanvasTexture. Works fully offline (no font fetching),
 * which is why we use it for in-world signage instead of drei's <Text>.
 */
export function makeTextTexture({
  text,
  width = 512,
  height = 128,
  font = 'bold 56px "Inter", "Segoe UI", system-ui, sans-serif',
  color = '#ffffff',
  background = 'transparent',
  align = 'center',
  lineHeight = 1.15,
  padding = 16,
  glow = 0,
}: TextTextureOptions): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  if (background !== 'transparent') {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (glow) {
    ctx.shadowColor = color
    ctx.shadowBlur = glow
  }
  const lines = Array.isArray(text) ? text : [text]
  const size = parseInt(/(\d+)px/.exec(font)?.[1] ?? '48', 10)
  const lh = size * lineHeight
  const total = lh * lines.length
  const x = align === 'left' ? padding : align === 'right' ? width - padding : width / 2
  lines.forEach((line, i) => {
    const y = height / 2 - total / 2 + lh * (i + 0.5)
    ctx.fillText(line, x, y, width - padding * 2)
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export interface TextPlaneProps extends TextTextureOptions {
  /** world size */
  size?: [number, number]
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** Use an unlit material so the text is always readable. */
  unlit?: boolean
  emissive?: number
  opacity?: number
  depthWrite?: boolean
  renderOrder?: number
}

export function TextPlane({
  size = [2, 0.5],
  position,
  rotation,
  unlit = true,
  emissive = 1,
  opacity = 1,
  depthWrite = false,
  renderOrder,
  ...opts
}: TextPlaneProps) {
  const key = JSON.stringify([opts.text, opts.font, opts.color, opts.background, opts.width, opts.height, opts.align, opts.glow])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const texture = useMemo(() => makeTextTexture(opts), [key])
  return (
    <mesh position={position} rotation={rotation} renderOrder={renderOrder}>
      <planeGeometry args={size} />
      {unlit ? (
        <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={depthWrite} toneMapped={false} />
      ) : (
        <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={emissive} transparent opacity={opacity} depthWrite={depthWrite} />
      )}
    </mesh>
  )
}
