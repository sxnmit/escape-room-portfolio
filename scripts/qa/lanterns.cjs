/* eslint-disable */
/**
 * Chamber V — lamps scenario.
 *   node scripts/qa/lanterns.cjs http://127.0.0.1:5185 /path/to/shots
 * Teleports into the McMaster chamber, reads the briefing at the lectern,
 * walks to each of the four lamps (via aisle waypoints — the benches block a
 * straight line), lights them with E, asserts the flags/solve, screenshots the
 * lit hall, and reloads to confirm the lamps stay lit. Exit 1 on any failure
 * or console error.
 */
const path = require('path')
const { launch } = require('../harness.cjs')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5185'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'lanterns')

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  · ' + String(extra).slice(0, 160) : ''}`)
}

// spoke-local → world for the mcmaster chamber (layout.ts: origin at polar(150°, apothem), local −z away from the hub)
const SPOKE = { theta: 150, apothem: 12.557 }
function localToWorld(lx, lz) {
  const th = ((SPOKE.theta - 90) * Math.PI) / 180
  const ox = SPOKE.apothem * Math.cos((SPOKE.theta * Math.PI) / 180)
  const oz = -SPOKE.apothem * Math.sin((SPOKE.theta * Math.PI) / 180)
  return { x: lx * Math.cos(th) + lz * Math.sin(th) + ox, z: -lx * Math.sin(th) + lz * Math.cos(th) + oz }
}
function yawToward(a, b) {
  const wa = localToWorld(a[0], a[1])
  const wb = localToWorld(b[0], b[1])
  return Math.atan2(-(wb.x - wa.x), -(wb.z - wa.z))
}

;(async () => {
  const h = await launch({ url, out })
  const { page } = h
  const waitFor = async (fn, timeout, step = 120) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(step)
    }
    return false
  }
  const landedAt = (x, z) => waitFor(async () => { const p = await h.player(); return Math.hypot(p.x - x, p.z - z) < 2.5 }, 12000, 250)
  const teleportAndSettle = async (lx, lz, yaw) => {
    const w = localToWorld(lx, lz)
    for (let attempt = 0; attempt < 3; attempt++) {
      await h.teleport(w.x, w.z, yaw)
      if (await landedAt(w.x, w.z)) return true
    }
    return false
  }
  const walkLocal = async (lx, lz, opts) => {
    const w = localToWorld(lx, lz)
    return h.walkTo(w.x, w.z, { tolerance: 1.2, timeout: 45000, ...opts })
  }

  await h.start()
  check('teleported into chamber V', await teleportAndSettle(0, -9.5, yawToward([0, -9.5], [0, -20])))
  await h.face(...Object.values(localToWorld(0, -20)))
  await h.shot('01-hall-dim')

  // briefing at the lectern
  const items = await page.evaluate(() => window.__game.interactables())
  const lectern = items.find((i) => i.id === 'console:mcmaster')
  check('lectern registered', !!lectern)
  check('walked to the lectern', await h.walkTo(lectern.x, lectern.z, { tolerance: 1.3, timeout: 45000 }))
  await waitFor(async () => (await h.state()).nearestId === 'console:mcmaster', 8000)
  let s = await h.state()
  check('lectern prompt reads "Read the briefing"', s.nearestId === 'console:mcmaster' && /briefing/i.test(s.nearestPrompt), s.nearestPrompt)
  await h.press('KeyE')
  await waitFor(async () => { const st = await h.state(); return st.overlay && st.overlay.kind === 'briefing' }, 8000)
  s = await h.state()
  check('briefing card opened', s.overlay && s.overlay.kind === 'briefing' && s.overlay.chamber === 'mcmaster', JSON.stringify(s.overlay))
  await h.shot('02-briefing')
  await h.press('Enter')
  await waitFor(async () => !(await h.state()).overlay, 8000)
  check('briefing closed', !(await h.state()).overlay)

  // lamps: front pair reachable directly, back pair via the aisle
  const lamps = items.filter((i) => i.id.startsWith('lamp:mcmaster:'))
  check('four lamps registered', lamps.length === 4, lamps.map((l) => l.id).join(','))
  const order = ['y1', 'y2', 'y3', 'y4'].map((id) => lamps.find((l) => l.id === `lamp:mcmaster:${id}`)).filter(Boolean)
  const waypoints = { y1: [[0, -9.3]], y2: [[0, -9.3]], y3: [[0, -9.3], [0, -18.6]], y4: [[0, -18.6]] }
  let n = 0
  for (const lamp of order) {
    const id = lamp.id.split(':')[2]
    for (const [wx, wz] of waypoints[id]) await walkLocal(wx, wz, { tolerance: 1.5 })
    const ok = await h.walkTo(lamp.x, lamp.z, { tolerance: 1.5, timeout: 45000 })
    check(`walked to ${id}`, ok)
    await waitFor(async () => (await h.state()).nearestId === lamp.id, 8000)
    s = await h.state()
    check(`${id} is the nearest interactable`, s.nearestId === lamp.id, `${s.nearestId} · ${s.nearestPrompt}`)
    check(`${id} prompt says Light`, /^Light · /.test(s.nearestPrompt), s.nearestPrompt)
    if (n === 0) await h.shot('03-first-lamp-prompt')
    await h.press('KeyE')
    const lit = await waitFor(async () => !!(await h.state()).flags[lamp.id], 6000)
    check(`${id} lit (flag set)`, lit)
    n++
    if (n === 1) await h.shot('04-first-lamp-lit')
    await waitFor(async () => (await h.state()).nearestId !== lamp.id, 6000)
    check(`${id} no longer interactable`, (await h.state()).nearestId !== lamp.id)
  }
  const solved = await waitFor(async () => !!(await h.state()).solved.mcmaster, 5000)
  check('state.solved.mcmaster after the fourth lamp', solved)
  s = await h.state()
  check('success toast shown', !!s.toast && /lit/i.test(s.toast), s.toast)
  await teleportAndSettle(0, -12.5, yawToward([0, -12.5], [0, -21]))
  await h.face(...Object.values(localToWorld(0, -21)))
  await h.wait(1500)
  await h.shot('05-hall-lit')
  await teleportAndSettle(-3, -17.5, yawToward([-3, -17.5], [0, -20]))
  await h.face(...Object.values(localToWorld(0, -20)))
  await h.wait(800)
  await h.shot('06-cap-and-board')

  // lectern prompt after solve
  await h.walkTo(lectern.x, lectern.z, { tolerance: 1.3, timeout: 45000 })
  await waitFor(async () => (await h.state()).nearestId === 'console:mcmaster', 8000)
  s = await h.state()
  check('lectern prompt reads lit', /lit/i.test(s.nearestPrompt), s.nearestPrompt)

  // reload keeps everything
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__game && window.__game.interactables().length > 0, null, { timeout: 60000 })
  await page.evaluate(() => window.__game.setDpr && window.__game.setDpr(0.35))
  s = await h.state()
  check('reload: still solved', !!s.solved.mcmaster)
  check('reload: all four flags persisted', order.every((l) => !!s.flags[l.id]))
  await teleportAndSettle(0, -12.5, yawToward([0, -12.5], [0, -21]))
  await h.wait(1500)
  await h.shot('07-reloaded-lit')

  console.log('renderer:', JSON.stringify(await page.evaluate(() => window.__game.renderer())))
  console.log('CONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await h.close()
  process.exit(failed.length || h.errors.length ? 1 : 0)
})().catch((e) => {
  console.error('LANTERNS QA CRASHED', e)
  process.exit(1)
})
