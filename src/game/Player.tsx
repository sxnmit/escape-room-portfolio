import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { useGame } from '@/state/gameStore'
import { findNearest, interactWith } from '@/state/interactables'
import { spawnBurst } from './fx/Burst'
import { SPAWN, roomAt } from './world/layout'
import { Character, type CharacterAnim } from './Character'
import { sfx } from '@/audio/sfx'

export enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  run = 'run',
  interact = 'interact',
  camLeft = 'camLeft',
  camRight = 'camRight',
  camUp = 'camUp',
  camDown = 'camDown',
}

export const KEY_MAP = [
  { name: Controls.forward, keys: ['KeyW'] },
  { name: Controls.backward, keys: ['KeyS'] },
  { name: Controls.left, keys: ['KeyA'] },
  { name: Controls.right, keys: ['KeyD'] },
  { name: Controls.run, keys: ['ShiftLeft', 'ShiftRight'] },
  { name: Controls.interact, keys: ['KeyE'] },
  { name: Controls.camLeft, keys: ['ArrowLeft'] },
  { name: Controls.camRight, keys: ['ArrowRight'] },
  { name: Controls.camUp, keys: ['ArrowUp'] },
  { name: Controls.camDown, keys: ['ArrowDown'] },
]

const WALK_SPEED = 5
const RUN_SPEED = 8.2
const CAM_DIST_DEFAULT = 8.5
const CAM_DIST_MIN = 4
const CAM_DIST_MAX = 13
const PITCH_MIN = 0.22
const PITCH_MAX = 1.25

/** Exponential damping toward a target angle along the shortest arc. */
function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const TAU = Math.PI * 2
  const diff = ((((target - current + Math.PI) % TAU) + TAU) % TAU) - Math.PI
  return current + diff * (1 - Math.exp(-lambda * dt))
}

/** Shared, mutable snapshot of where the player is — read by minimap / debug, never rendered reactively. */
export const playerSnapshot = {
  position: new THREE.Vector3(SPAWN.x, 0, SPAWN.z),
  heading: 0,
  cameraYaw: 0,
  /** diagnostics for the automation harness */
  debug: { frames: 0, ix: 0, iz: 0, paused: true, vx: 0, vz: 0 },
  /** set by the Player so automation can steer the camera (movement is camera-relative) */
  setYaw: (_yaw: number) => {},
}

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const [, getKeys] = useKeyboardControls<Controls>()

  const anim = useRef<CharacterAnim>({ speed: 0, running: false, moving: false, celebrateAt: -10, time: 0, lookAt: null })
  const cam = useRef({ yaw: SPAWN.yaw, pitch: 0.62, dist: CAM_DIST_DEFAULT, dragging: false, lastX: 0, lastY: 0 })
  const heading = useRef(SPAWN.yaw + Math.PI)
  const vel = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3(SPAWN.x, 1.2, SPAWN.z))
  const frame = useRef(0)
  const lastCelebrate = useRef(0)

  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  // ── mouse orbit / wheel zoom on the canvas ──────────────────────────────
  useEffect(() => {
    const el = gl.domElement
    const c = cam.current
    const onDown = (e: PointerEvent) => {
      if (useGame.getState().overlay) return
      c.dragging = true
      c.lastX = e.clientX
      c.lastY = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!c.dragging) return
      const dx = e.clientX - c.lastX
      const dy = e.clientY - c.lastY
      c.lastX = e.clientX
      c.lastY = e.clientY
      c.yaw -= dx * 0.0055
      c.pitch = THREE.MathUtils.clamp(c.pitch + dy * 0.004, PITCH_MIN, PITCH_MAX)
    }
    const onUp = (e: PointerEvent) => {
      c.dragging = false
      try {
        el.releasePointerCapture?.(e.pointerId)
      } catch {
        /* noop */
      }
    }
    const onWheel = (e: WheelEvent) => {
      if (useGame.getState().overlay) return
      c.dist = THREE.MathUtils.clamp(c.dist + e.deltaY * 0.01, CAM_DIST_MIN, CAM_DIST_MAX)
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  // ── E to interact (edge-triggered) ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const s = useGame.getState()
      if (!s.started || s.overlay) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
        if (s.nearestId) {
          e.preventDefault()
          interactWith(s.nearestId)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── teleport requests (debug / respawn) ─────────────────────────────────
  const teleport = useGame((s) => s.teleport)
  useEffect(() => {
    if (!teleport || !body.current) return
    body.current.setTranslation({ x: teleport.x, y: 0.6, z: teleport.z }, true)
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    if (teleport.yaw !== undefined) {
      cam.current.yaw = teleport.yaw
      heading.current = teleport.yaw + Math.PI
    }
    lookTarget.current.set(teleport.x, 1.2, teleport.z)
  }, [teleport])

  // ── celebrate trigger from the store ────────────────────────────────────
  const celebrate = useGame((s) => s.celebrate)
  useEffect(() => {
    if (celebrate !== lastCelebrate.current) {
      const first = lastCelebrate.current === 0
      lastCelebrate.current = celebrate
      if (first && celebrate === 0) return
      anim.current.celebrateAt = anim.current.time
      const p = playerSnapshot.position
      spawnBurst([p.x, p.y + 1.2, p.z], '#ffd166')
    }
  }, [celebrate])

  // initial camera placement + automation hook
  useEffect(() => {
    camera.position.set(SPAWN.x, 5, SPAWN.z + 8)
    camera.lookAt(SPAWN.x, 1.2, SPAWN.z)
    playerSnapshot.setYaw = (yaw: number) => {
      cam.current.yaw = yaw
    }
  }, [camera])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)
    const b = body.current
    if (!b) return
    const s = useGame.getState()
    const paused = !s.started || !!s.overlay
    const keys = getKeys()
    const c = cam.current
    anim.current.time += delta

    // camera keyboard orbit
    if (!paused) {
      if (keys.camLeft) c.yaw += 1.8 * delta
      if (keys.camRight) c.yaw -= 1.8 * delta
      if (keys.camUp) c.pitch = THREE.MathUtils.clamp(c.pitch - 1.2 * delta, PITCH_MIN, PITCH_MAX)
      if (keys.camDown) c.pitch = THREE.MathUtils.clamp(c.pitch + 1.2 * delta, PITCH_MIN, PITCH_MAX)
    }

    // ── movement ──────────────────────────────────────────────────────────
    let ix = 0
    let iz = 0
    if (!paused) {
      if (keys.forward) iz += 1
      if (keys.backward) iz -= 1
      if (keys.left) ix -= 1
      if (keys.right) ix += 1
    }
    const moving = ix !== 0 || iz !== 0
    const running = moving && !!keys.run
    const speed = running ? RUN_SPEED : WALK_SPEED

    // camera-relative basis
    const sinY = Math.sin(c.yaw)
    const cosY = Math.cos(c.yaw)
    // forward = away from camera (horizontal), right = perpendicular
    const fx = -sinY
    const fz = -cosY
    const rx = cosY
    const rz = -sinY

    let mx = fx * iz + rx * ix
    let mz = fz * iz + rz * ix
    const len = Math.hypot(mx, mz)
    if (len > 0) {
      mx /= len
      mz /= len
    }

    const target = tmp.dir.set(mx * speed, 0, mz * speed)
    // acceleration / deceleration feel
    const accel = moving ? 14 : 18
    vel.current.x = THREE.MathUtils.damp(vel.current.x, target.x, accel, delta)
    vel.current.z = THREE.MathUtils.damp(vel.current.z, target.z, accel, delta)
    if (!moving && Math.abs(vel.current.x) < 0.02 && Math.abs(vel.current.z) < 0.02) {
      vel.current.x = 0
      vel.current.z = 0
    }

    const lv = b.linvel()
    b.setLinvel({ x: vel.current.x, y: lv.y, z: vel.current.z }, true)

    // fell off the world? (should never happen, but be safe)
    const t = b.translation()
    if (t.y < -8) {
      b.setTranslation({ x: SPAWN.x, y: 0.6, z: SPAWN.z }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
    tmp.pos.set(t.x, t.y, t.z)

    // facing
    if (moving) {
      const targetHeading = Math.atan2(mx, mz)
      heading.current = dampAngle(heading.current, targetHeading, 14, delta)
    }

    // character animation state
    const hs = Math.hypot(vel.current.x, vel.current.z)
    anim.current.speed = THREE.MathUtils.clamp(hs / RUN_SPEED, 0, 1)
    anim.current.moving = hs > 0.15
    anim.current.running = running

    // ── camera ────────────────────────────────────────────────────────────
    const target3 = tmp.target.set(t.x, t.y + 1.25, t.z)
    easing.damp3(lookTarget.current, target3, 0.08, delta)
    const cp = Math.cos(c.pitch)
    tmp.offset.set(c.dist * cp * sinY, c.dist * Math.sin(c.pitch), c.dist * cp * cosY)
    let dist = c.dist
    // pull the camera in when a wall sits between it and the player
    const dirN = tmp.dir.copy(tmp.offset).normalize()
    const ray = new rapier.Ray({ x: target3.x, y: target3.y, z: target3.z }, { x: dirN.x, y: dirN.y, z: dirN.z })
    const hit = world.castRay(
      ray,
      c.dist,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
      undefined,
      undefined,
      b,
    )
    if (hit) {
      const toi = (hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi
      dist = Math.max(1.6, toi - 0.35)
    }
    tmp.desired.copy(target3).addScaledVector(dirN, dist)
    easing.damp3(camera.position, tmp.desired, hit ? 0.05 : 0.11, delta)
    camera.lookAt(lookTarget.current)

    // ── snapshot + nearest interactable + room tracking ───────────────────
    playerSnapshot.position.copy(tmp.pos)
    playerSnapshot.heading = heading.current
    playerSnapshot.cameraYaw = c.yaw
    playerSnapshot.debug.frames++
    playerSnapshot.debug.ix = ix
    playerSnapshot.debug.iz = iz
    playerSnapshot.debug.paused = paused
    playerSnapshot.debug.vx = vel.current.x
    playerSnapshot.debug.vz = vel.current.z

    frame.current++
    if (frame.current % 3 === 0) {
      if (paused && s.overlay?.kind !== 'briefing') {
        // keep the prompt hidden while an overlay is up
        if (s.nearestId) s.setNearest(null)
        anim.current.lookAt = null
      } else {
        const near = findNearest(tmp.pos)
        if (near) {
          const p = typeof near.prompt === 'function' ? near.prompt() : near.prompt
          s.setNearest(near.id, p)
          anim.current.lookAt = near.position
        } else {
          anim.current.lookAt = null
          if (s.nearestId) s.setNearest(null)
        }
      }
    }
    if (frame.current % 12 === 0) {
      s.setCurrentRoom(roomAt(t.x, t.z))
    }
  })

  // footsteps
  const stepTimer = useRef(0)
  useFrame((_, delta) => {
    const a = anim.current
    if (!a.moving) {
      stepTimer.current = 0
      return
    }
    stepTimer.current += delta * (a.running ? 3.6 : 2.6)
    if (stepTimer.current >= 1) {
      stepTimer.current = 0
      sfx.play('step')
    }
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      type="dynamic"
      position={[SPAWN.x, 0.6, SPAWN.z]}
      enabledRotations={[false, false, false]}
      linearDamping={0}
      angularDamping={0}
      friction={0}
      restitution={0}
      ccd
      userData={{ player: true }}
      name="player"
    >
      <CapsuleCollider args={[0.45, 0.35]} position={[0, 0.8, 0]} friction={0} />
      <Character anim={anim} headingRef={heading} />
    </RigidBody>
  )
}
