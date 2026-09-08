import { useCallback, useEffect, useRef } from 'react'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'
import { TerminalPuzzle } from './puzzles/TerminalPuzzle'
import { PipelinePuzzle } from './puzzles/PipelinePuzzle'
import { KeypadPuzzle } from './puzzles/KeypadPuzzle'

export interface PuzzleProps {
  chamber: ChamberId
  /** Call once when the player has solved it. The host marks progress and closes the overlay shortly after. */
  onSolved: () => void
  /** Whether the chamber is already solved (re-opening a solved console just shows the solved state). */
  solved: boolean
}

/** Mounts the right overlay puzzle for a chamber and handles the solve side-effects. */
export function PuzzleHost({ chamber }: { chamber: ChamberId }) {
  const c = CHAMBERS[chamber]
  const solved = useGame((s) => !!s.solved[chamber])
  const fired = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const onSolved = useCallback(() => {
    if (fired.current) return
    fired.current = true
    const g = useGame.getState()
    g.solve(chamber)
    sfx.play('success')
    // Identity, not shape: closing and reopening the same puzzle produces a new
    // overlay object, and AnimatePresence may reuse this component across that
    // round trip, so an unmount cleanup alone would not cancel this timer.
    const opening = g.overlay
    closeTimer.current = setTimeout(() => {
      const now = useGame.getState()
      if (now.overlay !== opening) return
      now.closeOverlay()
      now.showToast(`Vault ${c.numeral} · ${c.name} has unsealed in the hub.`, 'success')
    }, 2200)
  }, [chamber, c])

  const props: PuzzleProps = { chamber, onSolved, solved }
  switch (c.puzzle) {
    case 'terminal':
      return <TerminalPuzzle {...props} />
    case 'pipeline':
      return <PipelinePuzzle {...props} />
    case 'keypad':
      return <KeypadPuzzle {...props} />
    default:
      return null
  }
}
