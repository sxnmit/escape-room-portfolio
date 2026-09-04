import { PuzzleFrame } from '../PuzzleFrame'
import type { PuzzleProps } from '../PuzzleHost'

/** PLACEHOLDER — replaced by the real Keypad puzzle. */
export function KeypadPuzzle({ chamber, onSolved, solved }: PuzzleProps) {
  return (
    <PuzzleFrame chamber={chamber} title="Keypad puzzle (placeholder)">
      <div style={{ padding: 24 }}>
        <p>Placeholder for the keypad puzzle.</p>
        <button className="btn primary" disabled={solved} onClick={onSolved}>{solved ? 'Solved' : 'Solve instantly'}</button>
      </div>
    </PuzzleFrame>
  )
}
