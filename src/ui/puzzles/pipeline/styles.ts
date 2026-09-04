/** Scoped CSS for the pipeline board (injected once by the puzzle). All classes are prefixed `pp-`. */
export function pipelineStyles(accent: string) {
  return `
.pp-root { padding: 16px 22px 18px; user-select: none; -webkit-user-select: none; }
.pp-instructions { font-size: 13.5px; line-height: 1.5; color: var(--text); margin: 0 0 12px; opacity: 0.92; }
.pp-instructions b { color: ${accent}; font-weight: 700; }
.pp-board-wrap {
  position: relative;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.4), 0 18px 50px rgba(0,0,0,0.45);
  overflow: hidden;
}
.pp-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, auto);
  column-gap: 60px;
  row-gap: 62px;
  padding: 34px 40px;
  background-color: #0a1220;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(120,170,255,0.16) 1px, transparent 1.4px),
    linear-gradient(180deg, rgba(46,229,157,0.05), transparent 45%, rgba(20,60,120,0.12));
  background-size: 22px 22px, 100% 100%;
  touch-action: none;
}
.pp-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
/* the overlay root forces pointer-events:auto on every descendant — the SVG layers must stay transparent to the pointer */
.pp-layer, .pp-layer *, .pp-ribbon { pointer-events: none !important; }
.pp-layer.under { z-index: 0; }
.pp-layer.over { z-index: 3; }
.pp-card {
  position: relative;
  z-index: 1;
  min-height: 92px;
  padding: 13px 20px 13px 22px;
  border-radius: 12px;
  background: linear-gradient(180deg, #131c2e, #0e1524);
  border: 1px solid rgba(255,255,255,0.11);
  box-shadow: 0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05);
  transition: border-color 0.35s ease, box-shadow 0.35s ease, background 0.35s ease;
}
.pp-card.linked { border-color: ${accent}; box-shadow: 0 8px 22px rgba(0,0,0,0.35), 0 0 0 1px ${accent}33, 0 0 22px ${accent}2a; }
.pp-card.target { border-color: ${accent}; box-shadow: 0 0 0 2px ${accent}88, 0 0 30px ${accent}55; background: linear-gradient(180deg, #14233a, #0f1a2c); }
.pp-card[data-flash="1"] { border-color: #ff3b4a; box-shadow: 0 0 0 2px #ff3b4a99, 0 0 28px #ff3b4a66; background: linear-gradient(180deg, #2a141c, #1a0f16); transition: none; }
.pp-card[data-lit="1"] { border-color: ${accent}; box-shadow: 0 0 0 2px ${accent}cc, 0 0 40px ${accent}88; background: linear-gradient(180deg, #16332a, #0f2420); transition: none; }
.pp-card.hinting { animation: pp-hint 0.66s ease-in-out 3; }
@keyframes pp-hint { 0%,100% { box-shadow: 0 0 0 1px ${accent}55, 0 0 0 rgba(0,0,0,0); border-color: ${accent}; } 50% { box-shadow: 0 0 0 4px ${accent}, 0 0 34px ${accent}aa; border-color: #ffffff; } }
.pp-card { cursor: grab; }
.pp-card:active { cursor: grabbing; }
.pp-card.done { cursor: default; }
.pp-label { font-size: 14.5px; font-weight: 700; letter-spacing: 0.01em; color: #eef1ff; }
.pp-hint { margin-top: 4px; font-size: 11.5px; line-height: 1.35; color: var(--muted); }
.pp-chip {
  position: absolute; top: -9px; right: 12px;
  font-size: 9px; font-weight: 800; letter-spacing: 0.2em;
  padding: 3px 7px; border-radius: 999px;
  background: #0a1220; border: 1px solid rgba(255,255,255,0.14); color: var(--muted);
}
.pp-chip.accent { color: #0b0e17; background: ${accent}; border-color: ${accent}; box-shadow: 0 0 14px ${accent}66; }
.pp-port {
  position: absolute; top: 50%; width: 20px; height: 20px; margin-top: -10px;
  border-radius: 50%; display: grid; place-items: center;
  cursor: pointer; touch-action: none; z-index: 2;
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, background 0.25s ease, border-color 0.25s ease;
}
.pp-port::after { content: ''; position: absolute; inset: -14px; border-radius: 50%; }
.pp-port.in { left: -11px; background: #0a1220; border: 2.5px solid #a7b1d6; }
.pp-port.out { right: -11px; background: #e8ecff; border: 2.5px solid #e8ecff; box-shadow: 0 0 0 3px rgba(232,236,255,0.12); }
.pp-port.out:hover, .pp-port.out.armed { transform: scale(1.25); box-shadow: 0 0 0 4px ${accent}55, 0 0 18px ${accent}aa; background: ${accent}; border-color: ${accent}; }
.pp-port.out.armed { animation: pp-armed 1.1s ease-in-out infinite; }
.pp-port.in:hover, .pp-port.in.hot { transform: scale(1.25); border-color: ${accent}; box-shadow: 0 0 0 4px ${accent}44, 0 0 18px ${accent}aa; }
.pp-port.linked { background: ${accent}; border-color: ${accent}; box-shadow: 0 0 12px ${accent}99; }
.pp-port.done { cursor: default; }
.pp-port.hidden { display: none; }
@keyframes pp-armed { 0%,100% { box-shadow: 0 0 0 4px ${accent}55, 0 0 18px ${accent}aa; } 50% { box-shadow: 0 0 0 9px ${accent}22, 0 0 26px ${accent}cc; } }
.pp-link { fill: none; stroke: ${accent}; stroke-width: 3; stroke-linecap: round; }
.pp-link-glow { fill: none; stroke: ${accent}; stroke-width: 10; stroke-linecap: round; opacity: 0.22; }
.pp-flow { fill: none; stroke: #ffffff; stroke-width: 2; stroke-linecap: round; stroke-dasharray: 3 16; opacity: 0.55; animation: pp-dash 1.1s linear infinite; }
@keyframes pp-dash { to { stroke-dashoffset: -19; } }
.pp-live { fill: none; stroke: ${accent}; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 8 7; opacity: 0.95; filter: drop-shadow(0 0 6px ${accent}); }
.pp-footer { display: flex; align-items: center; gap: 16px; margin-top: 14px; min-height: 40px; }
.pp-rail { display: flex; align-items: center; gap: 10px; }
.pp-segs { display: flex; gap: 5px; }
.pp-seg { width: 26px; height: 7px; border-radius: 4px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.08); transition: background 0.4s ease, box-shadow 0.4s ease; }
.pp-seg.on { background: ${accent}; border-color: ${accent}; box-shadow: 0 0 12px ${accent}aa; }
.pp-wired { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: var(--muted); font-variant-numeric: tabular-nums; }
.pp-wired b { color: #eef1ff; }
.pp-msg { flex: 1; min-width: 0; font-size: 13px; line-height: 1.35; }
.pp-msg.err { color: #ff8a93; }
.pp-msg.ok { color: ${accent}; }
.pp-msg.info { color: var(--muted); }
.pp-msg em { font-style: normal; color: #eef1ff; font-weight: 600; }
.pp-hintbtn { padding: 0.5em 1em; font-size: 13px; }
.pp-badge {
  font-size: 11px; font-weight: 800; letter-spacing: 0.14em; white-space: nowrap;
  padding: 6px 11px; border-radius: 999px; color: #0b0e17; background: ${accent};
  box-shadow: 0 0 18px ${accent}77;
}
.pp-ribbon {
  position: absolute; left: 0; right: 0; top: 50%; z-index: 4; margin-top: -46px; height: 92px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  background: linear-gradient(90deg, rgba(8,12,20,0) 0%, rgba(8,12,20,0.94) 12%, rgba(8,12,20,0.94) 88%, rgba(8,12,20,0) 100%);
  border-top: 1px solid ${accent}55; border-bottom: 1px solid ${accent}55;
  pointer-events: none; overflow: hidden;
}
.pp-ribbon::before {
  content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: -40%;
  background: linear-gradient(90deg, transparent, ${accent}22, transparent);
  animation: pp-sweep 1.8s ease-in-out 0.2s 1 forwards;
}
@keyframes pp-sweep { to { left: 110%; } }
.pp-ribbon-title { font-size: 12px; font-weight: 800; letter-spacing: 0.34em; color: ${accent}; text-shadow: 0 0 16px ${accent}aa; }
.pp-ribbon-text { font-family: var(--serif); font-size: 21px; font-weight: 700; color: #f4f6ff; }
`
}
