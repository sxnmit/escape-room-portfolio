import { useGame } from '@/state/gameStore'

/**
 * Tiny synthesised sound effects — no audio assets needed.
 * The AudioContext is created lazily on the first user gesture.
 */
type SfxName = 'step' | 'blip' | 'open' | 'unlock' | 'locked' | 'success' | 'error' | 'lamp' | 'place' | 'ui' | 'vault' | 'type'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.35
  master.connect(ctx.destination)
  return ctx
}

function tone(
  freq: number,
  {
    type = 'sine' as OscillatorType,
    dur = 0.12,
    gain = 0.5,
    at = 0,
    slide = 0,
    attack = 0.005,
  }: { type?: OscillatorType; dur?: number; gain?: number; at?: number; slide?: number; attack?: number } = {},
) {
  const c = ensure()
  if (!c || !master) return
  const o = c.createOscillator()
  const g = c.createGain()
  const t0 = c.currentTime + at
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise(dur = 0.08, gain = 0.15, at = 0) {
  const c = ensure()
  if (!c || !master) return
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = gain
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 900
  src.connect(f).connect(g).connect(master)
  src.start(c.currentTime + at)
}

let stepToggle = false

export const sfx = {
  /** Call on the first user gesture so the browser lets audio start. */
  unlock() {
    const c = ensure()
    if (c && c.state === 'suspended') void c.resume()
  },
  play(name: SfxName) {
    if (useGame.getState().muted) return
    const c = ensure()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    switch (name) {
      case 'step':
        stepToggle = !stepToggle
        noise(0.05, stepToggle ? 0.06 : 0.05)
        break
      case 'blip':
        tone(880, { dur: 0.06, gain: 0.2 })
        break
      case 'ui':
        tone(660, { dur: 0.05, gain: 0.15, type: 'triangle' })
        break
      case 'type':
        tone(1400 + Math.random() * 300, { dur: 0.025, gain: 0.08, type: 'square' })
        break
      case 'open':
        tone(220, { dur: 0.35, gain: 0.3, type: 'sawtooth', slide: 120 })
        noise(0.3, 0.08)
        break
      case 'unlock':
        tone(523, { dur: 0.12, gain: 0.3 })
        tone(659, { dur: 0.12, gain: 0.3, at: 0.1 })
        tone(784, { dur: 0.25, gain: 0.35, at: 0.2 })
        break
      case 'vault':
        tone(110, { dur: 0.6, gain: 0.35, type: 'sawtooth', slide: 60 })
        tone(392, { dur: 0.3, gain: 0.2, at: 0.45 })
        tone(587, { dur: 0.5, gain: 0.25, at: 0.6 })
        break
      case 'locked':
        tone(180, { dur: 0.15, gain: 0.3, type: 'square' })
        tone(150, { dur: 0.2, gain: 0.3, type: 'square', at: 0.16 })
        break
      case 'error':
        tone(200, { dur: 0.18, gain: 0.3, type: 'sawtooth', slide: -80 })
        break
      case 'success':
        ;[523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.22, gain: 0.3, at: i * 0.09, type: 'triangle' }))
        tone(1318, { dur: 0.6, gain: 0.25, at: 0.38 })
        break
      case 'lamp':
        tone(440, { dur: 0.25, gain: 0.25, type: 'triangle', slide: 220 })
        break
      case 'place':
        tone(330, { dur: 0.15, gain: 0.3, type: 'triangle' })
        tone(495, { dur: 0.2, gain: 0.25, at: 0.08, type: 'triangle' })
        break
    }
  },
}
