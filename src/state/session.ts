import { create } from 'zustand'
import type { HintLevel } from '@/components/InkText'
import type {
  ErrorKind,
  ItemRecord,
  SegmentRecord,
  TextRecord,
  VerificationMethod,
} from '@/engine/types'
import type { GradeRating } from '@/engine/scheduler'
import type { HintAggressiveness, ResponseMode } from './settings'

export type SessionKind = 'review' | 'cold'

/** Filled = done, outlined = remaining, red-tinted = missed. */
export type MarkStatus = 'pending' | 'passed' | 'missed'

export interface SessionEntry {
  item: ItemRecord
  segment: SegmentRecord
  /** Link items: the segment the join arrives at. */
  nextSegment?: SegmentRecord
  text: TextRecord
}

export type Phase = 'learn' | 'prompt' | 'answer' | 'done'

export interface AttemptDraft {
  peeks: number
  meaningShown: boolean
  startedAt: number
  hintLevel: HintLevel
  errors: { wordIndex: number; kind: ErrorKind }[]
  /** Set once an objective mode has been checked. */
  checked: boolean
}

interface SessionState {
  kind: SessionKind
  entries: SessionEntry[]
  marks: MarkStatus[]
  index: number
  phase: Phase
  mode: ResponseMode
  draft: AttemptDraft
  aggressiveness: HintAggressiveness
  /** Cold check only: what the user got first time, reported plainly at the end. */
  passedFirstTime: number

  start: (kind: SessionKind, entries: SessionEntry[], mode: ResponseMode, agg: HintAggressiveness) => void
  setMode: (mode: ResponseMode) => void
  moreHint: () => void
  peek: () => void
  showMeaning: () => void
  reveal: () => void
  markChecked: (errors: { wordIndex: number; kind: ErrorKind }[]) => void
  beginTest: () => void
  advance: (rating: GradeRating, updated: ItemRecord) => void
  reset: () => void
}

const EMPTY_DRAFT: AttemptDraft = {
  peeks: 0,
  meaningShown: false,
  startedAt: Date.now(),
  hintLevel: 2,
  errors: [],
  checked: false,
}

/**
 * How much ink is left when a card comes up. Stronger items start with less;
 * the aggressiveness setting shifts the whole ramp.
 */
export function initialHintLevel(
  item: ItemRecord,
  aggressiveness: HintAggressiveness,
  kind: SessionKind = 'review',
  mode: ResponseMode = 'self_grade',
): HintLevel {
  if (kind === 'cold') return 4
  // In the objective modes the chips or the slots are the recall, so leaving
  // ink on the page would just be showing the answer.
  if (mode !== 'self_grade' && item.type !== 'meaning') return 4
  const byStreak = Math.min(4, Math.max(1, item.successStreak + 1))
  const shift = aggressiveness === 'gentle' ? -1 : aggressiveness === 'steep' ? 1 : 0
  return Math.min(4, Math.max(0, byStreak + shift)) as HintLevel
}

/** Meaning items are always graded by the user; there is nothing to match on. */
export function modeForItem(item: ItemRecord, preferred: ResponseMode): ResponseMode {
  if (item.type === 'meaning') return 'self_grade'
  return preferred
}

export function methodForMode(mode: ResponseMode): VerificationMethod {
  return mode
}

function freshDraft(
  entry: SessionEntry,
  agg: HintAggressiveness,
  kind: SessionKind,
  mode: ResponseMode,
): AttemptDraft {
  return {
    peeks: 0,
    meaningShown: false,
    startedAt: Date.now(),
    hintLevel: initialHintLevel(entry.item, agg, kind, mode),
    errors: [],
    checked: false,
  }
}

/** Never seen before, so there is nothing to test yet — teach it first. */
function phaseFor(entry: SessionEntry, kind: SessionKind): Phase {
  if (kind === 'cold') return 'prompt'
  return entry.item.introducedAt == null ? 'learn' : 'prompt'
}

export const useSession = create<SessionState>()((set, get) => ({
  kind: 'review',
  entries: [],
  marks: [],
  index: 0,
  phase: 'done',
  mode: 'self_grade',
  draft: EMPTY_DRAFT,
  aggressiveness: 'normal',
  passedFirstTime: 0,

  start: (kind, entries, mode, aggressiveness) =>
    set({
      kind,
      entries,
      marks: entries.map(() => 'pending' as MarkStatus),
      index: 0,
      phase: entries.length ? phaseFor(entries[0], kind) : 'done',
      mode: entries.length ? modeForItem(entries[0].item, mode) : mode,
      draft: entries.length
        ? freshDraft(entries[0], aggressiveness, kind, modeForItem(entries[0].item, mode))
        : EMPTY_DRAFT,
      aggressiveness,
      passedFirstTime: 0,
    }),

  setMode: (mode) => {
    const { entries, index, aggressiveness, kind } = get()
    const entry = entries[index]
    set({
      mode,
      draft: entry
        ? { ...get().draft, hintLevel: initialHintLevel(entry.item, aggressiveness, kind, mode) }
        : get().draft,
    })
  },

  // "More hint" puts ink back on the page.
  moreHint: () =>
    set((s) => ({
      draft: { ...s.draft, hintLevel: Math.max(0, s.draft.hintLevel - 1) as HintLevel },
    })),

  peek: () => set((s) => ({ draft: { ...s.draft, peeks: s.draft.peeks + 1 } })),

  // Using the meaning during a test is recorded exactly like a peek.
  showMeaning: () => set((s) => ({ draft: { ...s.draft, meaningShown: true } })),

  reveal: () => set({ phase: 'answer' }),

  markChecked: (errors) =>
    set((s) => ({ draft: { ...s.draft, errors, checked: true }, phase: 'answer' })),

  beginTest: () => set({ phase: 'prompt' }),

  advance: (rating, updated) => {
    const { entries, index, marks, kind, aggressiveness, mode } = get()
    const nextMarks = [...marks]
    nextMarks[index] = rating >= 2 ? 'passed' : 'missed'
    const nextEntries = entries.map((e, i) => (i === index ? { ...e, item: updated } : e))
    const nextIndex = index + 1
    const firstTime = kind === 'cold' && rating >= 3 ? 1 : 0

    if (nextIndex >= entries.length) {
      set((s) => ({
        entries: nextEntries,
        marks: nextMarks,
        phase: 'done',
        passedFirstTime: s.passedFirstTime + firstTime,
      }))
      return
    }
    set((s) => ({
      entries: nextEntries,
      marks: nextMarks,
      index: nextIndex,
      phase: phaseFor(nextEntries[nextIndex], kind),
      mode: modeForItem(nextEntries[nextIndex].item, mode),
      draft: freshDraft(
        nextEntries[nextIndex],
        aggressiveness,
        kind,
        modeForItem(nextEntries[nextIndex].item, mode),
      ),
      passedFirstTime: s.passedFirstTime + firstTime,
    }))
  },

  reset: () => set({ entries: [], marks: [], index: 0, phase: 'done', passedFirstTime: 0 }),
}))
