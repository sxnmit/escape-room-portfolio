import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CHAMBER_ORDER, GAME_SUBTITLE, GAME_TITLE } from '@/data/resume'
import { useGame, progressCount } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'

export function IntroScreen() {
  const start = useGame((s) => s.start)
  const reset = useGame((s) => s.resetProgress)
  const progress = useGame((s) => progressCount(s))
  const hasProgress = useGame((s) => Object.keys(s.solved).length > 0 || Object.keys(s.openedDoors).length > 0)

  const begin = () => {
    sfx.unlock()
    sfx.play('unlock')
    start()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        begin()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div className="overlay-backdrop interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} style={{ background: 'radial-gradient(ellipse at center, rgba(8,10,18,0.55), rgba(8,10,18,0.92))' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }} style={{ textAlign: 'center', maxWidth: 640 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.4em', color: 'var(--gold)', fontWeight: 700 }}>{GAME_SUBTITLE.toUpperCase()}</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 10vw, 96px)', margin: '8px 0 0', lineHeight: 1, letterSpacing: '0.04em', textShadow: '0 0 40px rgba(255,209,102,0.35)' }}>{GAME_TITLE}</h1>
        <p style={{ fontSize: 17, color: 'var(--text)', opacity: 0.9, lineHeight: 1.55, marginTop: 18 }}>
          Five sealed chambers circle the hub. Each holds a puzzle; each puzzle unseals a vault — and each vault holds a chapter of my story.
          <br />
          Walk. Solve. Reveal. Start with the most recent chapter and work back to the foundations.
        </p>

        <div className="panel" style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(2, auto)', gap: '10px 28px', padding: '14px 22px', marginTop: 22, fontSize: 14, textAlign: 'left' }}>
          <span><kbd className="key">W</kbd><kbd className="key">A</kbd><kbd className="key">S</kbd><kbd className="key">D</kbd> &nbsp;move</span>
          <span><kbd className="key">Shift</kbd> &nbsp;run</span>
          <span><kbd className="key">E</kbd> &nbsp;interact</span>
          <span>mouse drag / <kbd className="key">←</kbd><kbd className="key">→</kbd> &nbsp;look around</span>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
          <motion.button className="btn primary" style={{ fontSize: 17, padding: '0.8em 1.8em' }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} onClick={begin}>
            {hasProgress ? `Continue · ${progress}/${CHAMBER_ORDER.length} vaults` : 'Enter the vault'} <kbd className="key" style={{ background: 'rgba(0,0,0,0.2)', color: '#1a1400', border: 'none', boxShadow: 'none' }}>↵</kbd>
          </motion.button>
          {hasProgress && (
            <button className="btn" onClick={() => { reset(); sfx.play('ui'); begin() }}>
              Start over
            </button>
          )}
        </div>
        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--muted)' }}>Best on desktop with a keyboard · sound on for the full effect</div>
      </motion.div>
    </motion.div>
  )
}
