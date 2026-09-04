/* eslint-disable */
/**
 * End-to-end progression check: hub → chamber I door → console → (solve) →
 * vault I → reveal → chamber II door unlocks. Prints PASS/FAIL lines.
 */
const { launch } = require('./harness.cjs')
const layout = { hubApothem: 12.557, doorW: 3.6 }
const polar = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), -r * Math.sin((deg * Math.PI) / 180)]
const results = []
const check = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`) }

;(async () => {
  const out = process.argv[2] || 'shots/e2e'
  const url = process.argv[3] || 'http://127.0.0.1:5173'
  const h = await launch({ url, out })
  await h.start()

  // 1. walk to chamber I door (angle 30°) from inside the hub
  const [dx, dz] = polar(30, layout.hubApothem - 2.2)
  check('walked to door I', await h.walkTo(dx, dz))
  let s = await h.state()
  check('door I prompt shows', s.nearestId === 'door:scotiabank', s.nearestPrompt)
  await h.shot('01-door-I')
  await h.press('KeyE')
  s = await h.state()
  check('door I opened', s.openedDoors['door:scotiabank'])

  // locked door check: chamber II (330°)
  const [lx, lz] = polar(330, layout.hubApothem - 2.2)
  await h.walkTo(lx, lz)
  s = await h.state()
  check('door II is sealed', s.nearestId === 'door:chalk' && s.nearestPrompt === 'Sealed', s.nearestPrompt)
  await h.press('KeyE')
  s = await h.state()
  check('locked toast shown', !!s.toast && /Sealed/.test(s.toast), s.toast)
  check('door II still closed', !s.openedDoors['door:chalk'])

  // 2. into chamber I through the open door and up to the console
  await h.goto('scotiabank')
  const consoles = await h.evaluate(() => window.__game.interactables())
  const con = consoles.find((i) => i.id === 'console:scotiabank')
  check('console registered', !!con)
  check('walked to console', await h.walkTo(con.x, con.z, { tolerance: 1.2 }))
  s = await h.state()
  check('console prompt', s.nearestId === 'console:scotiabank', s.nearestPrompt)
  await h.press('KeyE')
  s = await h.state()
  check('puzzle overlay open', s.overlay && s.overlay.kind === 'puzzle' && s.overlay.chamber === 'scotiabank')
  await h.shot('02-puzzle-overlay')
  // solve via whatever the puzzle exposes (placeholder button or debug)
  const btn = await h.page.$('text=Solve instantly')
  if (btn) await btn.click()
  else await h.evaluate(() => window.__game.solve('scotiabank'))
  await h.wait(2600)
  s = await h.state()
  check('chamber I solved', s.solved.scotiabank)
  check('overlay closed after solve', !s.overlay)

  // 3. back to the hub, open vault I (angle 0°)
  await h.goto('hub')
  const [vx, vz] = polar(0, layout.hubApothem - 3.2)
  check('walked to vault I', await h.walkTo(vx, vz, { tolerance: 1.0 }))
  s = await h.state()
  check('vault I prompt', s.nearestId === 'vault:scotiabank', s.nearestPrompt)
  await h.shot('03-vault-I-open')
  await h.press('KeyE')
  s = await h.state()
  check('resume panel open', s.overlay && s.overlay.kind === 'resume')
  await h.shot('04-resume-panel')
  await h.wait(900)
  await h.press('Enter')
  s = await h.state()
  check('chamber I revealed', s.revealed.scotiabank)
  check('panel closed', !s.overlay)

  // 4. door II now unlocked
  await h.walkTo(lx, lz)
  s = await h.state()
  check('door II now unlocked', s.nearestId === 'door:chalk' && /Open/.test(s.nearestPrompt), s.nearestPrompt)
  await h.shot('05-door-II-unlocked')

  // 5. final door still sealed
  const [fx, fz] = polar(90, layout.hubApothem - 2.2)
  await h.walkTo(fx, fz)
  s = await h.state()
  check('final door sealed', s.nearestId === 'door:about' && s.nearestPrompt === 'Sealed', s.nearestPrompt)

  // 6. escape opens menu, escape closes it
  await h.press('Escape')
  s = await h.state()
  check('menu opens', s.overlay && s.overlay.kind === 'menu')
  await h.shot('06-menu')
  await h.press('Escape')
  s = await h.state()
  check('menu closes', !s.overlay)

  // 7. reload keeps progress
  await h.page.reload({ waitUntil: 'load' })
  await h.page.waitForFunction(() => !!window.__game && window.__game.interactables().length > 0)
  s = await h.state()
  check('progress persisted after reload', s.solved.scotiabank && s.revealed.scotiabank && s.openedDoors['door:scotiabank'])

  console.log('CONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 8))
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await h.close()
  process.exit(failed.length || h.errors.length ? 1 : 0)
})().catch((e) => { console.error('E2E CRASHED', e); process.exit(1) })
