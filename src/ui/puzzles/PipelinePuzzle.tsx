import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CHAMBERS, PIPELINE_PUZZLE } from '@/data/resume'
import { sfx } from '@/audio/sfx'
import { PuzzleFrame } from '../PuzzleFrame'
import type { PuzzleProps } from '../PuzzleHost'
import { boardLayout, buildTrack, linkPath, type PortMap, type Pt } from './pipeline/geometry'
import { pipelineStyles } from './pipeline/styles'
import { NodeCard } from './pipeline/NodeCard'
import { DataPulse } from './pipeline/DataPulse'

type Phase = 'wiring' | 'pulsing' | 'deployed'
type Tone = 'info' | 'err' | 'ok'

interface Drag {
  id: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  hot: string | null
  cleanup: () => void
}

interface Ripple {
  key: string
  p: Pt
}

const HINT_MS = 2000

/**
 * Chamber II — "connect the pipeline". Drag (or click-click) from a node's
 * output port to the next node's input port; the chain must be built in order
 * from the start node. Five links → a data pulse runs the chain → deployed.
 */
export function PipelinePuzzle({ chamber, onSolved, solved }: PuzzleProps) {
  const accent = CHAMBERS[chamber].accent
  const { order, nodes, instructions, successText, title } = PIPELINE_PUZZLE
  const total = order.length - 1
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const slots = useMemo(() => boardLayout(order).map((id) => byId[id]).filter(Boolean), [order, byId])
  const css = useMemo(() => pipelineStyles(accent), [accent])

  const [wired, setWired] = useState(solved ? total : 0)
  const [phase, setPhase] = useState<Phase>(solved ? 'pulsing' : 'wiring')
  const [ports, setPorts] = useState<PortMap>({})
  const [armed, setArmed] = useState<string | null>(null)
  const [hot, setHot] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [hintId, setHintId] = useState<string | null>(null)
  const [shake, setShake] = useState<{ id: string; n: number }>({ id: '', n: 0 })
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [msg, setMsg] = useState<{ text: ReactNode; tone: Tone; n: number }>(() =>
    solved
      ? { text: successText, tone: 'ok', n: 0 }
      : { text: <>Start at <em>{byId[order[0]]?.label}</em> — drag its ● to whatever happens next.</>, tone: 'info', n: 0 },
  )

  const boardRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<SVGPathElement>(null)
  const cards = useRef(new Map<string, HTMLDivElement>())
  const drag = useRef<Drag | null>(null)
  const wiredRef = useRef(wired)
  wiredRef.current = wired
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const portsRef = useRef(ports)
  portsRef.current = ports
  const fired = useRef(false)
  const timers = useRef<number[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms)
    timers.current.push(t)
    return t
  }, [])

  // ── measure port centres (offset-based, so entry transforms don't matter) ──
  const measure = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const next: PortMap = {}
    cards.current.forEach((card, id) => {
      const entry: PortMap[string] = {}
      for (const kind of ['in', 'out'] as const) {
        const port = card.querySelector<HTMLElement>(`[data-port="${kind}"]`)
        if (!port) continue
        // card's offsetParent is its motion wrapper (position: relative), whose offsetParent is the board
        const wrap = card.offsetParent as HTMLElement | null
        const ox = (wrap && wrap !== board ? wrap.offsetLeft : 0) + card.offsetLeft
        const oy = (wrap && wrap !== board ? wrap.offsetTop : 0) + card.offsetTop
        entry[kind] = { x: ox + port.offsetLeft + port.offsetWidth / 2, y: oy + port.offsetTop + port.offsetHeight / 2 }
      }
      next[id] = entry
    })
    setPorts((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [])

  useLayoutEffect(() => {
    measure()
    const board = boardRef.current
    if (!board || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(board)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    const t = timers.current
    return () => {
      t.forEach((id) => clearTimeout(id))
      drag.current?.cleanup()
      // the player wired everything but closed the board mid-celebration: still counts
      if (!solved && wiredRef.current === total && !fired.current) {
        fired.current = true
        onSolved()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const track = useMemo(() => (wired === total ? buildTrack(order, ports) : null), [wired, total, order, ports])

  // ── helpers ────────────────────────────────────────────────────────────
  const setLive = useCallback((from: Pt | null, to: Pt | null) => {
    liveRef.current?.setAttribute('d', from && to ? linkPath(from, to) : '')
  }, [])

  const toLocal = useCallback((clientX: number, clientY: number): Pt => {
    const b = boardRef.current
    if (!b) return { x: 0, y: 0 }
    const r = b.getBoundingClientRect()
    return { x: (clientX - r.left) * (b.offsetWidth / (r.width || 1)), y: (clientY - r.top) * (b.offsetHeight / (r.height || 1)) }
  }, [])

  const targetAt = useCallback(
    (clientX: number, clientY: number, source: string): string | null => {
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
      const card = el?.closest('[data-node]') as HTMLElement | null
      const id = card?.dataset.node ?? null
      if (!id || id === source || id === order[0]) return null
      return id
    },
    [order],
  )

  const flashCard = useCallback(
    (id: string) => {
      const el = cards.current.get(id)
      if (!el) return
      el.dataset.flash = '1'
      later(() => {
        delete el.dataset.flash
      }, 380)
    },
    [later],
  )

  const litCard = useCallback(
    (id: string) => {
      const el = cards.current.get(id)
      if (!el) return
      el.dataset.lit = '1'
      later(() => {
        delete el.dataset.lit
      }, 420)
    },
    [later],
  )

  const attemptLink = useCallback(
    (source: string, target: string) => {
      if (phaseRef.current !== 'wiring') return
      const k = wiredRef.current
      const p = portsRef.current
      if (source === order[k] && target === order[k + 1]) {
        const n = k + 1
        wiredRef.current = n
        setWired(n)
        sfx.play('blip')
        const a = p[source]?.out
        const b = p[target]?.in
        setRipples((r) => [...r.slice(-6), ...(a ? [{ key: `${n}a`, p: a }] : []), ...(b ? [{ key: `${n}b`, p: b }] : [])])
        if (n === total) {
          setMsg({ text: 'All wired — running the pipeline…', tone: 'ok', n: Date.now() })
          later(() => setPhase('pulsing'), 560)
        } else {
          setMsg({ text: <>Wired <em>{byId[target]?.label}</em>. {total - n} to go — keep following the flow.</>, tone: 'ok', n: Date.now() })
        }
        return
      }
      sfx.play('error')
      setShake((s) => ({ id: target, n: s.n + 1 }))
      flashCard(target)
      const targetLinked = order.indexOf(target) > 0 && order.indexOf(target) <= k
      let text: ReactNode
      if (targetLinked) text = <><em>{byId[target]?.label}</em> is already wired in.</>
      else if (source !== order[k]) text = k === 0 ? <>That’s not the next step — follow the flow from the start, <em>{byId[order[0]]?.label}</em>.</> : <>That’s not the next step — continue the flow from <em>{byId[order[k]]?.label}</em>.</>
      else text = <>That’s not the next step — what happens right after <em>{byId[source]?.label}</em>?</>
      setMsg({ text, tone: 'err', n: Date.now() })
    },
    [order, total, byId, later, flashCard],
  )

  // ── pointer interaction ────────────────────────────────────────────────
  const onOutDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      if (phaseRef.current !== 'wiring' || drag.current) return
      const src = portsRef.current[id]?.out
      if (!src) return
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      const d: Drag = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, hot: null, cleanup: () => {} }
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== d.pointerId) return
        if (!d.moved && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) > 5) d.moved = true
        if (!d.moved) return
        const t = targetAt(ev.clientX, ev.clientY, id)
        if (t !== d.hot) {
          d.hot = t
          setHot(t)
        }
        const end = t ? portsRef.current[t]?.in ?? toLocal(ev.clientX, ev.clientY) : toLocal(ev.clientX, ev.clientY)
        setLive(src, end)
      }
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== d.pointerId) return
        d.cleanup()
        try {
          el.releasePointerCapture(d.pointerId)
        } catch {
          /* noop */
        }
        drag.current = null
        setDragging(null)
        setHot(null)
        if (!d.moved) {
          // click-click mode: arm this output (or disarm it)
          setArmed((prev) => (prev === id ? null : id))
          sfx.play('ui')
          setLive(null, null)
          return
        }
        setArmed(null)
        setLive(null, null)
        if (d.hot) attemptLink(id, d.hot)
      }
      d.cleanup = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      drag.current = d
      setDragging(id)
      setLive(src, src)
    },
    [targetAt, toLocal, setLive, attemptLink],
  )

  const onTargetUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      if (drag.current || !armed || armed === id || id === order[0]) return
      e.stopPropagation()
      setArmed(null)
      setLive(null, null)
      attemptLink(armed, id)
    },
    [armed, order, attemptLink],
  )

  const onBoardDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.pp-port')) return
      if (armed) {
        setArmed(null)
        setLive(null, null)
      }
    },
    [armed, setLive],
  )

  const onBoardMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!armed || drag.current) return
      const src = portsRef.current[armed]?.out
      if (!src) return
      const t = targetAt(e.clientX, e.clientY, armed)
      setLive(src, t ? portsRef.current[t]?.in ?? toLocal(e.clientX, e.clientY) : toLocal(e.clientX, e.clientY))
    },
    [armed, targetAt, toLocal, setLive],
  )

  const onHint = useCallback(() => {
    if (phaseRef.current !== 'wiring') return
    const k = wiredRef.current
    sfx.play('ui')
    setHintId(order[k + 1])
    setMsg({ text: <>The pulsing node is the next step — wire it from <em>{byId[order[k]]?.label}</em>.</>, tone: 'info', n: Date.now() })
    later(() => setHintId(null), HINT_MS)
  }, [order, byId, later])

  // ── completion ─────────────────────────────────────────────────────────
  const onNode = useCallback(
    (i: number, pass: number) => {
      litCard(order[i])
      if (pass === 0 && !solved) sfx.play('blip')
    },
    [order, litCard, solved],
  )
  const onPassEnd = useCallback(
    (pass: number) => {
      if (pass !== 0 || solved) return
      setPhase('deployed')
      setMsg({ text: successText, tone: 'ok', n: Date.now() })
      if (!fired.current) {
        fired.current = true
        onSolved()
      }
    },
    [solved, successText, onSolved],
  )

  const deployed = solved || phase === 'deployed'
  const stepOf = (id: string) => {
    const i = order.indexOf(id)
    return wired > 0 && i >= 0 && i <= wired ? i + 1 : null
  }
  const links: string[] = []
  for (let k = 0; k < wired; k++) {
    const a = ports[order[k]]?.out
    const b = ports[order[k + 1]]?.in
    if (a && b) links.push(linkPath(a, b))
  }

  return (
    <PuzzleFrame
      chamber={chamber}
      title={title}
      width={900}
      hint={
        <AnimatePresence>
          {deployed && (
            <motion.span className="pp-badge" initial={{ opacity: 0, scale: 0.6, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
              Deployed ✓
            </motion.span>
          )}
        </AnimatePresence>
      }
    >
      <style>{css}</style>
      <div className="pp-root">
        <p className="pp-instructions">{instructions}</p>
        <div className="pp-board-wrap">
          <div ref={boardRef} className="pp-board" data-phase={phase} onPointerDown={onBoardDown} onPointerMove={onBoardMove} style={{ cursor: dragging ? 'grabbing' : undefined }}>
            <svg className="pp-layer under" aria-hidden>
              {links.map((d, k) => (
                <g key={k}>
                  <motion.path className="pp-link-glow" d={d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: 'easeOut', delay: solved ? 0.15 + k * 0.1 : 0 }} />
                  <motion.path className="pp-link" d={d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: 'easeOut', delay: solved ? 0.15 + k * 0.1 : 0 }} />
                  {phase !== 'wiring' && <path className="pp-flow" d={d} />}
                </g>
              ))}
            </svg>

            {slots.map((n, i) => {
              const idx = order.indexOf(n.id)
              return (
                <NodeCard
                  key={n.id}
                  node={n}
                  slot={i}
                  isStart={idx === 0}
                  isEnd={idx === order.length - 1}
                  step={stepOf(n.id)}
                  linkedIn={idx > 0 && idx <= wired}
                  linkedOut={idx >= 0 && idx < wired}
                  armed={armed === n.id}
                  hot={hot === n.id}
                  hinting={hintId === n.id}
                  shakeN={shake.id === n.id ? shake.n : 0}
                  done={phase !== 'wiring'}
                  cardRef={(id, el) => {
                    if (el) cards.current.set(id, el)
                    else cards.current.delete(id)
                  }}
                  onOutDown={onOutDown}
                  onTargetUp={onTargetUp}
                />
              )
            })}

            <svg className="pp-layer over" aria-hidden>
              <path ref={liveRef} className="pp-live" d="" />
              {ripples.map((r) => (
                <g key={r.key}>
                  <motion.circle cx={r.p.x} cy={r.p.y} fill="none" stroke={accent} strokeWidth={2} initial={{ r: 6, opacity: 0.95 }} animate={{ r: 30, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                  <motion.circle cx={r.p.x} cy={r.p.y} fill={accent} initial={{ r: 4, opacity: 0.9 }} animate={{ r: 16, opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                </g>
              ))}
              {phase !== 'wiring' && track && <DataPulse track={track} accent={accent} delay={solved ? 800 : 120} onNode={onNode} onPassEnd={onPassEnd} />}
            </svg>

            <AnimatePresence>
              {phase === 'deployed' && !solved && (
                <motion.div
                  className="pp-ribbon"
                  initial={{ opacity: 0, scaleX: 0.4, y: 12 }}
                  animate={{ opacity: 1, scaleX: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                >
                  <motion.div className="pp-ribbon-title" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    PIPELINE DEPLOYED
                  </motion.div>
                  <motion.div className="pp-ribbon-text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    {successText}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="pp-footer">
          <div className="pp-rail" data-wired={wired} data-total={total}>
            <div className="pp-segs">
              {Array.from({ length: total }, (_, i) => (
                <div key={i} className={`pp-seg${i < wired ? ' on' : ''}`} />
              ))}
            </div>
            <div className="pp-wired">
              WIRED <b>{wired}</b> / {total}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={msg.n} className={`pp-msg ${msg.tone}`} data-tone={msg.tone} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {msg.text}
            </motion.div>
          </AnimatePresence>
          <button className="btn ghost pp-hintbtn" onClick={onHint} disabled={phase !== 'wiring'} style={{ opacity: phase !== 'wiring' ? 0.4 : 1 }}>
            Hint
          </button>
        </div>
      </div>
    </PuzzleFrame>
  )
}
