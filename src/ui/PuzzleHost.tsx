import { useCallback, useRef } from 'react'
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

  const onSolved = useCallback(() => {
    if (fired.current) return
    fired.current = true
    const g = useGame.getState()
    g.solve(chamber)
    sfx.play('success')
    setTimeout(() => {
      const now = useGame.getState()
      if (now.overlay?.kind === 'puzzle' && now.overlay.chamber === chamber) now.closeOverlay()
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
