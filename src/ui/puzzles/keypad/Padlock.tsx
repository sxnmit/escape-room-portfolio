import { motion } from 'framer-motion'

const MINT = '#7cf5c4'

/**
 * SVG padlock. When `open` flips true the shackle dips (anticipation) and then
 * springs up and out with a little overshoot, the body turns mint and glows.
 */
export function Padlock({ open, accent, size = 56 }: { open: boolean; accent: string; size?: number }) {
  const color = open ? MINT : accent
  return (
    <motion.svg
      viewBox="0 0 64 80"
      width={size}
      height={(size * 80) / 64}
      initial={false}
      animate={{ filter: open ? `drop-shadow(0 0 8px ${MINT}) drop-shadow(0 0 20px ${MINT}99)` : `drop-shadow(0 0 5px ${accent}55)` }}
      transition={{ duration: 0.6 }}
      style={{ overflow: 'visible', display: 'block' }}
      data-open={open ? '1' : '0'}
      aria-hidden
    >
      <motion.path
        d="M20 40 V27 a12 12 0 0 1 24 0 V40"
        fill="none"
        strokeWidth={6}
        strokeLinecap="round"
        initial={false}
        animate={open ? { y: [0, 4, -16], rotate: [0, 0, -16], stroke: MINT } : { y: 0, rotate: 0, stroke: accent }}
        transition={open ? { duration: 0.8, times: [0, 0.32, 1], ease: ['easeIn', 'backOut'] } : { duration: 0.4 }}
        style={{ originX: 1, originY: 1 }}
      />
      <motion.rect x={10} y={38} width={44} height={34} rx={9} fill="#141a2c" strokeWidth={2.5} initial={false} animate={{ stroke: color }} transition={{ duration: 0.5 }} />
      <motion.circle cx={32} cy={53} r={4.2} initial={false} animate={{ fill: color }} transition={{ duration: 0.5 }} />
      <motion.rect x={30.2} y={55} width={3.6} height={9} rx={1.8} initial={false} animate={{ fill: color }} transition={{ duration: 0.5 }} />
    </motion.svg>
  )
}
