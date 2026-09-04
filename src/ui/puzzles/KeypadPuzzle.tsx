import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { CHAMBERS, KEYPAD_PUZZLE } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'
import { PuzzleFrame } from '../PuzzleFrame'
import type { PuzzleProps } from '../PuzzleHost'
import { keypadStyles } from './keypad/styles'
import { Padlock } from './keypad/Padlock'

/**
 * Chamber IV — the knowledge-base keypad. The four retrieval monitors in the
 * room each show one digit and its position; the player types the code here.
 * A "Reveal a digit" button hands over the digits one position at a time so
 * the puzzle is always solvable. All copy comes from KEYPAD_PUZZLE.
 */

type Status = 'idle' | 'checking' | 'denied' | 'granted'
type KeyId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | 'back' | 'enter'

const KEYS: KeyId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'enter']
const KEY_LABEL: Record<KeyId, string> = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '0': '0', back: '⌫', enter: '↵' }
/** A small beat between the 4th digit landing and the verdict, so the check reads as deliberate. */
const CHECK_BEAT_MS = 250
/** How long DENIED stays on the display before the slots clear. */
const DENY_MS = 950
const NOTICE_MS = 900

export function KeypadPuzzle({ chamber, onSolved, solved }: PuzzleProps) {
  const accent = CHAMBERS[chamber].accent
  const { title, instructions, code, monitorCaptions, successText } = KEYPAD_PUZZLE
  const LEN = code.length
  const css = useMemo(() => keypadStyles(accent), [accent])

  /** `solved` flips true the moment onSolved() fires; the celebration must key off the state at mount. */
  const solvedAtMount = useRef(solved).current
  const [entered, setEnteredState] = useState(solvedAtMount ? code : '')
  const [status, setStatusState] = useState<Status>(solvedAtMount ? 'granted' : 'idle')
  const [revealed, setRevealed] = useState(solvedAtMount ? LEN : 0)
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(null)

  // refs mirror the state so the window keydown listener and timers never go stale
  const enteredRef = useRef(entered)
  const statusRef = useRef(status)
  const fired = useRef(false)
  const timers = useRef<number[]>([])
  const checkTimer = useRef<number | null>(null)
  const keyEls = useRef(new Map<string, HTMLButtonElement>())
  const shake = useAnimationControls()
  const storeSolved = useGame((s) => !!s.solved[chamber])

  const setEntered = useCallback((v: string) => {
    enteredRef.current = v
    setEnteredState(v)
  }, [])
  const setStatus = useCallback((v: Status) => {
    statusRef.current = v
    setStatusState(v)
  }, [])
  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms)
    timers.current.push(t)
    return t
  }, [])
  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => clearTimeout(id))
  }, [])

  // ── outcomes ─────────────────────────────────────────────────────────────
  const grant = useCallback(() => {
    setStatus('granted')
    setRevealed(LEN)
    if (!fired.current) {
      fired.current = true
      onSolved()
    }
  }, [LEN, onSolved, setStatus])

  const deny = useCallback(() => {
    setStatus('denied')
    sfx.play('error')
    void shake.start({ x: [0, -12, 10, -8, 6, -3, 0], transition: { duration: 0.45, ease: 'easeOut' } })
    later(() => {
      if (statusRef.current !== 'denied') return
      setEntered('')
      setStatus('idle')
    }, DENY_MS)
  }, [later, setEntered, setStatus, shake])

  const check = useCallback(
    (value: string, immediate = false) => {
      if (checkTimer.current !== null) {
        clearTimeout(checkTimer.current)
        checkTimer.current = null
      }
      const run = () => {
        checkTimer.current = null
        if (value === code) grant()
        else deny()
      }
      if (immediate) {
        run()
        return
      }
      setStatus('checking')
      checkTimer.current = later(run, CHECK_BEAT_MS)
    },
    [code, grant, deny, later, setStatus],
  )

  // ── key presses (on-screen and physical) ─────────────────────────────────
  const flashKey = useCallback(
    (k: string) => {
      const el = keyEls.current.get(k)
      if (!el) return
      el.dataset.down = '1'
      later(() => {
        delete el.dataset.down
      }, 140)
    },
    [later],
  )

  const press = useCallback(
    (k: KeyId, viaKeyboard: boolean) => {
      const st = statusRef.current
      if (st === 'granted' || st === 'denied') return
      if (st === 'checking') {
        // Enter during the beat checks right away; everything else waits for the verdict
        if (k === 'enter') {
          if (viaKeyboard) flashKey(k)
          sfx.play('ui')
          check(enteredRef.current, true)
        }
        return
      }
      if (viaKeyboard) flashKey(k)
      const cur = enteredRef.current
      if (k === 'back') {
        if (!cur) return
        sfx.play('ui')
        setEntered(cur.slice(0, -1))
        return
      }
      if (k === 'enter') {
        sfx.play('ui')
        if (cur.length === LEN) check(cur, true)
        else setNotice({ text: `ENTER ${LEN} DIGITS`, n: Date.now() })
        return
      }
      if (cur.length >= LEN) return
      const next = cur + k
      sfx.play('blip')
      setEntered(next)
      if (next.length === LEN) check(next)
    },
    [LEN, check, flashKey, setEntered],
  )
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      let k: KeyId | null = null
      if (/^[0-9]$/.test(e.key)) k = e.key as KeyId
      else {
        const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)
        if (m) k = m[1] as KeyId
      }
      if (e.key === 'Backspace') k = 'back'
      else if (e.key === 'Enter') k = 'enter'
      if (!k) return // Escape and everything else bubble on to the global handlers
      e.preventDefault()
      pressRef.current(k, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // the notice ("ENTER 4 DIGITS") clears itself
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice((cur) => (cur && cur.n === notice.n ? null : cur)), NOTICE_MS)
    return () => clearTimeout(t)
  }, [notice])

  // ── solved from outside the keypad (e.g. window.__game.solve) ────────────
  useEffect(() => {
    if (!storeSolved || statusRef.current === 'granted') return
    if (checkTimer.current !== null) {
      clearTimeout(checkTimer.current)
      checkTimer.current = null
    }
    setEntered(code)
    grant()
  }, [storeSolved, code, grant, setEntered])

  const reveal = useCallback(() => {
    if (statusRef.current === 'granted') return
    setRevealed((r) => {
      if (r >= LEN) return r
      sfx.play('ui')
      return r + 1
    })
  }, [LEN])

  // ── render ───────────────────────────────────────────────────────────────
  const granted = status === 'granted'
  const statusText = notice
    ? notice.text
    : granted
      ? 'GRANTED'
      : status === 'denied'
        ? 'DENIED'
        : status === 'checking'
          ? 'CHECKING'
          : entered.length === 0
            ? 'ENTER CODE'
            : `${entered.length} / ${LEN}`

  return (
    <PuzzleFrame
      chamber={chamber}
      title={title}
      width={560}
      hint={
        <AnimatePresence>
          {granted && (
            <motion.span className="kp-badge" initial={{ opacity: 0, scale: 0.6, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
              Unlocked ✓
            </motion.span>
          )}
        </AnimatePresence>
      }
    >
      <style>{css}</style>
      <div className="kp-root">
        <div className="kp-cols">
          {/* ── keypad ── */}
          <motion.div className="kp-pad" animate={shake} data-testid="keypad" data-granted={granted ? '1' : '0'}>
            <div className="kp-brand">
              <span>{CHAMBERS[chamber].name.toUpperCase()} · ACCESS</span>
              <i />
            </div>
            <div className="kp-display" data-testid="keypad-display" data-status={status} data-entered={entered.length}>
              <div className="kp-flash" />
              <div className="kp-slots">
                {Array.from({ length: LEN }, (_, i) => {
                  const ch = entered[i]
                  return (
                    <div key={i} className={`kp-slot${ch ? '' : ' empty'}`}>
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={ch ? `d${i}-${ch}` : `e${i}`}
                          initial={{ scale: ch ? 1.7 : 0.6, opacity: 0, y: ch ? -6 : 0 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.08 } }}
                          transition={{ type: 'spring', stiffness: 700, damping: 26, opacity: { duration: 0.06 } }}
                        >
                          {ch ?? '●'}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
              <div className={`kp-status${notice ? ' notice' : ''}`} data-testid="keypad-status">
                {statusText}
              </div>
            </div>
            <div className="kp-grid">
              {KEYS.map((k) => (
                <motion.button
                  key={k}
                  type="button"
                  className={`kp-key${k === 'back' ? ' fn' : ''}${k === 'enter' ? ' fn enter' : ''}`}
                  data-key={k}
                  disabled={granted}
                  aria-label={k === 'back' ? 'Backspace' : k === 'enter' ? 'Enter' : k}
                  ref={(el) => {
                    if (el) keyEls.current.set(k, el)
                    else keyEls.current.delete(k)
                  }}
                  whileTap={granted ? undefined : { y: 3, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                  onClick={(e) => {
                    e.currentTarget.blur()
                    press(k, false)
                  }}
                >
                  <span>{KEY_LABEL[k]}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ── hint panel ── */}
          <div className="kp-side">
            <div className="kp-lockrow">
              <div className="kp-lockwrap">
                <AnimatePresence>
                  {granted && !solvedAtMount && (
                    <motion.div className="kp-burst" initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.25 }} />
                  )}
                </AnimatePresence>
                <Padlock open={granted} accent={accent} />
              </div>
              <div>
                <div className="kp-lock-title">RETRIEVAL LOCK</div>
                <div className={`kp-lock-state${granted ? ' open' : ''}`} data-testid="lock-state">
                  {granted ? 'UNLOCKED' : 'LOCKED'}
                </div>
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {granted ? (
                <motion.p
                  key="ok"
                  className="kp-success"
                  data-testid="keypad-success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: solvedAtMount ? 0 : 0.3, type: 'spring', stiffness: 260, damping: 20 }}
                >
                  {successText}
                </motion.p>
              ) : (
                <motion.p key="how" className="kp-instructions" exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
                  {instructions}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="kp-cards">
              {monitorCaptions.map((cap, i) => {
                const known = granted || i < revealed
                return (
                  <div key={i} className={`kp-card${granted ? ' open' : known ? ' known' : ''}`} data-testid={`digit-card-${i}`} data-digit={known ? code[i] : ''}>
                    <div className={`kp-digit${known ? '' : ' unknown'}`}>
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={known ? 'k' : 'u'}
                          initial={{ y: 14, opacity: 0, scale: 0.6 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          exit={{ y: -14, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 22, delay: granted && !solvedAtMount ? 0.35 + i * 0.09 : 0 }}
                        >
                          {known ? code[i] : '?'}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <div className="kp-pos">POSITION {i + 1}</div>
                    <div className="kp-cap">{cap}</div>
                  </div>
                )
              })}
            </div>
            <div className="kp-revealrow">
              <button type="button" className="btn ghost kp-revealbtn" data-testid="reveal-digit" onClick={reveal} disabled={granted || revealed >= LEN}>
                {revealed >= LEN ? 'All revealed' : 'Reveal a digit'}
              </button>
              <span className="kp-revealcount" data-testid="reveal-count">
                {revealed} / {LEN} revealed
              </span>
            </div>
          </div>
        </div>
        <div className="kp-footer">
          <span>
            <kbd className="key">0–9</kbd> type · <kbd className="key">⌫</kbd> delete · <kbd className="key">↵</kbd> check
          </span>
          <span className="hide-mobile">
            <kbd className="key">Esc</kbd> leave
          </span>
        </div>
      </div>
    </PuzzleFrame>
  )
}
