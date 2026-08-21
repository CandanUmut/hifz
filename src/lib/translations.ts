import type { SegmentRecord, TextRecord } from '@/engine/types'
import type { Settings } from '@/state/settings'

export interface ResolvedTransliteration {
  text: string
  title: string
  /** One token per Arabic word, so it can follow the recitation. */
  aligned: boolean
}

export interface ResolvedMeaning {
  tr?: { text: string; title: string }
  en?: { text: string; title: string }
}

/**
 * Maps a segment's edition-keyed translations onto the two the user picked,
 * falling back to whatever the text actually carries rather than showing
 * nothing because a preferred edition is missing from this pack.
 */
export function resolveMeaning(
  segment: SegmentRecord,
  text: TextRecord | undefined,
  settings: Pick<Settings, 'trEdition' | 'enEdition'>,
): ResolvedMeaning {
  const editions = text?.editions ?? []
  const titleOf = (id: string) => editions.find((e) => e.id === id)?.title ?? id

  const pick = (preferred: string, lang: string) => {
    if (segment.translations[preferred]) {
      return { text: segment.translations[preferred], title: titleOf(preferred) }
    }
    const alt = editions.find((e) => e.lang === lang && segment.translations[e.id])
    if (alt) return { text: segment.translations[alt.id], title: alt.title }
    return undefined
  }

  const resolved: ResolvedMeaning = {
    tr: pick(settings.trEdition, 'tr'),
    en: pick(settings.enEdition, 'en'),
  }

  // A user text has one nameless translation stream; show it rather than hide it.
  if (!resolved.tr && !resolved.en) {
    const [id, value] = Object.entries(segment.translations)[0] ?? []
    if (id && value) resolved.tr = { text: value, title: titleOf(id) }
  }
  return resolved
}

/**
 * The meanings to actually print, in reading order.
 *
 * Every screen used to reach for `meaning.tr` directly, which meant someone
 * using the app in English read the Turkish translation under every ayah —
 * and the two toggles that were supposed to control this were honoured on one
 * screen out of four.
 */
export function meaningLines(
  meaning: ResolvedMeaning,
  settings: Pick<Settings, 'showTranslationTr' | 'showTranslationEn'>,
): { text: string; title: string }[] {
  const lines: { text: string; title: string }[] = []
  if (settings.showTranslationTr && meaning.tr) lines.push(meaning.tr)
  if (settings.showTranslationEn && meaning.en) lines.push(meaning.en)
  // Asked for a translation, and the text has one in the other language only.
  if (!lines.length && (settings.showTranslationTr || settings.showTranslationEn)) {
    const only = meaning.tr ?? meaning.en
    if (only) lines.push(only)
  }
  return lines
}

/**
 * The transliteration to print under a line. Falls back to whatever the text
 * carries so a pack without the preferred edition still shows something.
 */
export function resolveTransliteration(
  segment: SegmentRecord,
  text: TextRecord | undefined,
  settings: Pick<Settings, 'translitEdition' | 'showTransliteration'>,
): ResolvedTransliteration | undefined {
  if (!settings.showTransliteration) return undefined
  const available = segment.transliterations
  if (!available) return undefined
  const editions = text?.transliterationEditions ?? []
  const titleOf = (id: string) => editions.find((e) => e.id === id)?.title ?? id

  const id = available[settings.translitEdition]
    ? settings.translitEdition
    : Object.keys(available)[0]
  if (!id) return undefined
  return { text: available[id], title: titleOf(id), aligned: id === 'aligned' }
}

/** Any transliteration at all — decides whether the toggle is worth showing. */
export function hasTransliteration(segments: SegmentRecord[]): boolean {
  return segments.some((s) => s.transliterations && Object.keys(s.transliterations).length > 0)
}

/** Any meaning at all — decides whether `meaning` items can be generated. */
export function hasMeaning(segments: SegmentRecord[]): boolean {
  return segments.some((s) => Object.keys(s.translations).length > 0)
}
