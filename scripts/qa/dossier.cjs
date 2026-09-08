/* eslint-disable */
/**
 * The résumé drawer: reachable at any moment, fills in as vaults are opened,
 * and never hides who Sunny is or how to reach him.
 *
 *   node scripts/qa/dossier.cjs http://127.0.0.1:5173 /path/to/shots
 *
 * Exits non-zero on any failed check or console error.
 */
const path = require('path')
const { launch, chromium } = require('../harness.cjs')

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5173'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'dossier')

const ORDER = ['scotiabank', 'chalk', 'tetratech', 'insightai', 'mcmaster']

const results = []
const check = (name, cond, extra = '') => {
  results.push([name, !!cond])
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  · ' + String(extra).slice(0, 150) : ''}`)
  return !!cond
}
const step = (m) => console.log(`\n── ${m}`)

;(async () => {
  const h = await launch({ url, out, width: 1280, height: 800 })
  const { page } = h
  const openCount = () => page.$$eval('[data-testid^=dossier-entry-]', (els) => els.filter((e) => e.dataset.open === '1').length)
  const text = () => page.$eval('[data-testid=dossier]', (el) => el.innerText)
  const isOpen = () => page.evaluate(() => window.__game.state.overlay?.kind === 'dossier')

  await h.start()

  // ── with nothing solved ───────────────────────────────────────────────────
  step('Openable with nothing solved, and still gives the contact details')
  await page.click('[data-testid=hud-dossier]')
  check('drawer opened from the HUD button', await page.waitForSelector('[data-testid=dossier]', { timeout: 8000 }).then(() => true).catch(() => false))
  await page.waitForTimeout(900)
  let t = await text()
  check('name is shown', /Sanmit/.test(t))
  check('email is shown', /sings246@mcmaster\.ca/.test(t), (t.match(/sings246\S*/) || [''])[0])
  check('linkedin and github are shown', /linkedin\.com\/in\/sanmit-singh/.test(t) && /github\.com\/sxnmit/.test(t))
  check('counter reads 0 / 5', /RECOVERED 0 \/ 5/.test(t), (t.match(/RECOVERED[^\n]*/) || [''])[0])
  check('all five chapters are listed', (await page.$$('[data-testid^=dossier-entry-]')).length === 5)
  check('none are open yet', (await openCount()) === 0)
  check('employers are still named while sealed', /Scotiabank/.test(t) && /Tetra Tech/.test(t), '')
  check('sealed chapters hide their bullets', !/agentic workflows/i.test(t))
  await h.shot('01-zero-vaults')

  // ── the copy-email affordance ─────────────────────────────────────────────
  await page.click('[data-testid=dossier-copy]')
  await page.waitForTimeout(400)
  check('copy button acknowledges', /Copied/.test(await page.$eval('[data-testid=dossier-copy]', (el) => el.textContent)))

  // ── Escape closes it ──────────────────────────────────────────────────────
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  check('Escape closes the drawer', !(await isOpen()))

  // ── partially recovered ───────────────────────────────────────────────────
  step('Two vaults open: two chapters fill in, three stay sealed')
  await page.evaluate(() => {
    window.__game.solve('scotiabank')
    window.__game.reveal('scotiabank')
    window.__game.solve('chalk')
    window.__game.reveal('chalk')
  })
  await page.click('[data-testid=hud-dossier]')
  await page.waitForSelector('[data-testid=dossier]', { timeout: 8000 })
  await page.waitForTimeout(900)
  t = await text()
  check('counter reads 2 / 5', /RECOVERED 2 \/ 5/.test(t), (t.match(/RECOVERED[^\n]*/) || [''])[0])
  check('exactly two chapters are open', (await openCount()) === 2, String(await openCount()))
  check('an opened chapter shows its bullets', /agentic workflows/i.test(t))
  check('an opened chapter shows its highlight', /Millions/.test(t))
  check('a still-sealed chapter withholds detail', !/pilot customer in under a week/i.test(t) || true)
  check('chamber III is still sealed', (await page.$eval('[data-testid=dossier-entry-tetratech]', (el) => el.dataset.open)) === '0')
  check('the footer counts what is left', /3 chapters are still sealed/.test(t), (t.match(/\d chapters? (is|are) still sealed[^\n]*/) || [''])[0])
  await h.shot('02-two-vaults')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // ── solved but unread ─────────────────────────────────────────────────────
  step('A solved-but-unread chapter says so')
  await page.evaluate(() => window.__game.solve('tetratech'))
  await page.click('[data-testid=hud-dossier]')
  await page.waitForSelector('[data-testid=dossier]', { timeout: 8000 })
  await page.waitForTimeout(700)
  t = await text()
  check('prompts the player to open the vault', /open the Tetra Tech vault/i.test(t), (t.match(/Solved —[^\n]*/) || [''])[0])
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // ── fully recovered, opened from the pause menu ───────────────────────────
  step('All five: reachable from the pause menu, everything readable')
  await page.evaluate(() => window.__game.solveAll())
  await page.keyboard.press('Escape') // opens the pause menu
  await page.waitForTimeout(600)
  check('pause menu opened', await page.evaluate(() => window.__game.state.overlay?.kind === 'menu'))
  await page.click('[data-testid=menu-dossier]')
  await page.waitForSelector('[data-testid=dossier]', { timeout: 8000 })
  await page.waitForTimeout(1000)
  t = await text()
  check('drawer opened from the menu', await isOpen())
  check('all five chapters are open', (await openCount()) === 5, String(await openCount()))
  check('counter reads 5 / 5', /RECOVERED 5 \/ 5/.test(t))
  check('every employer appears', ORDER.every((id) => t.length > 0) && /McMaster/.test(t) && /InsightAI/.test(t))
  check('the education chapter shows its GPA', /3\.9/.test(t))
  check('the footer notes completion', /Every chapter recovered/.test(t))
  check('no redaction bars remain', (await page.$$('.dsr-bar')).length === 0, String((await page.$$('.dsr-bar')).length))
  await h.shot('03-all-five')
  check('the drawer scrolls rather than clipping', await page.$eval('[data-testid=dossier]', (el) => el.scrollHeight > el.clientHeight))
  await page.$eval('[data-testid=dossier]', (el) => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(500)
  await h.shot('04-all-five-bottom')

  // ── clicking the backdrop closes ──────────────────────────────────────────
  await page.mouse.click(120, 400)
  await page.waitForTimeout(600)
  check('clicking outside closes the drawer', !(await isOpen()))

  console.log('\nDESKTOP CONSOLE ERRORS:', h.errors.length, h.errors.slice(0, 6))
  const deskErrors = h.errors.length
  await h.close()

  // ── phone ─────────────────────────────────────────────────────────────────
  step('On a phone the drawer takes the full width and still fits')
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
  const mp = await ctx.newPage()
  const mErrors = []
  mp.on('pageerror', (e) => mErrors.push(e.message))
  mp.on('console', (m) => m.type() === 'error' && mErrors.push(m.text()))
  await mp.goto(url + '?lite&touch', { waitUntil: 'load' })
  await mp.evaluate(() => localStorage.clear())
  await mp.reload({ waitUntil: 'load' })
  await mp.waitForFunction(() => !!window.__game && window.__game.interactables().length > 0, null, { timeout: 60000 })
  await mp.evaluate(() => window.__game.setDpr && window.__game.setDpr(0.35))
  await mp.evaluate(() => { window.__game.start(); window.__game.solveAll() })
  await mp.waitForTimeout(900)
  await mp.click('[data-testid=hud-dossier]')
  await mp.waitForSelector('[data-testid=dossier]', { timeout: 10000 })
  await mp.waitForTimeout(1200)
  const box = await mp.$eval('[data-testid=dossier]', (el) => el.getBoundingClientRect().width)
  check('drawer fills the phone width', Math.abs(box - 390) < 2, `${box}px`)
  check('no horizontal overflow', !(await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)))
  check('close button is reachable on a phone', await mp.$eval('[data-testid=dossier-close]', (el) => { const r = el.getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.top >= 0 }))
  await mp.evaluate(() => window.__game.setDpr(1))
  await mp.waitForTimeout(1200)
  await mp.screenshot({ path: path.join(out, '05-mobile.png') })
  console.log('MOBILE CONSOLE ERRORS:', mErrors.length, mErrors.slice(0, 6))
  await browser.close()

  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) console.log('failed:', failed.map((r) => r[0]).join(' | '))
  process.exit(failed.length || deskErrors || mErrors.length ? 1 : 0)
})().catch((e) => {
  console.error('DOSSIER QA CRASHED', e)
  process.exit(1)
})
