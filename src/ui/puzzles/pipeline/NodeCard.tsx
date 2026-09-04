import { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'

export interface NodeCardProps {
  node: { id: string; label: string; hint: string }
  /** Grid slot (for the entry stagger). */
  slot: number
  isStart: boolean
  isEnd: boolean
  /** 1-based step number once the node is part of the wired chain, else null. */
  step: number | null
  linkedIn: boolean
  linkedOut: boolean
  /** Its output port is selected (click-click mode). */
  armed: boolean
  /** A drag is hovering over it as the drop target. */
  hot: boolean
  hinting: boolean
  /** Increment to shake the card. */
  shakeN: number
  /** Deployed / solved: no interaction. */
  done: boolean
  cardRef: (id: string, el: HTMLDivElement | null) => void
  onOutDown: (e: React.PointerEvent<HTMLDivElement>, id: string) => void
  onTargetUp: (e: React.PointerEvent<HTMLDivElement>, id: string) => void
}

export function NodeCard({ node, slot, isStart, isEnd, step, linkedIn, linkedOut, armed, hot, hinting, shakeN, done, cardRef, onOutDown, onTargetUp }: NodeCardProps) {
  const shake = useAnimationControls()
  useEffect(() => {
    if (!shakeN) return
    void shake.start({ x: [0, -9, 9, -6, 6, -3, 0], transition: { duration: 0.42, ease: 'easeOut' } })
  }, [shakeN, shake])

  const linked = linkedIn || linkedOut
  const cls = ['pp-card', linked && 'linked', hot && !done && 'target', hinting && 'hinting', done && 'done'].filter(Boolean).join(' ')
  const chip = step !== null ? `STEP ${step}` : isStart ? 'START' : isEnd ? 'FINISH' : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.06 + slot * 0.055 }}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <motion.div
        ref={(el) => cardRef(node.id, el)}
        className={cls}
        data-node={node.id}
        animate={shake}
        onPointerDown={(e) => onOutDown(e, node.id)}
        onPointerUp={(e) => onTargetUp(e, node.id)}
      >
        {chip && (
          <motion.span
            key={chip}
            className={`pp-chip${step !== null || isStart ? ' accent' : ''}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            {chip}
          </motion.span>
        )}
        <div className="pp-label">{node.label}</div>
        <div className="pp-hint">{node.hint}</div>
        {!isStart && (
          <div
            className={['pp-port in', linkedIn && 'linked', hot && !done && 'hot', done && 'done'].filter(Boolean).join(' ')}
            data-port="in"
            title="input"
            onPointerUp={(e) => onTargetUp(e, node.id)}
          />
        )}
        {!isEnd && (
          <div
            className={['pp-port out', linkedOut && 'linked', armed && 'armed', done && 'done'].filter(Boolean).join(' ')}
            data-port="out"
            title="output — drag to the next step"
          />
        )}
      </motion.div>
    </motion.div>
  )
}
