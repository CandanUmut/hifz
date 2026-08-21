import { alignTokens } from './similarity'
import { editDistance, foldArabic } from '@/lib/text'

/**
 * Comparing what was recited with what should have been.
 *
 * The comparison is deliberately forgiving about orthography and strict about
 * words: a transcript writes الله where the mushaf writes ٱللَّه, and marking
 * that wrong would be the app being wrong, not the reader. What it will not
 * forgive is a missing or substituted word.
 */

export interface RecitationCheck {
  /** What the model heard, as written. */
  heard: string
  heardWords: string[]
  expectedWords: string[]
  /** Positions in the expected line that were not recited. */
  missing: number[]
  /** Positions in the transcript with no counterpart in the line. */
  extra: number[]
  /** 0–1 share of the expected words that were recited, in order. */
  score: number
}

function normalise(word: string): string {
  return foldArabic(word)
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLocaleLowerCase()
}

/**
 * Two words count as the same if they read the same, or differ by a single
 * letter in a word long enough for that to be spelling rather than memory.
 * Transcripts and the mushaf disagree constantly on orthography, and marking
 * those wrong is the app being wrong.
 */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 4) return false
  return editDistance(a, b, 1) <= 1
}

export function checkRecitation(heard: string, expectedWords: string[]): RecitationCheck {
  const heardWords = heard.split(/\s+/).filter(Boolean)
  const a = expectedWords.map(normalise).filter(Boolean)
  const b = heardWords.map(normalise).filter(Boolean)

  const pairs = alignTokens(a, b, sameWord)
  const matchedExpected = new Set(pairs.map(([i]) => i))
  const matchedHeard = new Set(pairs.map(([, j]) => j))

  return {
    heard,
    heardWords,
    expectedWords,
    missing: a.map((_, i) => i).filter((i) => !matchedExpected.has(i)),
    extra: b.map((_, i) => i).filter((i) => !matchedHeard.has(i)),
    score: a.length ? pairs.length / a.length : 0,
  }
}

/**
 * A suggestion, not a verdict — the reader still grades. Speech recognition
 * mishears, and the app must not turn its own mistake into a lapse.
 */
export function suggestedRating(check: RecitationCheck): 1 | 2 | 3 {
  if (check.score >= 0.995 && check.extra.length === 0) return 3
  if (check.score >= 0.85) return 2
  return 1
}
