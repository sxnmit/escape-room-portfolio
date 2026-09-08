/* eslint-disable */
/**
 * Shoving crates around Chamber III is the fiddliest thing the headless player
 * does: the capsule has to approach from behind without clipping the crate it
 * is aiming at or the two it is not, and a shove that lands short or wide has
 * to be retried. That logic lives here so the chamber scenario and the full
 * playthrough drive the crates identically.
 *
 *   const drv = crateDriver(h, { toLocal, toWorld })
 *   await drv.pushCrate('a')
 *
 * `h` is a harness from ../harness.cjs. `toLocal`/`toWorld` convert between
 * world space and the Tetra Tech spoke's local frame (see layout.ts).
 */

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

/** crate half (0.55) + capsule radius (0.35) + margin */
const CLEAR = 1.15
/** the open floor the player can route through, in spoke-local coordinates */
const ROOM = { minX: -5.4, maxX: 5.4, minZ: -21.4, maxZ: -8.4 }

function crateDriver(h, { toLocal, toWorld, ensureLive = async () => true, log = () => {} }) {
  const { page } = h

  const rawCrates = () => page.evaluate(() => (window.__game && window.__game.crates ? window.__game.crates() : null))
  const rawBlocks = () => page.evaluate(() => (window.__game && window.__game.blocks ? window.__game.blocks() : null))
  const crates = async () => (await rawCrates()) || ((await ensureLive()) && (await rawCrates())) || []
  const blocks = async () =>
    (await rawBlocks()) || ((await ensureLive()) && (await rawBlocks())) || { crates: [], locked: false, solved: false, lockT: 0 }
  const crate = async (id) => (await crates()).find((c) => c.id === id)

  /** The first crate a straight walk from a to b would clip, if any. */
  function firstBlocker(a, b, obstacles) {
    let worst = null
    const abx = b.x - a.x
    const abz = b.z - a.z
    const L2 = abx * abx + abz * abz
    if (L2 < 1e-6) return null
    for (const o of obstacles) {
      let t = ((o.x - a.x) * abx + (o.z - a.z) * abz) / L2
      t = Math.max(0, Math.min(1, t))
      const cx = a.x + abx * t
      const cz = a.z + abz * t
      const d = Math.hypot(o.x - cx, o.z - cz)
      if (d < CLEAR && t > 0.02 && t < 0.98 && (!worst || t < worst.t)) worst = { o, t, cx, cz, d }
    }
    return worst
  }

  /** Keep a waypoint on the room's open floor. */
  const clampRoom = (p) => {
    const l = toLocal(p.x, p.z)
    return toWorld(Math.max(ROOM.minX, Math.min(ROOM.maxX, l.x)), Math.max(ROOM.minZ, Math.min(ROOM.maxZ, l.z)))
  }

  /** walkTo that steps around crates instead of shoving them. */
  async function routeTo(target, opts = {}, exclude = [], depth = 0) {
    const me = await h.player()
    const hit = firstBlocker(me, target, (await crates()).filter((c) => !exclude.includes(c.id)))
    if (!hit || depth > 3) return h.walkTo(target.x, target.z, opts)
    const abx = target.x - me.x
    const abz = target.z - me.z
    const L = Math.hypot(abx, abz) || 1
    const nx = -abz / L
    const nz = abx / L
    let side = (hit.o.x - hit.cx) * nx + (hit.o.z - hit.cz) * nz > 0 ? -1 : 1
    let wp = { x: hit.o.x + nx * side * 2.0, z: hit.o.z + nz * side * 2.0 }
    if (Math.abs(toLocal(wp.x, wp.z).x) > ROOM.maxX) {
      side = -side
      wp = { x: hit.o.x + nx * side * 2.0, z: hit.o.z + nz * side * 2.0 }
    }
    wp = clampRoom(wp)
    log(`   detour around crate ${hit.o.id} via (${wp.x.toFixed(1)}, ${wp.z.toFixed(1)})`)
    await routeTo(wp, { tolerance: 0.5, timeout: 30000 }, exclude, depth + 1)
    return routeTo(target, opts, exclude, depth + 1)
  }

  /**
   * Reach `target` (a point behind crate `c`) without touching it: get onto a
   * circle of radius R around the crate, walk around it to the target's
   * bearing, then step in.
   */
  async function goBehind(c, target, R = 1.95) {
    const centre = { x: c.x, z: c.z }
    let me = await h.player()
    const dm = dist(me, centre) || 1
    const entryPt = clampRoom({ x: centre.x + ((me.x - centre.x) / dm) * R, z: centre.z + ((me.z - centre.z) / dm) * R })
    if (dm < R - 0.1) await h.walkTo(entryPt.x, entryPt.z, { tolerance: 0.35, timeout: 20000 })
    else await routeTo(entryPt, { tolerance: 0.4, timeout: 40000 }, [c.id])
    me = await h.player()
    const others = (await crates()).filter((k) => k.id !== c.id)
    const a0 = Math.atan2(me.z - centre.z, me.x - centre.x)
    const a1 = Math.atan2(target.z - centre.z, target.x - centre.x)
    const delta = ((((a1 - a0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
    const steps = Math.ceil(Math.abs(delta) / (Math.PI / 3.6))
    for (let k = 1; k < steps; k++) {
      const a = a0 + (delta * k) / steps
      const wp = clampRoom({ x: centre.x + Math.cos(a) * R, z: centre.z + Math.sin(a) * R })
      if (others.some((o) => dist(o, wp) < 1.25)) continue
      await h.walkTo(wp.x, wp.z, { tolerance: 0.45, timeout: 20000 })
    }
    return h.walkTo(target.x, target.z, { tolerance: 0.3, timeout: 20000 })
  }

  /**
   * Push crate `id` onto its pad: approach from behind along the pad→crate
   * line, then walk at the pad so the capsule shoves the crate ahead of it.
   * Re-reads the crate and nudges until it is within `goal` of the pad.
   */
  async function pushCrate(id, { goal = 0.7, maxAttempts = 8, confirm = 8000 } = {}) {
    const read = async () => {
      const c = await crate(id)
      return c ? { c, d: dist(c, { x: c.px, z: c.pz }), placed: !!c.placed } : { c: null, d: Infinity, placed: false }
    }
    /**
     * The room's own detector decides whether a pad is covered, and it runs
     * every fourth frame — seconds of wall clock under software rendering. Wait
     * for *its* verdict rather than for a distance, or the caller's next
     * assertion races it.
     */
    const settle = async () => {
      const t0 = Date.now()
      let last = await read()
      while (Date.now() - t0 < confirm) {
        if (last.placed) return last
        if (last.d > goal + 1.2) break // nowhere near: shove again rather than wait it out
        await h.wait(250)
        last = await read()
      }
      return last
    }

    let attempt = 0
    for (; attempt < maxAttempts; attempt++) {
      await ensureLive()
      const { c, d, placed } = await read()
      if (!c) return { ok: false, attempts: attempt, d: Infinity }
      log(`   crate ${id}: ${d.toFixed(2)} from pad (attempt ${attempt})`)
      if (placed) return { ok: true, attempts: attempt, d }
      if (d < goal) {
        const done = await settle()
        if (done.placed) return { ok: true, attempts: attempt, d: done.d }
      }
      const cur = await read()
      if (cur.placed) return { ok: true, attempts: attempt, d: cur.d }
      const pad = { x: cur.c.px, z: cur.c.pz }
      const dx = (cur.c.x - pad.x) / (cur.d || 1)
      const dz = (cur.c.z - pad.z) / (cur.d || 1)
      await goBehind(cur.c, { x: cur.c.x + dx * 1.5, z: cur.c.z + dz * 1.5 })
      // the crate rides ~0.87 ahead of the capsule, so stop just short of the pad
      await h.walkTo(pad.x + dx * 0.95, pad.z + dz * 0.95, { tolerance: 0.45, timeout: 30000 })
      await settle()
    }
    // the final shove counts too — re-read before declaring failure
    const final = await read()
    return { ok: final.placed, attempts: attempt, d: final.d }
  }

  return { crates, blocks, crate, routeTo, goBehind, pushCrate, clampRoom, firstBlocker, dist }
}

module.exports = { crateDriver, dist, CLEAR, ROOM }
