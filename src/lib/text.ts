/** Text helpers shared by the response modes. Nothing here mutates content. */

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

export function stripMarks(input: string): string {
  return input.replace(ARABIC_MARKS, '')
}

/** أ إ آ ٱ all count as ا when matching a typed initial. */
export function foldArabic(input: string): string {
  return stripMarks(input)
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

export function words(content: string): string[] {
  return content.split(/\s+/).filter(Boolean)
}

/**
 * The authoritative token list for a segment.
 *
 * Whitespace is not a reliable word boundary in a mushaf: a waqf mark such as ۖ
 * is written after a word with a space before it but belongs to that word, and
 * splitting there produced an order-tap chip nobody could place and a
 * type-initials slot nobody could type. When a pack ships `words`, that is the
 * tokenisation — for the ink fade, the response modes and the audio highlight
 * alike. User texts have no word list, so they fall back to whitespace.
 */
export function segmentWords(segment: {
  content: string
  words?: { ar: string }[]
}): string[] {
  if (segment.words?.length) return segment.words.map((w) => w.ar)
  return words(segment.content)
}

/**
 * The letter a user would type for a word. Diacritics are dropped: nobody
 * types a fatḥa, and demanding one would fail correct answers.
 */
export function initialOf(word: string): string {
  const folded = foldArabic(word)
  const first = [...folded][0] ?? ''
  return first.toLocaleLowerCase()
}

export function initialsOf(tokens: string[]): string[] {
  return tokens.map(initialOf)
}

export function sameInitial(typed: string, expected: string): boolean {
  if (!typed) return false
  return foldArabic(typed).toLocaleLowerCase().slice(0, 1) === expected
}

/** Deterministic shuffle so a re-render does not reorder the chips mid-tap. */
export function shuffle<T>(input: T[], seed: number): T[] {
  const out = [...input]
  let state = seed || 1
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
