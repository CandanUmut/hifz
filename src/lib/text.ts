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

