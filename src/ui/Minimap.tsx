import { useEffect, useRef } from 'react'
import { CHAMBERS, CHAMBER_ORDER } from '@/data/resume'
import { useGame } from '@/state/gameStore'
import { CHAMBER_ANGLES, CORRIDOR_LEN, FINAL_ANGLE, HUB_APOTHEM, HUB_RADIUS, ROOM_SIZE, VAULT_ANGLES, polar } from '@/game/world/layout'
import { playerSnapshot } from '@/game/Player'

const SIZE = 150
const WORLD_R = HUB_APOTHEM + CORRIDOR_LEN + ROOM_SIZE + 2
const K = SIZE / 2 / WORLD_R

function w2m(x: number, z: number): [number, number] {
  return [SIZE / 2 + x * K, SIZE / 2 + z * K]
}

/** Tiny SVG map: hub, spokes, vault dots, the player as an arrow. */
export function Minimap() {
  const solved = useGame((s) => s.solved)
  const revealed = useGame((s) => s.revealed)
  const finished = useGame((s) => s.finished)
  const arrow = useRef<SVGGElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (arrow.current) {
        const p = playerSnapshot.position
        const [mx, my] = w2m(p.x, p.z)
        const deg = 180 - (playerSnapshot.heading * 180) / Math.PI
        arrow.current.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${deg.toFixed(1)})`)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const rooms = [...CHAMBER_ORDER.map((id) => ({ id, angle: CHAMBER_ANGLES[id], accent: CHAMBERS[id].accent })), { id: 'about' as const, angle: FINAL_ANGLE, accent: '#ffd166' }]

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="panel" style={{ borderRadius: 16, display: 'block' }}>
      {/* hub */}
      <circle cx={SIZE / 2} cy={SIZE / 2} r={HUB_RADIUS * K} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" />
      {rooms.map((r) => {
        const [cx, cz] = polar(r.angle, HUB_APOTHEM + CORRIDOR_LEN + ROOM_SIZE / 2)
        const [ax, az] = polar(r.angle, HUB_APOTHEM)
        const [bx, bz] = polar(r.angle, HUB_APOTHEM + CORRIDOR_LEN)
        const [mx, my] = w2m(cx, cz)
        const [a1, a2] = w2m(ax, az)
        const [b1, b2] = w2m(bx, bz)
        const done = r.id === 'about' ? finished : !!revealed[r.id]
        const half = !done && r.id !== 'about' && !!solved[r.id]
        const s = ROOM_SIZE * K
        return (
          <g key={r.id}>
            <line x1={a1} y1={a2} x2={b1} y2={b2} stroke="rgba(255,255,255,0.3)" strokeWidth={3} />
            <g transform={`translate(${mx} ${my}) rotate(${-r.angle + 90})`}>
              <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={2} fill={done ? r.accent : half ? `${r.accent}66` : 'rgba(255,255,255,0.08)'} stroke={r.accent} strokeWidth={1} opacity={done ? 0.9 : 0.8} />
            </g>
          </g>
        )
      })}
      {CHAMBER_ORDER.map((id) => {
        const [vx, vz] = polar(VAULT_ANGLES[id], HUB_APOTHEM - 1.6)
        const [mx, my] = w2m(vx, vz)
        return <circle key={id} cx={mx} cy={my} r={2.6} fill={solved[id] ? CHAMBERS[id].accent : 'rgba(255,255,255,0.2)'} />
      })}
      <g ref={arrow}>
        <polygon points="0,-5 4,4 0,2 -4,4" fill="#ffffff" stroke="#0b0e17" strokeWidth={0.8} />
      </g>
    </svg>
  )
}
