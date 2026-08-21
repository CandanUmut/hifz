import { newId } from '@/db/db'
import { newCard } from './scheduler'
import type { Intent, ItemRecord, ItemType, SegmentRecord, Stage } from './types'

export interface ItemTypeChoice {
  block: boolean
  /** The joins, where memorisation actually breaks. On by default. */
  link: boolean
  /** Only offered when the text carries translations. */
  meaning: boolean
}

export const DEFAULT_ITEM_TYPES: ItemTypeChoice = { block: true, link: true, meaning: false }

function makeItem(
  textId: string,
  type: ItemType,
  segment: SegmentRecord,
  intent: Intent,
  stage: Stage,
  now: number,
  nextSegment?: SegmentRecord,
): ItemRecord {
  const card = newCard(now)
  return {
    id: newId(),
    textId,
    segmentId: segment.id,
    nextSegmentId: nextSegment?.id,
    type,
    stage,
    meaningDirection: type === 'meaning' ? 'to_meaning' : undefined,
    fsrs: card,
    due: card.due,
    intent,
    successStreak: 0,
    createdAt: now,
  }
}

export interface GenerateInput {
  textId: string
  /** Every segment of the text, ordered by index. */
  allSegments: SegmentRecord[]
  /** Segment indices the user is adding now. */
  selectedIndices: number[]
  /** Indices already in the plan, so joins can be closed across two sessions. */
  existingIndices: number[]
  existing: ItemRecord[]
  types: ItemTypeChoice
  intent: Intent
  stage: Stage
  now?: number
}

/**
 * Generates the items for a selection, skipping anything already scheduled.
 *
 * A `link` is created for every pair of consecutive segments that are both in
 * the plan — including a pair formed with something added in an earlier
 * session, which is how adding ayah 5–8 after 1–4 closes the 4→5 join.
 */
export function generateItems({
  textId,
  allSegments,
  selectedIndices,
  existingIndices,
  existing,
  types,
  intent,
  stage,
  now = Date.now(),
}: GenerateInput): ItemRecord[] {
  const byIndex = new Map(allSegments.map((s) => [s.index, s]))
  const planned = new Set([...existingIndices, ...selectedIndices])
  const selected = new Set(selectedIndices)

  const have = new Set(existing.map((i) => `${i.type}:${i.segmentId}`))
  const created: ItemRecord[] = []

  const push = (item: ItemRecord) => {
    const key = `${item.type}:${item.segmentId}`
    if (have.has(key)) return
    have.add(key)
    created.push(item)
  }

  for (const index of [...selected].sort((a, b) => a - b)) {
    const segment = byIndex.get(index)
    if (!segment) continue
    if (types.block) push(makeItem(textId, 'block', segment, intent, stage, now))
    if (types.meaning && Object.keys(segment.translations).length > 0) {
      push(makeItem(textId, 'meaning', segment, intent, stage, now))
    }
  }

  if (types.link) {
    for (const index of [...planned].sort((a, b) => a - b)) {
      if (!planned.has(index + 1)) continue
      // Only worth creating if one side is new; otherwise it already exists.
      if (!selected.has(index) && !selected.has(index + 1)) continue
      const from = byIndex.get(index)
      const to = byIndex.get(index + 1)
      if (!from || !to) continue
      push(makeItem(textId, 'link', from, intent, stage, now, to))
    }
  }

  return created
}

/** A join is named by both ends: "78:4 → 78:5". */
export function itemRef(
  item: ItemRecord,
  segment: SegmentRecord | undefined,
  next?: SegmentRecord,
): string {
  const base = segment?.ref ?? (segment ? `${segment.index + 1}` : '')
  if (item.type !== 'link') return base
  const tail = next?.ref ?? (next ? `${next.index + 1}` : '')
  return tail ? `${base} → ${tail}` : base
}
