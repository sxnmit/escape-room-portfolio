# Architecture

A hub-and-spoke 3D world built with React Three Fiber. The player walks between five puzzle chambers arranged around a central hub; solving a chamber unseals a wall vault back in the hub that reveals one chapter of the resume. A sixth "finale" door opens once all five vaults are revealed.

## Stack

- **Vite + React 19 + TypeScript** (`npm run dev`, `npm run build`, `npm run typecheck`)
- **three / @react-three/fiber / @react-three/drei** — rendering, `KeyboardControls`, `Stars`
- **@react-three/rapier** — physics (walls are fixed cuboid colliders; the player is a dynamic capsule with locked rotations; crates are dynamic bodies)
- **zustand** (+ `persist`) — game state, saved to `localStorage`
- **framer-motion** — DOM overlay animation
- **@react-three/postprocessing** — bloom + vignette (toggle with ✨, off in `?lite`)
- No external assets. The character, all set dressing and in-world text are procedural (`src/utils/TextPlane.tsx` renders text onto a `CanvasTexture`). Sound is synthesised with WebAudio (`src/audio/sfx.ts`).

## Directory map

```
src/
  data/resume.ts            ← ALL content: chambers, resume text, puzzle copy, about/contact. Edit this.
  state/gameStore.ts        ← zustand store + selectors (isChamberUnlocked, currentObjective, …)
  state/interactables.ts    ← registry of "press E" targets + useInteractable() hook
  game/
    Game.tsx                ← <Canvas>, lights, <Physics>, effects
    World.tsx               ← composes Walls + Hub + 5 chambers + AboutRoom
    Player.tsx              ← WASD controller, third-person camera (orbit/zoom, wall raycast), E handling
    Character.tsx           ← procedural animated character
    DebugBridge.tsx         ← exposes renderer knobs to window.__game
    world/layout.ts         ← ALL geometry math (hub 12-gon, spokes, wall segments, frames)
    world/Walls.tsx         ← static walls + colliders
    world/Hub.tsx           ← hub floor, plaque, doors, vaults
    world/Door.tsx          ← ChamberDoor / FinalDoor (sliding panels, status strip, blocking collider)
    world/Vault.tsx         ← ResumeVault (hinged circular door, artifact, opens the resume panel)
    world/Chamber.tsx       ← ChamberShell: corridor + room floor, pillars, lights, entry-banner sensor
    world/AboutRoom.tsx     ← closing room with the "Meet Sunny" monolith
    chambers/*Chamber.tsx   ← per-chamber set-piece rendered INSIDE the spoke's local frame
    puzzles3d/              ← in-world puzzles (crates & pads, lamps)
    fx/                     ← post-processing, particles
  ui/
    UI.tsx                  ← overlay root; Escape handling; AnimatePresence switch on store.overlay
    HUD.tsx                 ← objective card, progress pips, E prompt, toast, chamber banner, controls hint
    Minimap.tsx             ← SVG map driven by layout.ts + playerSnapshot
    IntroScreen / MenuOverlay / ResumePanel / AboutPanel / BriefingCard
    PuzzleHost.tsx          ← mounts the right overlay puzzle; handles solve side-effects
    PuzzleFrame.tsx         ← shared chrome for overlay puzzles
    puzzles/                ← TerminalPuzzle, PipelinePuzzle, KeypadPuzzle (overlay puzzles)
  utils/TextPlane.tsx       ← text → CanvasTexture plane (offline signage)
  utils/perf.ts             ← `?lite` flag
  utils/debug.ts            ← window.__game automation API
scripts/
  harness.cjs               ← Playwright playthrough harness (software WebGL)
  e2e-flow.cjs              ← end-to-end progression check
  qa/                       ← per-feature scenario scripts
```

## Coordinate conventions (see `layout.ts`)

- `+y` up. Polar angle θ (degrees): `x = r·cos θ`, `z = −r·sin θ`, so **θ = 90° is north (−z)**.
- Hub: 12-gon, circumradius 13, faces centred on multiples of 30°. Final door at 90°. Chamber doors at 30, 330, 270, 210, 150 (clockwise from the finale). Each chamber's resume vault sits on the solid face 30° clockwise of its door.
- A **spoke** (`SPOKES[id]`) is a corridor (length 7, width 4) + a 16×16 room. Chamber content renders inside `<group position={frame.origin} rotation-y={frame.rotationY}>` where **local −z points away from the hub** and local +x is to the right when looking away from the hub. The room centre is `spoke.roomCenterLocal` (`[0, 0, −15]`), the far wall is at `z = −23`, and `spoke.puzzleAnchorLocal` (`[0, 0, −20]`) is a good spot for the main set-piece.
- Colliders inside rotated groups are fine — react-three-rapier uses world matrices at creation.

## Game flow / state

- `solved[id]` — puzzle done. Set via `useGame.getState().solve(id)` (also triggers the character celebration).
- `revealed[id]` — the vault panel has been opened. **Door N+1 unlocks when vault N is revealed** (`isChamberUnlocked`). Final door unlocks when all five are revealed.
- `openedDoors[doorId]`, `flags[key]` — persisted world state (`flags` is free-form for in-world puzzle pieces, e.g. `lamp:y1`).
- `overlay` — `intro | menu | puzzle | briefing | resume | about | null`. While an overlay is up the player controller ignores movement input and hides the E prompt.
- Chamber entry sensors fire the banner (`showBanner`), toasts via `showToast(text, tone)`.

## Interaction pattern

```tsx
const anchor = useRef<THREE.Group>(null)
const near = useInteractable({ id: 'thing:x', radius: 2.6, prompt: 'Do the thing', enabled: () => true, onInteract: () => {...} }, anchor)
return <group><group ref={anchor} position={[0, 0, 1]} /> …mesh… </group>
```
The Player finds the nearest enabled interactable within its radius every few frames and the HUD shows `E · prompt`. `near` is true while this object is the highlighted one (use it to pulse a glow).

## Overlay puzzles

Implement `({ chamber, onSolved, solved }: PuzzleProps)` and wrap in `<PuzzleFrame chamber title>`. Call `onSolved()` once; the host marks the chamber solved, plays the success sound, shows a toast and closes the overlay ~2 s later — use that window to show your success state.

## Automation / QA

`window.__game` (see `utils/debug.ts`): `start()`, `goto('chalk')`, `teleport(x, z, yaw)`, `solve(id)`, `interact()`, `interactables()`, `state`, `player` (live position/heading), `setDpr(n)`.

`scripts/harness.cjs` wraps Playwright: `launch({url, out})` → `start()`, `goto(id)`, `walkTo(x, z)`, `hold(code, ms)`, `press(code)`, `type(text)`, `shot(name)`, `state()`, `player()`, `errors`. Software WebGL is slow, so the harness renders at DPR 0.35 while moving and at full DPR only for `shot()`. Run against a dev server started with `npx vite --port <port> --host 127.0.0.1` and append `?lite` (the harness does this automatically).
