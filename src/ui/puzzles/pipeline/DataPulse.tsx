import { useEffect, useRef } from 'react'
import { pointAt, type Track } from './geometry'

export interface DataPulseProps {
  track: Track
  accent: string
  /** ms for one full pass along the chain */
  duration?: number
  /** ms of dark between passes */
  gap?: number
  /** ms before the first pass starts */
  delay?: number
  onNode?: (chainIndex: number, pass: number) => void
  onPassEnd?: (pass: number) => void
}

const TRAIL = [0, 12, 24, 38]

/**
 * A glowing packet that travels the wired chain (RAF-driven, no React state per
 * frame). Fires `onNode` as it reaches each node and `onPassEnd` after each pass,
 * then keeps looping until unmounted.
 */
export function DataPulse({ track, accent, duration = 1600, gap = 420, delay = 0, onNode, onPassEnd }: DataPulseProps) {
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const halo = useRef<SVGCircleElement>(null)
  const cb = useRef({ onNode, onPassEnd })
  cb.current = { onNode, onPassEnd }

  useEffect(() => {
    let raf = 0
    const start = performance.now() + delay
    let pass = 0
    let fired = -1
    let ended = false
    const cycle = duration + gap
    const show = (v: boolean) => {
      const vis = v ? 'visible' : 'hidden'
      dots.current.forEach((d) => d && (d.style.visibility = vis))
      if (halo.current) halo.current.style.visibility = vis
    }
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const el = now - start
      if (el < 0) {
        show(false)
        return
      }
      let local = el - pass * cycle
      while (local >= cycle) {
        pass++
        fired = -1
        ended = false
        local -= cycle
      }
      if (local >= duration) {
        if (!ended) {
          ended = true
          cb.current.onPassEnd?.(pass)
        }
        show(false)
        return
      }
      const s = (local / duration) * track.total
      for (let i = fired + 1; i < track.nodeAt.length; i++) {
        if (track.nodeAt[i] <= s + 0.5) {
          fired = i
          cb.current.onNode?.(i, pass)
        } else break
      }
      show(true)
      dots.current.forEach((d, i) => {
        if (!d) return
        const p = pointAt(track, Math.max(0, s - TRAIL[i]))
        d.setAttribute('cx', p.x.toFixed(1))
        d.setAttribute('cy', p.y.toFixed(1))
      })
      if (halo.current) {
        const p = pointAt(track, s)
        halo.current.setAttribute('cx', p.x.toFixed(1))
        halo.current.setAttribute('cy', p.y.toFixed(1))
        halo.current.setAttribute('r', (13 + Math.sin(now / 90) * 2).toFixed(1))
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [track, duration, gap, delay])

  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle ref={halo} r={13} fill={accent} opacity={0.22} style={{ visibility: 'hidden' }} />
      {TRAIL.map((_, i) => (
        <circle
          key={i}
          ref={(el) => {
            dots.current[i] = el
          }}
          r={i === 0 ? 5.5 : 4.5 - i}
          fill={i === 0 ? '#ffffff' : accent}
          opacity={i === 0 ? 1 : 0.7 - i * 0.18}
          style={{ visibility: 'hidden', filter: i === 0 ? `drop-shadow(0 0 6px ${accent}) drop-shadow(0 0 12px ${accent})` : undefined }}
        />
      ))}
    </g>
  )
}
