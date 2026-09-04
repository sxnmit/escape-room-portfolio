/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RESUME CONTENT — the single place to edit what the game reveals.
 *
 *  Every piece of text a player reads lives here: chamber names, resume
 *  bullets, puzzle copy (terminal files, pipeline nodes, keypad code, lantern
 *  labels, crate labels), the closing "About" blurb and contact links.
 *  Game logic never hard-codes any of it. Edit freely; keep the ids stable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ChamberId = 'scotiabank' | 'chalk' | 'tetratech' | 'insightai' | 'mcmaster'

/** The order chambers must be completed in (most impressive → foundational). */
export const CHAMBER_ORDER: ChamberId[] = ['scotiabank', 'chalk', 'tetratech', 'insightai', 'mcmaster']

export type PuzzleKind = 'terminal' | 'pipeline' | 'blocks' | 'keypad' | 'lanterns'

export interface ChamberContent {
  id: ChamberId
  /** Roman numeral shown on doors / panels. */
  numeral: string
  /** Short name used on doors, minimap, toasts. */
  name: string
  /** Accent colour for this chamber (lights, door rings, panel headers). */
  accent: string
  /** What the room is themed as (shown on the entry banner). */
  theme: string
  /** One-line objective shown on the chamber entry banner. */
  objective: string
  puzzle: PuzzleKind

  // ── Resume reveal (shown in the vault panel) ────────────────────────────────
  role: string
  org: string
  dates: string
  location?: string
  /** One-sentence hook shown under the title. */
  tagline: string
  /** The big number / phrase spotlighted in the panel. */
  highlight: { value: string; label: string }
  bullets: string[]
  stack: string[]
  /** Optional secondary block (e.g. a previous role at the same company). */
  extra?: { title: string; subtitle?: string; bullets: string[] }
}

export const CHAMBERS: Record<ChamberId, ChamberContent> = {
  scotiabank: {
    id: 'scotiabank',
    numeral: 'I',
    name: 'Scotiabank',
    accent: '#ff3b4a',
    theme: 'Global Wealth Engineering — secure terminal',
    objective: 'Break into the onboarding terminal and decrypt the access key.',
    puzzle: 'terminal',
    role: 'Software Engineer Intern',
    org: 'Scotiabank · Global Wealth Engineering',
    dates: 'May 2026 – Sep 2026',
    location: 'Toronto, ON',
    tagline: 'Shipping client-facing onboarding for millions of users — and leading interns building agentic AI.',
    highlight: { value: 'Millions', label: 'of clients on the platform I build for' },
    bullets: [
      'Building an elevated onboarding experience for a client-facing wealth platform with a user base in the millions — the only intern staffed on this high-priority initiative — with a direct mandate to reduce onboarding drop-offs.',
      'Leading a team of five interns building agentic workflows and RAG pipelines with LangGraph to streamline architecture workflows for internal engineering teams, run with extreme programming (XP) practices.',
      'Owning features end-to-end: REST API design, React front-end work, Docker-based local environments and code review across a Bitbucket / Agile workflow.',
    ],
    stack: ['TypeScript', 'Python', 'React', 'Node.js', 'LangGraph', 'LangChain', 'SQL', 'Docker', 'REST APIs'],
    extra: {
      title: 'Previously · Product Management Intern',
      subtitle: 'Scotiabank · Jan 2026 – Apr 2026',
      bullets: [
        'Led end-to-end UX improvements across Two-Step Verification (2SV) authentication flows to reduce friction while holding the line on security and compliance.',
        'Partnered with Design, Engineering, Risk and Compliance to turn user pain points into shippable solutions inside legacy-system and high-risk identity constraints.',
      ],
    },
  },

  chalk: {
    id: 'chalk',
    numeral: 'II',
    name: 'Chalk',
    accent: '#2ee59d',
    theme: 'Pool hall back office — pipeline board',
    objective: 'Wire the product pipeline together, from table opening to owner dashboard.',
    puzzle: 'pipeline',
    role: 'Founder & Solo Engineer',
    org: 'Chalk — Pool Hall Management SaaS',
    dates: 'Apr 2026 – Present',
    tagline: 'A multi-tenant B2B SaaS built from scratch, solo — with a real pilot customer lined up before launch.',
    highlight: { value: '< 1 week', label: 'from first commit to a working product in a pilot venue' },
    bullets: [
      'Building a multi-tenant B2B SaaS from scratch with Next.js, TypeScript, Tailwind CSS, Supabase Postgres and Stripe — pre-launch, with a real pool hall as pilot customer.',
      'Designed real-time table session tracking (start / stop, live timers, automatic revenue calculation) optimised for tablet-first, in-venue use.',
      'Built an owner-facing analytics dashboard with peak-hour analysis and rate-tier breakdowns so operators can price and staff on evidence, not gut feel.',
      'Owning the whole surface — product decisions, schema design, auth and billing, UI polish and customer feedback loops.',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Supabase', 'PostgreSQL', 'Stripe', 'Vercel'],
  },

  tetratech: {
    id: 'tetratech',
    numeral: 'III',
    name: 'Tetra Tech',
    accent: '#ffb020',
    theme: 'Engineering workshop — automation floor',
    objective: 'Push each input crate onto its matching intake pad to generate the deliverable.',
    puzzle: 'blocks',
    role: 'Software Engineer & Business Analyst Intern',
    org: 'Tetra Tech',
    dates: 'May 2025 – Dec 2025',
    tagline: 'Owned an Excel-automation platform end-to-end, wearing PM, BA and developer hats at once.',
    highlight: { value: '90%', label: 'of manual deliverable prep eliminated' },
    bullets: [
      'Developed and owned an end-to-end Excel automation web app in React and C# — teams drag-and-drop inputs and receive client-ready deliverables automatically, streamlining tasks by 90%.',
      'Built and documented 5+ reusable React components in Storybook, improving UI development efficiency by 25% and cutting new-developer onboarding by 2+ hours per project.',
      'Built an API integration that pulls 10,000+ client feedback comments from Autodesk Construction Cloud into a PowerBI dashboard with scheduled refreshes across 20+ active projects.',
      'Gathered requirements directly from engineers, project managers and stakeholders, translating business needs into technical scope — cross-functional ownership across PM, BA and dev roles.',
    ],
    stack: ['React', 'C#', 'ASP.NET', 'TypeScript', 'Node.js', 'SQL', 'Storybook', 'PowerBI', 'REST APIs'],
  },

  insightai: {
    id: 'insightai',
    numeral: 'IV',
    name: 'InsightAI',
    accent: '#a78bfa',
    theme: 'Knowledge-base vault — retrieval lock',
    objective: 'Read the four retrieval monitors and enter the access code.',
    puzzle: 'keypad',
    role: 'Software Engineer Intern · AI / Backend',
    org: 'InsightAI',
    dates: 'Aug 2024 – Dec 2024',
    tagline: 'My first RAG system in production — turning messy conversations into a self-updating knowledge base.',
    highlight: { value: '70%', label: 'less manual effort to keep client knowledge bases current' },
    bullets: [
      'Refactored how client AI knowledge bases get updated by building a Retrieval-Augmented Generation application that processes conversational data, reducing manual update effort by 70%.',
      'Built the backend data-processing pipeline in Python / Django with pytest coverage, integrating the OpenAI API for embedding and generation.',
      'Shipped the React / Node front-end surfaces that let clients review and approve knowledge-base changes.',
    ],
    stack: ['Python', 'Django', 'OpenAI API', 'RAG', 'React', 'Node.js', 'pytest'],
  },

  mcmaster: {
    id: 'mcmaster',
    numeral: 'V',
    name: 'McMaster',
    accent: '#ff6f91',
    theme: 'Lecture hall — the foundations',
    objective: 'Light the four study lamps to bring the lecture hall to life.',
    puzzle: 'lanterns',
    role: 'Honours Computer Science, B.A.Sc.',
    org: 'McMaster University',
    dates: 'Sep 2023 – Apr 2027 (expected)',
    location: 'Hamilton, ON',
    tagline: 'The foundations everything else is built on.',
    highlight: { value: '3.9 / 4.0', label: 'GPA · 2× Dean’s List' },
    bullets: [
      'Honours Computer Science — Bachelor of Applied Science, expected graduation April 2027.',
      'GPA 3.9 / 4.0 with two Dean’s List honours.',
      'Coursework: Software Engineering, Databases, Data Structures & Algorithms, Algorithms & Complexity, Concurrent Systems, Operating Systems, Computer Architecture, Networks & Security, Agile Methodologies.',
    ],
    stack: ['Java', 'Python', 'C#', 'C', 'JavaScript', 'TypeScript', 'SQL', 'Spring Boot', 'Django', 'Angular', 'Flutter', 'MongoDB', 'PostgreSQL'],
    extra: {
      title: 'Toolbox',
      bullets: [
        'Languages: Java, Python, C#, C, JavaScript, TypeScript, SQL, CSS.',
        'Frameworks: .NET Core, Node.js, React, Next.js, Angular, Django, Spring Boot, PostgreSQL, MongoDB, Flutter, Tailwind CSS.',
        'Tools: Cursor, Claude Code, Visual Studio, Postman, Jira, Confluence, Git / GitHub / Bitbucket, Docker, LangChain, LangGraph, PowerBI.',
      ],
    },
  },
}

// ─── Puzzle copy ──────────────────────────────────────────────────────────────

/** Chamber I — terminal. The player must find the shift, decrypt, then unlock. */
export const TERMINAL_PUZZLE = {
  hostname: 'gwe-onboarding',
  user: 'intern',
  banner: [
    'SCOTIABANK · GLOBAL WEALTH ENGINEERING',
    'onboarding-gateway v2.6 — restricted shell',
    'Type  help  to list commands.',
  ],
  /** The plaintext the player must submit with `unlock`. Case-insensitive. */
  password: 'ONBOARD',
  /** Caesar shift used to produce cipher.txt from the password. */
  shift: 3,
  files: {
    'README.md': [
      '# Onboarding gateway',
      'The release vault is sealed behind a rotated key.',
      'Steps: read the notes, decrypt the cipher, unlock the vault.',
      'Try:  cat notes.md',
    ],
    'notes.md': [
      'Handover notes (from the last intern):',
      '- The vault key in cipher.txt was scrambled with a Caesar shift.',
      '- Every letter was rotated FORWARD by 3.',
      '- Use  decrypt <text> <shift>  to rotate it back, then  unlock <key>.',
    ],
    'cipher.txt': ['RQERDUG'],
    'onboarding.log': [
      '[09:12:04] funnel step 3 drop-off: 41% → 23% after redesign',
      '[09:12:05] agentic-review pipeline: 6 interns online, LangGraph graph compiled',
      '[09:12:07] release vault: LOCKED (awaiting key)',
    ],
  } as Record<string, string[]>,
  successLines: [
    'ACCESS GRANTED — release vault unsealed.',
    'Deploying onboarding v2.6 … done.',
    'A vault has opened back in the hub.',
  ],
}

/** Chamber II — pipeline. Nodes must be connected in `order`. */
export const PIPELINE_PUZZLE = {
  title: 'Chalk — table session pipeline',
  instructions: 'Drag from a node’s output port ● to the next node’s input port ○ to wire the flow, from opening a table to the owner’s dashboard.',
  nodes: [
    { id: 'open', label: 'Table opens', hint: 'A player racks up — a session begins.' },
    { id: 'timer', label: 'Live session timer', hint: 'Tracks minutes played in real time.' },
    { id: 'rate', label: 'Rate tier lookup', hint: 'Peak vs off-peak pricing.' },
    { id: 'revenue', label: 'Revenue calculation', hint: 'Minutes × rate, computed automatically.' },
    { id: 'checkout', label: 'Stripe checkout', hint: 'The table closes and the tab is paid.' },
    { id: 'dashboard', label: 'Owner dashboard', hint: 'Peak-hour analysis & rate-tier breakdowns.' },
  ],
  order: ['open', 'timer', 'rate', 'revenue', 'checkout', 'dashboard'],
  successText: 'Pipeline deployed — the pilot venue is live.',
}

/** Chamber III — crates & pads (3D). Colours pair crates with their pads. */
export const BLOCKS_PUZZLE = {
  briefing: 'Three input crates, three intake pads. Push each crate onto the pad that matches its colour.',
  items: [
    { id: 'a', label: 'FIELD DATA', color: '#ffb020' },
    { id: 'b', label: 'SITE FEEDBACK', color: '#38bdf8' },
    { id: 'c', label: 'COST MODEL', color: '#f472b6' },
  ],
  deliverableLabel: 'CLIENT DELIVERABLE',
  successText: 'Deliverable generated — the automation floor is running.',
}

/** Chamber IV — keypad (3D monitors show the digits). */
export const KEYPAD_PUZZLE = {
  title: 'Knowledge-base access',
  instructions: 'Four retrieval monitors around this chamber each show one digit of the code and its position.',
  code: '7024',
  monitorCaptions: ['retrieval shard', 'embedding index', 'vector store', 'answer cache'],
  successText: 'Knowledge base unlocked.',
}

/** Chamber V — lamps (3D). */
export const LANTERNS_PUZZLE = {
  briefing: 'Light all four study lamps.',
  lamps: [
    { id: 'y1', label: 'Year 1 · Foundations' },
    { id: 'y2', label: 'Year 2 · Systems' },
    { id: 'y3', label: 'Year 3 · Algorithms' },
    { id: 'y4', label: 'Year 4 · Capstone' },
  ],
  successText: 'The lecture hall is lit.',
}

// ─── Closing room ─────────────────────────────────────────────────────────────

export const ABOUT = {
  name: 'Sanmit “Sunny” Singh',
  title: 'Software engineer · McMaster CS ’27 · Toronto',
  blurb: [
    'I like building things people actually use: onboarding flows for millions of bank clients, a SaaS a real pool hall runs its floor on, tools that erase hours of manual work.',
    'I care about the whole product — the data model, the API, the pixel, and the person on the other end. I move fast, ship early, and keep things clean enough that the next person (or the next me) can keep going.',
    'Currently: Software Engineer Intern at Scotiabank, building Chalk on the side, and finishing an Honours CS degree at McMaster.',
  ],
  sideQuests: [
    { name: 'Signal', blurb: 'Background Python agent that scrapes NewsAPI, RSS and Claude web search into a categorised HTML email digest on a schedule.' },
    { name: 'Macify', blurb: 'Context-aware Chrome extension for fast, guided navigation across McMaster systems.' },
  ],
  links: [
    { label: 'Email', value: 'sings246@mcmaster.ca', href: 'mailto:sings246@mcmaster.ca' },
    { label: 'LinkedIn', value: 'linkedin.com/in/sanmit-singh', href: 'https://linkedin.com/in/sanmit-singh' },
    { label: 'GitHub', value: 'github.com/sxnmit', href: 'https://github.com/sxnmit' },
  ],
  closing: 'Thanks for walking through. Let’s build something.',
}

export const GAME_TITLE = 'THE VAULT'
export const GAME_SUBTITLE = 'An interactive resume · Sanmit Singh'
