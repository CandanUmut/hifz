import type { SegmentRecord, TextRecord } from '@/engine/types'
import type { Settings } from '@/state/settings'

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

/** Any meaning at all — decides whether `meaning` items can be generated. */
export function hasMeaning(segments: SegmentRecord[]): boolean {
  return segments.some((s) => Object.keys(s.translations).length > 0)
}
