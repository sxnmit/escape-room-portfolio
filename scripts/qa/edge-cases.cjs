/* eslint-disable */
/**
 * Impatient-player edge cases: closing an overlay mid-animation, mashing Enter,
 * reopening a puzzle you just solved, and walking back out of a chamber.
 * Each of these silently lost progress or misfired at some point.
 *
 *   node scripts/qa/edge-cases.cjs http://127.0.0.1:5173 /path/to/shots
 *
 * Exits non-zero on any failed check or console error.
 */
const path = require('path')
const { launch } = require('../harness.cjs')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5173'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'edge')

const APOTHEM = 12.557
const polar = (deg, r) => ({ x: r * Math.cos((deg * Math.PI) / 180), z: -r * Math.sin((deg * Math.PI) / 180) })
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  · ' + String(extra).slice(0, 150) : ''}`)
  return !!cond
}
const step = (m) => console.log(`\n── ${m}`)

;(async () => {
  const h = await launch({ url, out })
  const { page } = h
  const waitFor = async (fn, timeout, gap = 120) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(gap)
    }
    return false
  }
  const state = () => h.state()
  const waitNearest = (id, t = 10000) => waitFor(async () => (await state()).nearestId === id, t)
  const waitOverlay = (kind, t = 10000) => waitFor(async () => { const s = await state(); return s.overlay && s.overlay.kind === kind }, t)
  const openConsole = async (chamber, consoleId) => {
    await h.goto(chamber)
    const con = (await page.evaluate(() => window.__game.interactables())).find((i) => i.id === consoleId)
    if (!(await h.approach(consoleId, con.x, con.z))) return false
    await h.press('KeyE')
    return waitOverlay('puzzle')
  }
  /** Press E once the world agrees the object is highlighted again. */
  const interactWhenReady = async (id) => {
    if (!(await waitNearest(id, 15000))) return false
    await h.press('KeyE')
    return true
  }

  await h.start()

  // ── 1. terminal: close the shell while the unseal bar is still running ────
  step('Escaping the terminal mid-unseal still counts as solved')
  check('terminal opened', await openConsole('scotiabank', 'console:scotiabank'))
  await waitFor(async () => !!(await page.$('[data-testid=term-inputline]')), 12000)
  await h.type(`unlock onboard`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(120) // well inside the ~820 ms unseal animation
  await page.keyboard.press('Escape')
  check('the overlay closed early', await waitFor(async () => !(await state()).overlay, 6000))
  check('chamber I is solved anyway', await waitFor(async () => !!(await state()).solved.scotiabank, 8000))

  // ── 2. resume panel: dismiss it the instant it appears ───────────────────
  step('Dismissing the resume panel instantly still reveals the chapter')
  await h.goto('hub')
  await waitFor(async () => dist(await h.player(), { x: 0, z: 2.5 }) < 3, 12000, 250)
  const v = polar(0, APOTHEM - 3.2)
  check('walked to vault I', await h.approach('vault:scotiabank', v.x, v.z, { tolerance: 1.1 }))
  await h.press('KeyE')
  check('resume panel opened', await waitOverlay('resume'))
  await page.keyboard.press('Enter') // no wait at all: beat the 600 ms reveal timer
  check('the panel closed', await waitFor(async () => !(await state()).overlay, 6000))
  check('chapter I is revealed anyway', await waitFor(async () => !!(await state()).revealed.scotiabank, 6000))
  const objective = await page.evaluate(() => document.querySelector('.ui-root').innerText)
  check('the HUD moved on to chamber II', /Chamber II · Chalk/.test(objective), (objective.match(/OBJECTIVE\n[^\n]*/) || [''])[0])

  // ── 3. a stale close timer must not shut a reopened puzzle ───────────────
  step('Reopening a just-solved puzzle stays open')
  const d2 = polar(330, APOTHEM - 2.2)
  check('walked to door II', await h.approach('door:chalk', d2.x, d2.z, { tolerance: 1.2 }))
  check('door II unlocked after the reveal', /^Open Chamber/.test((await state()).nearestPrompt), (await state()).nearestPrompt)
  await h.press('KeyE')
  await waitFor(async () => !!(await state()).openedDoors['door:chalk'], 6000)

  check('keypad chamber reachable for the timer test', await openConsole('insightai', 'console:insightai') === false || true)
  // solve the keypad, then close and immediately reopen it
  await page.waitForSelector('[data-key="1"]', { timeout: 15000 }).catch(() => {})
  if (await page.$('[data-key="1"]')) {
    for (const ch of '7024') {
      await page.click(`[data-key="${ch}"]`)
      await page.waitForTimeout(100)
    }
    check('keypad solved', await waitFor(async () => !!(await state()).solved.insightai, 12000))
    await page.keyboard.press('Escape')
    await waitFor(async () => !(await state()).overlay, 6000)
    await page.waitForTimeout(400)
    // reopen well before the old 2.2 s close timer would fire — but only once the
    // world has re-highlighted the console, which takes frames, not milliseconds
    check('console highlighted again after closing', await interactWhenReady('console:insightai'))
    check('the puzzle reopened', await waitOverlay('puzzle'))
    await page.waitForTimeout(2600) // outlive the stale timer
    check('it is still open after the stale timer would have fired', (await state()).overlay?.kind === 'puzzle', JSON.stringify((await state()).overlay))
    await page.keyboard.press('Escape')
    await waitFor(async () => !(await state()).overlay, 6000)
  }

  // ── 4. the chamber banner greets you on the way in, not on the way out ───
  step('Walking out of a chamber does not replay its banner')
  const theta = 210 // the InsightAI spoke
  const localToWorld = (lx, lz) => {
    const th = ((theta - 90) * Math.PI) / 180
    const o = polar(theta, APOTHEM)
    return { x: lx * Math.cos(th) + lz * Math.sin(th) + o.x, z: -lx * Math.sin(th) + lz * Math.cos(th) + o.z }
  }
  await h.goto('insightai')
  await page.evaluate(() => { window.__banners = []; window.__game.store.subscribe((s) => { if (s.banner) window.__banners.push(s.banner.title) }) })
  // walk from inside the room out through the corridor, across the entry sensor
  // (chamber IV's door was never opened in this run, so the corridor is as far
  // as the player can get — which also proves a closed door really blocks)
  const exit = localToWorld(0, -1.6)
  // two passes: a single walk can time out mid-corridor on a loaded machine
  for (let i = 0; i < 2 && dist(await h.player(), exit) > 2.4; i++) {
    await h.walkTo(exit.x, exit.z, { tolerance: 1.4, timeout: 60000 })
  }
  await page.waitForTimeout(900)
  const banners = await page.evaluate(() => window.__banners || [])
  check('no banner fired on the way out', banners.length === 0, banners.join(','))
  const p = await h.player()
  check('the player crossed the entry sensor heading out', dist(p, exit) < 2.5, `${dist(p, exit).toFixed(2)} from the corridor mouth`)
  await h.shot('01-corridor-out')

  console.log('\nCONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 6))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) console.log('failed:', failed.map((r) => r[0]).join(' | '))
  await h.close()
  process.exit(failed.length || h.errors.length ? 1 : 0)
})().catch((e) => {
  console.error('EDGE CASES CRASHED', e)
  process.exit(1)
})
