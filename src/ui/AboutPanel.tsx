import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ABOUT } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'

export function AboutPanel() {
  const close = useGame((s) => s.closeOverlay)
  const finish = useGame((s) => s.finish)
  const reset = useGame((s) => s.resetProgress)
  const requestTeleport = useGame((s) => s.requestTeleport)

  useEffect(() => {
    finish()
  }, [finish])

  const stagger = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

  return (
    <motion.div className="overlay-backdrop interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div className="panel scroll" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} style={{ width: '100%', maxWidth: 760, maxHeight: '92vh', overflow: 'auto', borderTop: '3px solid var(--gold)' }}>
        <div style={{ padding: '28px 32px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold)', fontWeight: 800 }}>THE FINALE · ABOUT</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 5vw, 44px)', margin: '6px 0 0', lineHeight: 1.05 }}>{ABOUT.name}</h2>
          <div style={{ marginTop: 6, fontSize: 15, color: 'var(--muted)', fontWeight: 600 }}>{ABOUT.title}</div>
        </div>

        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.15, delayChildren: 0.25 }} style={{ padding: '18px 32px 0', display: 'grid', gap: 12 }}>
          {ABOUT.blurb.map((p, i) => (
            <motion.p key={i} variants={stagger} style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6 }}>
              {p}
            </motion.p>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ margin: '18px 32px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {ABOUT.sideQuests.map((q) => (
            <div key={q.name} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 700 }}>SIDE QUEST</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{q.name}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 4, color: 'var(--text)', opacity: 0.85 }}>{q.blurb}</div>
            </div>
          ))}
        </motion.div>

        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.1, delayChildren: 1 }} style={{ margin: '18px 32px 0', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ABOUT.links.map((l) => (
            <motion.a key={l.label} variants={stagger} href={l.href} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: 'none', color: 'var(--text)' }} onClick={() => sfx.play('ui')}>
              <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{l.label}</span>
              <span style={{ color: 'var(--muted)' }}>{l.value}</span>
            </motion.a>
          ))}
        </motion.div>

        <div style={{ padding: '22px 32px 28px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', color: 'var(--gold)', flex: 1 }}>{ABOUT.closing}</div>
          <button className="btn ghost" onClick={() => { reset(); requestTeleport(0, 2.5, 0); close(); sfx.play('ui') }}>Play again</button>
          <button className="btn primary" onClick={() => { close(); sfx.play('ui') }}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
