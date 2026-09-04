# The Vault — a walkable 3D interactive resume

A hub-and-spoke 3D world you can walk around in the browser. Five sealed chambers circle a central hub; each chamber holds a small puzzle, each solved puzzle unseals a wall vault back in the hub, and each vault reveals one chapter of Sanmit "Sunny" Singh's resume — most recent and most impressive first, foundations last. A sixth door opens once every vault is revealed and leads to the closing "About Sunny" room.

Built with React Three Fiber, Rapier physics and Zustand. No downloaded assets: the character, the rooms, the signage and the sound effects are all generated in code.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

| Key | Action |
| --- | --- |
| `W A S D` | move (camera-relative) |
| `Shift` | run |
| `E` (or `Enter` / `Space`) | interact with the highlighted object |
| mouse drag · `← →` · wheel | orbit / tilt / zoom the camera |
| `Esc` | close an overlay, or open the pause menu |

On touch devices a virtual joystick, a run toggle and an `E` button appear. Progress is saved in `localStorage`; the pause menu can reset it or jump back to the hub.

### The route

1. **Chamber I · Scotiabank** — a locked terminal. Read the handover notes, decrypt the rotated key, `unlock` the release vault.
2. **Chamber II · Chalk** — wire the table-session pipeline together, from "table opens" to the owner dashboard.
3. **Chamber III · Tetra Tech** — push each input crate onto its matching intake pad to generate the deliverable.
4. **Chamber IV · InsightAI** — read the four retrieval monitors and enter the code on the keypad.
5. **Chamber V · McMaster** — light the four study lamps.
6. **The finale** — meet Sunny.

Each chamber's door unseals when the previous chapter's vault has been opened, so the story is always told in order.

## Editing the content

Everything a player reads lives in **`src/data/resume.ts`**: chamber names and accent colours, the resume bullets and highlight stats per vault, the terminal's files and password, the pipeline nodes and their order, the keypad code and monitor captions, the crate and lamp labels, and the closing blurb plus contact links. Edit that file; the game logic never hard-codes any of it.

## Build & deploy

```bash
npm run typecheck
npm run build      # static output in dist/
npm run preview
```

`dist/` is a static site — drop it on Vercel, Netlify, GitHub Pages or any static host. Add `?lite` to the URL to disable shadows and post-processing on low-end machines.

## Project layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full map. In short:

- `src/game/world/layout.ts` — all world geometry (hub 12-gon, spokes, wall segments) derived from a few constants.
- `src/game/world/*` — walls, doors, vaults, hub, chamber shell, about room.
- `src/game/chambers/*` — each chamber's set-piece, rendered in that spoke's local frame.
- `src/game/puzzles3d/*` — the in-world puzzles (crates & pads, lamps).
- `src/ui/puzzles/*` — the overlay puzzles (terminal, pipeline, keypad).
- `src/state/*` — the Zustand store and the "press E" interactable registry.
- `src/ui/*` — HUD, intro, menu, resume and about panels, minimap, touch controls.

## Automated playthroughs

`scripts/harness.cjs` drives the game in headless Chromium (software WebGL) through a small automation API exposed on `window.__game`. `scripts/e2e-flow.cjs` walks the whole progression loop; `scripts/qa/*.cjs` play each chamber for real (typing into the terminal, dragging pipeline nodes, pushing crates, pressing keypad keys, lighting lamps), check the panels on desktop and the joystick on a phone-sized viewport, and take screenshots:

```bash
npx vite --port 5173 &
node scripts/e2e-flow.cjs shots/e2e http://127.0.0.1:5173
node scripts/qa/terminal.cjs shots/terminal http://127.0.0.1:5173
node scripts/qa/pipeline.cjs http://127.0.0.1:5173 shots/pipeline
node scripts/qa/blocks.cjs http://127.0.0.1:5173 shots/blocks
node scripts/qa/keypad.cjs http://127.0.0.1:5173 shots/keypad
node scripts/qa/lanterns.cjs http://127.0.0.1:5173 shots/lanterns
node scripts/qa/ui.cjs http://127.0.0.1:5173 shots/ui
node scripts/qa/visuals.cjs http://127.0.0.1:5173 shots/visuals
```

Each script prints `PASS`/`FAIL` lines and exits non-zero on a failure or a console error.

Requires Playwright's Chromium to be installed (`npx playwright install chromium`).
