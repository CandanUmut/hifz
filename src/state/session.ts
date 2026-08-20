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
import type { ResponseMode } from './settings'

export type SessionKind = 'review' | 'cold' | 'practice'

/** Filled = remembered, outlined = still to come, red = missed. */
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
  startedAt: number
  hintLevel: HintLevel
  errors: { wordIndex: number; kind: ErrorKind }[]
  /** Set once the recitation check has run. */
  checked: boolean
  /** What the recitation check heard, kept so the reader can see it. */
  heard?: string
}

interface SessionState {
  kind: SessionKind
  entries: SessionEntry[]
  marks: MarkStatus[]
  index: number
  phase: Phase
  mode: ResponseMode
  draft: AttemptDraft
  /** Cold check only: what was recalled first time, reported plainly at the end. */
  passedFirstTime: number

  start: (kind: SessionKind, entries: SessionEntry[]) => void
  setMode: (mode: ResponseMode) => void
  peek: () => void
  reveal: () => void
  markChecked: (errors: { wordIndex: number; kind: ErrorKind }[], heard?: string) => void
  beginTest: () => void
  advance: (rating: GradeRating, updated: ItemRecord) => void
  reset: () => void
}

/**
 * How much ink is on the page when a card comes up.
 *
 * Always hidden. The whole point is to recall the line, and an ayah shown at
 * any readable level tests reading, not memory. Ghost keeps the word shapes so
 * there is something to tap when you are stuck; a cold check shows nothing at
 * all, because that is what a cold check is for.
 */
export function hiddenLevel(kind: SessionKind): HintLevel {
  return kind === 'cold' ? 4 : 3
}

/** Meaning items are always graded by the reader; there is nothing to listen to. */
export function modeForItem(item: ItemRecord, preferred: ResponseMode): ResponseMode {
  if (item.type === 'meaning') return 'self_grade'
  return preferred
}

export function methodForMode(mode: ResponseMode): VerificationMethod {
  return mode
}

function freshDraft(kind: SessionKind): AttemptDraft {
  return {
    peeks: 0,
    startedAt: Date.now(),
    hintLevel: hiddenLevel(kind),
    errors: [],
    checked: false,
  }
}

/**
 * Never seen before, so there is nothing to test yet — show it first. Practice
 * sessions skip this: the reader asked to be tested.
 */
function phaseFor(entry: SessionEntry, kind: SessionKind): Phase {
  if (kind === 'cold') return 'prompt'
  return entry.item.introducedAt == null ? 'learn' : 'prompt'
}

const EMPTY_DRAFT = freshDraft('review')

export const useSession = create<SessionState>()((set, get) => ({
  kind: 'review',
  entries: [],
  marks: [],
  index: 0,
  phase: 'done',
  mode: 'self_grade',
  draft: EMPTY_DRAFT,
  passedFirstTime: 0,

  start: (kind, entries) =>
    set({
      kind,
      entries,
      marks: entries.map(() => 'pending' as MarkStatus),
      index: 0,
      phase: entries.length ? phaseFor(entries[0], kind) : 'done',
      mode: 'self_grade',
      draft: freshDraft(kind),
      passedFirstTime: 0,
    }),

  setMode: (mode) => set({ mode }),

  peek: () => set((s) => ({ draft: { ...s.draft, peeks: s.draft.peeks + 1 } })),

  reveal: () => set({ phase: 'answer' }),

  markChecked: (errors, heard) =>
    set((s) => ({ draft: { ...s.draft, errors, heard, checked: true }, phase: 'answer' })),

  beginTest: () => set({ phase: 'prompt' }),

  advance: (rating, updated) => {
    const { entries, index, marks, kind } = get()
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
      mode: modeForItem(nextEntries[nextIndex].item, s.mode),
      draft: freshDraft(kind),
      passedFirstTime: s.passedFirstTime + firstTime,
    }))
  },

  reset: () => set({ entries: [], marks: [], index: 0, phase: 'done', passedFirstTime: 0 }),
}))
