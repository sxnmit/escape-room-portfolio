import { PuzzleFrame } from '../PuzzleFrame'
import type { PuzzleProps } from '../PuzzleHost'

/** PLACEHOLDER — replaced by the real Pipeline puzzle. */
export function PipelinePuzzle({ chamber, onSolved, solved }: PuzzleProps) {
  return (
    <PuzzleFrame chamber={chamber} title="Pipeline puzzle (placeholder)">
      <div style={{ padding: 24 }}>
        <p>Placeholder for the pipeline puzzle.</p>
        <button className="btn primary" disabled={solved} onClick={onSolved}>{solved ? 'Solved' : 'Solve instantly'}</button>
      </div>
    </PuzzleFrame>
  )
}
