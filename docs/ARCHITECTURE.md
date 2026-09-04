# Architecture

A hub-and-spoke 3D world built with React Three Fiber, Rapier physics and Zustand. This document is the map for anyone (human or agent) changing the game.

## Stack

| Concern | Choice |
| --- | --- |
| Rendering | React 19 + `@react-three/fiber` 9 + `@react-three/drei` 10, three r185 |
| Physics | `@react-three/rapier` 2 (Rapier WASM) — capsule player, fixed cuboid walls, dynamic crates |
| State | `zustand` 5 with `persist` (progress lives in `localStorage`) |
| UI motion | `framer-motion` for DOM overlays, `maath` easing for 3D |
| Post-processing | `@react-three/postprocessing` bloom + vignette (disabled by `?lite`) |
| Build | Vite 8 (rolldown) with vendor chunks split into `rapier`, `three`, `react` |

No downloaded assets: character, rooms, signage (canvas-texture text) and sound (WebAudio oscillators) are generated in code.

## Content

`src/data/resume.ts` is the only place resume/puzzle copy lives: chamber names, accents, roles, bullets, highlight stats, terminal files and password, pipeline nodes and their order, crate labels, keypad code and monitor captions, lamp labels, the about blurb and contact links. Game logic only reads it.

## World geometry (`src/game/world/layout.ts`)

- Polar convention: angle θ (degrees) → world `x = r·cos θ`, `z = −r·sin θ`, so θ = 90° is north (−z), the direction the player faces at spawn.
- Hub: a 12-gon (circumradius 13). Faces sit at multiples of 30°. Doors on 90° (finale), 30° (I), 330° (II), 270° (III), 210° (IV), 150° (V) — chambers march clockwise. Resume vaults sit on the solid face clockwise of each chamber door (0°, 300°, 240°, 180°, 120°). The 60° face holds the title plaque.
- Spoke: corridor (7 long, 4 wide) then a 16×16 room. Everything inside a chamber renders in the spoke's **local frame**: origin at the hub face, `−z` away from the hub, `+x` to the right; room spans `x ∈ [−8, 8]`, `z ∈ [−7, −23]`, centre `[0, 0, −15]`, puzzle anchor `[0, 0, −20]`.
- `buildWalls()` derives every wall segment (hub faces with door openings, corridors, rooms) as world-space boxes; `Walls.tsx` renders them and their colliders under one fixed rigid body. `frameToWorld` / `worldToFrame` convert between frames; `roomAt` tells the HUD where the player is.

## Progression rules (`src/state/gameStore.ts`)

- `solved[chamber]` — the chamber's puzzle is done (opens the hub vault).
- `revealed[chamber]` — the vault's resume panel has been opened. Chamber N+1's door unlocks when chamber N is **revealed**; the finale door unlocks when all five are revealed.
- `openedDoors`, `flags` (lamp states etc.), `finished`, `muted`, `fx` are persisted; overlays, toasts, banners, `nearestId` are session-only.
- Selectors: `isChamberUnlocked`, `lockReason`, `isFinalUnlocked`, `nextChamber`, `currentObjective`, `progressCount`.

## Interaction (`src/state/interactables.ts`)

Objects register `{ id, position, radius, prompt, enabled, onInteract }` with `useInteractable(spec, ref)` (world position read once after mount, so rotated groups are fine). The player controller finds the nearest enabled one within its radius every 3 frames and writes only the id/prompt into the store; the HUD renders the prompt; `E`/`Enter`/`Space`, the prompt pill, or the touch `E` button call `interactWith(id)`. Ids in use: `door:<chamber>`, `door:about`, `vault:<chamber>`, `console:<chamber>`, `console:tetratech:reset`, `lamp:mcmaster:<id>`, `about:monolith`.

## Player & camera (`src/game/Player.tsx`)

Dynamic capsule with locked rotations; horizontal velocity set from camera-relative WASD (or the virtual joystick in `playerSnapshot.touch`), smoothed with exponential damping. Third-person camera: yaw/pitch from mouse drag or arrow keys, wheel zoom, a Rapier ray from the player pulls the camera in when a wall blocks it. `playerSnapshot` exposes position/heading/camera yaw and diagnostics to the minimap and the automation harness. Overlays pause input.

## Character (`src/game/Character.tsx`)

Procedural low-poly explorer bot. Walk/run cycle, idle breathing and look-around, blink, celebration hop and spin on `celebrate`, and a glance toward the nearest interactable. Driven entirely from a mutable `CharacterAnim` ref — no React state per frame.

## Chambers

| Chamber | Files | Puzzle |
| --- | --- | --- |
| I Scotiabank | `chambers/ScotiabankChamber.tsx`, `ui/puzzles/TerminalPuzzle.tsx` | CRT terminal: `help`, `ls`, `cat`, `decrypt`, `unlock`, `hint`, tab-completion, history |
| II Chalk | `chambers/ChalkChamber.tsx`, `ui/puzzles/PipelinePuzzle.tsx` (+ `pipeline/`) | Drag (or click-click) node cards to wire the flow in order; a data pulse runs the chain |
| III Tetra Tech | `chambers/TetraTechChamber.tsx`, `puzzles3d/BlocksPuzzle.tsx` | Push crates onto colour-matched pads (push assist + magnet), reset console, deliverable rises |
| IV InsightAI | `chambers/InsightAIChamber.tsx`, `ui/puzzles/KeypadPuzzle.tsx` (+ `keypad/`) | Read four monitors, enter the code; progressive digit reveal keeps it solvable |
| V McMaster | `chambers/McMasterChamber.tsx`, `puzzles3d/Lanterns.tsx` | Light four lamps; chalkboard reveals the class year |
| Finale | `world/AboutRoom.tsx`, `ui/AboutPanel.tsx` | Monolith opens the about panel |

Overlay puzzles receive `PuzzleProps = { chamber, onSolved, solved }` from `ui/PuzzleHost.tsx`, which marks progress, plays the success sound and closes the overlay ~2 s later. In-world puzzles call `useGame.getState().solve(id)` themselves. `BriefingCard` shows the instructions for the in-world puzzles.

## World polish

- `Door.tsx`: spring-slid panels, status strip (dim crimson sealed → accent unlocked → mint open), white flash + burst on open, shake on a sealed interaction.
- `Vault.tsx`: sealed until solved; when the player comes within range the wheel spins up, the door swings with overshoot, the artifact pops with a burst.
- `fx/Burst.tsx`: pooled instanced confetti, `spawnBurst(position, color)`.
- `utils/textures.ts`: procedural grid floor texture; `utils/TextPlane.tsx`: canvas-texture signage.

## Performance knobs

`?lite` disables shadows, MSAA and post-processing and pins DPR to 1 (the harness uses it). `window.__game.setDpr(n)` is exposed by `DebugBridge` for automation.

## Automation (`scripts/`)

`harness.cjs` launches headless Chromium with software WebGL, renders at low DPR while moving and full DPR for screenshots, and offers `start`, `goto`, `teleport`, `walkTo`, `press`, `hold`, `type`, `state`, `player`, `shot`. `window.__game` (from `utils/debug.ts`) exposes `start`, `goto`, `teleport`, `solve`, `reveal`, `solveAll`, `interact`, `interactables`, `reset`, `setDpr`, `renderer`, and per-chamber hooks such as `crates`/`blocks`.

Scenarios: `e2e-flow.cjs` (progression loop), `qa/terminal.cjs`, `qa/pipeline.cjs`, `qa/blocks.cjs`, `qa/keypad.cjs`, `qa/lanterns.cjs`, `qa/ui.cjs` (desktop panels + mobile joystick), `qa/visuals.cjs` (screenshots in normal and lite modes). Each prints PASS/FAIL lines and exits non-zero on failure or console errors. Software rendering is slow; the scripts wait on state rather than fixed timers.
