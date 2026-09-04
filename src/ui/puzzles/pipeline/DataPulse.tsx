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
 * A glowing packet that travels the wired chain and keeps looping until
 * unmounted. The dot itself is moved in requestAnimationFrame (no React state
 * per frame); the node-reached / pass-end events are scheduled with timers so
 * they land on time even when a slow renderer starves rAF.
 */
export function DataPulse({ track, accent, duration = 1600, gap = 420, delay = 0, onNode, onPassEnd }: DataPulseProps) {
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const halo = useRef<SVGCircleElement>(null)
  const cb = useRef({ onNode, onPassEnd })
  cb.current = { onNode, onPassEnd }

  useEffect(() => {
    const cycle = duration + gap
    const start = performance.now() + delay
    const timers: number[] = []
    let raf = 0

    // ── events: a timer per node arrival + one for the pass end, re-armed every cycle ──
    const schedule = (pass: number) => {
      const base = delay + pass * cycle
      track.nodeAt.forEach((s, i) => {
        timers.push(window.setTimeout(() => cb.current.onNode?.(i, pass), base + (s / (track.total || 1)) * duration))
      })
      timers.push(
        window.setTimeout(() => {
          cb.current.onPassEnd?.(pass)
          schedule(pass + 1)
        }, base + duration),
      )
    }
    schedule(0)

    // ── visuals ──
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
      const local = el % cycle
      if (local >= duration) {
        show(false)
        return
      }
      const s = (local / duration) * track.total
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
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach((t) => clearTimeout(t))
    }
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
