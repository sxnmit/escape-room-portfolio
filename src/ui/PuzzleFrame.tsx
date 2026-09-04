import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CHAMBERS, type ChamberId } from '@/data/resume'
import { useGame } from '@/state/gameStore'

/**
 * Shared chrome for puzzle overlays: backdrop, header with chamber identity,
 * close button. Puzzle internals render as children.
 */
export function PuzzleFrame({ chamber, title, children, width = 760, hint }: { chamber: ChamberId; title: string; children: ReactNode; width?: number; hint?: ReactNode }) {
  const c = CHAMBERS[chamber]
  const close = useGame((s) => s.closeOverlay)
  return (
    <motion.div className="overlay-backdrop interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div
        className="panel"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ width: '100%', maxWidth: width, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: `3px solid ${c.accent}` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--panel-border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: c.accent, color: '#0b0e17', fontFamily: 'var(--serif)', fontWeight: 800, fontSize: 16 }}>{c.numeral}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>{c.name.toUpperCase()} · {c.theme.toUpperCase()}</div>
            <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          </div>
          {hint}
          <button className="btn ghost" onClick={close} title="Close (Esc)" style={{ padding: '0.45em 0.8em' }}>
            Esc ✕
          </button>
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </motion.div>
    </motion.div>
  )
}
