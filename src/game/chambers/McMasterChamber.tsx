import { SPOKES } from '@/game/world/layout'
import { PuzzleConsole } from './PuzzleConsole'

/** Placeholder set-piece — replaced by the bespoke McMaster chamber. Rendered inside the spoke's local frame. */
export function McMasterChamber() {
  const spoke = SPOKES.mcmaster
  return <PuzzleConsole chamber="mcmaster" position={spoke.puzzleAnchorLocal} label="Briefing" />
}
