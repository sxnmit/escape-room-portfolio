import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CHAMBERS, CHAMBER_ORDER } from '@/data/resume'
import { useGame, currentObjective } from '@/state/gameStore'
import { Minimap } from './Minimap'
import { sfx } from '@/audio/sfx'

export function HUD() {
  return (
    <>
      <ObjectiveCard />
      <TopRight />
      <Prompt />
      <Toast />
      <Banner />
      <ControlsHint />
    </>
  )
}

function ObjectiveCard() {
  const objective = useGame((s) => currentObjective(s))
  const solved = useGame((s) => s.solved)
  const revealed = useGame((s) => s.revealed)
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ position: 'absolute', top: 18, left: 18, maxWidth: 360 }}
      className="panel"
    >
      <div style={{ padding: '12px 16px 12px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>OBJECTIVE</div>
        <AnimatePresence mode="wait">
          <motion.div key={objective} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={{ marginTop: 4, fontSize: 14, lineHeight: 1.35, fontWeight: 500 }}>
            {objective}
          </motion.div>
        </AnimatePresence>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {CHAMBER_ORDER.map((id) => {
            const c = CHAMBERS[id]
            const state = revealed[id] ? 'revealed' : solved[id] ? 'solved' : 'todo'
            return (
              <div key={id} title={`${c.numeral} · ${c.name}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: 'var(--serif)',
                    background: state === 'revealed' ? c.accent : state === 'solved' ? `${c.accent}55` : 'rgba(255,255,255,0.06)',
                    color: state === 'revealed' ? '#0b0e17' : state === 'solved' ? '#fff' : 'var(--muted)',
                    border: `1px solid ${state === 'todo' ? 'rgba(255,255,255,0.12)' : c.accent}`,
                    boxShadow: state === 'revealed' ? `0 0 14px ${c.accent}88` : 'none',
                    transition: 'all 0.4s ease',
                  }}
                >
                  {c.numeral}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

function TopRight() {
  const muted = useGame((s) => s.muted)
  const fx = useGame((s) => s.fx)
  const toggleMute = useGame((s) => s.toggleMute)
  const toggleFx = useGame((s) => s.toggleFx)
  const openOverlay = useGame((s) => s.openOverlay)
  const btn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--panel-border)',
    background: 'var(--panel)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 15,
  }
  return (
    <div style={{ position: 'absolute', top: 18, right: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      <div className="interactive" style={{ display: 'flex', gap: 8 }}>
        <button style={btn} title={muted ? 'Unmute' : 'Mute'} onClick={() => { toggleMute(); sfx.play('ui') }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button style={{ ...btn, opacity: fx ? 1 : 0.6 }} title={fx ? 'Disable glow effects' : 'Enable glow effects'} onClick={() => { toggleFx(); sfx.play('ui') }}>
          ✨
        </button>
        <button style={btn} title="Menu (Esc)" onClick={() => { openOverlay({ kind: 'menu' }); sfx.play('ui') }}>
          ☰
        </button>
      </div>
      <div className="hide-mobile">
        <Minimap />
      </div>
    </div>
  )
}

function Prompt() {
  const prompt = useGame((s) => s.nearestPrompt)
  const id = useGame((s) => s.nearestId)
  const overlay = useGame((s) => s.overlay)
  const show = !!id && !!prompt && !overlay
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="prompt"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          style={{ position: 'absolute', left: '50%', bottom: 64, transform: 'translateX(-50%)' }}
        >
          <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 12px', borderRadius: 999, fontSize: 15, fontWeight: 600 }}>
            <kbd className="key">E</kbd>
            <span>{prompt}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Toast() {
  const toast = useGame((s) => s.toast)
  const clear = useGame((s) => s.clearToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clear, 3600)
    return () => clearTimeout(t)
  }, [toast, clear])
  const color = toast?.tone === 'locked' ? 'var(--red)' : toast?.tone === 'success' ? 'var(--mint)' : 'var(--gold)'
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{ position: 'absolute', left: '50%', bottom: 130, transform: 'translateX(-50%)', maxWidth: 520 }}
        >
          <div className="panel" style={{ padding: '10px 18px', borderLeft: `3px solid ${color}`, fontSize: 14, fontWeight: 500, textAlign: 'center' }}>
            {toast.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Banner() {
  const banner = useGame((s) => s.banner)
  const clear = useGame((s) => s.clearBanner)
  useEffect(() => {
    if (!banner) return
    sfx.play('blip')
    const t = setTimeout(clear, 3400)
    return () => clearTimeout(t)
  }, [banner, clear])
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          initial={{ opacity: 0, y: -30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{ position: 'absolute', top: 90, left: 0, right: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, letterSpacing: '0.35em', color: banner.accent, fontWeight: 700 }}>CHAMBER {banner.numeral}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 44, fontWeight: 700, lineHeight: 1.05, textShadow: `0 0 30px ${banner.accent}66, 0 2px 12px rgba(0,0,0,0.6)` }}>{banner.title}</div>
            <div style={{ marginTop: 8, fontSize: 15, color: 'var(--text)', opacity: 0.9, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>{banner.subtitle}</div>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: 2, width: 220, margin: '12px auto 0', background: banner.accent, transformOrigin: 'center' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ControlsHint() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 14000)
    return () => clearTimeout(t)
  }, [])
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hide-mobile" style={{ position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', alignItems: 'center' }}>
          <span><kbd className="key">W</kbd><kbd className="key">A</kbd><kbd className="key">S</kbd><kbd className="key">D</kbd> move</span>
          <span><kbd className="key">Shift</kbd> run</span>
          <span><kbd className="key">E</kbd> interact</span>
          <span>drag / <kbd className="key">←</kbd><kbd className="key">→</kbd> look</span>
          <span><kbd className="key">Esc</kbd> menu</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
