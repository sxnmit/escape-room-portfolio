import { SPOKES } from '@/game/world/layout'
import { PuzzleConsole } from './PuzzleConsole'

/** Placeholder set-piece — replaced by the bespoke TetraTech chamber. Rendered inside the spoke's local frame. */
export function TetraTechChamber() {
  const spoke = SPOKES.tetratech
  return <PuzzleConsole chamber="tetratech" position={spoke.puzzleAnchorLocal} label="Briefing" />
}
