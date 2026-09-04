import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { BLOCKS_PUZZLE, CHAMBERS, LANTERNS_PUZZLE, type ChamberId } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'

/** Short instructions card for the in-world (3D) puzzles. */
export function BriefingCard({ chamber }: { chamber: ChamberId }) {
  const c = CHAMBERS[chamber]
  const close = useGame((s) => s.closeOverlay)
  const text = c.puzzle === 'blocks' ? BLOCKS_PUZZLE.briefing : c.puzzle === 'lanterns' ? LANTERNS_PUZZLE.briefing : c.objective

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault()
        sfx.play('ui')
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <motion.div className="overlay-backdrop interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="panel" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} style={{ maxWidth: 520, width: '100%', padding: 26, borderTop: `3px solid ${c.accent}` }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: c.accent, fontWeight: 800 }}>CHAMBER {c.numeral} · BRIEFING</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, marginTop: 6 }}>{c.name}</div>
        <p style={{ fontSize: 16, lineHeight: 1.5, marginTop: 12, color: 'var(--text)' }}>{text}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn primary" onClick={close}>
            Got it <kbd className="key" style={{ background: 'rgba(0,0,0,0.2)', color: '#1a1400', border: 'none', boxShadow: 'none' }}>↵</kbd>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
