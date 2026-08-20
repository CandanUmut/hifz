import { db, newId } from './db'
import {
  confidenceFor,
  evidenceTier,
} from '@/engine/evidence'
import { generateItems, type ItemTypeChoice } from '@/engine/items'
import { daysSince, isPass, schedule, type GradeRating } from '@/engine/scheduler'
import type {
  AttemptRecord,
  ErrorKind,
  EvidenceRecord,
  EvidenceTier,
  Intent,
  ItemRecord,
  SegmentRecord,
  TextRecord,
  VerificationMethod,
} from '@/engine/types'
import { loadManifest, loadPackText, toRecords, type PackIndexEntry } from '@/packs/loader'

const DAY = 86_400_000

// --- import ---------------------------------------------------------------

/** Copies a pack text into the local database the first time it is opened. */
export async function ensurePackText(entry: PackIndexEntry, file: string, textId: string) {
  const existing = await db.texts.get(textId)
  if (existing) return existing
  const manifest = await loadManifest(entry)
  const packText = await loadPackText(manifest, file)
  const { text, segments } = toRecords(manifest, packText)
  await db.transaction('rw', db.texts, db.segments, async () => {
    await db.texts.put(text)
    await db.segments.bulkPut(segments)
  })
  return text
}

export interface NewUserText {
  title: string
  lang: string
  dir: 'rtl' | 'ltr'
  segments: Array<{ content: string; translations?: Record<string, string> }>
}

export async function createUserText(input: NewUserText): Promise<TextRecord> {
  const id = newId()
  const now = Date.now()
  const text: TextRecord = {
    id,
    title: input.title.trim() || 'Untitled',
    source: 'user',
    lang: input.lang,
    dir: input.dir,
    segmentCount: input.segments.length,
    editions: [{ id: 'user', lang: input.lang, title: 'Your notes', translator: 'You' }],
    createdAt: now,
  }
  const segments: SegmentRecord[] = input.segments.map((s, index) => ({
    id: `${id}#${index}`,
    textId: id,
    index,
    ref: String(index + 1),
    content: s.content,
    translations: s.translations ?? {},
  }))
  await db.transaction('rw', db.texts, db.segments, async () => {
    await db.texts.put(text)
    await db.segments.bulkPut(segments)
  })
  return text
}

// --- reads ----------------------------------------------------------------

export function getText(textId: string) {
  return db.texts.get(textId)
}

export async function getSegments(textId: string): Promise<SegmentRecord[]> {
  const segments = await db.segments.where('textId').equals(textId).toArray()
  return segments.sort((a, b) => a.index - b.index)
}

export function getItems(textId: string) {
  return db.items.where('textId').equals(textId).toArray()
}

export function allItems() {
  return db.items.toArray()
}

export function allTexts() {
  return db.texts.toArray()
}

export function getAttempts(itemId: string) {
  return db.attempts.where('itemId').equals(itemId).sortBy('at')
}

// --- plan -----------------------------------------------------------------

export interface AddToPlanInput {
  textId: string
  indices: number[]
  types: ItemTypeChoice
  intent?: Intent
}

export async function addToPlan({
  textId,
  indices,
  types,
  intent = 'learning',
}: AddToPlanInput): Promise<number> {
  const [allSegments, existing] = await Promise.all([getSegments(textId), getItems(textId)])
  const byId = new Map(allSegments.map((s) => [s.id, s]))
  const existingIndices = [
    ...new Set(existing.map((i) => byId.get(i.segmentId)?.index).filter((n): n is number => n != null)),
  ]
  const created = generateItems({
    textId,
    allSegments,
    selectedIndices: indices,
    existingIndices,
    existing,
    types,
    intent,
  })
  if (created.length) await db.items.bulkPut(created)
  return created.length
}

export async function removeFromPlan(itemIds: string[]) {
  await db.items.bulkDelete(itemIds)
}

/**
 * Intent is the user's word for what they are working on. Setting it here is
 * the only thing that ever writes it.
 */
export async function setIntentForText(textId: string, intent: Intent) {
  const items = await getItems(textId)
  await db.items.bulkPut(items.map((i) => ({ ...i, intent })))
}

export async function setIntentForItems(itemIds: string[], intent: Intent) {
  const items = await db.items.bulkGet(itemIds)
  await db.items.bulkPut(
    items.filter((i): i is ItemRecord => !!i).map((i) => ({ ...i, intent })),
  )
}

// --- queue ----------------------------------------------------------------

export interface QueueOptions {
  now?: number
  dailyNewCap: number
  limit?: number
}

function startOfDay(now: number) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * What is owed right now: everything past due, then as many never-seen items
 * as the daily cap still allows. Paused items are never scheduled.
 */
/** A line is introduced before the join that leaves it. */
const TYPE_ORDER: Record<ItemRecord['type'], number> = { block: 0, meaning: 1, link: 2 }

function readingOrder(a: ItemRecord, b: ItemRecord): number {
  return (
    a.textId.localeCompare(b.textId) ||
    (parseSegmentIndex(a.segmentId) ?? 0) - (parseSegmentIndex(b.segmentId) ?? 0) ||
    TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
  )
}

export async function buildQueue({ now = Date.now(), dailyNewCap, limit }: QueueOptions) {
  const items = (await db.items.toArray()).filter((i) => i.intent !== 'paused')
  const introducedToday = items.filter(
    (i) => i.introducedAt != null && i.introducedAt >= startOfDay(now),
  ).length

  const due = items
    .filter((i) => i.introducedAt != null && i.due <= now)
    .sort((a, b) => a.due - b.due || readingOrder(a, b))

  // Everything added in one go shares a createdAt, so reading order is the
  // real tiebreak: a line, then the join that leaves it.
  const fresh = items
    .filter((i) => i.introducedAt == null)
    .sort((a, b) => a.createdAt - b.createdAt || readingOrder(a, b))
    .slice(0, Math.max(0, dailyNewCap - introducedToday))

  const queue = [...due, ...fresh]
  return limit ? queue.slice(0, limit) : queue
}

/** Items untouched for ≥ 30 days — the ones a cold check exists to find. */
export async function coldCheckCandidates(now = Date.now(), limit = 10) {
  const items = await db.items.toArray()
  return items
    .filter(
      (i) =>
        i.intent !== 'paused' &&
        i.lastSeenAt != null &&
        now - i.lastSeenAt >= 30 * DAY,
    )
    .sort((a, b) => (a.lastSeenAt ?? 0) - (b.lastSeenAt ?? 0))
    .slice(0, limit)
}

/** Median recent answer time, so the estimate is the user's pace, not ours. */
export async function estimateSecondsPerItem(fallback = 14): Promise<number> {
  const recent = await db.attempts.orderBy('at').reverse().limit(60).toArray()
  const durations = recent
    .map((a) => a.durationMs)
    .filter((d) => d > 1500 && d < 180_000)
    .sort((a, b) => a - b)
  if (durations.length < 5) return fallback
  return Math.round(durations[Math.floor(durations.length / 2)] / 1000)
}

// --- grading --------------------------------------------------------------

export interface RecordAttemptInput {
  item: ItemRecord
  method: VerificationMethod
  rating: GradeRating
  peeks: number
  meaningShown: boolean
  durationMs: number
  hintLevel?: number
  errors?: { wordIndex: number; kind: ErrorKind }[]
  cold?: boolean
  desiredRetention: number
  now?: number
}

/**
 * One graded recall: an append-only attempt, an evidence record describing how
 * it was obtained, and the schedule update. Nothing is ever deleted here.
 */
export async function recordAttempt(input: RecordAttemptInput): Promise<ItemRecord> {
  const now = input.now ?? Date.now()
  const { item } = input

  // A peeked answer cannot be Easy — the ceiling is enforced in the UI, and
  // again here so no other caller can route around it.
  const rating = (input.peeks > 0 && input.rating === 4 ? 3 : input.rating) as GradeRating
  const passed = isPass(rating)
  const gapDays = item.lastSeenAt ? daysSince(item.lastSeenAt, now) : 0
  const confidence = confidenceFor(input.method, gapDays)

  const attempt: AttemptRecord = {
    id: newId(),
    itemId: item.id,
    at: now,
    method: input.method,
    rating,
    peeks: input.peeks,
    meaningShown: input.meaningShown,
    durationMs: input.durationMs,
    hintLevel: input.hintLevel,
    errors: input.errors?.length ? input.errors : undefined,
    cold: input.cold,
  }

  const evidence: EvidenceRecord = {
    id: newId(),
    itemId: item.id,
    at: now,
    method: input.method,
    confidence,
    passed,
    gapDays: Math.round(gapDays),
  }

  const fsrs = schedule(item.fsrs, rating, input.desiredRetention, now)
  const updated: ItemRecord = {
    ...item,
    fsrs,
    due: fsrs.due,
    successStreak: passed ? item.successStreak + 1 : 0,
    introducedAt: item.introducedAt ?? now,
    lastSeenAt: now,
    lastEvidence: {
      id: evidence.id,
      at: evidence.at,
      method: evidence.method,
      confidence: evidence.confidence,
      passed: evidence.passed,
      gapDays: evidence.gapDays,
    },
    meaningDirection:
      item.type === 'meaning'
        ? item.meaningDirection === 'to_meaning'
          ? 'from_meaning'
          : 'to_meaning'
        : item.meaningDirection,
  }

  await db.transaction('rw', db.items, db.attempts, db.evidence, async () => {
    await db.attempts.add(attempt)
    await db.evidence.add(evidence)
    await db.items.put(updated)
  })

  return updated
}

// --- derived views --------------------------------------------------------

export interface TextSummary {
  text: TextRecord
  items: ItemRecord[]
  /** Evidence tier per segment index, for the heat strip. */
  tiers: Map<number, EvidenceTier>
  intent: Intent
  inPlan: number
  dueNow: number
  lastEvidence?: ItemRecord['lastEvidence']
}

/** Text-level intent is the strongest intent among its items. */
export function deriveIntent(items: ItemRecord[]): Intent {
  if (!items.length) return 'not_started'
  if (items.some((i) => i.intent === 'learning')) return 'learning'
  if (items.some((i) => i.intent === 'maintaining')) return 'maintaining'
  if (items.some((i) => i.intent === 'paused')) return 'paused'
  return 'not_started'
}

/**
 * Segment ids are `${textId}#${index}` for both pack and user texts, so the
 * library can draw a heat strip without loading every segment of every surah.
 */
export function parseSegmentIndex(segmentId: string): number | null {
  const hash = segmentId.lastIndexOf('#')
  if (hash < 0) return null
  const index = Number(segmentId.slice(hash + 1))
  return Number.isInteger(index) ? index : null
}

/** Heat tiers straight from the items, without touching the segment table. */
export function tiersFromItems(items: ItemRecord[], now = Date.now()): Map<number, EvidenceTier> {
  const tiers = new Map<number, EvidenceTier>()
  for (const item of items) {
    const index = parseSegmentIndex(item.segmentId)
    if (index == null) continue
    const tier = evidenceTier(item, now)
    const current = tiers.get(index)
    tiers.set(index, current ? weaker(current, tier) : tier)
  }
  return tiers
}

export function summarise(
  text: TextRecord,
  segments: SegmentRecord[],
  items: ItemRecord[],
  now = Date.now(),
): TextSummary {
  const indexById = new Map(segments.map((s) => [s.id, s.index]))
  const tiers = new Map<number, EvidenceTier>()

  // A segment's tier is the weakest tier among the items that cover it, so the
  // strip never looks better than the shakiest thing in the line.
  for (const item of items) {
    const index = indexById.get(item.segmentId)
    if (index == null) continue
    const tier = evidenceTier(item, now)
    const current = tiers.get(index)
    tiers.set(index, current ? weaker(current, tier) : tier)
  }

  const withEvidence = items
    .filter((i) => i.lastEvidence)
    .sort((a, b) => (b.lastEvidence?.at ?? 0) - (a.lastEvidence?.at ?? 0))

  return {
    text,
    items,
    tiers,
    intent: deriveIntent(items),
    inPlan: new Set(items.map((i) => i.segmentId)).size,
    dueNow: items.filter((i) => i.intent !== 'paused' && i.due <= now).length,
    lastEvidence: withEvidence[0]?.lastEvidence,
  }
}

const TIER_STRENGTH: Record<EvidenceTier, number> = {
  untested: 0,
  weak: 1,
  fair: 2,
  strong: 3,
  cold_verified: 4,
}

function weaker(a: EvidenceTier, b: EvidenceTier): EvidenceTier {
  return TIER_STRENGTH[a] <= TIER_STRENGTH[b] ? a : b
}

// --- export / delete ------------------------------------------------------

export async function exportAll() {
  const [texts, segments, items, attempts, evidence, coldChecks] = await Promise.all([
    db.texts.toArray(),
    db.segments.toArray(),
    db.items.toArray(),
    db.attempts.toArray(),
    db.evidence.toArray(),
    db.coldChecks.toArray(),
  ])
  return {
    app: 'hifz',
    schema: 1,
    exportedAt: new Date().toISOString(),
    texts,
    segments,
    items,
    attempts,
    evidence,
    coldChecks,
  }
}

export async function deleteAll() {
  await db.transaction(
    'rw',
    [db.texts, db.segments, db.items, db.attempts, db.evidence, db.coldChecks],
    async () => {
      await Promise.all([
        db.texts.clear(),
        db.segments.clear(),
        db.items.clear(),
        db.attempts.clear(),
        db.evidence.clear(),
        db.coldChecks.clear(),
      ])
    },
  )
}
