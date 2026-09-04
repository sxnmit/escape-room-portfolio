import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHAMBER_ORDER, CHAMBERS, type ChamberId } from '@/data/resume'

export type Overlay =
  | { kind: 'intro' }
  | { kind: 'menu' }
  | { kind: 'puzzle'; chamber: ChamberId }
  | { kind: 'briefing'; chamber: ChamberId }
  | { kind: 'resume'; chamber: ChamberId }
  | { kind: 'about' }
  | null

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'locked'
}

export interface Banner {
  id: number
  numeral: string
  title: string
  subtitle: string
  accent: string
}

export interface GameState {
  // ── progression (persisted) ──────────────────────────────────────────────
  solved: Partial<Record<ChamberId, boolean>>
  revealed: Partial<Record<ChamberId, boolean>>
  openedDoors: Record<string, boolean>
  /** Free-form persisted flags for in-world puzzle pieces, e.g. "lamp:y1". */
  flags: Record<string, boolean>
  finished: boolean
  muted: boolean
  fx: boolean

  // ── session ───────────────────────────────────────────────────────────────
  started: boolean
  overlay: Overlay
  nearestId: string | null
  nearestPrompt: string
  toast: Toast | null
  banner: Banner | null
  /** Incremented to trigger a character celebration animation. */
  celebrate: number
  /** Incremented to ask the player controller to teleport. */
  teleport: { x: number; z: number; yaw?: number; n: number } | null
  /** Which chamber (if any) the player is currently inside; null = hub / corridor. */
  currentRoom: ChamberId | 'about' | 'hub'

  // ── actions ───────────────────────────────────────────────────────────────
  start: () => void
  openOverlay: (o: Exclude<Overlay, null>) => void
  closeOverlay: () => void
  solve: (id: ChamberId) => void
  reveal: (id: ChamberId) => void
  openDoor: (doorId: string) => void
  setFlag: (key: string, value: boolean) => void
  setNearest: (id: string | null, prompt?: string) => void
  showToast: (text: string, tone?: Toast['tone']) => void
  clearToast: () => void
  showBanner: (b: Omit<Banner, 'id'>) => void
  clearBanner: () => void
  triggerCelebrate: () => void
  requestTeleport: (x: number, z: number, yaw?: number) => void
  setCurrentRoom: (room: GameState['currentRoom']) => void
  finish: () => void
  toggleMute: () => void
  toggleFx: () => void
  resetProgress: () => void
}

let toastCounter = 0
let bannerCounter = 0
let teleportCounter = 0

const initialProgress = {
  solved: {},
  revealed: {},
  openedDoors: {},
  flags: {},
  finished: false,
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialProgress,
      muted: false,
      fx: true,

      started: false,
      overlay: { kind: 'intro' },
      nearestId: null,
      nearestPrompt: '',
      toast: null,
      banner: null,
      celebrate: 0,
      teleport: null,
      currentRoom: 'hub',

      start: () => set({ started: true, overlay: null }),
      openOverlay: (o) => set({ overlay: o }),
      closeOverlay: () => set({ overlay: null }),

      solve: (id) => {
        if (get().solved[id]) return
        set((s) => ({ solved: { ...s.solved, [id]: true }, celebrate: s.celebrate + 1 }))
      },
      reveal: (id) => {
        if (get().revealed[id]) return
        set((s) => ({ revealed: { ...s.revealed, [id]: true } }))
      },
      openDoor: (doorId) => set((s) => ({ openedDoors: { ...s.openedDoors, [doorId]: true } })),
      setFlag: (key, value) => set((s) => ({ flags: { ...s.flags, [key]: value } })),

      setNearest: (id, prompt = '') => {
        const s = get()
        if (s.nearestId === id && s.nearestPrompt === prompt) return
        set({ nearestId: id, nearestPrompt: prompt })
      },

      showToast: (text, tone = 'info') => set({ toast: { id: ++toastCounter, text, tone } }),
      clearToast: () => set({ toast: null }),
      showBanner: (b) => set({ banner: { ...b, id: ++bannerCounter } }),
      clearBanner: () => set({ banner: null }),

      triggerCelebrate: () => set((s) => ({ celebrate: s.celebrate + 1 })),
      requestTeleport: (x, z, yaw) => set({ teleport: { x, z, yaw, n: ++teleportCounter } }),
      setCurrentRoom: (room) => {
        if (get().currentRoom !== room) set({ currentRoom: room })
      },
      finish: () => set({ finished: true }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),
      toggleFx: () => set((s) => ({ fx: !s.fx })),
      resetProgress: () =>
        set({ ...initialProgress, overlay: null, toast: null, banner: null, currentRoom: 'hub' }),
    }),
    {
      name: 'sunny-vault-progress-v1',
      partialize: (s) => ({
        solved: s.solved,
        revealed: s.revealed,
        openedDoors: s.openedDoors,
        flags: s.flags,
        finished: s.finished,
        muted: s.muted,
        fx: s.fx,
      }),
    },
  ),
)

// ─── Selectors / derived helpers ──────────────────────────────────────────────

export const chamberIndex = (id: ChamberId) => CHAMBER_ORDER.indexOf(id)

/** A chamber door is unlocked when the previous chamber's vault has been revealed. */
export function isChamberUnlocked(s: Pick<GameState, 'revealed'>, id: ChamberId): boolean {
  const i = chamberIndex(id)
  if (i <= 0) return true
  return !!s.revealed[CHAMBER_ORDER[i - 1]]
}

/** Why a chamber is locked, phrased for the player. */
export function lockReason(s: Pick<GameState, 'revealed' | 'solved'>, id: ChamberId): string {
  const i = chamberIndex(id)
  if (i <= 0) return ''
  const prev = CHAMBERS[CHAMBER_ORDER[i - 1]]
  if (s.solved[prev.id] && !s.revealed[prev.id]) return `Sealed — open the ${prev.name} vault in the hub first.`
  return `Sealed — complete Chamber ${prev.numeral} · ${prev.name} first.`
}

export const isFinalUnlocked = (s: Pick<GameState, 'revealed'>) => CHAMBER_ORDER.every((c) => !!s.revealed[c])

/** The chamber the player should be working on right now (null when everything is done). */
export function nextChamber(s: Pick<GameState, 'revealed'>): ChamberId | null {
  return CHAMBER_ORDER.find((c) => !s.revealed[c]) ?? null
}

/** Human-readable objective for the HUD. */
export function currentObjective(s: Pick<GameState, 'revealed' | 'solved' | 'finished'>): string {
  const next = nextChamber(s)
  if (!next) return s.finished ? 'You’ve seen it all. Wander freely — or start over from the menu.' : 'Every vault is open. The final door has unsealed.'
  const c = CHAMBERS[next]
  if (s.solved[next]) return `Return to the hub and open the ${c.name} vault.`
  return `Enter Chamber ${c.numeral} · ${c.name} and solve its puzzle.`
}

export const progressCount = (s: Pick<GameState, 'revealed'>) => CHAMBER_ORDER.filter((c) => !!s.revealed[c]).length
