/* eslint-disable */
/**
 * UI scenario — desktop intro/resume/about/menu screenshots and a mobile run
 * that drives the virtual joystick and the on-screen E button.
 *   node scripts/qa/ui.cjs http://127.0.0.1:5173 /path/to/shots
 */
const path = require('path')
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const { launch } = require('../harness.cjs')
const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5173'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'ui')
const polar = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), -r * Math.sin((deg * Math.PI) / 180)]
const results = []
const check = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  · ' + String(x).slice(0, 140) : ''}`) }

async function desktop() {
  const h = await launch({ url, out, width: 1280, height: 800 })
  await h.shot('d1-intro')
  await h.start()
  await h.evaluate(() => window.__game.solve('scotiabank'))
  await h.goto('hub')
  const [vx, vz] = polar(0, 12.557 - 3.2)
  check('walked to vault I', await h.walkTo(vx, vz, { tolerance: 1.0, timeout: 45000 }))
  await h.page.waitForFunction(() => window.__game.state.nearestId === 'vault:scotiabank', null, { timeout: 8000 }).catch(() => {})
  await h.press('KeyE')
  await h.page.waitForFunction(() => window.__game.state.overlay && window.__game.state.overlay.kind === 'resume', null, { timeout: 8000 }).catch(() => {})
  check('resume panel open', (await h.state()).overlay?.kind === 'resume')
  await h.wait(1600)
  await h.shot('d2-resume-panel')
  const txt = await h.page.evaluate(() => document.querySelector('.ui-root').innerText)
  check('chapter ribbon shown', /CHAPTER 1 OF 5/.test(txt))
  check('next chapter footer shown', /Next: Chamber II/.test(txt))
  await h.press('Enter')
  await h.page.waitForFunction(() => !window.__game.state.overlay, null, { timeout: 8000 }).catch(() => {})
  check('revealed after Enter', !!(await h.state()).revealed.scotiabank)
  await h.evaluate(() => window.__game.solveAll())
  await h.goto('about')
  const mono = (await h.evaluate(() => window.__game.interactables())).find((i) => i.id === 'about:monolith')
  check('walked to monolith', await h.walkTo(mono.x, mono.z, { tolerance: 1.4, timeout: 45000 }))
  await h.page.waitForFunction(() => window.__game.state.nearestId === 'about:monolith', null, { timeout: 8000 }).catch(() => {})
  await h.press('KeyE')
  await h.page.waitForFunction(() => window.__game.state.overlay && window.__game.state.overlay.kind === 'about', null, { timeout: 8000 }).catch(() => {})
  check('about panel open', (await h.state()).overlay?.kind === 'about')
  await h.wait(1500)
  await h.shot('d3-about-panel')
  check('finished flag set', !!(await h.state()).finished)
  await h.press('Escape')
  await h.press('Escape')
  await h.page.waitForFunction(() => window.__game.state.overlay && window.__game.state.overlay.kind === 'menu', null, { timeout: 8000 }).catch(() => {})
  check('menu open', (await h.state()).overlay?.kind === 'menu')
  await h.shot('d4-menu')
  await h.page.reload({ waitUntil: 'load' })
  await h.page.waitForFunction(() => !!window.__game, null, { timeout: 60000 })
  await h.wait(1500)
  await h.shot('d5-intro-with-progress')
  const intro = await h.page.evaluate(() => document.querySelector('.ui-root').innerText)
  check('intro shows continue with progress', /Continue · 5\/5/.test(intro), intro.match(/Continue[^\n]*/)?.[0])
  console.log('desktop errors', h.errors.length, h.errors.slice(0, 3))
  const e = h.errors.length
  await h.close()
  return e
}

async function mobile() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(url + '?lite&touch', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__game && window.__game.interactables().length > 0, null, { timeout: 60000 })
  await page.evaluate(() => window.__game.setDpr && window.__game.setDpr(0.35))
  await page.screenshot({ path: path.join(out, 'm1-intro.png') })
  await page.evaluate(() => window.__game.start())
  await page.waitForTimeout(1200)
  const stick = await page.$('[data-testid="touch-stick"]')
  check('joystick rendered on touch device', !!stick)
  const eBtn = await page.$('[data-testid="touch-interact"]')
  check('E button rendered', !!eBtn)
  await page.evaluate(() => window.__game.setDpr(1))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(out, 'm2-hud-touch.png') })
  await page.evaluate(() => window.__game.setDpr(0.35))
  // drag the stick up (forward) for a while
  const b = await stick.boundingBox()
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2
  const p0 = await page.evaluate(() => ({ x: window.__game.player.position.x, z: window.__game.player.position.z }))
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 50, { steps: 5 })
  await page.waitForTimeout(2500)
  await page.mouse.up()
  await page.waitForTimeout(500)
  const p1 = await page.evaluate(() => ({ x: window.__game.player.position.x, z: window.__game.player.position.z }))
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z)
  check('joystick moved the player', moved > 1.0, `moved ${moved.toFixed(2)}`)
  check('stick released → no drift', (await page.evaluate(() => Math.hypot(window.__game.player.touch.x, window.__game.player.touch.z))) === 0)
  // walk to door I with the stick isn't practical; teleport next to it and use the E button
  const [dx, dz] = polar(30, 12.557 - 2.2)
  await page.evaluate(([x, z]) => window.__game.teleport(x, z), [dx, dz])
  await page.waitForFunction(() => window.__game.state.nearestId === 'door:scotiabank', null, { timeout: 15000 }).catch(() => {})
  check('door prompt near door', (await page.evaluate(() => window.__game.state.nearestId)) === 'door:scotiabank')
  await eBtn.tap()
  await page.waitForFunction(() => window.__game.state.openedDoors['door:scotiabank'], null, { timeout: 8000 }).catch(() => {})
  check('E button opened the door', await page.evaluate(() => !!window.__game.state.openedDoors['door:scotiabank']))
  // resume panel fits the phone
  await page.evaluate(() => { window.__game.solve('scotiabank'); window.__game.store.getState().openOverlay({ kind: 'resume', chamber: 'scotiabank' }) })
  await page.waitForTimeout(1800)
  await page.evaluate(() => window.__game.setDpr(1))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(out, 'm3-resume-mobile.png') })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('no horizontal overflow on mobile', !overflow)
  console.log('mobile errors', errors.length, errors.slice(0, 3))
  await browser.close()
  return errors.length
}

;(async () => {
  const e1 = await desktop()
  const e2 = await mobile()
  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  process.exit(failed || e1 || e2 ? 1 : 0)
})().catch((e) => { console.error('UI QA CRASHED', e); process.exit(1) })
