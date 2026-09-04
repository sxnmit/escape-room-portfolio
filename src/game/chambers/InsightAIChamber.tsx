import { SPOKES } from '@/game/world/layout'
import { PuzzleConsole } from './PuzzleConsole'

/** Placeholder set-piece — replaced by the bespoke InsightAI chamber. Rendered inside the spoke's local frame. */
export function InsightAIChamber() {
  const spoke = SPOKES.insightai
  return <PuzzleConsole chamber="insightai" position={spoke.puzzleAnchorLocal} label="Keypad" />
}
