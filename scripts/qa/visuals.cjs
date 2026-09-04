/* eslint-disable */
/**
 * Visual pass — screenshots of the hub, a door, the vault opening sequence,
 * a chamber and a celebration, in normal and ?lite modes.
 *   node scripts/qa/visuals.cjs http://127.0.0.1:5173 /path/to/shots
 */
const path = require('path')
const { launch } = require('../harness.cjs')
const args = process.argv.slice(2)
const url = args.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5173'
const out = args.find((a) => !/^https?:/.test(a)) || path.join(__dirname, '..', '..', 'shots', 'visuals')
const polar = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), -r * Math.sin((deg * Math.PI) / 180)]
const APOTHEM = 12.557

async function run(lite) {
  const tag = lite ? 'lite' : 'full'
  const h = await launch({ url, out, lite })
  const settle = lite ? 1400 : 3000
  await h.start()
  await h.wait(800)
  await h.shot(`${tag}-01-hub-spawn`, { settle })
  // door I from inside the hub
  const [dx, dz] = polar(30, APOTHEM - 3.2)
  await h.teleport(dx, dz, ((30 - 90) * Math.PI) / 180 + Math.PI)
  await h.face(...polar(30, APOTHEM))
  await h.wait(600)
  await h.shot(`${tag}-02-door-I`, { settle })
  // vault I opening sequence: solve, then approach so the sequence plays
  await h.evaluate(() => window.__game.solve('scotiabank'))
  const [vx, vz] = polar(0, APOTHEM - 4)
  await h.teleport(vx, vz)
  await h.face(...polar(0, APOTHEM))
  await h.wait(300)
  await h.shot(`${tag}-03-vault-spinning`, { settle: 500 })
  await h.wait(2500)
  await h.shot(`${tag}-04-vault-open`, { settle })
  if (!lite) {
    await h.goto('chalk')
    await h.shot(`${tag}-05-chalk-room`, { settle })
    await h.goto('hub')
    await h.evaluate(() => window.__game.solve('chalk'))
    await h.shot(`${tag}-06-celebration`, { settle: 350 })
  }
  console.log(tag, 'renderer', JSON.stringify(await h.evaluate(() => window.__game.renderer())), 'errors', h.errors.length, h.errors.slice(0, 3))
  await h.close()
  return h.errors.length
}
;(async () => {
  const e1 = await run(false)
  const e2 = await run(true)
  process.exit(e1 + e2 ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
