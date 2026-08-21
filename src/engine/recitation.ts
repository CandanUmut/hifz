import { alignTokens } from './similarity'
import { editDistance, foldArabic } from '@/lib/text'

/**
 * Comparing what was recited with what should have been.
 *
 * The rule here is the one a teacher uses, not the one a spellchecker uses: if
 * the reader plainly recited the line, the line passed. A speech model is not
 * an examiner — it drops a word in a long breath, writes الله where the mushaf
 * writes ٱللَّه, glues a conjunction onto the next word, and hears a short
 * particle as part of its neighbour. Marking any of that wrong is the app being
 * wrong, and being told you failed something you recited correctly is the
 * fastest way to stop opening the app at all.
 *
 * So the comparison is forgiving twice over: about what counts as the same
 * word, and about how much of a line has to land before the line is accepted.
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
  /** 0–1 letter-level agreement, which survives a mis-split word. */
  letterScore: number
  /** The kinder of the two, and what the verdict is read from. */
  best: number
}

/**
 * Enough of the line landed. Deliberately low: the check exists to tell a
 * recitation from a blank, not to grade tajwīd.
 */
export const ACCEPT_SCORE = 0.5
/** Something was recited, but not enough of it to call the line remembered. */
export const PARTIAL_SCORE = 0.25

export type Verdict = 'accepted' | 'partial' | 'missed'

function normalise(word: string): string {
  return foldArabic(word)
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLocaleLowerCase()
}

/**
 * Arabic hangs single letters on the front of words — the wa- of conjunction,
 * the article, a preposition — and a transcript attaches them wherever it
 * pleases. The bare stem is the thing worth comparing.
 */
function stem(word: string): string {
  let out = word
  if (out.startsWith('ال') && out.length >= 5) out = out.slice(2)
  else if (/^[وفبكل]/.test(out) && out.length >= 4) out = out.slice(1)
  if (out.startsWith('ال') && out.length >= 5) out = out.slice(2)
  return out
}

/** One substitution per four letters, so long words are not held to the letter. */
function tolerance(length: number): number {
  if (length < 4) return 0
  if (length < 7) return 1
  return 2
}

/**
 * Two words count as the same if they read the same, if they differ by a
 * spelling's worth of letters, if they share a stem, or if one is the start of
 * the other — which is what a run-together transcript looks like.
 */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true

  const shortest = Math.min(a.length, b.length)
  const cap = tolerance(shortest)
  if (cap > 0 && editDistance(a, b, cap) <= cap) return true

  const sa = stem(a)
  const sb = stem(b)
  if (sa === sb && sa.length >= 3) return true
  if (Math.min(sa.length, sb.length) >= 4) {
    const stemCap = tolerance(Math.min(sa.length, sb.length))
    if (stemCap > 0 && editDistance(sa, sb, stemCap) <= stemCap) return true
  }

  // A glued transcript: "ربالعالمين" for "رب" then "العالمين".
  if (shortest >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  if (shortest >= 4 && (a.endsWith(b) || b.endsWith(a))) return true

  return false
}

/** Scattered letters agree by accident; a run of four does not. */
const MIN_RUN = 4

/**
 * Letters, ignoring where the spaces fell.
 *
 * Whisper decides word boundaries on its own, and it is often the only thing
 * it got wrong. Reading the two lines as one run of letters gives a second
 * opinion that a mis-split cannot spoil.
 *
 * Only unbroken runs count. Arabic has so few letters that any two lines share
 * a long scattered subsequence — al-Fātiḥa and al-Ikhlāṣ agree on half their
 * letters in order and on nothing else — so a subsequence alone would accept
 * the wrong surah.
 */
function letterAgreement(expected: string[], heard: string[]): number {
  const a = expected.join('').split('')
  const b = heard.join('').split('')
  if (!a.length) return 0
  if (!b.length) return 0
  // Long ayah against a long transcript is still only a few hundred squared.
  if (a.length * b.length > 400_000) return 0

  const pairs = alignTokens(a, b)
  let matched = 0
  let run = 0
  for (let k = 0; k < pairs.length; k++) {
    const continues =
      k > 0 && pairs[k][0] === pairs[k - 1][0] + 1 && pairs[k][1] === pairs[k - 1][1] + 1
    if (continues) {
      run++
      continue
    }
    if (run >= MIN_RUN) matched += run
    run = 1
  }
  if (run >= MIN_RUN) matched += run
  return matched / a.length
}

export function checkRecitation(heard: string, expectedWords: string[]): RecitationCheck {
  const heardWords = heard.split(/\s+/).filter(Boolean)
  const a = expectedWords.map(normalise).filter(Boolean)
  const b = heardWords.map(normalise).filter(Boolean)

  const pairs = alignTokens(a, b, sameWord)
  const matchedExpected = new Set(pairs.map(([i]) => i))
  const matchedHeard = new Set(pairs.map(([, j]) => j))

  const score = a.length ? pairs.length / a.length : 0
  const letterScore = letterAgreement(a, b)

  return {
    heard,
    heardWords,
    expectedWords,
    missing: a.map((_, i) => i).filter((i) => !matchedExpected.has(i)),
    extra: b.map((_, i) => i).filter((i) => !matchedHeard.has(i)),
    score,
    letterScore,
    best: Math.max(score, letterScore),
  }
}

export function verdict(check: RecitationCheck): Verdict {
  if (!check.heardWords.length) return 'missed'
  if (check.best >= ACCEPT_SCORE) return 'accepted'
  if (check.best >= PARTIAL_SCORE) return 'partial'
  return 'missed'
}

/**
 * A suggestion, not a verdict — the reader still grades. Speech recognition
 * mishears, and the app must not turn its own mistake into a lapse.
 */
export function suggestedRating(check: RecitationCheck): 1 | 2 | 3 {
  if (check.best >= 0.8) return 3
  if (check.best >= ACCEPT_SCORE) return 2
  return 1
}
