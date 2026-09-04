import { SPOKES } from '@/game/world/layout'
import { PuzzleConsole } from './PuzzleConsole'

/** Placeholder set-piece — replaced by the bespoke Chalk chamber. Rendered inside the spoke's local frame. */
export function ChalkChamber() {
  const spoke = SPOKES.chalk
  return <PuzzleConsole chamber="chalk" position={spoke.puzzleAnchorLocal} label="Pipeline board" />
}
