/* eslint-disable */
/**
 * Chamber III — crates & pads (3D) scenario.
 *   node scripts/qa/blocks.cjs http://127.0.0.1:5183 /path/to/shots
 * (either argument order works: the one starting with http is the url)
 *
 * Reads the briefing, checks the reset console works before the solve, pushes
 * each crate onto its pad by walking into it from behind (re-nudging until it
 * is within 0.7 of the pad), waits for the solve, screenshots the deliverable,
 * verifies the reset console is ignored once solved and that a reload keeps
 * the crates locked on their pads. Exit 1 on any failed check / console error.
 */
const path = require('path')
const { launch } = require('../harness.cjs')
const { crateDriver } = require('./lib/crates.cjs')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5183'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'blocks')

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + String(extra).slice(0, 200) : ''}`)
}

// spoke-local → world for the tetratech chamber (layout.ts: origin at polar(270°, apothem), local −z away from the hub)
const SPOKE = { theta: 270, apothem: 12.557 }
const TH = ((SPOKE.theta - 90) * Math.PI) / 180
const OX = SPOKE.apothem * Math.cos((SPOKE.theta * Math.PI) / 180)
const OZ = -SPOKE.apothem * Math.sin((SPOKE.theta * Math.PI) / 180)
const toWorld = (lx, lz) => ({ x: lx * Math.cos(TH) + lz * Math.sin(TH) + OX, z: -lx * Math.sin(TH) + lz * Math.cos(TH) + OZ })
const toLocal = (wx, wz) => {
  const dx = wx - OX
  const dz = wz - OZ
  return { x: dx * Math.cos(TH) - dz * Math.sin(TH), z: dx * Math.sin(TH) + dz * Math.cos(TH) }
}
const yawToward = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z))
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

;(async () => {
  const h = await launch({ url, out })
  const { page } = h

  const entry = toWorld(0, -9.5)

  /**
   * Other modules in this tree are edited live; a broken HMR update can unmount the whole
   * Canvas (taking the puzzle, its debug hooks and the player with it) and remount it later.
   * Wait for the hooks to come back and re-enter the chamber if the player got reset.
   */
  /** Raw probe used only by ensureLive: the driver's accessors call back into it. */
  const hooksLive = () => page.evaluate(() => !!(window.__game && window.__game.crates && window.__game.crates()))
  async function ensureLive() {
    const ok = await waitFor(hooksLive, 30000, 300)
    if (!ok) return false
    let s = await h.state()
    if (!s.started) await h.start()
    s = await h.state()
    if (s.currentRoom !== 'tetratech') {
      console.log('   (player is outside chamber III — re-entering after an external remount)')
      await gotoAndSettle('tetratech', entry)
    }
    return true
  }
  // crate handling (accessors, routing, pushing) is shared with the full playthrough
  const driver = crateDriver(h, { toLocal, toWorld, ensureLive: () => ensureLive(), log: (m) => console.log(m) })
  const { crates, blocks, crate, routeTo, goBehind, pushCrate } = driver
  const waitFor = async (fn, timeout, step = 120) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(step)
    }
    return false
  }
  /** Software WebGL stalls for seconds while shaders compile: wait until the render loop is actually advancing. */
  async function waitFrames(n = 4, timeout = 60000) {
    const t0 = Date.now()
    const start = await page.evaluate(() => window.__game.player.debug.frames)
    while (Date.now() - t0 < timeout) {
      await page.waitForTimeout(250)
      const f = await page.evaluate(() => window.__game.player.debug.frames)
      if (f - start >= n) return true
    }
    return false
  }
  const landedAt = (target) => waitFor(async () => dist(await h.player(), target) < 2.5, 12000, 250)
  const gotoAndSettle = async (id, target) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await h.goto(id)
      if (await landedAt(target)) return true
    }
    return false
  }
  const teleportAndSettle = async (p, yaw) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await h.teleport(p.x, p.z, yaw)
      if (await landedAt(p)) return true
    }
    return false
  }
  /** Walk in local coordinates. */
  const walkLocal = (lx, lz, opts) => {
    const w = toWorld(lx, lz)
    return h.walkTo(w.x, w.z, opts)
  }
  const playerLocal = async () => {
    const p = await h.player()
    return toLocal(p.x, p.z)
  }

  // ── into the room ──────────────────────────────────────────────────────────
  await h.start()
  // record every toast so timing-sensitive checks don't race the 3.6 s auto-clear
  await page.evaluate(() => { window.__toasts = []; window.__game.store.subscribe((st) => { if (st.toast) window.__toasts.push(st.toast.text) }) })
  check('render loop is alive', await waitFrames(4))
  check('teleported into chamber III', await gotoAndSettle('tetratech', entry))
  check('render loop alive in chamber III', await waitFrames(4))
  await h.wait(500)
  await h.shot('01-room-entry')

  let list = await crates()
  check('__game.crates() lists 3 crates', Array.isArray(list) && list.length === 3, JSON.stringify(list.map((c) => c.id)))
  check('crates sit on their spawn points', list.every((c) => dist(c, { x: c.sx, z: c.sz }) < 0.15), list.map((c) => dist(c, { x: c.sx, z: c.sz }).toFixed(2)).join(','))
  check('crates start ~5 units from their pads', list.every((c) => dist(c, { x: c.px, z: c.pz }) > 4 && dist(c, { x: c.px, z: c.pz }) < 7), list.map((c) => dist(c, { x: c.px, z: c.pz }).toFixed(2)).join(','))
  const items = await h.evaluate(() => window.__game.interactables())
  const brief = items.find((i) => i.id === 'console:tetratech')
  const reset = items.find((i) => i.id === 'console:tetratech:reset')
  check('briefing console registered', !!brief, brief && `(${brief.x.toFixed(2)}, ${brief.z.toFixed(2)})`)
  check('reset console registered', !!reset, reset && `(${reset.x.toFixed(2)}, ${reset.z.toFixed(2)})`)

  // ── briefing ───────────────────────────────────────────────────────────────
  check('walked to the briefing lectern', await h.approach('console:tetratech', brief.x, brief.z, { tolerance: 1.2 }))
  let s = await h.state()
  check('briefing prompt shows', s.nearestId === 'console:tetratech' && /briefing/i.test(s.nearestPrompt), s.nearestPrompt)
  await h.press('KeyE')
  s = await h.state()
  check('briefing card opened', s.overlay && s.overlay.kind === 'briefing' && s.overlay.chamber === 'tetratech', JSON.stringify(s.overlay))
  await h.wait(500)
  await h.shot('02-briefing', { settle: 600 })
  await h.press('Enter')
  check('briefing card closed', await waitFor(async () => !(await h.state()).overlay, 4000))

  // ── reset console works before the solve ───────────────────────────────────
  {
    const b = await crate('b')
    const d = dist(b, { x: b.px, z: b.pz })
    const dx = (b.x - b.px) / d
    const dz = (b.z - b.pz) / d
    await goBehind(b, { x: b.x + dx * 1.5, z: b.z + dz * 1.5 })
    await h.walkTo(b.x - dx * 1.6, b.z - dz * 1.6, { tolerance: 0.5, timeout: 20000 })
    await h.wait(600)
    const moved = await crate('b')
    const shoved = dist(moved, { x: moved.sx, z: moved.sz })
    check('crate can be pushed (moved > 0.6 from its start)', shoved > 0.6, shoved.toFixed(2))
    await h.shot('03-crate-pushed')
    check('walked to the reset console', await routeTo({ x: reset.x, z: reset.z }, { tolerance: 1.2, timeout: 60000 }))
    await waitFor(async () => (await h.state()).nearestId === 'console:tetratech:reset', 6000)
    s = await h.state()
    check('reset prompt shows', s.nearestId === 'console:tetratech:reset' && s.nearestPrompt === 'Reset crates', `${s.nearestId} · ${s.nearestPrompt}`)
    await h.shot('04-reset-console')
    await h.press('KeyE')
    await h.wait(600)
    const back = await crate('b')
    const dBack = dist(back, { x: back.sx, z: back.sz })
    check('reset returned the crate to its start (< 0.5)', dBack < 0.5, dBack.toFixed(2))
    s = await h.state()
    check('reset toast shown', !!s.toast && /start/i.test(s.toast), s.toast)
    check('not solved yet', !s.solved.tetratech)
  }

  // ── push the three crates ──────────────────────────────────────────────────
  for (const id of ['b', 'a', 'c']) {
    const r = await pushCrate(id)
    check(`crate ${id} pushed onto its pad`, r.ok, `d=${r.d.toFixed(2)} after ${r.attempts} attempt(s)`)
    const c = await crate(id)
    check(`pad ${id} reports filled`, c.placed, String(c.placed))
    if (id === 'b') await h.shot('05-first-pad-filled')
  }

  // ── solve ──────────────────────────────────────────────────────────────────
  await ensureLive()
  const solvedInTime = await waitFor(async () => (await h.state()).solved.tetratech, 3000, 100)
  check('state.solved.tetratech within 3 s', solvedInTime)
  s = await h.state()
  const toasts = await page.evaluate(() => window.__toasts || [])
  check('success toast shown', toasts.some((t) => /deliverable/i.test(t)) || (!!s.toast && /deliverable/i.test(s.toast)), toasts.slice(-2).join(' | '))
  // the lock / rise animation is driven by (clamped) frame time — software GL stalls on the new shaders, so wait on it
  check('lock animation completed', await waitFor(async () => (await blocks()).lockT > 2.6, 90000, 300))
  const locked = await blocks()
  check('crates locked after solve', locked.locked)
  check('crates snapped to pad centres (< 0.1)', locked.crates.every((c) => dist(c, { x: c.px, z: c.pz }) < 0.1), locked.crates.map((c) => dist(c, { x: c.px, z: c.pz }).toFixed(3)).join(','))
  await h.shot('06-solved-pads')

  // deliverable vantage: mid-room looking at the generator
  const v1 = toWorld(0, -15.6)
  await teleportAndSettle(v1, yawToward(v1, toWorld(0, -21.3)))
  await h.wait(500)
  await h.shot('07-deliverable')
  const v2 = toWorld(4.8, -16.2)
  await teleportAndSettle(v2, yawToward(v2, toWorld(-0.5, -20.5)))
  await h.wait(400)
  await h.shot('08-deliverable-angle')

  // ── reset console is ignored after the solve ───────────────────────────────
  const nearReset = toWorld(5.4, -19.4)
  await teleportAndSettle(nearReset, yawToward(nearReset, toWorld(7.6, -19.4)))
  check('walked back to the reset console', await routeTo({ x: reset.x, z: reset.z }, { tolerance: 1.2, timeout: 30000 }))
  await h.wait(600)
  s = await h.state()
  check('reset console not highlighted once solved', s.nearestId !== 'console:tetratech:reset', `${s.nearestId} · ${s.nearestPrompt}`)
  await h.press('KeyE')
  await h.wait(500)
  const after = await blocks()
  check('crates still on their pads after pressing E', after.crates.every((c) => dist(c, { x: c.px, z: c.pz }) < 0.1))
  check('still locked', after.locked)

  // ── reload keeps the solved layout ─────────────────────────────────────────
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__game && window.__game.interactables().length > 0, null, { timeout: 30000 })
  await page.evaluate(() => window.__game.setDpr && window.__game.setDpr(0.35))
  await h.start()
  check('teleported into chamber III after reload', await gotoAndSettle('tetratech', entry))
  await waitFrames(4)
  await waitFor(async () => !!(await page.evaluate(() => window.__game.crates)), 5000)
  const reloaded = await blocks()
  check('reload: still solved', reloaded.solved)
  check('reload: crates spawn on their pads as locked bodies', reloaded.locked && reloaded.crates.every((c) => dist(c, { x: c.px, z: c.pz }) < 0.1), reloaded.crates.map((c) => dist(c, { x: c.px, z: c.pz }).toFixed(3)).join(','))
  const v3 = toWorld(0.4, -13.0)
  await teleportAndSettle(v3, yawToward(v3, toWorld(0, -20)))
  await h.wait(500)
  await h.shot('09-reloaded-solved')
  const rc = await h.evaluate(() => (window.__game.renderer ? window.__game.renderer() : null))
  console.log('renderer:', JSON.stringify(rc))

  const errors = h.errors.filter((e) => !/Outdated Optimize Dep|504/.test(e))
  console.log('CONSOLE ERRORS:', errors.length, errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await h.close()
  process.exit(failed.length || errors.length ? 1 : 0)
})().catch((e) => {
  console.error('BLOCKS QA CRASHED', e)
  process.exit(1)
})
