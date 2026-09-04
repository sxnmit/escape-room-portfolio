import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGame } from '@/state/gameStore'
import { HUD } from './HUD'
import { IntroScreen } from './IntroScreen'
import { MenuOverlay } from './MenuOverlay'
import { ResumePanel } from './ResumePanel'
import { AboutPanel } from './AboutPanel'
import { PuzzleHost } from './PuzzleHost'
import { BriefingCard } from './BriefingCard'
import { sfx } from '@/audio/sfx'
import { TouchControls } from './TouchControls'

export function UI() {
  const overlay = useGame((s) => s.overlay)
  const started = useGame((s) => s.started)

  // global keys: Escape closes overlays / opens the menu; first gesture unlocks audio
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      sfx.unlock()
      if (e.code !== 'Escape') return
      const g = useGame.getState()
      if (!g.started) return
      if (g.overlay) {
        if (g.overlay.kind === 'intro') return
        g.closeOverlay()
      } else {
        g.openOverlay({ kind: 'menu' })
      }
    }
    const onPointer = () => sfx.unlock()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, { once: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  return (
    <div className="ui-root">
      {started && <HUD />}
      <TouchControls />
      <AnimatePresence mode="wait">
        {overlay?.kind === 'intro' && <IntroScreen key="intro" />}
        {overlay?.kind === 'menu' && <MenuOverlay key="menu" />}
        {overlay?.kind === 'puzzle' && <PuzzleHost key={`puzzle-${overlay.chamber}`} chamber={overlay.chamber} />}
        {overlay?.kind === 'briefing' && <BriefingCard key={`brief-${overlay.chamber}`} chamber={overlay.chamber} />}
        {overlay?.kind === 'resume' && <ResumePanel key={`resume-${overlay.chamber}`} chamber={overlay.chamber} />}
        {overlay?.kind === 'about' && <AboutPanel key="about" />}
      </AnimatePresence>
    </div>
  )
}
