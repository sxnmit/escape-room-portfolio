import { SPOKES } from '@/game/world/layout'
import { PuzzleConsole } from './PuzzleConsole'

/** Placeholder set-piece — replaced by the bespoke Scotiabank chamber. Rendered inside the spoke's local frame. */
export function ScotiabankChamber() {
  const spoke = SPOKES.scotiabank
  return <PuzzleConsole chamber="scotiabank" position={spoke.puzzleAnchorLocal} label="Terminal" />
}
