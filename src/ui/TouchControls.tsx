import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/gameStore'
import { interactWith } from '@/state/interactables'
import { playerSnapshot } from '@/game/Player'
import { sfx } from '@/audio/sfx'

const R = 58 // joystick radius in px

/** Detects a touch-first device (or ?touch in the URL for testing). */
export function useIsTouch() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(pointer: coarse)').matches || new URLSearchParams(window.location.search).has('touch')
  }, [])
}

/**
 * Virtual joystick (left thumb) + interact / run buttons (right thumb).
 * Feeds `playerSnapshot.touch`, which the player controller reads when no
 * keyboard input is active.
 */
export function TouchControls() {
  const isTouch = useIsTouch()
  const started = useGame((s) => s.started)
  const overlay = useGame((s) => s.overlay)
  const nearestId = useGame((s) => s.nearestId)
  const nearestPrompt = useGame((s) => s.nearestPrompt)
  const [run, setRun] = useState(false)
  const knob = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    playerSnapshot.touch.run = run
  }, [run])

  // release the stick whenever the controls unmount or an overlay opens
  useEffect(() => {
    return () => {
      playerSnapshot.touch.x = 0
      playerSnapshot.touch.z = 0
    }
  }, [])
  useEffect(() => {
    if (overlay) {
      playerSnapshot.touch.x = 0
      playerSnapshot.touch.z = 0
      drag.current = null
      if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
    }
  }, [overlay])

  if (!isTouch || !started || overlay) return null

  const setStick = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy)
    const k = len > R ? R / len : 1
    const x = dx * k
    const y = dy * k
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`
    playerSnapshot.touch.x = x / R
    playerSnapshot.touch.z = -y / R
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = base.current!.getBoundingClientRect()
    drag.current = { id: e.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
    base.current!.setPointerCapture(e.pointerId)
    setStick(e.clientX - drag.current.cx, e.clientY - drag.current.cy)
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    e.preventDefault()
    setStick(e.clientX - d.cx, e.clientY - d.cy)
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    setStick(0, 0)
  }

  const circle: React.CSSProperties = {
    borderRadius: '50%',
    background: 'rgba(14, 17, 28, 0.55)',
    border: '1px solid rgba(255,255,255,0.18)',
    backdropFilter: 'blur(8px)',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  }

  return (
    <>
      <div
        ref={base}
        className="interactive"
        data-testid="touch-stick"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ ...circle, position: 'absolute', left: 28, bottom: 28, width: R * 2 + 24, height: R * 2 + 24, display: 'grid', placeItems: 'center' }}
        aria-label="Move"
        role="application"
      >
        <div ref={knob} style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', transition: 'transform 0.05s linear' }} />
      </div>
      <div className="interactive" style={{ position: 'absolute', right: 28, bottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <button
          aria-pressed={run}
          aria-label="Run"
          onClick={() => {
            setRun((r) => !r)
            sfx.play('ui')
          }}
          style={{ ...circle, width: 58, height: 58, color: run ? '#0b0e17' : 'var(--text)', background: run ? 'var(--gold)' : circle.background, fontWeight: 800, fontSize: 12, letterSpacing: '0.1em' }}
        >
          RUN
        </button>
        <button
          data-testid="touch-interact"
          aria-label={nearestPrompt ? `Interact: ${nearestPrompt}` : 'Interact'}
          disabled={!nearestId}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            const id = useGame.getState().nearestId
            if (id) interactWith(id)
          }}
          style={{ ...circle, width: 92, height: 92, fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 30, color: nearestId ? '#0b0e17' : 'var(--muted)', background: nearestId ? 'var(--mint)' : circle.background, opacity: nearestId ? 1 : 0.55, boxShadow: nearestId ? '0 0 30px rgba(124,245,196,0.5)' : 'none', transition: 'all 0.2s ease' }}
        >
          E
        </button>
      </div>
    </>
  )
}
