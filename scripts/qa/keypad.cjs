/* eslint-disable */
/**
 * Chamber IV — keypad puzzle scenario.
 *   node scripts/qa/keypad.cjs http://127.0.0.1:5184 /path/to/shots
 * Teleports into the InsightAI chamber, screenshots the retrieval monitors from
 * two vantage points, walks to the keypad pedestal, opens the overlay, enters a
 * wrong code with the on-screen keys (must be DENIED), reveals two digits with
 * the hint button, types the real code on the physical keyboard (Backspace
 * included), waits for the solve, screenshots GRANTED, waits for the overlay to
 * close and screenshots the room with green monitors. Exit 1 on any failure or
 * console error.
 */
const path = require('path')
const { launch } = require('../harness.cjs')

const url = process.argv[2] || 'http://127.0.0.1:5184'
const out = process.argv[3] || path.join(__dirname, '..', '..', 'shots', 'keypad')
/** Mirrors KEYPAD_PUZZLE.code in src/data/resume.ts (the page exposes no data hook for it). */
const CODE = '7024'
const WRONG = '0000'

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  · ' + String(extra).slice(0, 160) : ''}`)
}

// spoke-local → world for the insightai chamber (layout.ts: origin at polar(210°, apothem), local −z away from the hub)
const SPOKE = { theta: 210, apothem: 12.557 }
function localToWorld(lx, lz) {
  const th = ((SPOKE.theta - 90) * Math.PI) / 180
  const ox = SPOKE.apothem * Math.cos((SPOKE.theta * Math.PI) / 180)
  const oz = -SPOKE.apothem * Math.sin((SPOKE.theta * Math.PI) / 180)
  return { x: lx * Math.cos(th) + lz * Math.sin(th) + ox, z: -lx * Math.sin(th) + lz * Math.cos(th) + oz }
}
/** Camera yaw so the player looks from local point a toward local point b. */
function yawToward(a, b) {
  const wa = localToWorld(a[0], a[1])
  const wb = localToWorld(b[0], b[1])
  return Math.atan2(-(wb.x - wa.x), -(wb.z - wa.z))
}

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

;(async () => {
  const h = await launch({ url, out })
  const { page } = h
  const waitFor = async (fn, timeout, step = 100) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(step)
    }
    return false
  }
  const landedAt = (x, z) =>
    waitFor(async () => {
      const p = await h.player()
      return Math.hypot(p.x - x, p.z - z) < 2.5
    }, 12000, 250)
  const gotoAndSettle = async (id, target) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await h.goto(id)
      if (await landedAt(target.x, target.z)) return true
    }
    return false
  }
  const teleportAndSettle = async (x, z, yaw) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await h.teleport(x, z, yaw)
      if (await landedAt(x, z)) return true
    }
    return false
  }
  // Camera pitch moves per *rendered frame* (1.2 rad/s of frame time clamped to 1/20 s), so on a starved software
  // renderer key holds must be counted in frames, not milliseconds.
  const frames = () => page.evaluate(() => window.__game.player.debug.frames)
  const holdFrames = async (code, n, timeout = 30000) => {
    const f0 = await frames()
    const t0 = Date.now()
    await page.keyboard.down(code)
    try {
      while (Date.now() - t0 < timeout && (await frames()) - f0 < n) await page.waitForTimeout(80)
    } finally {
      await page.keyboard.up(code)
    }
  }
  /** Level the third-person camera (ArrowUp = camUp; pitch clamps at 0.22 so over-holding is harmless) or tip it back down. */
  const pitchCamera = (up) => holdFrames(up ? 'ArrowUp' : 'ArrowDown', up ? 26 : 8)
  const vantage = async (from, toward, name) => {
    const p = localToWorld(from[0], from[1])
    await teleportAndSettle(p.x, p.z, yawToward(from, toward))
    await h.face(localToWorld(toward[0], toward[1]).x, localToWorld(toward[0], toward[1]).z)
    await waitFrames(page, 18) // the camera damps toward its new spot over ~15 frames
    await h.shot(name)
  }
  const display = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid=keypad-display]')
      return el ? { status: el.dataset.status, entered: Number(el.dataset.entered), text: (el.querySelector('[data-testid=keypad-status]') || {}).textContent || '' } : null
    })
  const waitStatus = (st, timeout = 4000) => waitFor(async () => ((await display()) || {}).status === st, timeout, 60)
  const digitOf = (i) => page.evaluate((i) => (document.querySelector(`[data-testid=digit-card-${i}]`) || { dataset: {} }).dataset.digit, i)

  await h.start()
  check('render loop is alive', await waitFrames(page, 4))
  const entry = localToWorld(0, -9.5)
  check('teleported into chamber IV', await gotoAndSettle('insightai', entry))
  check('render loop alive in chamber IV', await waitFrames(page, 4))
  // measure the renderer's pace: on a starved machine every wall-clock pause costs a big slice of the host's 2.2 s solve window
  const f0 = await frames()
  await h.wait(2000)
  const fps = ((await frames()) - f0) / 2
  const slow = fps < 8
  console.log(`render pace ≈ ${fps.toFixed(1)} fps${slow ? ' (slow: skipping cosmetic pauses)' : ''}`)
  await h.shot('01-room-entry')

  // ── monitor vantage shots (digits must be legible — check by eye) ─────────
  // (the camera sits ~7 units behind the player, so the spots are chosen so that ray clears the column)
  // the camera clamps against the side wall in the monitor-free stretch between the near and far monitors
  await pitchCamera(true)
  await vantage([1.5, -15.3], [-7.7, -12.6], '02-monitors-left')
  await vantage([-1.5, -15.3], [7.7, -12.6], '03-monitors-right')
  await pitchCamera(false)

  // ── walk to the pedestal ─────────────────────────────────────────────────
  check('teleported back to the door', await gotoAndSettle('insightai', entry))
  const items = await h.evaluate(() => window.__game.interactables())
  const con = items.find((i) => i.id === 'console:insightai')
  check('console:insightai registered', !!con, con && `(${con.x.toFixed(2)}, ${con.z.toFixed(2)}) r=${con.r}`)
  check('walked to the keypad pedestal', await h.walkTo(con.x, con.z, { tolerance: 1.2, timeout: 90000 }))
  await page.waitForFunction(() => window.__game.state.nearestId === 'console:insightai', null, { timeout: 8000 }).catch(() => {})
  let s = await h.state()
  check('pedestal is the nearest interactable', s.nearestId === 'console:insightai', s.nearestId)
  check('prompt reads "Use keypad"', s.nearestPrompt === 'Use keypad', s.nearestPrompt)
  await h.shot('04-pedestal')

  // ── open the keypad ──────────────────────────────────────────────────────
  await h.press('KeyE')
  s = await h.state()
  check('puzzle overlay opened', s.overlay && s.overlay.kind === 'puzzle' && s.overlay.chamber === 'insightai', JSON.stringify(s.overlay))
  await page.waitForSelector('[data-key="1"]', { timeout: 5000 })
  await page.waitForTimeout(700)
  const keyCount = await page.$$eval('[data-key]', (els) => els.length)
  check('twelve keys rendered', keyCount === 12, String(keyCount))
  let d = await display()
  check('display starts empty / idle', d && d.status === 'idle' && d.entered === 0, JSON.stringify(d))
  const captions = await page.$$eval('.kp-cap', (els) => els.map((e) => e.textContent))
  check('hint panel lists the four monitor captions', captions.length === 4 && captions.includes('vector store'), JSON.stringify(captions))
  await h.shot('05-keypad-open', { settle: 600 })

  // ── wrong code via the on-screen keys ────────────────────────────────────
  for (const ch of WRONG) {
    await page.click(`[data-key="${ch}"]`)
    await page.waitForTimeout(140)
  }
  check('display shows DENIED after a wrong code', await waitStatus('denied', 3000), JSON.stringify(await display()))
  // DENIED only lasts ~1 s: grab the DOM straight away rather than through the (slow) full-DPR shot
  await page.waitForTimeout(120)
  await page.screenshot({ path: path.join(out, '06-denied.png') })
  s = await h.state()
  check('wrong code does not solve', !s.solved.insightai)
  check('overlay still open after a wrong code', s.overlay && s.overlay.kind === 'puzzle')
  check('slots clear back to idle', await waitStatus('idle', 3000), JSON.stringify(await display()))
  d = await display()
  check('display empty again', d && d.entered === 0, JSON.stringify(d))

  // ── Enter with too few digits only nudges ────────────────────────────────
  await page.click('[data-key="7"]')
  await page.waitForTimeout(120)
  await page.click('[data-key="enter"]')
  await page.waitForTimeout(120)
  d = await display()
  check('Enter with 1 digit shows the notice, keeps the digit', d && d.entered === 1 && /4 DIGITS/.test(d.text), JSON.stringify(d))
  await page.click('[data-key="back"]')
  await page.waitForTimeout(150)
  d = await display()
  check('on-screen ⌫ removes the digit', d && d.entered === 0, JSON.stringify(d))

  // ── reveal digits with the hint button ───────────────────────────────────
  check('no digit revealed yet', (await digitOf(0)) === '', await digitOf(0))
  await page.click('[data-testid=reveal-digit]')
  await page.waitForTimeout(250)
  check('first reveal shows digit at position 1', (await digitOf(0)) === CODE[0] && (await digitOf(1)) === '', `${await digitOf(0)} ${await digitOf(1)}`)
  await page.click('[data-testid=reveal-digit]')
  await page.waitForTimeout(250)
  check('second reveal shows digit at position 2', (await digitOf(1)) === CODE[1], await digitOf(1))
  const count = await page.$eval('[data-testid=reveal-count]', (el) => el.textContent)
  check('reveal counter reads 2 / 4', /2 \/ 4/.test(count), count)
  await h.shot('07-hint-revealed', { settle: 500 })

  // ── correct code on the physical keyboard (with a Backspace fix-up) ──────
  await h.type(CODE[0] + '9')
  await page.waitForTimeout(120)
  d = await display()
  check('physical digits land in the display', d && d.entered === 2, JSON.stringify(d))
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(120)
  d = await display()
  check('physical Backspace removes a digit', d && d.entered === 1, JSON.stringify(d))
  await h.type(CODE.slice(1))
  const t0 = Date.now()
  let solvedInTime = true
  try {
    await page.waitForFunction(() => !!window.__game.state.solved.insightai, null, { timeout: 3000 })
  } catch {
    solvedInTime = false
  }
  check('state.solved.insightai within 3 s', solvedInTime, `${Date.now() - t0} ms`)
  check('display shows GRANTED', await waitStatus('granted', 2000), JSON.stringify(await display()))
  // The host closes the overlay ~2.2 s after the solve and a screenshot needs a compositor frame (≈1 s at 1–2 fps),
  // so take the live GRANTED shot straight away; only a fast renderer gets the pause for the shackle to land.
  if (!slow) await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(out, '08-granted.png') })
  const lockOpen = await page.$eval('svg[data-open]', (el) => el.dataset.open).catch(() => null)
  check('padlock is open', lockOpen === '1', lockOpen)
  const disabled = await page.$$eval('[data-key]', (els) => els.every((e) => e.disabled))
  check('keys disabled once granted', disabled)
  // the success line follows the instructions' exit animation (rAF-driven, so slow on a starved renderer): poll in real time
  const successShown = await waitFor(() => page.evaluate(() => !!document.querySelector('[data-testid=keypad-success]')), 6000, 60)
  check('success line shown', successShown)

  // host closes the overlay ~2.2 s after the solve
  let closed = true
  try {
    await page.waitForFunction(() => !window.__game.state.overlay, null, { timeout: 5000 })
  } catch {
    closed = false
  }
  check('overlay closed after solve', closed)
  await h.wait(900)
  s = await h.state()
  check('prompt now reads "Keypad · unlocked"', s.nearestPrompt === 'Keypad · unlocked', s.nearestPrompt)
  await h.shot('09-room-unlocked')

  // ── re-open when solved: granted state, no interaction ───────────────────
  await h.press('KeyE')
  s = await h.state()
  check('solved keypad re-opens', s.overlay && s.overlay.kind === 'puzzle')
  await page.waitForSelector('[data-testid=keypad-display]', { timeout: 4000 })
  await page.waitForTimeout(600)
  d = await display()
  check('re-opened keypad shows GRANTED with the code', d && d.status === 'granted' && d.entered === CODE.length, JSON.stringify(d))
  check('re-opened keys are disabled', await page.$$eval('[data-key]', (els) => els.every((e) => e.disabled)))
  await h.shot('10-reopened-solved', { settle: 400 })
  await h.press('Escape')
  s = await h.state()
  check('Escape closes the keypad', !s.overlay)

  // ── green monitors ───────────────────────────────────────────────────────
  await pitchCamera(true)
  await vantage([1.5, -15.3], [-7.7, -12.6], '11-monitors-green')
  await vantage([-1.5, -15.3], [7.7, -12.6], '12-monitors-right-green')
  await vantage([1.8, -10.6], [-3.9, -14.4], '13-column-solved')

  const rc = await h.evaluate(() => (window.__game.renderer ? window.__game.renderer() : null))
  console.log('renderer:', JSON.stringify(rc))

  const errors = h.errors.filter((e) => !/Outdated Optimize Dep|504/.test(e))
  console.log('CONSOLE ERRORS:', errors.length, errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await h.close()
  process.exit(failed.length || errors.length ? 1 : 0)
})().catch((e) => {
  console.error('KEYPAD QA CRASHED', e)
  process.exit(1)
})
