import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ABOUT, CHAMBERS, CHAMBER_ORDER, type ChamberId } from '@/data/resume'
import { useGame, progressCount } from '@/state/gameStore'
import { sfx } from '@/audio/sfx'

/**
 * The dossier: the résumé as it has been recovered so far, in a side drawer.
 *
 * Identity and contact details are always readable — someone who just wants to
 * reach Sunny should never have to finish a puzzle first. Each chapter fills in
 * as its vault is opened; the ones still sealed keep their shape (numeral,
 * employer, era) with the detail redacted, so the drawer reads as a document
 * being declassified rather than a list of locks.
 */

const REDACTION_ROWS = [
  [92, 64],
  [78, 88, 46],
  [84, 58],
]

export function DossierPanel() {
  const close = useGame((s) => s.closeOverlay)
  const revealed = useGame((s) => s.revealed)
  const solved = useGame((s) => s.solved)
  const count = useGame((s) => progressCount(s))
  const total = CHAMBER_ORDER.length
  const [copied, setCopied] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  const email = useMemo(() => ABOUT.links.find((l) => l.label === 'Email')?.value ?? '', [])
  const copyEmail = async () => {
    sfx.play('ui')
    try {
      await navigator.clipboard.writeText(email)
    } catch {
      // clipboard is unavailable (insecure context, denied): select it instead
      const sel = window.getSelection()
      const node = panelRef.current?.querySelector('[data-email]')
      if (sel && node) {
        const range = document.createRange()
        range.selectNodeContents(node)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <>
      <motion.div
        className="interactive"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(6, 8, 14, 0.45)', backdropFilter: 'blur(2px)' }}
      />
      <motion.aside
        ref={panelRef}
        className="interactive scroll dossier"
        data-testid="dossier"
        role="dialog"
        aria-modal="true"
        aria-label="Résumé"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(540px, 100vw)',
          overflowY: 'auto',
          background: 'linear-gradient(160deg, rgba(17, 21, 34, 0.97), rgba(11, 14, 23, 0.98))',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-30px 0 80px rgba(0, 0, 0, 0.55)',
        }}
      >
        <style>{css}</style>

        {/* ── identity: never gated ───────────────────────────────────────── */}
        <header className="dsr-head">
          <div className="dsr-eyebrow">RÉSUMÉ · RECOVERED {count} / {total}</div>
          <h2 className="dsr-name">{ABOUT.name}</h2>
          <div className="dsr-title">{ABOUT.title}</div>

          <div className="dsr-links">
            {ABOUT.links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="dsr-link" onClick={() => sfx.play('ui')}>
                <span className="dsr-link-label">{l.label}</span>
                <span data-email={l.label === 'Email' ? '' : undefined}>{l.value}</span>
              </a>
            ))}
          </div>
          <button className="dsr-copy" onClick={copyEmail} data-testid="dossier-copy">
            {copied ? '✓ Copied' : 'Copy email'}
          </button>

          <div className="dsr-meter" aria-label={`${count} of ${total} chapters recovered`}>
            {CHAMBER_ORDER.map((id) => (
              <span key={id} className="dsr-seg" style={{ background: revealed[id] ? CHAMBERS[id].accent : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </header>

        {/* ── the chapters ────────────────────────────────────────────────── */}
        <div className="dsr-body">
          {CHAMBER_ORDER.map((id, i) => (
            <Entry key={id} id={id} index={i} open={!!revealed[id]} solvedNotRead={!!solved[id] && !revealed[id]} />
          ))}
        </div>

        <footer className="dsr-foot">
          <span>
            {count === total
              ? 'Every chapter recovered.'
              : `${total - count} ${total - count === 1 ? 'chapter is' : 'chapters are'} still sealed — open the vaults in the hub to fill them in.`}
          </span>
          <button ref={closeRef} className="btn primary" onClick={() => { sfx.play('ui'); close() }} data-testid="dossier-close">
            Close <kbd className="key" style={{ background: 'rgba(0,0,0,0.2)', color: '#1a1400', border: 'none', boxShadow: 'none' }}>Esc</kbd>
          </button>
        </footer>
      </motion.aside>
    </>
  )
}

function Entry({ id, index, open, solvedNotRead }: { id: ChamberId; index: number; open: boolean; solvedNotRead: boolean }) {
  const c = CHAMBERS[id]
  const rows = REDACTION_ROWS[index % REDACTION_ROWS.length]
  return (
    <motion.section
      className={`dsr-entry${open ? ' open' : ''}`}
      data-testid={`dossier-entry-${id}`}
      data-open={open ? '1' : '0'}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, type: 'spring', stiffness: 240, damping: 26 }}
      style={{ '--accent': c.accent } as React.CSSProperties}
    >
      <div className="dsr-spine" aria-hidden />
      <div className="dsr-node">{open ? c.numeral : '🔒'}</div>

      <div className="dsr-entry-body">
        <div className="dsr-org">
          {c.org.split('·')[0].trim()}
          <span className="dsr-dates">{c.dates}</span>
        </div>

        {open ? (
          <>
            <h3 className="dsr-role">{c.role}</h3>
            <p className="dsr-tagline">{c.tagline}</p>
            <div className="dsr-highlight">
              <b>{c.highlight.value}</b>
              <span>{c.highlight.label}</span>
            </div>
            <ul className="dsr-bullets">
              {c.bullets.map((b, k) => (
                <li key={k}>{b}</li>
              ))}
            </ul>
            {c.extra && (
              <div className="dsr-extra">
                <div className="dsr-extra-title">{c.extra.title}</div>
                {c.extra.subtitle && <div className="dsr-extra-sub">{c.extra.subtitle}</div>}
                <ul>
                  {c.extra.bullets.map((b, k) => (
                    <li key={k}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="dsr-stack">
              {c.stack.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="dsr-redacted" aria-label="Sealed">
              <span className="dsr-bar" style={{ width: '62%', height: 15 }} />
              {rows.map((w, k) => (
                <span key={k} className="dsr-bar" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="dsr-sealed">
              {solvedNotRead ? `Solved — open the ${c.name} vault in the hub to recover this chapter.` : `Sealed — Chamber ${c.numeral} · ${c.name}`}
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}

const css = `
.dossier { font-size: 14px; }
.dsr-head { padding: 26px 28px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.dsr-eyebrow { font-size: 10px; letter-spacing: 0.24em; font-weight: 800; color: var(--gold); }
.dsr-name { font-family: var(--serif); font-size: clamp(26px, 6vw, 34px); margin: 6px 0 0; line-height: 1.1; }
.dsr-title { font-size: 13.5px; color: var(--muted); font-weight: 600; margin-top: 4px; }
.dsr-links { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.dsr-link { display: flex; gap: 10px; align-items: baseline; text-decoration: none; color: var(--text); font-size: 13px; padding: 5px 10px; border-radius: 9px; background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); transition: background 0.15s ease, border-color 0.15s ease; }
.dsr-link:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); }
.dsr-link-label { font-size: 10px; letter-spacing: 0.18em; font-weight: 800; color: var(--gold); min-width: 62px; }
.dsr-copy { margin-top: 8px; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px; background: transparent; border: 1px solid var(--panel-border); color: var(--muted); }
.dsr-copy:hover { color: var(--text); border-color: rgba(255,255,255,0.3); }
.dsr-meter { display: flex; gap: 4px; margin-top: 16px; }
.dsr-seg { flex: 1; height: 4px; border-radius: 2px; transition: background 0.5s ease; }

.dsr-body { padding: 8px 28px 0; }
.dsr-entry { position: relative; padding: 18px 0 18px 30px; }
.dsr-spine { position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.12)); }
.dsr-entry:first-child .dsr-spine { top: 26px; }
.dsr-entry:last-child .dsr-spine { bottom: calc(100% - 26px); }
.dsr-entry.open .dsr-spine { background: linear-gradient(to bottom, var(--accent), rgba(255,255,255,0.12)); opacity: 0.5; }
.dsr-node { position: absolute; left: 0; top: 18px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-family: var(--serif); font-weight: 800; font-size: 11px; background: #12151f; border: 1px solid rgba(255,255,255,0.16); color: var(--muted); }
.dsr-entry.open .dsr-node { background: var(--accent); border-color: var(--accent); color: #0b0e17; box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 55%, transparent); }

.dsr-org { font-size: 13px; font-weight: 700; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.dsr-entry.open .dsr-org { color: var(--accent); }
.dsr-dates { font-size: 11.5px; color: var(--muted); font-weight: 500; }
.dsr-role { font-size: 16.5px; margin: 4px 0 0; line-height: 1.25; }
.dsr-tagline { font-size: 13px; line-height: 1.5; color: var(--text); opacity: 0.85; font-style: italic; margin: 6px 0 0; }
.dsr-highlight { display: flex; align-items: baseline; gap: 8px; margin-top: 10px; padding: 7px 11px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent); }
.dsr-highlight b { font-family: var(--serif); font-size: 17px; color: var(--accent); }
.dsr-highlight span { font-size: 11.5px; color: var(--text); opacity: 0.8; line-height: 1.3; }
.dsr-bullets { margin: 10px 0 0; padding-left: 16px; display: grid; gap: 7px; font-size: 13px; line-height: 1.5; }
.dsr-bullets li::marker { color: var(--accent); }
.dsr-extra { margin-top: 10px; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--panel-border); }
.dsr-extra-title { font-size: 12px; font-weight: 700; }
.dsr-extra-sub { font-size: 11px; color: var(--muted); }
.dsr-extra ul { margin: 6px 0 0; padding-left: 16px; display: grid; gap: 5px; font-size: 12.5px; line-height: 1.45; }
.dsr-stack { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 11px; }
.dsr-stack span { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid var(--panel-border); }

.dsr-redacted { display: grid; gap: 7px; margin-top: 8px; }
.dsr-bar { display: block; height: 9px; border-radius: 3px; background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 26%, rgba(255,255,255,0.07)), rgba(255,255,255,0.05)); filter: blur(0.4px); }
.dsr-sealed { margin-top: 11px; font-size: 11.5px; letter-spacing: 0.02em; color: var(--muted); }

.dsr-foot { position: sticky; bottom: 0; display: flex; align-items: center; gap: 14px; padding: 16px 28px 20px; margin-top: 10px; font-size: 12px; color: var(--muted); background: linear-gradient(to top, rgba(11,14,23,0.98) 65%, transparent); backdrop-filter: blur(6px); }
.dsr-foot span { flex: 1; line-height: 1.4; }

@media (max-width: 640px) {
  .dsr-head, .dsr-body, .dsr-foot { padding-left: 18px; padding-right: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .dsr-seg { transition: none; }
}
`
