/**
 * The whole data model. Two things to keep straight:
 *
 *  - Intent is the user's. The app never writes it on their behalf beyond the
 *    action they took, and never argues with it.
 *  - Evidence is the app's. It is derived from what was actually observed and
 *    is read-only to the user.
 *
 * They are separate fields, separately displayed, and one never overwrites the
 * other.
 */

// --- axis A: intent (user-controlled) ------------------------------------

export type Intent = 'not_started' | 'learning' | 'maintaining' | 'paused'

export const INTENT_LABELS: Record<Intent, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  maintaining: 'Maintaining',
  paused: 'Paused',
}

// --- axis B: evidence (system-derived) -----------------------------------

export type EvidenceTier = 'untested' | 'weak' | 'fair' | 'strong' | 'cold_verified'

export const EVIDENCE_LABELS: Record<EvidenceTier, string> = {
  untested: 'Not checked yet',
  weak: 'Shaky',
  fair: 'Holding',
  strong: 'Solid',
  cold_verified: 'Cold-checked',
}

export type VerificationMethod = 'self_grade' | 'order_tap' | 'type_initials' | 'recite_asr'

export type Confidence = 'low' | 'medium' | 'high' | 'highest'

/** What the app says it saw. Never "you know this". */
export const METHOD_LABELS: Record<VerificationMethod, string> = {
  self_grade: 'Self-checked',
  order_tap: 'Reconstructed',
  type_initials: 'Typed from memory',
  recite_asr: 'Recited',
}

export const METHOD_CONFIDENCE: Record<VerificationMethod, Confidence> = {
  self_grade: 'low',
  order_tap: 'medium',
  type_initials: 'medium',
  recite_asr: 'high',
}

/** A check passed after this long without exposure counts as a cold check. */
export const COLD_GAP_DAYS = 30

// --- content --------------------------------------------------------------

export interface Word {
  ar: string
  translit?: string
  en?: string
}

export interface SegmentAudio {
  /** ms offset into the text's audio file. */
  from: number
  to: number
  /** Positional: entry n covers words[n]. */
  wordTimings?: [number, number][]
}

export interface EditionInfo {
  id: string
  lang: string
  title: string
  translator: string
  source?: string
  sourceUrl?: string
  license?: string
}

export interface TextRecord {
  id: string
  title: string
  source: 'pack' | 'user'
  lang: string
  dir: 'rtl' | 'ltr'
  packId?: string
  /** Sort order inside a pack — surah number, poem number, whatever. */
  packIndex?: number
  titleArabic?: string
  titleTr?: string
  audioUrl?: string
  /** Whose recitation the bundled word timings belong to. */
  reciter?: string
  segmentCount: number
  /** Which translation editions this text carries, for the settings picker. */
  editions?: EditionInfo[]
  attribution?: {
    source: string
    sourceUrl: string
    edition: string
    translator: string
  }
  license?: string
  createdAt: number
}

export interface SegmentRecord {
  id: string
  textId: string
  index: number
  /** What a human calls it: "78:4", "stanza 3", or just the number. */
  ref?: string
  content: string
  /** Keyed by edition id; resolved to the user's chosen editions at render. */
  translations: Record<string, string>
  words?: Word[]
  audio?: SegmentAudio
}

// --- scheduling -----------------------------------------------------------

export type ItemType = 'block' | 'link' | 'meaning'

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  block: 'Line',
  link: 'Join',
  meaning: 'Meaning',
}

/** ts-fsrs Card with timestamps stored as epoch ms so Dexie can index them. */
export interface StoredCard {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: number
  last_review?: number
}

export interface ItemRecord {
  id: string
  textId: string
  /** For a link this is the segment the join leaves from. */
  segmentId: string
  /** Link only: the segment the join arrives at. */
  nextSegmentId?: string
  type: ItemType
  /** meaning items alternate direction across reviews. */
  meaningDirection?: 'to_meaning' | 'from_meaning'
  fsrs: StoredCard
  /** Mirrors fsrs.due so Dexie can range-query what is owed. */
  due: number
  intent: Intent
  /** Consecutive passes, for the "≥ 3 successful intervals" part of `strong`. */
  successStreak: number
  /** First graded exposure — used for the daily new-item cap. */
  introducedAt?: number
  lastSeenAt?: number
  lastEvidence?: EvidenceRef
  createdAt: number
}

export type ErrorKind = 'wrong_word' | 'wrong_order' | 'missing' | 'extra'

/** Append-only. History is what makes the evidence tier honest. */
export interface AttemptRecord {
  id: string
  itemId: string
  at: number
  method: VerificationMethod
  /** FSRS rating 1–4: Again / Hard / Good / Easy. */
  rating: 1 | 2 | 3 | 4
  peeks: number
  meaningShown: boolean
  durationMs: number
  /** Hint level the user was on when they answered. */
  hintLevel?: number
  errors?: { wordIndex: number; kind: ErrorKind }[]
  cold?: boolean
}

export interface EvidenceRecord {
  id: string
  itemId: string
  at: number
  method: VerificationMethod
  confidence: Confidence
  passed: boolean
  /** Days since the previous exposure. ≥ 30 makes this a cold check. */
  gapDays: number
}

/**
 * The last evidence, denormalised onto the item. The library draws a heat
 * strip per ayah, and that must not become one query per square.
 */
export type EvidenceRef = Omit<EvidenceRecord, 'itemId'>

// --- session state --------------------------------------------------------

export interface ColdCheckRun {
  id: string
  at: number
  itemIds: string[]
  passedFirstTime: number
  total: number
}
