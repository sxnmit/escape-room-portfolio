import { CHAMBERS, TERMINAL_PUZZLE } from '@/data/resume'

/**
 * Pure command engine for the Chamber I terminal. No React, no DOM — every
 * command is a function of (engine state, input) → (lines to print, effects),
 * which keeps the overlay component thin and lets the logic be unit-tested.
 *
 * All puzzle copy (banner, files, password, shift, success lines) comes from
 * TERMINAL_PUZZLE in src/data/resume.ts; only shell chrome is defined here.
 */

export type LineTone =
  | 'default' // phosphor body text
  | 'muted' // dim helper text
  | 'banner' // boot banner headline (chamber accent)
  | 'cmd' // an echoed command (rendered with the prompt prefix)
  | 'error' // red
  | 'success' // mint/green
  | 'key' // bright highlight (a decrypted key)
  | 'warn' // amber
  | 'rule' // thin separator line

export interface Line {
  id: number
  text: string
  tone: LineTone
}

export type Effect = { kind: 'clear' } | { kind: 'unlock-ok' } | { kind: 'unlock-fail' } | { kind: 'exit' } | { kind: 'already-unsealed' }

export interface EngineState {
  hintLevel: number
  failures: number
  solved: boolean
}

export interface RunResult {
  lines: Omit<Line, 'id'>[]
  effects: Effect[]
  state: EngineState
}

export const PROMPT = `${TERMINAL_PUZZLE.user}@${TERMINAL_PUZZLE.hostname}:~$ `

export const FILE_NAMES = Object.keys(TERMINAL_PUZZLE.files)

interface CommandSpec {
  name: string
  usage: string
  blurb: string
  /** Hidden commands still run, but are not listed by `help`. */
  hidden?: boolean
}

export const COMMANDS: CommandSpec[] = [
  { name: 'help', usage: 'help', blurb: 'list the available commands' },
  { name: 'ls', usage: 'ls', blurb: 'list files in the home directory' },
  { name: 'cat', usage: 'cat <file>', blurb: 'print a file' },
  { name: 'decrypt', usage: 'decrypt <text|file> <shift>', blurb: 'rotate every letter back by <shift>' },
  { name: 'unlock', usage: 'unlock <key>', blurb: 'submit the release-vault key' },
  { name: 'hint', usage: 'hint', blurb: 'a nudge in the right direction' },
  { name: 'clear', usage: 'clear', blurb: 'wipe the screen' },
  { name: 'whoami', usage: 'whoami', blurb: 'print the current user' },
  { name: 'exit', usage: 'exit', blurb: 'close the terminal' },
  { name: 'pwd', usage: 'pwd', blurb: '', hidden: true },
  { name: 'sudo', usage: 'sudo', blurb: '', hidden: true },
  { name: 'echo', usage: 'echo', blurb: '', hidden: true },
]

const VISIBLE_COMMAND_NAMES = COMMANDS.filter((c) => !c.hidden).map((c) => c.name)

export function initialEngineState(solved: boolean): EngineState {
  return { hintLevel: 0, failures: 0, solved }
}

/** Caesar shift every A–Z / a–z letter BACK by `shift` places (other chars untouched). */
export function caesarBack(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 65 && code <= 90) out += String.fromCharCode(((code - 65 - s + 26) % 26) + 65)
    else if (code >= 97 && code <= 122) out += String.fromCharCode(((code - 97 - s + 26) % 26) + 97)
    else out += ch
  }
  return out
}

/** Case-insensitive file lookup; returns the canonical name or null. */
export function resolveFile(name: string): string | null {
  const lower = name.toLowerCase()
  return FILE_NAMES.find((f) => f.toLowerCase() === lower) ?? null
}

/** Split on whitespace, keeping it simple (no quoting — nothing here needs it). */
export function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean)
}

const L = (text: string, tone: LineTone = 'default'): Omit<Line, 'id'> => ({ text, tone })

/** Pad a usage column so help reads as a table. */
function padEnd(s: string, n: number) {
  return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length)
}

export function runCommand(state: EngineState, rawInput: string): RunResult {
  const lines: Omit<Line, 'id'>[] = []
  const effects: Effect[] = []
  let next = { ...state }
  const tokens = tokenize(rawInput)
  if (tokens.length === 0) return { lines, effects, state: next }

  const cmd = tokens[0].toLowerCase()
  const args = tokens.slice(1)

  switch (cmd) {
    case 'help': {
      lines.push(L('available commands', 'muted'))
      const width = Math.max(...COMMANDS.filter((c) => !c.hidden).map((c) => c.usage.length)) + 3
      for (const c of COMMANDS) {
        if (c.hidden) continue
        lines.push(L(`  ${padEnd(c.usage, width)}${c.blurb}`))
      }
      lines.push(L('  Tab completes commands & files · ↑/↓ recalls history', 'muted'))
      break
    }

    case 'ls': {
      lines.push(L(FILE_NAMES.join('   ')))
      break
    }

    case 'cat': {
      if (args.length === 0) {
        lines.push(L('usage: cat <file>', 'warn'))
        break
      }
      for (const a of args) {
        const f = resolveFile(a)
        if (!f) {
          lines.push(L(`cat: ${a}: No such file or directory`, 'error'))
          continue
        }
        for (const t of TERMINAL_PUZZLE.files[f]) lines.push(L(t, f === 'cipher.txt' ? 'key' : 'default'))
      }
      break
    }

    case 'decrypt': {
      const usage = () => {
        lines.push(L('usage: decrypt <text|file> <shift>', 'warn'))
        lines.push(L('       <shift> is a whole number — letters are rotated BACK by that many places', 'muted'))
      }
      if (args.length < 2) {
        usage()
        break
      }
      const shiftArg = args[args.length - 1]
      if (!/^-?\d+$/.test(shiftArg)) {
        usage()
        break
      }
      const shift = parseInt(shiftArg, 10)
      const subject = args.slice(0, -1)
      const file = subject.length === 1 ? resolveFile(subject[0]) : null
      const source = file ? TERMINAL_PUZZLE.files[file] : [subject.join(' ')]
      lines.push(L(`decrypt(${file ?? subject.join(' ')}, ${shift})`, 'muted'))
      let hitKey = false
      for (const t of source) {
        const plain = caesarBack(t, shift)
        lines.push(L(`  → ${plain}`, 'key'))
        if (plain.trim().toLowerCase() === TERMINAL_PUZZLE.password.toLowerCase()) hitKey = true
      }
      if (hitKey) lines.push(L(`that looks like a key.  try:  unlock ${caesarBack(source[0], shift).trim()}`, 'success'))
      break
    }

    case 'unlock': {
      if (args.length === 0) {
        lines.push(L('usage: unlock <key>', 'warn'))
        break
      }
      const key = args.join(' ')
      if (next.solved) {
        lines.push(L('release vault is already unsealed — nothing left to unlock here.', 'success'))
        effects.push({ kind: 'already-unsealed' })
        break
      }
      if (key.toLowerCase() === TERMINAL_PUZZLE.password.toLowerCase()) {
        next.solved = true
        effects.push({ kind: 'unlock-ok' })
      } else {
        next.failures += 1
        lines.push(L(`ACCESS DENIED — key "${key}" rejected.`, 'error'))
        if (next.failures >= 2) lines.push(L('stuck?  type  hint', 'muted'))
        effects.push({ kind: 'unlock-fail' })
      }
      break
    }

    case 'hint': {
      next.hintLevel = Math.min(3, next.hintLevel + 1)
      if (next.solved) {
        lines.push(L('nothing left to hint at — the vault is already unsealed.', 'muted'))
        break
      }
      if (next.hintLevel === 1) {
        lines.push(L('hint 1/3 · the last intern left handover notes.', 'muted'))
        lines.push(L('  try:  cat notes.md', 'warn'))
      } else if (next.hintLevel === 2) {
        lines.push(L('hint 2/3 · the key was rotated forward — rotate it back.', 'muted'))
        lines.push(L(`  try:  decrypt cipher.txt ${TERMINAL_PUZZLE.shift}`, 'warn'))
      } else {
        lines.push(L('hint 3/3 · fine, here it is.', 'muted'))
        lines.push(L(`  try:  unlock ${TERMINAL_PUZZLE.password}`, 'warn'))
      }
      break
    }

    case 'clear': {
      effects.push({ kind: 'clear' })
      break
    }

    case 'whoami': {
      lines.push(L(TERMINAL_PUZZLE.user))
      lines.push(L(`${CHAMBERS.scotiabank.role} — ${CHAMBERS.scotiabank.org}`, 'muted'))
      break
    }

    case 'pwd': {
      lines.push(L(`/home/${TERMINAL_PUZZLE.user}`))
      break
    }

    case 'echo': {
      lines.push(L(args.join(' ')))
      break
    }

    case 'sudo': {
      lines.push(L(`${TERMINAL_PUZZLE.user} is not in the sudoers file. This incident will be reported.`, 'error'))
      break
    }

    case 'exit':
    case 'quit':
    case 'logout': {
      effects.push({ kind: 'exit' })
      break
    }

    default: {
      lines.push(L(`command not found: ${tokens[0]} (try help)`, 'error'))
    }
  }

  return { lines, effects, state: next }
}

export interface Completion {
  /** The new full input value, or null when nothing could be completed. */
  value: string | null
  /** Candidates to print when the prefix is ambiguous. */
  candidates: string[]
}

/** Tab completion: command names on the first token, file names after cat/decrypt. */
export function complete(input: string): Completion {
  const endsWithSpace = /\s$/.test(input)
  const tokens = tokenize(input)
  const none: Completion = { value: null, candidates: [] }

  // completing the command name
  if (tokens.length === 0 || (tokens.length === 1 && !endsWithSpace)) {
    const prefix = (tokens[0] ?? '').toLowerCase()
    const matches = VISIBLE_COMMAND_NAMES.filter((c) => c.startsWith(prefix))
    if (matches.length === 0) return none
    if (matches.length === 1) return { value: `${matches[0]} `, candidates: [] }
    const common = commonPrefix(matches)
    return { value: common.length > prefix.length ? common : null, candidates: matches }
  }

  // completing a file name argument
  const cmd = tokens[0].toLowerCase()
  if (cmd !== 'cat' && cmd !== 'decrypt') return none
  if (cmd === 'decrypt' && (tokens.length > 2 || (tokens.length === 2 && endsWithSpace))) return none
  const partial = endsWithSpace ? '' : tokens[tokens.length - 1]
  const matches = FILE_NAMES.filter((f) => f.toLowerCase().startsWith(partial.toLowerCase()))
  if (matches.length === 0) return none
  const head = endsWithSpace ? tokens : tokens.slice(0, -1)
  if (matches.length === 1) return { value: `${[...head, matches[0]].join(' ')} `, candidates: [] }
  const common = commonPrefix(matches)
  return { value: common.length > partial.length ? [...head, common].join(' ') : null, candidates: matches }
}

function commonPrefix(items: string[]): string {
  if (items.length === 0) return ''
  let p = items[0]
  for (const s of items.slice(1)) {
    let i = 0
    while (i < p.length && i < s.length && p[i].toLowerCase() === s[i].toLowerCase()) i++
    p = p.slice(0, i)
  }
  return p
}
