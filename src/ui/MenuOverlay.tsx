import { useState } from 'react'
import { motion } from 'framer-motion'
import { CHAMBERS, CHAMBER_ORDER } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'

export function MenuOverlay() {
  const close = useGame((s) => s.closeOverlay)
  const muted = useGame((s) => s.muted)
  const fx = useGame((s) => s.fx)
  const toggleMute = useGame((s) => s.toggleMute)
  const toggleFx = useGame((s) => s.toggleFx)
  const reset = useGame((s) => s.resetProgress)
  const requestTeleport = useGame((s) => s.requestTeleport)
  const solved = useGame((s) => s.solved)
  const revealed = useGame((s) => s.revealed)
  const openOverlay = useGame((s) => s.openOverlay)
  const [confirm, setConfirm] = useState(false)

  return (
    <motion.div className="overlay-backdrop interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="panel" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} style={{ width: '100%', maxWidth: 560, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--serif)', margin: 0, fontSize: 30 }}>Paused</h2>
          <button className="btn ghost" onClick={close}>Resume <kbd className="key">Esc</kbd></button>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
          {CHAMBER_ORDER.map((id) => {
            const c = CHAMBERS[id]
            const state = revealed[id] ? 'Revealed' : solved[id] ? 'Solved — vault waiting in the hub' : 'Not yet'
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: revealed[id] ? c.accent : 'rgba(255,255,255,0.08)', color: revealed[id] ? '#0b0e17' : 'var(--muted)', fontFamily: 'var(--serif)', fontWeight: 800 }}>{c.numeral}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{state}</div>
                </div>
                {revealed[id] && (
                  <button className="btn ghost" style={{ padding: '0.35em 0.7em', fontSize: 12 }} onClick={() => openOverlay({ kind: 'resume', chamber: id })}>
                    Re-read
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => { toggleMute(); sfx.play('ui') }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
          <button className="btn" onClick={() => { toggleFx(); sfx.play('ui') }}>{fx ? '✨ Glow on' : '✨ Glow off'}</button>
          <button className="btn" onClick={() => { requestTeleport(0, 2.5, 0); close(); sfx.play('ui') }}>↩ Return to hub</button>
          {!confirm ? (
            <button className="btn ghost" style={{ marginLeft: 'auto', color: 'var(--red)' }} onClick={() => setConfirm(true)}>Reset progress</button>
          ) : (
            <button className="btn" style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', borderColor: 'transparent' }} onClick={() => { reset(); requestTeleport(0, 2.5, 0); sfx.play('error') }}>Confirm reset</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
