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

/**
 * A rough Latin letter per Arabic letter, for texts with no transliteration of
 * their own. Digraphs collapse to their first letter — nobody is going to type
 * both halves of "kh" into one slot.
 */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'a', آ: 'a', ٱ: 'a', ء: 'a', ع: 'a',
  ب: 'b', ت: 't', ث: 't', ط: 't',
  ج: 'j', ح: 'h', ه: 'h', ة: 'h', خ: 'k', ك: 'k',
  د: 'd', ذ: 'd', ض: 'd',
  ر: 'r', ز: 'z', ظ: 'z',
  س: 's', ش: 's', ص: 's',
  غ: 'g', ف: 'f', ق: 'q', ل: 'l', م: 'm', ن: 'n',
  و: 'w', ي: 'y', ى: 'y',
}

/**
 * First Latin letter of a transliteration. Leading ʿayn and hamza marks are
 * skipped — they are not on anyone's keyboard — as are the macrons and dots
 * that scholarly transliteration puts on letters.
 */
export function latinInitial(translit: string): string {
  const stripped = translit
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ʿʾʻʼ'`‘’-]/g, '')
  const match = /[a-z]/i.exec(stripped)
  return match ? match[0].toLowerCase() : ''
}

/**
 * Every letter that should be accepted for one word.
 *
 * Typing the Arabic initial assumes an Arabic keyboard and Arabic spelling,
 * which is a different skill from having the passage memorised — so the Latin
 * initial counts too. The set is deliberately generous: ٱللَّهُ is transliterated
 * both "l-lahu" and "al-lahu" in the same surah, and for a word carrying the
 * definite article the letter someone thinks of is usually the one after it —
 * "s" for ٱلصَّمَدُ, not "a". What the test still holds you to is the word order
 * and the word count, which is what it was ever measuring.
 */
export function acceptedInitials(word: string, translit?: string): Set<string> {
  const out = new Set<string>()
  const add = (value: string) => {
    if (value) out.add(value.toLocaleLowerCase())
  }

  const folded = foldArabic(word)
  const first = [...folded][0] ?? ''
  add(first)
  add(ARABIC_TO_LATIN[first])
  if (translit) add(latinInitial(translit))

  // Past the definite article, for both scripts.
  const withoutArticle = folded.replace(/^ال/, '')
  if (withoutArticle && withoutArticle !== folded) {
    const stem = [...withoutArticle][0] ?? ''
    add(stem)
    add(ARABIC_TO_LATIN[stem])
  }
  if (translit) {
    const stemTranslit = translit.replace(/^(al|l)[-\u2010-\u2015 ]?/i, '')
    add(latinInitial(stemTranslit))
  }

  return out
}

export function initialsOf(tokens: string[], translits?: (string | undefined)[]): Set<string>[] {
  return tokens.map((token, i) => acceptedInitials(token, translits?.[i]))
}

export function sameInitial(typed: string, accepted: Set<string> | undefined): boolean {
  if (!typed || !accepted) return false
  const arabic = foldArabic(typed).toLocaleLowerCase().slice(0, 1)
  if (accepted.has(arabic)) return true
  return accepted.has(typed.toLocaleLowerCase().slice(0, 1))
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
