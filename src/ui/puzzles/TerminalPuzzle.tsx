import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { TERMINAL_PUZZLE } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'
import { PuzzleFrame } from '../PuzzleFrame'
import type { PuzzleProps } from '../PuzzleHost'
import { PROMPT, complete, initialEngineState, runCommand, type EngineState, type Line } from './terminal/engine'
import './terminal/terminal.css'

/**
 * Chamber I — a CRT-styled restricted shell. The player reads the handover
 * notes, Caesar-decrypts cipher.txt and submits the key with `unlock`.
 *
 * All puzzle text comes from TERMINAL_PUZZLE (src/data/resume.ts); the command
 * logic lives in ./terminal/engine.ts so this file is only presentation,
 * keyboard handling and the unseal / deny animations.
 */

const RULE = '─'.repeat(72)
const BAR_CELLS = 24
const UNSEAL_MS = 820
/** virtual "characters" spent pausing at the end of each banner line */
const LINE_PAUSE = 9
const BOOT_TICK_MS = 11

const BANNER = TERMINAL_PUZZLE.banner
const BANNER_TOTAL = BANNER.reduce((n, l) => n + l.length + LINE_PAUSE, 0)

/** Which banner text is visible after `n` virtual characters of the boot typewriter. */
function bannerAt(n: number): string[] {
  const out: string[] = []
  let budget = n
  for (const line of BANNER) {
    if (budget <= 0) break
    out.push(line.slice(0, Math.min(line.length, budget)))
    budget -= line.length + LINE_PAUSE
  }
  return out
}

function isModifierKey(e: React.KeyboardEvent) {
  return e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'CapsLock'
}

export function TerminalPuzzle({ chamber, onSolved, solved }: PuzzleProps) {
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')
  const [caret, setCaret] = useState(0)
  const [bootChars, setBootChars] = useState(0)
  const [bootDone, setBootDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unsealed, setUnsealed] = useState(solved)
  const [flash, setFlash] = useState<{ kind: 'green' | 'red'; n: number } | null>(null)

  const engine = useRef<EngineState>(initialEngineState(solved))
  const history = useRef<string[]>([])
  const histIdx = useRef(0)
  const draft = useRef('')
  const idRef = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const intervals = useRef(new Set<ReturnType<typeof setInterval>>())
  const lastTypeSfx = useRef(0)
  const solvedFired = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const shake = useAnimationControls()

  const push = useCallback((items: Omit<Line, 'id'>[]) => {
    if (items.length === 0) return
    setLines((prev) => [...prev, ...items.map((l) => ({ ...l, id: ++idRef.current }))])
  }, [])
  const updateLine = useCallback((id: number, text: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)))
  }, [])
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
  }, [])

  // ── boot typewriter (any key skips) ──────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setBootChars((n) => (n >= BANNER_TOTAL ? n : n + 1))
    }, BOOT_TICK_MS)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (bootDone || bootChars < BANNER_TOTAL) return
    setBootDone(true)
    const banner: Omit<Line, 'id'>[] = BANNER.map((text, i) => ({ text, tone: i === 0 ? 'banner' : 'muted' }))
    banner.push({ text: RULE, tone: 'rule' })
    if (solved) {
      banner.push({ text: TERMINAL_PUZZLE.successLines[0], tone: 'success' })
      banner.push({ text: 'session restored — the shell stays open if you want to poke around.', tone: 'muted' })
    }
    push(banner)
  }, [bootChars, bootDone, solved, push])

  // ── focus management ─────────────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    return () => {
      timers.current.forEach(clearTimeout)
      intervals.current.forEach(clearInterval)
      timers.current.clear()
      intervals.current.clear()
    }
  }, [])

  const refocus = useCallback(() => {
    if (window.getSelection()?.toString()) return
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // ── keep the newest output in view ───────────────────────────────────────
  useLayoutEffect(() => {
    const el = screenRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, input, bootChars])

  // ── outcomes ─────────────────────────────────────────────────────────────
  const fireSolved = useCallback(() => {
    if (solvedFired.current) return
    solvedFired.current = true
    onSolved()
  }, [onSolved])

  const startUnseal = useCallback(() => {
    setBusy(true)
    const barId = ++idRef.current
    setLines((prev) => [
      ...prev,
      { id: ++idRef.current, text: 'key accepted — unsealing release vault', tone: 'muted' },
      { id: barId, text: `unsealing ${'░'.repeat(BAR_CELLS)}   0%`, tone: 'success' },
    ])
    const t0 = performance.now()
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / UNSEAL_MS)
      const eased = 1 - Math.pow(1 - p, 2.2)
      const n = Math.round(eased * BAR_CELLS)
      const pct = String(Math.round(eased * 100)).padStart(3, ' ')
      updateLine(barId, `unsealing ${'█'.repeat(n)}${'░'.repeat(BAR_CELLS - n)} ${pct}%`)
      if (p >= 1) {
        clearInterval(iv)
        intervals.current.delete(iv)
        setFlash({ kind: 'green', n: performance.now() })
        setUnsealed(true)
        fireSolved()
        TERMINAL_PUZZLE.successLines.forEach((text, i) => later(() => push([{ text, tone: i === 0 ? 'success' : 'default' }]), 120 + i * 170))
        later(() => setBusy(false), 120 + TERMINAL_PUZZLE.successLines.length * 170)
      }
    }, 33)
    intervals.current.add(iv)
  }, [fireSolved, later, push, updateLine])

  const deny = useCallback(() => {
    sfx.play('error')
    setFlash({ kind: 'red', n: performance.now() })
    void shake.start({ x: [0, -11, 9, -7, 5, -3, 2, 0], transition: { duration: 0.42, ease: 'easeOut' } })
  }, [shake])

  // ── submit a command ─────────────────────────────────────────────────────
  const submit = useCallback(
    (value: string) => {
      setInput('')
      setCaret(0)
      draft.current = ''
      if (value.trim()) {
        const h = history.current
        if (h[h.length - 1] !== value) h.push(value)
      }
      histIdx.current = history.current.length

      const r = runCommand(engine.current, value)
      engine.current = r.state
      const effects = new Set(r.effects.map((e) => e.kind))
      if (effects.has('clear')) {
        setLines([])
        return
      }
      const out: Omit<Line, 'id'>[] = [{ text: value, tone: 'cmd' }, ...r.lines]
      push(out)
      if (effects.has('exit')) {
        later(() => useGame.getState().closeOverlay(), 120)
        return
      }
      if (effects.has('unlock-ok')) startUnseal()
      else if (effects.has('unlock-fail')) deny()
      else if (value.trim()) sfx.play('blip')
    },
    [deny, later, push, startUnseal],
  )

  const doComplete = useCallback(() => {
    const c = complete(input)
    if (c.value !== null) {
      setInput(c.value)
      setCaret(c.value.length)
    }
    if (c.candidates.length > 1) {
      push([
        { text: input, tone: 'cmd' },
        { text: c.candidates.join('   '), tone: 'muted' },
      ])
    }
    if (c.value !== null || c.candidates.length > 1) sfx.play('type')
  }, [input, push])

  const recall = useCallback(
    (dir: -1 | 1) => {
      const h = history.current
      if (h.length === 0) return
      if (histIdx.current === h.length) draft.current = input
      const i = Math.max(0, Math.min(h.length, histIdx.current + dir))
      histIdx.current = i
      const v = i === h.length ? draft.current : h[i]
      setInput(v)
      setCaret(v.length)
    },
    [input],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Escape closes the overlay globally (src/ui/UI.tsx) — let it bubble.
      if (e.key === 'Escape') return
      if (!bootDone) {
        if (!isModifierKey(e)) {
          e.preventDefault()
          setBootChars(BANNER_TOTAL)
        }
        return
      }
      if (busy) {
        e.preventDefault()
        return
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'l') {
          e.preventDefault()
          setLines([])
        } else if (k === 'c' && !window.getSelection()?.toString()) {
          e.preventDefault()
          push([{ text: `${input}^C`, tone: 'cmd' }])
          setInput('')
          setCaret(0)
          histIdx.current = history.current.length
        }
        return
      }
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          submit(input)
          return
        case 'Tab':
          e.preventDefault()
          doComplete()
          return
        case 'ArrowUp':
          e.preventDefault()
          recall(-1)
          return
        case 'ArrowDown':
          e.preventDefault()
          recall(1)
          return
      }
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        const now = performance.now()
        if (now - lastTypeSfx.current > 48) {
          lastTypeSfx.current = now
          sfx.play('type')
        }
      }
    },
    [bootDone, busy, doComplete, input, push, recall, submit],
  )

  const syncCaret = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    setCaret(el.selectionStart ?? el.value.length)
  }

  // ── render ───────────────────────────────────────────────────────────────
  const bootLines = useMemo(() => (bootDone ? [] : bannerAt(bootChars)), [bootChars, bootDone])
  const before = input.slice(0, caret)
  const under = input.charAt(caret)
  const after = input.slice(caret + 1)

  const status = (
    <span className={`term-status ${unsealed ? 'unsealed' : 'locked'}`} data-testid="term-status">
      {unsealed ? 'UNSEALED' : 'LOCKED'}
    </span>
  )

  return (
    <PuzzleFrame chamber={chamber} title={`${TERMINAL_PUZZLE.hostname} — restricted shell`} width={820} hint={status}>
      <div className="term-root">
        <motion.div className={`term-crt${unsealed ? ' unsealed' : ''}${busy ? ' busy' : ''}`} animate={shake} onMouseUp={refocus} data-testid="terminal">
          <div className="term-screen" ref={screenRef}>
            {bootLines.map((text, i) => (
              <div key={`boot-${i}`} className={`term-line ${i === 0 ? 't-banner' : 't-muted'}`}>
                {text}
                {i === bootLines.length - 1 && <span className="term-cursor">&nbsp;</span>}
              </div>
            ))}
            <div className="term-output" data-testid="term-output">
              {lines.map((l) =>
                l.tone === 'cmd' ? (
                  <div key={l.id} className="term-line t-cmd">
                    <span className="term-prompt">{PROMPT}</span>
                    {l.text}
                  </div>
                ) : (
                  <div key={l.id} className={`term-line t-${l.tone}`}>
                    {l.text}
                  </div>
                ),
              )}
            </div>
            {bootDone && (
              <div className="term-line term-inputline" data-testid="term-inputline">
                <span className="term-prompt">{PROMPT}</span>
                {before}
                <span className="term-cursor">{under || ' '}</span>
                {after}
              </div>
            )}
          </div>
          <div className="term-scanlines" />
          <div className="term-vignette" />
          <div className="term-glare" />
          {flash && <div key={flash.n} className={`term-flash ${flash.kind}`} />}
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setCaret(e.target.selectionStart ?? e.target.value.length)
            }}
            onKeyDown={onKeyDown}
            onKeyUp={syncCaret}
            onSelect={syncCaret}
            onBlur={() => later(() => {
              if (document.activeElement === document.body) inputRef.current?.focus({ preventScroll: true })
            }, 0)}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="terminal input"
            data-testid="term-input"
          />
        </motion.div>
        <div className="term-footer">
          <div className="chips">
            {['help', 'ls', 'hint'].map((c) => (
              <button
                key={c}
                type="button"
                className="term-chip"
                disabled={!bootDone || busy}
                onClick={() => {
                  submit(c)
                  refocus()
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="hide-mobile">
            <kbd className="key">Tab</kbd> completes · <kbd className="key">↑</kbd>
            <kbd className="key">↓</kbd> history · <kbd className="key">Esc</kbd> leave
          </div>
        </div>
      </div>
    </PuzzleFrame>
  )
}
