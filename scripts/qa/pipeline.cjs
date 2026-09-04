/* eslint-disable */
/**
 * Chamber II — pipeline puzzle scenario.
 *   node scripts/qa/pipeline.cjs http://127.0.0.1:5182 /path/to/shots
 * Walks to the pipeline board, opens it, makes one wrong drag (must be rejected),
 * wires the five links in order with real pointer drags, waits for the solve,
 * and screenshots the deployed board + the room afterwards. Exit 1 on failure.
 */
const path = require('path')
const { launch } = require('../harness.cjs')

const url = process.argv[2] || 'http://127.0.0.1:5182'
const out = process.argv[3] || path.join(__dirname, '..', '..', 'shots', 'pipeline')
const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`)
}

async function portBox(page, node, port) {
  const el = await page.$(`[data-node="${node}"] [data-port="${port}"]`)
  if (!el) throw new Error(`port not found: ${node}/${port}`)
  const b = await el.boundingBox()
  if (!b) throw new Error(`port has no box: ${node}/${port}`)
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function drag(page, from, to) {
  const a = await portBox(page, from, 'out')
  const b = await portBox(page, to, 'in')
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(a.x + 12, a.y + 4, { steps: 3 })
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.waitForTimeout(80)
  await page.mouse.up()
  await page.waitForTimeout(350)
}

const wired = (page) => page.$eval('.pp-rail', (el) => Number(el.dataset.wired))

/** Software WebGL stalls for seconds while shaders compile: wait until the render loop is actually advancing. */
async function waitFrames(page, n = 4, timeout = 60000) {
  const t0 = Date.now()
  const start = await page.evaluate(() => window.__game.player.debug.frames)
  while (Date.now() - t0 < timeout) {
    await page.waitForTimeout(250)
    const f = await page.evaluate(() => window.__game.player.debug.frames)
    if (f - start >= n) return true
  }
  return false
}
const msgTone = (page) => page.$eval('.pp-msg', (el) => el.dataset.tone).catch(() => null)
/** Wait for a selector to appear (framer-motion exit/enter animations run on the starved rAF in software GL). */
const appears = (page, sel, timeout = 4000) => page.waitForSelector(sel, { timeout, state: 'attached' }).then(() => true).catch(() => false)

// spoke-local → world for the chalk chamber (layout.ts: origin at polar(330°, apothem), local −z away from the hub)
const CHALK = { theta: 330, apothem: 12.557 }
function localToWorld(lx, lz) {
  const th = ((CHALK.theta - 90) * Math.PI) / 180
  const ox = CHALK.apothem * Math.cos((CHALK.theta * Math.PI) / 180)
  const oz = -CHALK.apothem * Math.sin((CHALK.theta * Math.PI) / 180)
  return { x: lx * Math.cos(th) + lz * Math.sin(th) + ox, z: -lx * Math.sin(th) + lz * Math.cos(th) + oz }
}
/** Camera yaw so the player looks from local point a toward local point b. */
function yawToward(a, b) {
  const wa = localToWorld(a[0], a[1])
  const wb = localToWorld(b[0], b[1])
  return Math.atan2(-(wb.x - wa.x), -(wb.z - wa.z))
}
async function vantage(h, from, toward, name) {
  const p = localToWorld(from[0], from[1])
  await h.teleport(p.x, p.z, yawToward(from, toward))
  await h.wait(600)
  await h.shot(name)
}

;(async () => {
  const h = await launch({ url, out })
  const { page } = h
  await h.start()
  check('render loop is alive', await waitFrames(page, 4))
  await h.goto('chalk')
  check('render loop alive in chalk', await waitFrames(page, 4))
  await h.shot('00-room-entry')

  const items = await h.evaluate(() => window.__game.interactables())
  const con = items.find((i) => i.id === 'console:chalk')
  check('console:chalk registered', !!con, JSON.stringify(con))
  check('walked to the pipeline board', await h.walkTo(con.x, con.z, { tolerance: 1.1, timeout: 45000 }))
  // the nearest-interactable scan runs every 3 frames — give the starved renderer a moment
  await page.waitForFunction(() => window.__game.state.nearestId === 'console:chalk', null, { timeout: 8000 }).catch(() => {})
  let s = await h.state()
  check('board prompt shows', s.nearestId === 'console:chalk' && /pipeline board/i.test(s.nearestPrompt), s.nearestPrompt)
  await h.shot('01-board-prompt')

  await h.press('KeyE')
  s = await h.state()
  check('puzzle overlay open', s.overlay && s.overlay.kind === 'puzzle' && s.overlay.chamber === 'chalk', JSON.stringify(s.overlay))
  await page.waitForSelector('[data-node="open"] [data-port="out"]', { timeout: 5000 })
  await page.waitForTimeout(900) // let the cards settle in
  const nodeCount = await page.$$eval('[data-node]', (els) => els.length)
  check('six node cards rendered', nodeCount === 6, String(nodeCount))
  check('start node has no input port', (await page.$('[data-node="open"] [data-port="in"]')) === null)
  check('end node has no output port', (await page.$('[data-node="dashboard"] [data-port="out"]')) === null)
  await h.shot('02-overlay-open')

  // one wrong drag: rate → revenue is a real pipeline edge but not the *next* step
  await page.evaluate(() => {
    window.__flashed = []
    const mo = new MutationObserver((ms) => ms.forEach((m) => m.target.dataset.flash === '1' && window.__flashed.push(m.target.dataset.node)))
    document.querySelectorAll('.pp-card').forEach((c) => mo.observe(c, { attributes: true, attributeFilter: ['data-flash'] }))
  })
  await drag(page, 'rate', 'revenue')
  check('wrong drag rejected (still 0 wired)', (await wired(page)) === 0)
  check('rejection message shown', await appears(page, '.pp-msg[data-tone="err"]'), await page.$eval('.pp-msg', (el) => el.textContent).catch(() => ''))
  const flashed = await page.evaluate(() => window.__flashed)
  check('target card flashed red', flashed.includes('revenue'), JSON.stringify(flashed))
  await h.shot('03-rejected')

  // hint pulses the next target
  await page.click('.pp-hintbtn')
  await page.waitForTimeout(300)
  check('hint pulses the next node', (await page.$('[data-node="timer"].hinting')) !== null)

  // the five correct links, in order
  const chain = ['open', 'timer', 'rate', 'revenue', 'checkout', 'dashboard']
  for (let k = 0; k < chain.length - 1; k++) {
    await drag(page, chain[k], chain[k + 1])
    const w = await wired(page)
    check(`link ${k + 1}: ${chain[k]} → ${chain[k + 1]}`, w === k + 1, `wired=${w}`)
    if (k === 2) await h.shot('04-half-wired')
  }

  // solve lands within 4 s of the last drag (draw-on + 1.6 s pulse)
  let solvedInTime = true
  try {
    await page.waitForFunction(() => !!window.__game.state.solved.chalk, null, { timeout: 4000 })
  } catch {
    solvedInTime = false
  }
  check('state.solved.chalk within 4 s', solvedInTime)
  check('deployed ribbon shown', await appears(page, '.pp-ribbon', 2500))
  check('deployed badge shown', await appears(page, '.pp-badge', 2500))
  await h.shot('05-deployed', { settle: 400 })

  // host closes the overlay ~2.2 s after the solve
  let closed = true
  try {
    await page.waitForFunction(() => !window.__game.state.overlay, null, { timeout: 5000 })
  } catch {
    closed = false
  }
  check('overlay closed after solve', closed)
  s = await h.state()
  check('board prompt now says deployed', /deployed/i.test(s.nearestPrompt), s.nearestPrompt)
  await h.wait(800)
  await h.shot('06-room-deployed')

  // re-opening a solved board shows the completed chain, no interaction needed
  await h.press('KeyE')
  await page.waitForSelector('.pp-badge', { timeout: 4000 })
  await page.waitForTimeout(1500)
  check('solved board shows 5 links', (await page.$$eval('.pp-link', (els) => els.length)) === 5)
  check('solved board wired 5/5', (await wired(page)) === 5)
  await h.shot('07-reopened-solved', { settle: 600 })
  await h.press('Escape')

  // room vantage shots: table 1 + timer board + lamp, then table 2 + bar
  await vantage(h, [2.2, -9.6], [-4.5, -14.5], '08-room-table-1')
  await vantage(h, [-2.2, -18.5], [5.5, -13.5], '09-room-bar')
  const rc = await h.evaluate(() => {
    const r = window.__game.renderer && window.__game.renderer()
    return r || null
  })
  console.log('renderer:', JSON.stringify(rc))

  const errors = h.errors.filter((e) => !/Outdated Optimize Dep|504/.test(e))
  console.log('CONSOLE ERRORS:', errors.length, errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await h.close()
  process.exit(failed.length || errors.length ? 1 : 0)
})().catch((e) => {
  console.error('PIPELINE QA CRASHED', e)
  process.exit(1)
})
