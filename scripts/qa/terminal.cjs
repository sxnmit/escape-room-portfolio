/* eslint-disable */
/**
 * Chamber I — terminal puzzle scenario.
 *   node scripts/qa/terminal.cjs <outDir> <url>
 * Walks to the Scotiabank terminal desk, opens the shell, runs the intended
 * command path (help → ls → cat → decrypt → unlock), checks the denied / unsealed
 * outcomes and that the room screen flips to the solved state.
 */
const { launch } = require('../harness.cjs')

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + String(extra).slice(0, 160) : ''}`)
}

;(async () => {
  const out = process.argv[2] || 'shots/terminal'
  const url = process.argv[3] || 'http://127.0.0.1:5173'
  const h = await launch({ url, out })
  const page = h.page

  const outputText = () => page.evaluate(() => (document.querySelector('[data-testid=term-output]') || {}).textContent || '')
  const inputLine = () => page.evaluate(() => (document.querySelector('[data-testid=term-inputline]') || {}).textContent || '')
  const waitFor = async (fn, timeout, step = 100) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true
      await page.waitForTimeout(step)
    }
    return false
  }
  const waitForPrompt = () => waitFor(async () => !!(await page.$('[data-testid=term-inputline]')), 9000, 120)
  const run = async (cmd) => {
    await h.type(cmd)
    await h.press('Enter')
    await page.waitForTimeout(220)
  }

  // Software WebGL on a busy machine can run at 1–3 fps: make sure the teleport
  // has actually landed (re-issuing it if a frame never ran) before walking.
  const gotoAndSettle = async (id, target) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await h.goto(id)
      const landed = await waitFor(async () => {
        const p = await h.player()
        return Math.hypot(p.x - target[0], p.z - target[1]) < 2.5
      }, 12000, 250)
      if (landed) return true
    }
    return false
  }

  await h.start()
  check('teleported into chamber I', await gotoAndSettle('scotiabank', [19.1, -11.03]))
  await h.wait(400)
  await h.shot('01-room-locked')

  // ── walk to the desk ───────────────────────────────────────────────────────
  const items = await h.evaluate(() => window.__game.interactables())
  const con = items.find((i) => i.id === 'console:scotiabank')
  check('console interactable registered', !!con, con && `(${con.x.toFixed(2)}, ${con.z.toFixed(2)}) r=${con.r}`)
  check('walked to the terminal', await h.walkTo(con.x, con.z, { tolerance: 1.3, timeout: 90000 }))
  let s = await h.state()
  check('terminal is the nearest interactable', s.nearestId === 'console:scotiabank', s.nearestId)
  check('prompt reads "Use terminal"', s.nearestPrompt === 'Use terminal', s.nearestPrompt)
  await h.shot('02-desk-close')

  // ── open the shell ─────────────────────────────────────────────────────────
  await h.press('KeyE')
  s = await h.state()
  check('puzzle overlay opened', s.overlay && s.overlay.kind === 'puzzle' && s.overlay.chamber === 'scotiabank', JSON.stringify(s.overlay))
  check('boot banner finished and prompt appeared', await waitForPrompt())
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'))
  check('hidden input has focus', focused === 'term-input', focused)
  await h.shot('03-terminal-boot')
  let txt = await outputText()
  check('banner shows the gateway name', /onboarding-gateway/.test(txt))

  // ── intended path ──────────────────────────────────────────────────────────
  await run('help')
  txt = await outputText()
  check('help lists decrypt + unlock', /decrypt <text\|file> <shift>/.test(txt) && /unlock <key>/.test(txt))
  await run('ls')
  txt = await outputText()
  check('ls lists cipher.txt', /cipher\.txt/.test(txt))
  await run('cat notes.md')
  txt = await outputText()
  check('cat notes.md prints the handover notes', /Caesar shift/.test(txt))

  // tab completion + history
  await h.type('ca')
  await h.press('Tab')
  let il = await inputLine()
  check('Tab completes "ca" → "cat "', /\$ cat\s*$/.test(il.replace(/ /g, ' ')), JSON.stringify(il))
  await h.type('ci')
  await h.press('Tab')
  il = await inputLine()
  check('Tab completes file → cipher.txt', /cat cipher\.txt/.test(il), JSON.stringify(il))
  await h.press('Enter')
  await page.waitForTimeout(200)
  txt = await outputText()
  check('cat cipher.txt prints the ciphertext', /RQERDUG/.test(txt))
  await h.press('ArrowUp')
  il = await inputLine()
  check('ArrowUp recalls last command', /cat cipher\.txt/.test(il), JSON.stringify(il))
  await h.press('Control+C')
  il = await inputLine()
  check('Ctrl+C clears the line', /\$\s*$/.test(il.replace(/ /g, ' ')), JSON.stringify(il))

  await run('hint')
  txt = await outputText()
  check('first hint points at notes.md', /try:\s+cat notes\.md/.test(txt))

  await run('decrypt cipher.txt 3')
  txt = await outputText()
  check('decrypt reveals ONBOARD', /ONBOARD/.test(txt))
  await h.shot('04-terminal-decrypted')

  await run('unlock wrongkey')
  await page.waitForTimeout(400)
  s = await h.state()
  txt = await outputText()
  check('wrong key prints ACCESS DENIED', /ACCESS DENIED/.test(txt))
  check('wrong key does not solve', !s.solved.scotiabank)
  check('overlay still open after wrong key', s.overlay && s.overlay.kind === 'puzzle')
  await h.shot('05-terminal-denied', { settle: 500 })

  await run('unlock onboard')
  const solvedInTime = await waitFor(async () => (await h.state()).solved.scotiabank, 3500, 100)
  check('correct key solves within 3.5 s', solvedInTime)
  // the success lines stagger in over ~0.6 s after the bar completes; read them before the (slow) full-DPR shot
  const printed = await waitFor(async () => /A vault has opened back in the hub/.test(await outputText()), 2000, 60)
  txt = await outputText()
  check('success lines printed', printed && /ACCESS GRANTED/.test(txt) && /100%/.test(txt))
  await h.shot('06-terminal-unsealed', { settle: 400 })
  const closed = await waitFor(async () => !(await h.state()).overlay, 4500, 120)
  check('overlay closes after solve', closed)
  await h.wait(600)
  s = await h.state()
  check('prompt now reads "Terminal · unlocked"', s.nearestPrompt === 'Terminal · unlocked', s.nearestPrompt)
  await h.shot('07-room-unlocked')

  // ── re-open when solved ────────────────────────────────────────────────────
  await h.press('KeyE')
  s = await h.state()
  check('solved terminal re-opens', s.overlay && s.overlay.kind === 'puzzle')
  check('prompt appears on re-open', await waitForPrompt())
  txt = await outputText()
  check('solved state shows ACCESS GRANTED on boot', /ACCESS GRANTED — release vault unsealed/.test(txt))
  await run('unlock onboard')
  txt = await outputText()
  check('unlock when solved says already unsealed', /already unsealed/.test(txt))
  await h.shot('08-terminal-reopened', { settle: 500 })
  await h.press('Escape')
  s = await h.state()
  check('Escape closes the terminal', !s.overlay)

  // ── beauty shots of the set dressing (not pass/fail) ───────────────────────
  // world coords of local points in the scotiabank spoke: origin polar(30°, 12.557), rotY −60°
  const toWorld = (lx, lz) => [10.875 + lx * 0.5 - lz * 0.8660254, -6.279 + lx * 0.8660254 + lz * 0.5]
  const [hx, hz] = toWorld(4.6, -16.4)
  const [px, pz] = toWorld(1.2, -12.6)
  await h.teleport(px, pz)
  await h.face(hx, hz)
  await h.shot('09-hologram')
  const [lx, lz] = toWorld(-7.66, -15.6)
  const [qx, qz] = toWorld(-2.6, -15.6)
  await h.teleport(qx, qz)
  await h.face(lx, lz)
  await h.shot('10-log-panel')
  const [dx, dz] = toWorld(0, -20)
  const [rx, rz] = toWorld(2.4, -16.6)
  await h.teleport(rx, rz)
  await h.face(dx, dz)
  await h.shot('11-desk-angle')

  console.log('CONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await h.close()
  process.exit(failed.length || h.errors.length ? 1 : 0)
})().catch((e) => {
  console.error('TERMINAL QA CRASHED', e)
  process.exit(1)
})
