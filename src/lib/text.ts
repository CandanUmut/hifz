/** Text helpers shared by the response modes. Nothing here mutates content. */

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

/**
 * The dagger alif is a letter, not an ornament.
 *
 * The mushaf writes ٱلْعَـٰلَمِينَ with a superscript alef where plain orthography
 * puts a full ا, and every transcript writes it out. Stripping it along with
 * the diacritics left العلمين, which matches nothing — and it appears in 46% of
 * the ayah in these packs, so half of all recitation checks failed on it alone.
 */
const DAGGER_ALIF = /ٰ/g

export function stripMarks(input: string): string {
  return input.replace(DAGGER_ALIF, 'ا').replace(ARABIC_MARKS, '')
}

/** Orthographic variants that carry no difference in sound. */
export function foldArabic(input: string): string {
  return stripMarks(input)
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

/**
 * Levenshtein distance, capped: anything past the cap is not interesting, and
 * stopping early keeps a whole-ayah comparison cheap.
 */
export function editDistance(a: string, b: string, cap = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      best = Math.min(best, row[j])
    }
    if (best > cap) return cap + 1
    prev = row
  }
  return prev[b.length]
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

