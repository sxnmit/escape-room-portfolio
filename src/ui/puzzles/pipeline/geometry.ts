/**
 * Pure geometry helpers for the pipeline board: deterministic node layout,
 * bezier link paths and an arc-length "track" the data pulse travels along.
 */

export interface Pt {
  x: number
  y: number
}

export interface PortMap {
  [nodeId: string]: { in?: Pt; out?: Pt }
}

/**
 * 3×2 grid assignment expressed in terms of chain positions so it never
 * equals the correct reading order:
 *   row 1: [ o0 · o4 · o5 ]
 *   row 2: [ o1 · o2 · o3 ]
 * The correct chain therefore flows down, along the bottom row, and back up
 * to the top-right — a purposeful "U" with no link ever passing behind a card.
 */
export function boardLayout<T>(order: readonly T[]): T[] {
  const o = (i: number) => order[Math.min(i, order.length - 1)]
  return [o(0), o(4), o(5), o(1), o(2), o(3)]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Control-point reach for a link from an output port at `a` to an input port at `b`. */
export function linkReach(a: Pt, b: Pt) {
  const forward = b.x >= a.x
  return forward ? clamp(Math.abs(b.x - a.x) * 0.5, 60, 140) : 72
}

export function linkPath(a: Pt, b: Pt): string {
  const dx = linkReach(a, b)
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function cubic(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const mt = 1 - t
  const w0 = mt * mt * mt
  const w1 = 3 * mt * mt * t
  const w2 = 3 * mt * t * t
  const w3 = t * t * t
  return { x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x, y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y }
}

export interface Track {
  pts: Pt[]
  /** cumulative arc length at each point */
  cum: number[]
  total: number
  /** arc length at which the pulse reaches node i (i = chain index) */
  nodeAt: number[]
}

/** Sample the whole chain (bezier links + straight runs across each card) into a polyline. */
export function buildTrack(order: readonly string[], ports: PortMap): Track | null {
  const pts: Pt[] = []
  const cum: number[] = []
  const nodeAt: number[] = []
  let total = 0
  const push = (p: Pt) => {
    if (pts.length) {
      const q = pts[pts.length - 1]
      total += Math.hypot(p.x - q.x, p.y - q.y)
    }
    pts.push(p)
    cum.push(total)
  }
  for (let i = 0; i < order.length - 1; i++) {
    const a = ports[order[i]]?.out
    const b = ports[order[i + 1]]?.in
    if (!a || !b) return null
    if (i === 0) {
      nodeAt.push(0)
      push(a)
    }
    const dx = linkReach(a, b)
    const c1 = { x: a.x + dx, y: a.y }
    const c2 = { x: b.x - dx, y: b.y }
    for (let s = 1; s <= 28; s++) push(cubic(a, c1, c2, b, s / 28))
    nodeAt.push(total)
    const next = ports[order[i + 1]]?.out
    if (next) push(next)
  }
  if (!pts.length) return null
  return { pts, cum, total, nodeAt }
}

/** Position along the track at arc length `s` (clamped). */
export function pointAt(track: Track, s: number): Pt {
  const { pts, cum } = track
  if (s <= 0) return pts[0]
  if (s >= track.total) return pts[pts.length - 1]
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= s) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo] || 1
  const t = (s - cum[lo]) / span
  return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * t, y: pts[lo].y + (pts[hi].y - pts[lo].y) * t }
}
