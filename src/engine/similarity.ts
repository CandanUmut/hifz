import { foldArabic } from '@/lib/text'
import { segmentWords } from '@/lib/text'

/**
 * Mutashābihāt — passages that are nearly the same, and therefore interfere
 * with each other. They are the second thing that breaks a recitation after
 * the joins: you reach the end of a familiar line and take the wrong branch.
 *
 * The graph is built over the segments actually on this device. It is not a
 * scholarly concordance and does not pretend to be: it reports what looks
 * alike among the texts the reader has opened.
 */

/** Below this many words a match says nothing — every ayah shares short phrases. */
const MIN_TOKENS = 3
/** Order-aware similarity, so a reordering is not treated as the same line. */
const MIN_SCORE = 0.6
/** Consecutive words used to prefilter candidate pairs. */
const SHINGLE = 2

export interface SegmentLike {
  id: string
  textId: string
  index: number
  ref?: string
  content: string
  words?: { ar: string }[]
}

export interface Match {
  segmentId: string
  textId: string
  index: number
  ref?: string
  /** 0–1, order aware. 1 means the same words in the same order. */
  score: number
  identical: boolean
  /** Word positions in *this* segment that the other one does not have. */
  differing: number[]
  /** Word positions in the *other* segment that this one does not have. */
  otherDiffering: number[]
}

export type InterferenceGraph = Map<string, Match[]>

/** Diacritics and alef variants carry no weight for judging resemblance. */
export function normalizeTokens(words: string[]): string[] {
  return words.map((w) => foldArabic(w).replace(/\s+/g, '')).filter(Boolean)
}

interface Prepared {
  segment: SegmentLike
  tokens: string[]
}

/**
 * Longest common subsequence, with the matched pairs kept so the caller can
 * show which words actually differ rather than just how similar two lines are.
 */
export function alignTokens(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length
  const m = b.length
  if (!n || !m) return []
  // table[i][j] = LCS length of a[i..] and b[j..]
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const pairs: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return pairs
}

export function similarity(a: string[], b: string[]): { score: number; pairs: Array<[number, number]> } {
  const pairs = alignTokens(a, b)
  const score = (2 * pairs.length) / (a.length + b.length)
  return { score, pairs }
}

export interface GraphOptions {
  minScore?: number
  minTokens?: number
  /** Cap per segment so one very repetitive text cannot flood the list. */
  maxMatches?: number
}

export function buildInterferenceGraph(
  segments: SegmentLike[],
  options: GraphOptions = {},
): InterferenceGraph {
  const minScore = options.minScore ?? MIN_SCORE
  const minTokens = options.minTokens ?? MIN_TOKENS
  const maxMatches = options.maxMatches ?? 6

  const prepared: Prepared[] = segments
    .map((segment) => ({ segment, tokens: normalizeTokens(segmentWords(segment)) }))
    .filter((p) => p.tokens.length >= minTokens)

  // Inverted index of word pairs, so we only score pairs that share a phrase
  // rather than comparing every segment with every other one.
  const buckets = new Map<string, number[]>()
  prepared.forEach((p, i) => {
    const seen = new Set<string>()
    for (let k = 0; k + SHINGLE <= p.tokens.length; k++) {
      const key = p.tokens.slice(k, k + SHINGLE).join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      const list = buckets.get(key)
      if (list) list.push(i)
      else buckets.set(key, [i])
    }
  })

  const candidates = new Map<number, Set<number>>()
  for (const list of buckets.values()) {
    // A phrase shared by half the corpus tells us nothing; skip those buckets.
    if (list.length < 2 || list.length > 40) continue
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const set = candidates.get(list[x]) ?? new Set<number>()
        set.add(list[y])
        candidates.set(list[x], set)
      }
    }
  }

  const graph: InterferenceGraph = new Map()
  const add = (from: Prepared, to: Prepared, score: number, differing: number[], otherDiffering: number[]) => {
    const list = graph.get(from.segment.id) ?? []
    list.push({
      segmentId: to.segment.id,
      textId: to.segment.textId,
      index: to.segment.index,
      ref: to.segment.ref,
      score,
      identical: score === 1,
      differing,
      otherDiffering,
    })
    graph.set(from.segment.id, list)
  }

  for (const [i, others] of candidates) {
    for (const j of others) {
      const a = prepared[i]
      const b = prepared[j]
      const { score, pairs } = similarity(a.tokens, b.tokens)
      if (score < minScore) continue

      const matchedA = new Set(pairs.map(([x]) => x))
      const matchedB = new Set(pairs.map(([, y]) => y))
      const aDiff = a.tokens.map((_, k) => k).filter((k) => !matchedA.has(k))
      const bDiff = b.tokens.map((_, k) => k).filter((k) => !matchedB.has(k))

      add(a, b, score, aDiff, bDiff)
      add(b, a, score, bDiff, aDiff)
    }
  }

  for (const [id, list] of graph) {
    list.sort((x, y) => y.score - x.score || x.index - y.index)
    graph.set(id, list.slice(0, maxMatches))
  }
  return graph
}

export interface Cluster {
  /** Segment ids that all resemble each other, in reading order. */
  segmentIds: string[]
  /** Weakest pairwise score in the cluster — how alike the whole group is. */
  score: number
}

/** Connected components, so a set of near-identical lines is shown as one group. */
export function clusters(graph: InterferenceGraph): Cluster[] {
  const seen = new Set<string>()
  const out: Cluster[] = []

  for (const id of graph.keys()) {
    if (seen.has(id)) continue
    const stack = [id]
    const members: string[] = []
    let lowest = 1
    seen.add(id)
    while (stack.length) {
      const current = stack.pop()!
      members.push(current)
      for (const match of graph.get(current) ?? []) {
        lowest = Math.min(lowest, match.score)
        if (seen.has(match.segmentId)) continue
        seen.add(match.segmentId)
        stack.push(match.segmentId)
      }
    }
    if (members.length > 1) out.push({ segmentIds: members, score: lowest })
  }

  return out.sort((a, b) => b.score - a.score || b.segmentIds.length - a.segmentIds.length)
}

// --- memo -----------------------------------------------------------------

let cacheKey = ''
let cached: InterferenceGraph = new Map()

/**
 * Rebuilding costs a beat, and every screen that wants the graph wants the
 * same one, so it is kept until the set of segments changes.
 */
export function getInterferenceGraph(segments: SegmentLike[]): InterferenceGraph {
  const key = `${segments.length}:${segments.map((s) => s.id).join('|')}`
  if (key === cacheKey) return cached
  cacheKey = key
  cached = buildInterferenceGraph(segments)
  return cached
}
