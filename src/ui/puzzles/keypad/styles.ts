/** Scoped CSS for the keypad overlay (injected once by the puzzle). All classes are prefixed `kp-`. */
export function keypadStyles(accent: string) {
  const mint = '#7cf5c4'
  const red = '#ff3b4a'
  return `
.kp-root { padding: 16px 18px 14px; user-select: none; -webkit-user-select: none; }
.kp-cols { display: flex; gap: 16px; align-items: stretch; }
@media (max-width: 600px) {
  .kp-cols { flex-direction: column; align-items: center; }
  .kp-side { width: 100%; }
}

/* ── the physical keypad ─────────────────────────────────────────────────── */
.kp-pad {
  position: relative; flex: 0 0 236px; width: 236px; padding: 12px 14px 14px; border-radius: 20px;
  background: linear-gradient(180deg, #1d2236 0%, #12162a 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 22px 44px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -3px 0 rgba(0,0,0,0.55);
}
.kp-pad::before { content: ''; position: absolute; inset: 5px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.035); pointer-events: none; }
.kp-brand { display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; letter-spacing: 0.26em; font-weight: 800; color: rgba(255,255,255,0.38); padding: 2px 4px 9px; }
.kp-brand i { width: 6px; height: 6px; border-radius: 50%; background: ${accent}; box-shadow: 0 0 8px ${accent}; transition: background 0.4s ease, box-shadow 0.4s ease; }
.kp-pad[data-granted="1"] .kp-brand i { background: ${mint}; box-shadow: 0 0 10px ${mint}; }

.kp-display {
  position: relative; height: 76px; border-radius: 12px; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 0%, #0d1024, #05070f 70%);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 6px 18px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(0,0,0,0.6);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  transition: box-shadow 0.35s ease, border-color 0.35s ease;
}
.kp-display::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 3px); pointer-events: none; }
.kp-display[data-status="denied"] { border-color: ${red}88; box-shadow: inset 0 6px 18px rgba(0,0,0,0.9), 0 0 0 1px ${red}55, 0 0 26px ${red}55; }
.kp-display[data-status="granted"] { border-color: ${mint}88; box-shadow: inset 0 6px 18px rgba(0,0,0,0.9), 0 0 0 1px ${mint}55, 0 0 30px ${mint}55; }
.kp-flash { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
.kp-display[data-status="denied"] .kp-flash { background: ${red}; animation: kp-flash 0.55s ease-out 1; }
.kp-display[data-status="granted"] .kp-flash { background: ${mint}; animation: kp-flash 0.9s ease-out 1; }
@keyframes kp-flash { 0% { opacity: 0.55; } 100% { opacity: 0; } }

.kp-slots { display: flex; gap: 10px; position: relative; z-index: 1; }
.kp-slot { position: relative; width: 30px; height: 34px; font-family: var(--mono); font-size: 27px; font-weight: 800; line-height: 1; color: ${accent}; text-shadow: 0 0 12px ${accent}aa; transition: color 0.25s ease, text-shadow 0.25s ease; }
.kp-slot > span { position: absolute; inset: 0; display: grid; place-items: center; }
.kp-slot.empty { color: ${accent}55; text-shadow: none; font-size: 13px; }
.kp-display[data-status="denied"] .kp-slot { color: #ff5c6a; text-shadow: 0 0 12px ${red}; }
.kp-display[data-status="granted"] .kp-slot { color: ${mint}; text-shadow: 0 0 14px ${mint}; }
.kp-status { position: relative; z-index: 1; font-size: 9px; font-weight: 800; letter-spacing: 0.3em; color: rgba(255,255,255,0.42); transition: color 0.2s ease; }
.kp-display[data-status="checking"] .kp-status { color: ${accent}; animation: kp-blink 0.24s steps(2) infinite; }
.kp-display[data-status="denied"] .kp-status { color: #ff5c6a; text-shadow: 0 0 10px ${red}; }
.kp-display[data-status="granted"] .kp-status { color: ${mint}; text-shadow: 0 0 10px ${mint}; }
.kp-status.notice { color: #ffd166; text-shadow: 0 0 10px #ffd16688; }
@keyframes kp-blink { to { opacity: 0.35; } }

.kp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 14px; }
.kp-key {
  position: relative; height: 46px; border-radius: 11px; border: 1px solid rgba(255,255,255,0.12);
  background: linear-gradient(180deg, #2c3452, #1c2238);
  box-shadow: 0 4px 0 #090b14, 0 7px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14);
  font-family: var(--mono); font-size: 19px; font-weight: 700; color: #eef1ff;
  display: grid; place-items: center; cursor: pointer; padding: 0;
  transition: background 0.15s ease, box-shadow 0.08s ease, color 0.2s ease, opacity 0.3s ease;
}
.kp-key > span { display: block; transition: transform 0.08s ease; }
.kp-key:not(:disabled):hover { background: linear-gradient(180deg, #343d60, #202741); }
.kp-key:not(:disabled):active, .kp-key[data-down="1"] { box-shadow: 0 1px 0 #090b14, 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08); background: linear-gradient(180deg, #232a44, #171c2f); }
.kp-key[data-down="1"] > span { transform: translateY(2px); }
.kp-key.fn { color: ${accent}; font-size: 17px; }
.kp-key.enter { background: linear-gradient(180deg, ${accent}, ${accent}cc); color: #0b0e17; border-color: ${accent}; box-shadow: 0 4px 0 #3b2a7a, 0 7px 16px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.35); }
.kp-key.enter:not(:disabled):hover { background: linear-gradient(180deg, #c4b2ff, ${accent}); }
.kp-key.enter:not(:disabled):active, .kp-key.enter[data-down="1"] { box-shadow: 0 1px 0 #3b2a7a, 0 2px 6px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.2); background: linear-gradient(180deg, ${accent}cc, ${accent}99); }
.kp-key:disabled { cursor: default; opacity: 0.4; }
.kp-key:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ── hint side ───────────────────────────────────────────────────────────── */
.kp-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 11px; padding: 13px 14px 12px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
.kp-lockrow { display: flex; align-items: center; gap: 12px; }
.kp-lockwrap { position: relative; width: 56px; height: 68px; display: grid; place-items: center; flex: none; }
.kp-burst { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; border: 2px solid ${mint}; pointer-events: none; }
.kp-lock-title { font-size: 9.5px; letter-spacing: 0.24em; font-weight: 800; color: var(--muted); }
.kp-lock-state { margin-top: 3px; font-size: 17px; font-weight: 800; letter-spacing: 0.06em; color: ${accent}; transition: color 0.4s ease, text-shadow 0.4s ease; }
.kp-lock-state.open { color: ${mint}; text-shadow: 0 0 14px ${mint}88; }
.kp-instructions { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text); opacity: 0.9; }
.kp-success { margin: 0; font-family: var(--serif); font-size: 16px; line-height: 1.35; font-weight: 700; color: ${mint}; text-shadow: 0 0 16px ${mint}55; }
.kp-cards { display: flex; flex-direction: column; gap: 6px; }
.kp-card { display: flex; align-items: center; gap: 10px; padding: 5px 9px 5px 6px; border-radius: 11px; background: linear-gradient(180deg, #131a2c, #0e1424); border: 1px solid rgba(255,255,255,0.09); min-width: 0; transition: border-color 0.35s ease, box-shadow 0.35s ease; }
.kp-card.known { border-color: ${accent}66; box-shadow: 0 0 0 1px ${accent}22, 0 0 16px ${accent}22; }
.kp-card.open { border-color: ${mint}88; box-shadow: 0 0 0 1px ${mint}33, 0 0 18px ${mint}33; }
.kp-digit { position: relative; width: 28px; height: 30px; font-family: var(--mono); font-size: 19px; font-weight: 800; color: #eef1ff; text-shadow: 0 0 12px ${accent}88; flex: none; border-radius: 7px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
.kp-digit > span { position: absolute; inset: 0; display: grid; place-items: center; }
.kp-digit.unknown { color: rgba(255,255,255,0.28); text-shadow: none; }
.kp-card.open .kp-digit { color: ${mint}; text-shadow: 0 0 12px ${mint}aa; }
.kp-pos { flex: none; width: 74px; font-size: 8.5px; letter-spacing: 0.2em; font-weight: 800; color: ${accent}; transition: color 0.35s ease; }
.kp-card.open .kp-pos { color: ${mint}; }
.kp-cap { flex: 1; min-width: 0; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kp-revealrow { display: flex; align-items: center; gap: 10px; margin-top: auto; }
.kp-revealbtn { padding: 0.5em 0.95em; font-size: 12.5px; border-color: ${accent}66; white-space: nowrap; }
.kp-revealbtn:not(:disabled):hover { border-color: ${accent}; box-shadow: 0 0 16px ${accent}33; }
.kp-revealbtn:disabled { opacity: 0.4; cursor: default; transform: none; }
.kp-revealcount { font-size: 11px; color: var(--muted); letter-spacing: 0.08em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.kp-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 11.5px; color: var(--muted); }
.kp-footer .key { font-size: 0.8em; }
.kp-badge {
  font-size: 11px; font-weight: 800; letter-spacing: 0.14em; white-space: nowrap;
  padding: 6px 11px; border-radius: 999px; color: #0b0e17; background: ${mint};
  box-shadow: 0 0 18px ${mint}77;
}
`
}
