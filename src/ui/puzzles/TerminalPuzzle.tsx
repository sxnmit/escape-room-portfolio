import { PuzzleFrame } from '../PuzzleFrame'
import type { PuzzleProps } from '../PuzzleHost'

/** PLACEHOLDER — replaced by the real Terminal puzzle. */
export function TerminalPuzzle({ chamber, onSolved, solved }: PuzzleProps) {
  return (
    <PuzzleFrame chamber={chamber} title="Terminal puzzle (placeholder)">
      <div style={{ padding: 24 }}>
        <p>Placeholder for the terminal puzzle.</p>
        <button className="btn primary" disabled={solved} onClick={onSolved}>{solved ? 'Solved' : 'Solve instantly'}</button>
      </div>
    </PuzzleFrame>
  )
}
