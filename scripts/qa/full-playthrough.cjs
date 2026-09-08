/* eslint-disable */
/**
 * The whole game, start to finish, played the way a person plays it.
 *   node scripts/qa/full-playthrough.cjs http://127.0.0.1:5173 /path/to/shots
 *
 * Rules this script holds itself to:
 *   - Progress is only ever made through real input: walking with WASD, pressing
 *     E, typing into the terminal, dragging pipeline cards, shoving crates,
 *     clicking keypad keys, lighting lamps.
 *   - It never calls __game.solve / reveal / solveAll.
 *   - __game.goto() is used only to skip the long corridor walks between the hub
 *     and a room; the first chamber is entered on foot to prove the doorway is
 *     actually passable.
 *
 * Exits non-zero on any failed check or console error.
 */
const path = require('path')
const { launch } = require('../harness.cjs')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5173'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'full')

/** Mirrors TERMINAL_PUZZLE / KEYPAD_PUZZLE in src/data/resume.ts. */
const TERMINAL_KEY = 'onboard'
const KEYPAD_CODE = '7024'

const APOTHEM = 12.557
const DOOR_ANGLE = { scotiabank: 30, chalk: 330, tetratech: 270, insightai: 210, mcmaster: 150, about: 90 }
const VAULT_ANGLE = { scotiabank: 0, chalk: 300, tetratech: 240, insightai: 180, mcmaster: 120 }
const ORDER = ['scotiabank', 'chalk', 'tetratech', 'insightai', 'mcmaster']
const NAME = { scotiabank: 'Scotiabank', chalk: 'Chalk', tetratech: 'Tetra Tech', insightai: 'InsightAI', mcmaster: 'McMaster' }
const NUMERAL = { scotiabank: 'I', chalk: 'II', tetratech: 'III', insightai: 'IV', mcmaster: 'V' }

const polar = (deg, r) => ({ x: r * Math.cos((deg * Math.PI) / 180), z: -r * Math.sin((deg * Math.PI) / 180) })
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

/** spoke-local (x right, −z away from the hub) → world, for the spoke at `theta`. */
function localToWorld(theta, lx, lz) {
  const th = ((theta - 90) * Math.PI) / 180
  const o = polar(theta, APOTHEM)
  return { x: lx * Math.cos(th) + lz * Math.sin(th) + o.x, z: -lx * Math.sin(th) + lz * Math.cos(th) + o.z }
}

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  · ' + String(extra).slice(0, 150) : ''}`)
  return !!cond
}
const step = (msg) => console.log(`\n── ${msg}`)

;(async () => {
  const h = await launch({ url, out })
  const { page } = h

  // ── small helpers ─────────────────────────────────────────────────────────
  const waitFor = async (fn, timeout, gap = 120) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(gap)
    }
    return false
  }
  const state = () => h.state()
  const waitNearest = (id, timeout = 10000) => waitFor(async () => (await state()).nearestId === id, timeout)
  const waitOverlay = (kind, timeout = 10000) => waitFor(async () => { const s = await state(); return s.overlay && s.overlay.kind === kind }, timeout)
  const waitNoOverlay = (timeout = 10000) => waitFor(async () => !(await state()).overlay, timeout)
  const waitSolved = (id, timeout = 12000) => waitFor(async () => !!(await state()).solved[id], timeout)
  const landedAt = (p) => waitFor(async () => dist(await h.player(), p) < 2.5, 12000, 250)
  const gotoRoom = async (id) => {
    for (let i = 0; i < 3; i++) {
      await h.goto(id)
      const target = localToWorld(DOOR_ANGLE[id], 0, -9.5)
      if (await landedAt(target)) return true
    }
    return false
  }
  const walkLocal = (theta, lx, lz, opts = {}) => {
    const w = localToWorld(theta, lx, lz)
    return h.walkTo(w.x, w.z, { tolerance: 1.3, timeout: 45000, ...opts })
  }
  const item = async (id) => (await page.evaluate(() => window.__game.interactables())).find((i) => i.id === id)
  /** Record every toast: the HUD clears them after 3.6 s, faster than a slow walk. */
  const toasts = () => page.evaluate(() => window.__toasts || [])

  await h.start()
  await page.evaluate(() => {
    window.__toasts = []
    window.__game.store.subscribe((s) => {
      if (s.toast) window.__toasts.push(s.toast.text)
    })
  })
  check('game started, no overlay', !(await state()).overlay)
  await h.shot('00-hub')

  // ── the locked world ──────────────────────────────────────────────────────
  step('Every door but the first is sealed')
  for (const id of ORDER.slice(1)) {
    const d = polar(DOOR_ANGLE[id], APOTHEM - 2.2)
    await h.walkTo(d.x, d.z, { tolerance: 1.2, timeout: 45000 })
    await waitNearest(`door:${id}`)
    const s = await state()
    check(`door ${NUMERAL[id]} is sealed`, s.nearestId === `door:${id}` && s.nearestPrompt === 'Sealed', s.nearestPrompt)
  }
  {
    const f = polar(DOOR_ANGLE.about, APOTHEM - 2.2)
    await h.walkTo(f.x, f.z, { tolerance: 1.2, timeout: 45000 })
    await waitNearest('door:about')
    const s = await state()
    check('the finale door is sealed', s.nearestId === 'door:about' && s.nearestPrompt === 'Sealed', s.nearestPrompt)
    await h.press('KeyE')
    check('pressing E on the finale door does not open it', !(await state()).openedDoors['door:about'])
  }

  // ── chamber loop ──────────────────────────────────────────────────────────
  for (let n = 0; n < ORDER.length; n++) {
    const id = ORDER[n]
    const theta = DOOR_ANGLE[id]

    step(`Chamber ${NUMERAL[id]} · ${NAME[id]}`)
    const door = polar(theta, APOTHEM - 2.2)
    check(`walked to door ${NUMERAL[id]}`, await h.walkTo(door.x, door.z, { tolerance: 1.2, timeout: 45000 }))
    await waitNearest(`door:${id}`)
    let s = await state()
    check(`door ${NUMERAL[id]} is unlocked now`, /^Open Chamber/.test(s.nearestPrompt), s.nearestPrompt)
    await h.press('KeyE')
    check(`door ${NUMERAL[id]} opened`, await waitFor(async () => !!(await state()).openedDoors[`door:${id}`], 6000))

    if (n === 0) {
      // walk the corridor on foot once, to prove the doorway is passable
      check('walked through the doorway into the room', await walkLocal(theta, 0, -9.5, { tolerance: 1.6 }))
      const p = await h.player()
      check('player is inside chamber I', dist(p, localToWorld(theta, 0, -9.5)) < 3, `room=${(await state()).currentRoom}`)
    } else {
      check(`entered chamber ${NUMERAL[id]}`, await gotoRoom(id))
    }
    await h.shot(`${n + 1}0-chamber-${id}`)

    // ── solve it ────────────────────────────────────────────────────────────
    if (id === 'scotiabank') {
      const con = await item('console:scotiabank')
      check('walked to the terminal', await h.walkTo(con.x, con.z, { tolerance: 1.3, timeout: 45000 }))
      await waitNearest('console:scotiabank')
      await h.press('KeyE')
      check('terminal overlay opened', await waitOverlay('puzzle'))
      await waitFor(async () => !!(await page.$('[data-testid=term-inputline]')), 12000)
      const run = async (cmd) => {
        await h.type(cmd)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(600)
      }
      await run('cat notes.md')
      const notes = await page.evaluate(() => document.querySelector('.ui-root').innerText)
      check('notes.md explains the Caesar shift', /rotated FORWARD by 3/i.test(notes))
      await run('decrypt cipher.txt 3')
      const decrypted = await page.evaluate(() => document.querySelector('.ui-root').innerText)
      check('decrypt reveals the key', /ONBOARD/.test(decrypted))
      await run('unlock wrongkey')
      check('a wrong key does not solve it', !(await state()).solved.scotiabank)
      await h.shot('11-terminal')
      await run(`unlock ${TERMINAL_KEY}`)
      check('the right key solves chamber I', await waitSolved('scotiabank'))
    }

    if (id === 'chalk') {
      const con = await item('console:chalk')
      check('walked to the pipeline board', await h.walkTo(con.x, con.z, { tolerance: 1.3, timeout: 45000 }))
      await waitNearest('console:chalk')
      await h.press('KeyE')
      check('pipeline overlay opened', await waitOverlay('puzzle'))
      await page.waitForSelector('[data-node="open"]', { timeout: 20000 })
      await page.waitForTimeout(1200)
      const card = async (node) => {
        const b = await (await page.$(`[data-node="${node}"]`)).boundingBox()
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      }
      const wired = () => page.evaluate(() => Number(document.querySelector('.pp-rail').dataset.wired))
      // one wrong wiring first: the board must refuse it
      await (async () => {
        const a = await card('open')
        const b = await card('dashboard')
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10)
        await page.mouse.up()
        await page.waitForTimeout(900)
      })()
      check('the board refuses an out-of-order link', (await wired()) === 0, `wired=${await wired()}`)
      await h.shot('21-pipeline')
      const chain = [['open', 'timer'], ['timer', 'rate'], ['rate', 'revenue'], ['revenue', 'checkout'], ['checkout', 'dashboard']]
      for (let k = 0; k < chain.length; k++) {
        const a = await card(chain[k][0])
        const b = await card(chain[k][1])
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10)
        await page.mouse.up()
        check(`wired link ${k + 1}/5`, await waitFor(async () => (await wired()) === k + 1, 12000))
      }
      check('the deployed pipeline solves chamber II', await waitSolved('chalk', 20000))
    }

    if (id === 'tetratech') {
      const crates = () => page.evaluate(() => window.__game.crates())
      const list = await crates()
      check('three crates are in the room', list.length === 3)
      for (const c0 of list) {
        let placed = false
        for (let attempt = 0; attempt < 6 && !placed; attempt++) {
          const c = (await crates()).find((k) => k.id === c0.id)
          const pad = { x: c.px, z: c.pz }
          const d = dist(c, pad)
          if (d < 0.7) { placed = true; break }
          const ux = (c.x - pad.x) / d
          const uz = (c.z - pad.z) / d
          // stand behind the crate on the crate→pad line, then push through the pad
          await h.walkTo(c.x + ux * 1.9, c.z + uz * 1.9, { tolerance: 0.5, timeout: 30000 })
          await h.walkTo(pad.x + ux * 0.95, pad.z + uz * 0.95, { tolerance: 0.45, timeout: 30000 })
          await h.wait(800)
          const after = (await crates()).find((k) => k.id === c0.id)
          placed = dist(after, { x: after.px, z: after.pz }) < 0.7
        }
        check(`crate ${c0.id} pushed onto its pad`, placed)
      }
      check('all three pads filled solves chamber III', await waitSolved('tetratech'))
      await h.shot('31-crates')
    }

    if (id === 'insightai') {
      const con = await item('console:insightai')
      check('walked to the keypad', await h.walkTo(con.x, con.z, { tolerance: 1.3, timeout: 45000 }))
      await waitNearest('console:insightai')
      await h.press('KeyE')
      check('keypad overlay opened', await waitOverlay('puzzle'))
      await page.waitForSelector('[data-key="1"]', { timeout: 15000 })
      for (const ch of '0000') await page.click(`[data-key="${ch}"]`)
      await page.waitForTimeout(1200)
      check('a wrong code is denied', !(await state()).solved.insightai)
      await h.shot('41-keypad')
      for (const ch of KEYPAD_CODE) {
        await page.click(`[data-key="${ch}"]`)
        await page.waitForTimeout(120)
      }
      check('the monitors’ code solves chamber IV', await waitSolved('insightai'))
    }

    if (id === 'mcmaster') {
      const lamps = (await page.evaluate(() => window.__game.interactables())).filter((i) => i.id.startsWith('lamp:mcmaster:'))
      check('four lamps are in the hall', lamps.length === 4)
      const aisle = { y1: [[0, -9.3]], y2: [[0, -9.3]], y3: [[0, -9.3], [0, -18.6]], y4: [[0, -18.6]] }
      for (const lamp of lamps) {
        const key = lamp.id.split(':')[2]
        for (const [lx, lz] of aisle[key] || []) await walkLocal(theta, lx, lz, { tolerance: 1.5 })
        await h.walkTo(lamp.x, lamp.z, { tolerance: 1.5, timeout: 45000 })
        await waitNearest(lamp.id)
        await h.press('KeyE')
        check(`lit ${key}`, await waitFor(async () => !!(await state()).flags[lamp.id], 6000))
      }
      check('four lit lamps solve chamber V', await waitSolved('mcmaster'))
      await h.shot('51-lamps')
    }

    // ── back to the hub for the vault ───────────────────────────────────────
    await h.goto('hub')
    check(`returned to the hub from chamber ${NUMERAL[id]}`, await waitFor(async () => dist(await h.player(), { x: 0, z: 2.5 }) < 3, 12000, 250))
    const v = polar(VAULT_ANGLE[id], APOTHEM - 3.2)
    check(`walked to vault ${NUMERAL[id]}`, await h.walkTo(v.x, v.z, { tolerance: 1.1, timeout: 45000 }))
    await waitNearest(`vault:${id}`)
    s = await state()
    check(`vault ${NUMERAL[id]} offers to open`, /Open the/.test(s.nearestPrompt), s.nearestPrompt)
    await h.shot(`${n + 1}2-vault-${id}`)
    await h.press('KeyE')
    check(`vault ${NUMERAL[id]} shows the resume panel`, await waitOverlay('resume'))
    await h.wait(1400)
    const panel = await page.evaluate(() => document.querySelector('.ui-root').innerText)
    check(`panel is chapter ${n + 1} of 5`, new RegExp(`CHAPTER ${n + 1} OF 5`).test(panel), (panel.match(/CHAPTER[^\n]*/) || [''])[0])
    check(`panel names ${NAME[id]}`, panel.includes(NAME[id].split(' ')[0]))
    await h.shot(`${n + 1}3-resume-${id}`)
    await h.press('Enter')
    check(`chapter ${NUMERAL[id]} is revealed`, await waitFor(async () => !!(await state()).revealed[id], 6000))
    check('the panel closed', await waitNoOverlay())
  }

  // ── the finale ────────────────────────────────────────────────────────────
  step('The finale')
  const f = polar(DOOR_ANGLE.about, APOTHEM - 2.2)
  check('walked to the finale door', await h.walkTo(f.x, f.z, { tolerance: 1.2, timeout: 45000 }))
  await waitNearest('door:about')
  let s = await state()
  check('the finale door unsealed after five reveals', /^Open Chamber/.test(s.nearestPrompt), s.nearestPrompt)
  await h.shot('60-finale-door')
  await h.press('KeyE')
  check('the finale door opened', await waitFor(async () => !!(await state()).openedDoors['door:about'], 6000))
  check('entered the closing room', await gotoRoom('about'))
  const mono = await item('about:monolith')
  check('walked to the monolith', await h.walkTo(mono.x, mono.z, { tolerance: 1.4, timeout: 45000 }))
  await waitNearest('about:monolith')
  await h.press('KeyE')
  check('the about panel opened', await waitOverlay('about'))
  await h.wait(1500)
  const about = await page.evaluate(() => document.querySelector('.ui-root').innerText)
  check('the about panel carries the contact details', /sings246@mcmaster\.ca/.test(about) && /github\.com\/sxnmit/.test(about))
  check('the game is marked finished', !!(await state()).finished)
  await h.shot('61-about')

  // toasts must be read before the reload clears the recording
  const seen = await toasts()
  check('the run announced each vault unsealing', ORDER.every((c) => seen.some((t) => t.includes(NAME[c]) && /unseal/i.test(t))), `${seen.length} toasts`)

  // ── it all survives a reload ──────────────────────────────────────────────
  step('Progress survives a reload')
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__game && window.__game.interactables().length > 0, null, { timeout: 60000 })
  await page.evaluate(() => window.__game.setDpr && window.__game.setDpr(0.35))
  s = await state()
  check('all five chambers still solved', ORDER.every((c) => !!s.solved[c]))
  check('all five chapters still revealed', ORDER.every((c) => !!s.revealed[c]))
  check('still finished', !!s.finished)
  const intro = await page.evaluate(() => document.querySelector('.ui-root').innerText)
  check('the intro offers to continue at 5/5', /Continue · 5\/5/.test(intro), (intro.match(/Continue[^\n]*/) || [''])[0])

  console.log('\nCONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) console.log('failed:', failed.map((r) => r[0]).join(' | '))
  await h.close()
  process.exit(failed.length || h.errors.length ? 1 : 0)
})().catch((e) => {
  console.error('FULL PLAYTHROUGH CRASHED', e)
  process.exit(1)
})
