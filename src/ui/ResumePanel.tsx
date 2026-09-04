import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CHAMBERS, CHAMBER_ORDER, type ChamberId } from '@/data/resume'
import { useGame, chamberIndex, isFinalUnlocked } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'

/**
 * The "vault reveal": one chapter of the resume presented as a recovered
 * dossier. Opening it counts as revealing the chapter, which unlocks the next
 * chamber door.
 */
export function ResumePanel({ chamber }: { chamber: ChamberId }) {
  const c = CHAMBERS[chamber]
  const close = useGame((s) => s.closeOverlay)
  const reveal = useGame((s) => s.reveal)
  const wasRevealed = useGame.getState().revealed[chamber]

  useEffect(() => {
    if (wasRevealed) return
    const id = setTimeout(() => reveal(chamber), 600)
    return () => clearTimeout(id)
  }, [chamber, reveal, wasRevealed])

  const onClose = () => {
    close()
    if (wasRevealed) return
    const s = useGame.getState()
    const i = chamberIndex(chamber)
    const next = CHAMBER_ORDER[i + 1]
    sfx.play('unlock')
    if (next) s.showToast(`Chamber ${CHAMBERS[next].numeral} · ${CHAMBERS[next].name} has unsealed.`, 'success')
    else if (isFinalUnlocked(s)) s.showToast('Every vault is open. The final door has unsealed.', 'success')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stagger = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }
  const index = chamberIndex(chamber)
  const next = CHAMBER_ORDER[index + 1]
  const nextText = next ? `Next: Chamber ${CHAMBERS[next].numeral} · ${CHAMBERS[next].name} — its door unseals when you continue.` : 'Every chapter recovered — the final door unseals when you continue.'

  return (
    <motion.div className="overlay-backdrop interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div
        className="panel scroll"
        initial={{ opacity: 0, y: 30, scale: 0.96, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ width: '100%', maxWidth: 820, maxHeight: '92vh', padding: 0, overflow: 'auto', borderTop: `3px solid ${c.accent}` }}
      >
        {/* chapter ribbon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 30px 0' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 800, color: 'var(--muted)' }}>CHAPTER {index + 1} OF {CHAMBER_ORDER.length}</span>
          <div style={{ display: 'flex', gap: 4, flex: 1, maxWidth: 220 }}>
            {CHAMBER_ORDER.map((id, i) => (
              <motion.div key={id} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2 + i * 0.06 }} style={{ height: 4, flex: 1, borderRadius: 2, transformOrigin: 'left', background: i <= index ? CHAMBERS[id].accent : 'rgba(255,255,255,0.12)' }} />
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 30px 10px', display: 'flex', gap: 22, alignItems: 'flex-start' }}>
          <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 220 }} style={{ width: 70, height: 70, borderRadius: 18, flexShrink: 0, display: 'grid', placeItems: 'center', background: c.accent, color: '#0b0e17', fontFamily: 'var(--serif)', fontWeight: 800, fontSize: 34, boxShadow: `0 0 40px ${c.accent}66` }}>
            {c.numeral}
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: c.accent, fontWeight: 800 }}>VAULT {c.numeral} · RECOVERED</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px, 4vw, 34px)', margin: '4px 0 0', lineHeight: 1.1 }}>{c.role}</h2>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 600 }}>{c.org}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
              {c.dates}
              {c.location ? ` · ${c.location}` : ''}
            </div>
          </div>
        </div>

        <div style={{ padding: '6px 30px 0' }}>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, color: 'var(--text)', opacity: 0.92, fontStyle: 'italic' }}>{c.tagline}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 20, padding: '18px 30px 8px' }}>
          <motion.ul initial="hidden" animate="show" transition={{ staggerChildren: 0.12, delayChildren: 0.3 }} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
            {c.bullets.map((b, i) => (
              <motion.li key={i} variants={stagger} style={{ display: 'flex', gap: 12, fontSize: 14.5, lineHeight: 1.5 }}>
                <span style={{ color: c.accent, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>▸</span>
                <span>{b}</span>
              </motion.li>
            ))}
          </motion.ul>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} style={{ alignSelf: 'start', padding: 16, borderRadius: 14, background: `${c.accent}18`, border: `1px solid ${c.accent}55`, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{c.highlight.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.85, marginTop: 8, lineHeight: 1.35 }}>{c.highlight.label}</div>
          </motion.div>
        </div>

        {c.extra && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ margin: '10px 30px 0', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{c.extra.title}</div>
            {c.extra.subtitle && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.extra.subtitle}</div>}
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.45, display: 'grid', gap: 6 }}>
              {c.extra.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </motion.div>
        )}

        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.05, delayChildren: 0.7 }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '16px 30px 0' }}>
          {c.stack.map((s) => (
            <motion.span key={s} variants={stagger} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-border)' }}>
              {s}
            </motion.span>
          ))}
        </motion.div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '20px 30px 26px', flexWrap: 'wrap' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} style={{ fontSize: 13, color: 'var(--muted)', flex: 1, minWidth: 200 }}>
            {wasRevealed ? 'Recovered earlier — re-read any chapter from the pause menu.' : nextText}
          </motion.div>
          <button className="btn primary" onClick={onClose}>
            {wasRevealed ? 'Close' : 'Continue'} <kbd className="key" style={{ background: 'rgba(0,0,0,0.2)', color: '#1a1400', border: 'none', boxShadow: 'none' }}>↵</kbd>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
