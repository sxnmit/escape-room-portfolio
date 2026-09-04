import * as THREE from 'three'
import { CHAMBER_ORDER, type ChamberId } from '@/data/resume'

/**
 * World geometry. Everything is derived from a few constants so the whole map
 * can be re-tuned from here.
 *
 * Conventions: +y up. A polar angle θ (degrees) maps to world
 *   x = r·cos θ,  z = −r·sin θ
 * so θ = 90° is "north" (−z), the direction the player faces at spawn.
 */

export const DEG = Math.PI / 180

// ── Hub ───────────────────────────────────────────────────────────────────────
export const HUB_SIDES = 12
export const HUB_RADIUS = 13 // circumradius of the 12-gon
export const HUB_APOTHEM = HUB_RADIUS * Math.cos(Math.PI / HUB_SIDES)
export const HUB_FACE_LENGTH = 2 * HUB_RADIUS * Math.sin(Math.PI / HUB_SIDES)
export const HUB_WALL_HEIGHT = 5.5

// ── Shared dims ───────────────────────────────────────────────────────────────
export const WALL_T = 0.6
export const WALL_H = 4.5
export const DOOR_W = 3.6
export const DOOR_H = 3.4
export const CORRIDOR_LEN = 7
export const CORRIDOR_W = 4
export const ROOM_SIZE = 16

// ── Angles ────────────────────────────────────────────────────────────────────
export const FINAL_ANGLE = 90
/** Chambers march clockwise from the final door: NE, SE, S, SW, NW. */
export const CHAMBER_ANGLES: Record<ChamberId, number> = {
  scotiabank: 30,
  chalk: 330,
  tetratech: 270,
  insightai: 210,
  mcmaster: 150,
}
/** Each chamber's resume vault sits on the solid hub face clockwise of its door. */
export const VAULT_ANGLES: Record<ChamberId, number> = {
  scotiabank: 0,
  chalk: 300,
  tetratech: 240,
  insightai: 180,
  mcmaster: 120,
}
/** The one solid face with nothing on it: a title plaque lives here. */
export const PLAQUE_ANGLE = 60

export const SPAWN = { x: 0, z: 2.5, yaw: 0 }

// ── Helpers ───────────────────────────────────────────────────────────────────
export function polar(thetaDeg: number, r: number): [number, number] {
  const t = thetaDeg * DEG
  return [r * Math.cos(t), -r * Math.sin(t)]
}

/** Rotation.y for a group whose local −z should point outward at angle θ. */
export function outwardRotationY(thetaDeg: number) {
  return (thetaDeg - 90) * DEG
}

/** Rotation.y for a group whose local +z should point outward at angle θ (i.e. faces the hub with −z). */
export function inwardRotationY(thetaDeg: number) {
  return (thetaDeg + 90) * DEG
}

export interface Frame {
  /** World position of the frame origin. */
  origin: THREE.Vector3
  /** rotation.y such that local −z points outward from the hub centre. */
  rotationY: number
  thetaDeg: number
}

export function faceFrame(thetaDeg: number, r = HUB_APOTHEM): Frame {
  const [x, z] = polar(thetaDeg, r)
  return { origin: new THREE.Vector3(x, 0, z), rotationY: outwardRotationY(thetaDeg), thetaDeg }
}

/** Convert a local point in a frame (−z = outward, +x = clockwise-right) to world. */
export function frameToWorld(f: Frame, local: [number, number, number]): THREE.Vector3 {
  const v = new THREE.Vector3(...local)
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rotationY)
  return v.add(f.origin)
}

// ── Spokes (corridor + room) ──────────────────────────────────────────────────
export interface Spoke {
  id: ChamberId | 'about'
  frame: Frame
  /** Local z of the room's near wall (negative). */
  roomNearZ: number
  roomFarZ: number
  roomCenterLocal: [number, number, number]
  roomCenterWorld: THREE.Vector3
  /** Local position for the chamber's main puzzle object, near the back wall, facing the hub. */
  puzzleAnchorLocal: [number, number, number]
}

function makeSpoke(id: Spoke['id'], thetaDeg: number): Spoke {
  const frame = faceFrame(thetaDeg)
  const roomNearZ = -CORRIDOR_LEN
  const roomFarZ = -CORRIDOR_LEN - ROOM_SIZE
  const roomCenterLocal: [number, number, number] = [0, 0, -CORRIDOR_LEN - ROOM_SIZE / 2]
  return {
    id,
    frame,
    roomNearZ,
    roomFarZ,
    roomCenterLocal,
    roomCenterWorld: frameToWorld(frame, roomCenterLocal),
    puzzleAnchorLocal: [0, 0, roomFarZ + 3],
  }
}

export const SPOKES: Record<ChamberId | 'about', Spoke> = {
  scotiabank: makeSpoke('scotiabank', CHAMBER_ANGLES.scotiabank),
  chalk: makeSpoke('chalk', CHAMBER_ANGLES.chalk),
  tetratech: makeSpoke('tetratech', CHAMBER_ANGLES.tetratech),
  insightai: makeSpoke('insightai', CHAMBER_ANGLES.insightai),
  mcmaster: makeSpoke('mcmaster', CHAMBER_ANGLES.mcmaster),
  about: makeSpoke('about', FINAL_ANGLE),
}

export const CHAMBER_SPOKES = CHAMBER_ORDER.map((id) => SPOKES[id])

// ── Wall segments (world-space boxes) ─────────────────────────────────────────
export interface WallSeg {
  position: [number, number, number]
  rotationY: number
  /** Full size: length (along local x), height, thickness. */
  size: [number, number, number]
  kind: 'hub' | 'corridor' | 'room' | 'lintel'
  room?: ChamberId | 'about'
}

function segInFrame(
  f: Frame,
  local: [number, number, number],
  size: [number, number, number],
  kind: WallSeg['kind'],
  room?: ChamberId | 'about',
): WallSeg {
  const p = frameToWorld(f, local)
  return { position: [p.x, p.y, p.z], rotationY: f.rotationY, size, kind, room }
}

export type HubFaceKind = 'solid' | 'chamber' | 'final' | 'vault' | 'plaque'
export interface HubFace {
  thetaDeg: number
  kind: HubFaceKind
  chamber?: ChamberId
  frame: Frame
}

export const HUB_FACES: HubFace[] = Array.from({ length: HUB_SIDES }, (_, i) => {
  const thetaDeg = i * (360 / HUB_SIDES)
  let kind: HubFaceKind = 'solid'
  let chamber: ChamberId | undefined
  if (thetaDeg === FINAL_ANGLE) kind = 'final'
  else if (thetaDeg === PLAQUE_ANGLE) kind = 'plaque'
  for (const id of CHAMBER_ORDER) {
    if (CHAMBER_ANGLES[id] === thetaDeg) {
      kind = 'chamber'
      chamber = id
    }
    if (VAULT_ANGLES[id] === thetaDeg) {
      kind = 'vault'
      chamber = id
    }
  }
  return { thetaDeg, kind, chamber, frame: faceFrame(thetaDeg) }
})

export function buildWalls(): WallSeg[] {
  const segs: WallSeg[] = []
  const L = HUB_FACE_LENGTH
  const H = HUB_WALL_HEIGHT

  for (const face of HUB_FACES) {
    const f = face.frame
    if (face.kind === 'chamber' || face.kind === 'final') {
      const side = (L - DOOR_W) / 2
      const cx = DOOR_W / 2 + side / 2
      segs.push(segInFrame(f, [-cx, H / 2, 0], [side + 0.02, H, WALL_T], 'hub'))
      segs.push(segInFrame(f, [cx, H / 2, 0], [side + 0.02, H, WALL_T], 'hub'))
      const lintelH = H - DOOR_H
      segs.push(segInFrame(f, [0, DOOR_H + lintelH / 2, 0], [DOOR_W + 0.04, lintelH, WALL_T], 'lintel'))
    } else {
      segs.push(segInFrame(f, [0, H / 2, 0], [L + 0.02, H, WALL_T], 'hub'))
    }
  }

  for (const spoke of Object.values(SPOKES)) {
    const f = spoke.frame
    const room = spoke.id
    // corridor side walls
    const cLen = CORRIDOR_LEN + WALL_T
    for (const sgn of [-1, 1]) {
      const p = frameToWorld(f, [sgn * (CORRIDOR_W / 2 + WALL_T / 2), WALL_H / 2, -CORRIDOR_LEN / 2])
      segs.push({
        position: [p.x, p.y, p.z],
        rotationY: f.rotationY + Math.PI / 2,
        size: [cLen, WALL_H, WALL_T],
        kind: 'corridor',
        room,
      })
    }
    // room near wall (two pieces flanking the corridor opening)
    const nearSide = (ROOM_SIZE - CORRIDOR_W) / 2
    const nearCx = CORRIDOR_W / 2 + nearSide / 2
    for (const sgn of [-1, 1]) {
      segs.push(segInFrame(f, [sgn * nearCx, WALL_H / 2, spoke.roomNearZ], [nearSide + WALL_T, WALL_H, WALL_T], 'room', room))
    }
    // room side walls
    for (const sgn of [-1, 1]) {
      const p = frameToWorld(f, [sgn * (ROOM_SIZE / 2), WALL_H / 2, spoke.roomCenterLocal[2]])
      segs.push({
        position: [p.x, p.y, p.z],
        rotationY: f.rotationY + Math.PI / 2,
        size: [ROOM_SIZE + WALL_T, WALL_H, WALL_T],
        kind: 'room',
        room,
      })
    }
    // room far wall
    segs.push(segInFrame(f, [0, WALL_H / 2, spoke.roomFarZ], [ROOM_SIZE + WALL_T, WALL_H, WALL_T], 'room', room))
  }

  return segs
}

export const WALLS = buildWalls()

/** Which room a world point is in (for HUD / minimap). */
export function roomAt(x: number, z: number): ChamberId | 'about' | 'hub' {
  const r = Math.hypot(x, z)
  if (r < HUB_APOTHEM - 0.2) return 'hub'
  for (const spoke of Object.values(SPOKES)) {
    const local = worldToFrame(spoke.frame, x, z)
    const half = ROOM_SIZE / 2 + 0.5
    if (local.x > -half && local.x < half && local.z < 0.5 && local.z > spoke.roomFarZ - 0.5) return spoke.id
  }
  return 'hub'
}

export function worldToFrame(f: Frame, x: number, z: number) {
  const v = new THREE.Vector3(x - f.origin.x, 0, z - f.origin.z)
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -f.rotationY)
  return { x: v.x, z: v.z }
}
