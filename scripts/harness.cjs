/* eslint-disable */
/**
 * Headless playthrough harness (Playwright + Chromium with software WebGL).
 *
 *   const { launch } = require('./harness.cjs')
 *   const h = await launch({ url: 'http://127.0.0.1:5173', out: 'shots/my-run' })
 *   await h.start()                 // dismiss the intro
 *   await h.goto('scotiabank')      // teleport into a chamber
 *   await h.hold('KeyW', 800)       // walk forward for 800 ms
 *   await h.press('KeyE')           // interact
 *   await h.shot('terminal-open')   // screenshot → shots/my-run/terminal-open.png
 *   console.log(h.errors)           // console errors collected so far
 *   await h.close()
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('/opt/node22/lib/node_modules/playwright')

async function launch({ url = 'http://127.0.0.1:5173', out = 'shots', width = 1100, height = 680, fresh = true, lite = true } = {}) {
  if (lite && !/[?&]lite/.test(url)) url += (url.includes('?') ? '&' : '?') + 'lite'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  const logs = []
  page.on('console', (m) => {
    const text = m.text()
    logs.push(`[${m.type()}] ${text}`)
    if (m.type() === 'error') errors.push(text)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(url, { waitUntil: 'load' })
  if (fresh) {
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'load' })
  }
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 })
  // wait for the physics world / player to be live
  await page.waitForFunction(() => window.__game.interactables().length > 0, null, { timeout: 30000 })
  await page.waitForTimeout(600)
  // software WebGL is slow: render small while moving, full-res only for screenshots
  const MOVE_DPR = 0.35
  const setDpr = (d) => page.evaluate((d) => window.__game.setDpr && window.__game.setDpr(d), d)
  await setDpr(MOVE_DPR)

  const h = {
    browser,
    page,
    errors,
    logs,
    /** Full-resolution screenshot (temporarily raises DPR and waits for a frame). */
    async shot(name, { settle = 1400 } = {}) {
      await setDpr(1)
      await page.waitForTimeout(settle)
      const file = path.join(out, `${name}.png`)
      await page.screenshot({ path: file })
      await setDpr(MOVE_DPR)
      await page.waitForTimeout(200)
      return file
    },
    /** Point the camera so that W walks toward (x, z). */
    async face(x, z) {
      await page.evaluate(([x, z]) => {
        const p = window.__game.player.position
        window.__game.player.setYaw(Math.atan2(-(x - p.x), -(z - p.z)))
      }, [x, z])
      await page.waitForTimeout(150)
    },
    /** Walk to within `tolerance` of (x, z) by steering the camera and holding W. */
    async walkTo(x, z, { tolerance = 0.7, timeout = 25000, run = false } = {}) {
      const t0 = Date.now()
      if (run) await page.keyboard.down('ShiftLeft')
      await this.face(x, z)
      await page.keyboard.down('KeyW')
      let ok = false
      try {
        while (Date.now() - t0 < timeout) {
          const p = await this.player()
          const d = Math.hypot(x - p.x, z - p.z)
          if (d < tolerance) { ok = true; break }
          await this.face(x, z)
          await page.waitForTimeout(d > 3 ? 350 : 120)
        }
      } finally {
        await page.keyboard.up('KeyW')
        if (run) await page.keyboard.up('ShiftLeft')
      }
      await page.waitForTimeout(400)
      return ok
    },
    async start() {
      await page.evaluate(() => window.__game.start())
      await page.waitForTimeout(700)
    },
    async goto(id) {
      await page.evaluate((id) => window.__game.goto(id), id)
      await page.waitForTimeout(900)
    },
    async teleport(x, z, yaw) {
      await page.evaluate(([x, z, yaw]) => window.__game.teleport(x, z, yaw), [x, z, yaw])
      await page.waitForTimeout(900)
    },
    async hold(code, ms) {
      await page.keyboard.down(code)
      await page.waitForTimeout(ms)
      await page.keyboard.up(code)
      await page.waitForTimeout(150)
    },
    async press(code) {
      await page.keyboard.press(code)
      await page.waitForTimeout(250)
    },
    async type(text) {
      await page.keyboard.type(text, { delay: 20 })
    },
    async wait(ms) {
      await page.waitForTimeout(ms)
    },
    state() {
      return page.evaluate(() => {
        const s = window.__game.state
        return { started: s.started, overlay: s.overlay, solved: s.solved, revealed: s.revealed, openedDoors: s.openedDoors, nearestId: s.nearestId, nearestPrompt: s.nearestPrompt, currentRoom: s.currentRoom, toast: s.toast && s.toast.text, flags: s.flags, finished: s.finished }
      })
    },
    player() {
      return page.evaluate(() => ({ x: window.__game.player.position.x, y: window.__game.player.position.y, z: window.__game.player.position.z, heading: window.__game.player.heading }))
    },
    evaluate: (fn, arg) => page.evaluate(fn, arg),
    async close() {
      await browser.close()
    },
  }
  return h
}

module.exports = { launch }
