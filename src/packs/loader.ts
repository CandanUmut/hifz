import type {
  EditionInfo,
  SegmentRecord,
  TextRecord,
  TransliterationInfo,
  Word,
} from '@/engine/types'

/**
 * Packs are static JSON in public/packs. Nothing here talks to an API — see
 * docs/pack-schema.md and scripts/build-packs.ts.
 */

const ROOT = `${import.meta.env.BASE_URL}packs`

export interface PackIndexEntry {
  id: string
  title: string
  subtitle: string
  version: string
  file: string
  textCount: number
  segmentCount: number
}

export interface PackManifest {
  schema: number
  id: string
  version: string
  builtAt: string
  title: string
  subtitle: string
  lang: string
  dir: 'rtl' | 'ltr'
  license: string
  attribution: { source: string; sourceUrl: string; edition: string; translator: string }
  sources: {
    arabic: { source: string; edition: string; sourceUrl: string; license: string }
    translations: EditionInfo[]
    transliterations?: TransliterationInfo[]
    wordByWord: { source: string; sourceUrl: string }
    audio: { source: string; sourceUrl: string; reciter: string; style: string }
  }
  texts: Array<{
    id: string
    index: number
    title: string
    titleArabic: string
    titleTr: string
    segmentCount: number
    file: string
  }>
}

export interface PackTextFile {
  id: string
  packId: string
  index: number
  title: string
  titleArabic: string
  titleTr: string
  lang: string
  dir: 'rtl' | 'ltr'
  audioUrl?: string
  segments: Array<{
    index: number
    ref: string
    content: string
    translations: Record<string, string>
    transliterations?: Record<string, string>
    words?: Word[]
    audio?: { from: number; to: number; wordTimings?: [number, number, number][] }
  }>
}

const cache = new Map<string, unknown>()

/**
 * Thrown when a pack file is not on the device and cannot be reached — the
 * ordinary case for a surah never opened before, offline.
 */
export class PackUnavailableError extends Error {
  readonly offline: boolean
  constructor(offline: boolean) {
    super(
      offline
        ? 'This one has not been downloaded yet, and there is no connection right now.'
        : 'This one has not been downloaded yet, and it could not be fetched just now.',
    )
    this.name = 'PackUnavailableError'
    this.offline = offline
  }
}

async function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url)
  if (hit) return hit as T
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new PackUnavailableError(typeof navigator !== 'undefined' && !navigator.onLine)
  }
  if (!res.ok) throw new PackUnavailableError(false)
  const data = (await res.json()) as T
  cache.set(url, data)
  return data
}

export function listPacks(): Promise<{ schema: number; packs: PackIndexEntry[] }> {
  return getJson(`${ROOT}/index.json`)
}

export function loadManifest(entry: PackIndexEntry): Promise<PackManifest> {
  return getJson(`${ROOT}/${entry.file}`)
}

export function loadPackText(manifest: PackManifest, file: string): Promise<PackTextFile> {
  return getJson(`${ROOT}/${manifest.id}/${file}`)
}

/** Turns a pack text into the records the local database stores. */
export function toRecords(
  manifest: PackManifest,
  file: PackTextFile,
): { text: TextRecord; segments: SegmentRecord[] } {
  const text: TextRecord = {
    id: file.id,
    title: file.title,
    source: 'pack',
    lang: file.lang,
    dir: file.dir,
    packId: manifest.id,
    packIndex: file.index,
    titleArabic: file.titleArabic,
    titleTr: file.titleTr,
    audioUrl: file.audioUrl,
    reciter: manifest.sources.audio.reciter,
    segmentCount: file.segments.length,
    editions: manifest.sources.translations,
    transliterationEditions: manifest.sources.transliterations,
    attribution: manifest.attribution,
    license: manifest.license,
    createdAt: Date.now(),
  }
  const segments: SegmentRecord[] = file.segments.map((s) => ({
    id: `${file.id}#${s.index}`,
    textId: file.id,
    index: s.index,
    ref: s.ref,
    content: s.content,
    translations: s.translations,
    transliterations: s.transliterations,
    words: s.words,
    audio: s.audio,
  }))
  return { text, segments }
}
