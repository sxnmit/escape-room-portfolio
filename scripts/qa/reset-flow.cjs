/* eslint-disable */
/**
 * "Start over" / "Play again" / "Reset progress" must return the *world* to its
 * opening state, not just the store — the World stays mounted across a reset, so
 * every component that latches on `solved` has to unlatch.
 *
 *   node scripts/qa/reset-flow.cjs http://127.0.0.1:5173 /path/to/shots
 *
 * Exits non-zero on any failed check or console error.
 */
const path = require('path')
const { launch } = require('../harness.cjs')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5173'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'reset')

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
  const waitFor = async (fn, timeout, gap = 150) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(gap)
    }
    return false
  }
  const blocks = () => page.evaluate(() => window.__game.blocks())
  const atStart = (c) => dist(c, { x: c.sx, z: c.sz }) < 0.4
  const onPad = (c) => dist(c, { x: c.px, z: c.pz }) < 0.4

  await h.start()

  step('Finish the game, then reset it')
  await h.goto('tetratech')
  await waitFor(async () => (await blocks()).crates.length === 3, 20000)
  check('crates start on their spawn points', (await blocks()).crates.every(atStart))
  check('the room starts unlocked', !(await blocks()).locked)

  await page.evaluate(() => window.__game.solveAll())
  check('chamber III locks once solved', await waitFor(async () => (await blocks()).locked, 8000))
  check('crates snap onto their pads', await waitFor(async () => (await blocks()).crates.every(onPad), 12000))
  await h.shot('01-solved')

  await page.evaluate(() => window.__game.reset())
  await page.waitForTimeout(1500)
  const s = await h.state()
  check('the store forgot every chamber', Object.keys(s.solved).length === 0 && Object.keys(s.revealed).length === 0)

  step('The world must reopen too')
  const b = await blocks()
  check('chamber III unlocked again', !b.locked, `locked=${b.locked}`)
  check('crates returned to their spawn points', b.crates.every(atStart), b.crates.map((c) => dist(c, { x: c.sx, z: c.sz }).toFixed(2)).join(','))
  await h.shot('02-after-reset')

  // the reset console must be usable again
  const reset = (await page.evaluate(() => window.__game.interactables())).find((i) => i.id === 'console:tetratech:reset')
  check('reset console is registered', !!reset)
  check('walked to the reset console', await h.walkTo(reset.x, reset.z, { tolerance: 1.3, timeout: 45000 }))
  check('reset console offers its prompt again', await waitFor(async () => (await h.state()).nearestId === 'console:tetratech:reset', 8000), (await h.state()).nearestPrompt)

  // and the crates must be pushable again (i.e. dynamic, not fixed)
  step('The puzzle is playable a second time')
  const c0 = (await blocks()).crates[0]
  const pad = { x: c0.px, z: c0.pz }
  const d = dist(c0, pad)
  const ux = (c0.x - pad.x) / d
  const uz = (c0.z - pad.z) / d
  await h.walkTo(c0.x + ux * 1.9, c0.z + uz * 1.9, { tolerance: 0.5, timeout: 30000 })
  await h.walkTo(pad.x + ux * 0.95, pad.z + uz * 0.95, { tolerance: 0.45, timeout: 30000 })
  await h.wait(900)
  const moved = (await blocks()).crates.find((c) => c.id === c0.id)
  check('a crate can be pushed after the reset', dist(moved, { x: c0.x, z: c0.z }) > 0.8, `moved ${dist(moved, { x: c0.x, z: c0.z }).toFixed(2)}`)
  check('pad detection runs again', (await blocks()).fill.some((f) => f > 0) || onPad(moved), JSON.stringify((await blocks()).fill))
  await h.shot('03-pushable-again')

  step('The hub reopened as well')
  await h.goto('hub')
  await waitFor(async () => dist(await h.player(), { x: 0, z: 2.5 }) < 3, 12000, 250)
  const v = polar(0, APOTHEM - 3.2)
  await h.walkTo(v.x, v.z, { tolerance: 1.1, timeout: 45000 })
  await waitFor(async () => (await h.state()).nearestId === 'vault:scotiabank', 8000)
  const st = await h.state()
  check('vault I is sealed again', st.nearestPrompt === 'Sealed', st.nearestPrompt)
  await h.shot('04-vault-resealed')
  const d2 = polar(330, APOTHEM - 2.2)
  await h.walkTo(d2.x, d2.z, { tolerance: 1.2, timeout: 45000 })
  await waitFor(async () => (await h.state()).nearestId === 'door:chalk', 8000)
  check('door II is sealed again', (await h.state()).nearestPrompt === 'Sealed', (await h.state()).nearestPrompt)

  console.log('\nCONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 6))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) console.log('failed:', failed.map((r) => r[0]).join(' | '))
  await h.close()
  process.exit(failed.length || h.errors.length ? 1 : 0)
})().catch((e) => {
  console.error('RESET FLOW CRASHED', e)
  process.exit(1)
})
