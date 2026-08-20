/**
 * Build-time snapshot of Qur'an content into static packs under public/packs/.
 *
 * The shipped app never calls any of these APIs at runtime: the packs are
 * plain JSON files, so the app works offline and nobody's donation-funded
 * server carries our traffic. Re-run this script to update a pack.
 *
 *   npm run build:packs -- --pack=juz-amma --provider=auto
 *
 * Sources, and why each one:
 *
 *   Arabic + word-by-word + audio timings — Quran.com API v4 (Quran Foundation).
 *     The Arabic text and the word list must come from the same place, or the
 *     words would not concatenate back into the ayah and the order-tap and
 *     type-initials response modes would silently break.
 *
 *   Turkish translation — Açık Kuran (github.com/acik-kuran/acikkuran-api),
 *     the volunteer project this app was told to build on. Falls back to the
 *     same edition mirrored on the quran-api CDN when Açık Kuran is not
 *     reachable; whichever one actually ran is recorded in the pack.
 *
 *   English translation — quran-api CDN (github.com/fawazahmed0/quran-api).
 *
 * Every edition's attribution travels with the pack and is surfaced in the UI.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// --- endpoints ------------------------------------------------------------

const QURAN_API = 'https://api.quran.com/api/v4'
const QURAN_QDC = 'https://api.quran.com/api/qdc'
const QURAN_CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1'
const ACIKKURAN = 'https://api.acikkuran.com'
const AUDIO_HOST = 'https://download.quranicaudio.com'

const SCHEMA_VERSION = 1

// --- pack definitions -----------------------------------------------------

interface PackDef {
  id: string
  title: string
  subtitle: string
  surahs: number[]
}

const PACKS: Record<string, PackDef> = {
  'al-fatiha': {
    id: 'quran-al-fatiha',
    title: 'Al-Fātiḥa',
    subtitle: 'The opening — 7 ayah',
    surahs: [1],
  },
  'juz-amma': {
    id: 'quran-juz-amma',
    title: 'Juz ʿAmma',
    subtitle: 'Surah 78–114, the last thirtieth',
    surahs: Array.from({ length: 37 }, (_, i) => 78 + i),
  },
}

// --- translation editions -------------------------------------------------

interface EditionDef {
  /** Stable id used by the app and stored in Settings. */
  id: string
  lang: 'tr' | 'en'
  title: string
  translator: string
  /** Slug on the quran-api CDN. */
  cdnSlug: string
  sourceUrl: string
  license: string
}

/**
 * Transliteration is not a translation — it is the same text in another
 * script — so it is kept in its own field. Putting it in `translations` would
 * make it eligible to generate `meaning` items, which would be nonsense.
 */
interface TransliterationDef {
  id: string
  title: string
  hint: string
  /** Slug on the quran-api CDN, or null for the one derived from the words. */
  cdnSlug: string | null
  sourceUrl: string
  license: string
}

const TRANSLITERATIONS: TransliterationDef[] = [
  {
    id: 'easy',
    title: 'Readable',
    hint: 'Spelled the way it is recited — "Qul huwal laahu ahad".',
    cdnSlug: 'ara-quran-la1',
    sourceUrl: 'https://quran411.com',
    license: 'Freely distributed transliteration; no restriction stated.',
  },
  {
    id: 'scholarly',
    title: 'Scholarly',
    hint: 'Full diacritics — "Qul Huwa Allāhu ʾAĥadun".',
    cdnSlug: 'ara-quranphoneticst',
    sourceUrl: 'https://github.com/fawazahmed0/quran-api',
    license: 'Freely distributed transliteration; no restriction stated.',
  },
  {
    id: 'aligned',
    title: 'Word-aligned',
    hint: 'One token per Arabic word, so it follows the recitation word by word.',
    cdnSlug: null,
    sourceUrl: 'https://api-docs.quran.foundation',
    license: 'Quran.com API v4 word-by-word transliteration.',
  },
]

const EDITIONS: EditionDef[] = [
  {
    id: 'elmalili-sadelestirilmis',
    lang: 'tr',
    title: 'Elmalılı Hamdi Yazır (sadeleştirilmiş)',
    translator: 'Elmalılı Muhammed Hamdi Yazır',
    cdnSlug: 'tur-elmallsadelesti',
    sourceUrl: 'https://github.com/fawazahmed0/quran-api',
    license: 'Public domain (translator d. 1942); compiled edition released without restriction.',
  },
  {
    id: 'diyanet-isleri',
    lang: 'tr',
    title: 'Diyanet İşleri Meali',
    translator: 'Diyanet İşleri Başkanlığı',
    cdnSlug: 'tur-diyanetisleri',
    sourceUrl: 'https://tanzil.net',
    license: 'Tanzil.net terms — free for non-commercial use with attribution.',
  },
  {
    id: 'clear-quran',
    lang: 'en',
    title: 'The Clear Quran',
    translator: 'Dr. Mustafa Khattab',
    cdnSlug: 'eng-mustafakhattaba',
    sourceUrl: 'https://quran.com',
    license: 'Used with permission of the translator for non-commercial distribution.',
  },
  {
    id: 'pickthall',
    lang: 'en',
    title: 'The Meaning of the Glorious Koran',
    translator: 'Marmaduke Pickthall',
    cdnSlug: 'eng-mohammedmarmadu',
    sourceUrl: 'https://tanzil.net',
    license: 'Public domain (first published 1930).',
  },
]

/**
 * Reciter whose word timings get snapshotted into the pack. Timings are
 * per-recitation, so switching reciter means rebuilding the pack:
 *   npm run build:packs -- --reciter=6
 * Ids come from https://api.quran.com/api/v4/resources/recitations.
 */
const RECITERS: Record<number, { name: string; style: string }> = {
  1: { name: 'AbdulBaset AbdulSamad', style: 'Mujawwad' },
  2: { name: 'AbdulBaset AbdulSamad', style: 'Murattal' },
  3: { name: 'Abdur-Rahman as-Sudais', style: 'Murattal' },
  4: { name: 'Abu Bakr al-Shatri', style: 'Murattal' },
  5: { name: 'Hani ar-Rifai', style: 'Murattal' },
  6: { name: 'Mahmoud Khalil Al-Husary', style: 'Murattal' },
  7: { name: 'Mishari Rashid al-Afasy', style: 'Murattal' },
}

// --- pack file shapes (documented in docs/pack-schema.md) -----------------

export interface PackWord {
  ar: string
  translit?: string
  en?: string
}

export interface PackSegment {
  index: number
  /** Human reference, e.g. "78:4". */
  ref: string
  /** Built by joining `words`, so the two can never disagree. */
  content: string
  translations: Record<string, string>
  /** Keyed by transliteration edition id. Never a translation. */
  transliterations?: Record<string, string>
  words?: PackWord[]
  audio?: { from: number; to: number; wordTimings?: [number, number, number][] }
}

export interface PackText {
  id: string
  packId: string
  index: number
  title: string
  titleArabic: string
  titleTr: string
  lang: string
  dir: 'rtl' | 'ltr'
  revelationPlace: string
  /** Whether the surah is preceded by the basmala when recited. */
  bismillahPre: boolean
  audioUrl?: string
  segments: PackSegment[]
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
  attribution: {
    source: string
    sourceUrl: string
    edition: string
    translator: string
  }
  sources: {
    arabic: { source: string; edition: string; sourceUrl: string; license: string }
    translations: Array<
      Pick<EditionDef, 'id' | 'lang' | 'title' | 'translator' | 'sourceUrl' | 'license'> & {
        source: string
      }
    >
    transliterations: Array<{
      id: string
      title: string
      hint: string
      source: string
      sourceUrl: string
      license: string
    }>
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

// --- tiny fetch helpers ---------------------------------------------------

async function getJson<T>(url: string, tries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return (await res.json()) as T
    } catch (err) {
      lastError = err
      await sleep(400 * 2 ** attempt)
    }
  }
  throw new Error(`GET ${url} failed: ${String(lastError)}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// --- Turkish provider -----------------------------------------------------

type VerseMap = Map<string, string> // "78:4" -> text

interface TurkishResult {
  provider: 'acikkuran' | 'mirror'
  source: string
  verses: VerseMap
}

/**
 * Açık Kuran exposes one endpoint per surah, with the translator chosen by
 * author id. Author ids are looked up by name so a renumbering upstream does
 * not silently swap the edition.
 */
async function fetchTurkishFromAcikKuran(surahs: number[]): Promise<TurkishResult> {
  interface Author {
    id: number
    name: string
    description?: string
  }
  const authors = await getJson<{ data: Author[] }>(`${ACIKKURAN}/authors`, 1)
  const list = authors.data ?? []
  const elmalili =
    list.find((a) => /elmal/i.test(a.name) && /sadele/i.test(`${a.name} ${a.description ?? ''}`)) ??
    list.find((a) => /elmal/i.test(a.name))
  if (!elmalili) throw new Error('Açık Kuran: no Elmalılı author found')

  const verses: VerseMap = new Map()
  for (const surah of surahs) {
    interface Verse {
      verse_number: number
      translation?: { text?: string }
    }
    const body = await getJson<{ data: { verses: Verse[] } }>(
      `${ACIKKURAN}/surah/${surah}?author=${elmalili.id}`,
      2,
    )
    for (const verse of body.data.verses) {
      const text = verse.translation?.text
      if (text) verses.set(`${surah}:${verse.verse_number}`, text.trim())
    }
    await sleep(120)
  }
  return {
    provider: 'acikkuran',
    source: `Açık Kuran — ${elmalili.name}`,
    verses,
  }
}

async function fetchEditionFromCdn(slug: string): Promise<VerseMap> {
  interface Row {
    chapter: number
    verse: number
    text: string
  }
  const body = await getJson<{ quran: Row[] }>(`${QURAN_CDN}/editions/${slug}.min.json`)
  const map: VerseMap = new Map()
  for (const row of body.quran) map.set(`${row.chapter}:${row.verse}`, row.text.trim())
  return map
}

// --- Quran.com -------------------------------------------------------------

interface Chapter {
  id: number
  name_simple: string
  name_arabic: string
  verses_count: number
  revelation_place: string
  bismillah_pre: boolean
  translated_name: { name: string }
}

async function fetchChapters(): Promise<Map<number, Chapter>> {
  const body = await getJson<{ chapters: Chapter[] }>(`${QURAN_API}/chapters?language=tr`)
  return new Map(body.chapters.map((c) => [c.id, c]))
}

interface ApiWord {
  position: number
  char_type_name: string
  text_uthmani: string
  translation?: { text?: string }
  transliteration?: { text?: string | null }
}

interface ApiVerse {
  verse_key: string
  verse_number: number
  text_uthmani: string
  words: ApiWord[]
}

async function fetchVerses(surah: number): Promise<ApiVerse[]> {
  const url =
    `${QURAN_API}/verses/by_chapter/${surah}` +
    `?words=true&fields=text_uthmani&word_fields=text_uthmani&language=en&per_page=300`
  const body = await getJson<{ verses: ApiVerse[] }>(url)
  return body.verses
}

interface VerseTiming {
  verse_key: string
  timestamp_from: number
  timestamp_to: number
  segments: number[][]
}

interface AudioFile {
  audio_url: string
  verse_timings: VerseTiming[]
}

async function fetchAudio(surah: number, reciterId: number): Promise<AudioFile | null> {
  try {
    const body = await getJson<{ audio_files: AudioFile[] }>(
      `${QURAN_QDC}/audio/reciters/${reciterId}/audio_files?chapter=${surah}&segments=true`,
      2,
    )
    return body.audio_files?.[0] ?? null
  } catch (err) {
    console.warn(`  audio unavailable for surah ${surah}: ${String(err)}`)
    return null
  }
}

// --- build ----------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function build(packKey: string) {
  const def = PACKS[packKey]
  if (!def) throw new Error(`unknown pack "${packKey}" (have: ${Object.keys(PACKS).join(', ')})`)

  const outRoot = path.resolve(process.cwd(), arg('out', 'public/packs'))
  const outDir = path.join(outRoot, def.id)
  await mkdir(outDir, { recursive: true })

  const wantAudio = !process.argv.includes('--no-audio')
  const providerChoice = arg('provider', 'auto')
  const reciterId = Number(arg('reciter', '7'))
  const reciter = RECITERS[reciterId]
  if (wantAudio && !reciter) {
    throw new Error(`unknown reciter ${reciterId} (have: ${Object.keys(RECITERS).join(', ')})`)
  }

  console.log(`\n${def.title} — ${def.surahs.length} surah`)

  // Turkish, from Açık Kuran where reachable.
  let turkish: TurkishResult
  if (providerChoice === 'mirror') {
    turkish = {
      provider: 'mirror',
      source: 'quran-api CDN mirror of the Elmalılı (sadeleştirilmiş) edition',
      verses: await fetchEditionFromCdn('tur-elmallsadelesti'),
    }
  } else {
    try {
      turkish = await fetchTurkishFromAcikKuran(def.surahs)
      console.log(`  Turkish: ${turkish.source}`)
    } catch (err) {
      if (providerChoice === 'acikkuran') throw err
      console.warn(`  Açık Kuran unreachable (${String(err)})`)
      console.warn('  falling back to the quran-api CDN mirror of the same edition')
      turkish = {
        provider: 'mirror',
        source: 'quran-api CDN mirror of the Elmalılı (sadeleştirilmiş) edition',
        verses: await fetchEditionFromCdn('tur-elmallsadelesti'),
      }
    }
  }

  // Remaining editions from the CDN.
  const editionVerses = new Map<string, VerseMap>()
  for (const edition of EDITIONS) {
    if (edition.id === 'elmalili-sadelestirilmis') {
      editionVerses.set(edition.id, turkish.verses)
      continue
    }
    console.log(`  fetching ${edition.title}`)
    editionVerses.set(edition.id, await fetchEditionFromCdn(edition.cdnSlug))
  }

  const translitVerses = new Map<string, VerseMap>()
  for (const edition of TRANSLITERATIONS) {
    if (!edition.cdnSlug) continue
    console.log(`  fetching transliteration: ${edition.title}`)
    translitVerses.set(edition.id, await fetchEditionFromCdn(edition.cdnSlug))
  }

  const chapters = await fetchChapters()
  const texts: PackManifest['texts'] = []

  for (const surah of def.surahs) {
    const chapter = chapters.get(surah)
    if (!chapter) throw new Error(`no chapter metadata for ${surah}`)
    const verses = await fetchVerses(surah)
    const audio = wantAudio ? await fetchAudio(surah, reciterId) : null
    const timings = new Map(audio?.verse_timings.map((t) => [t.verse_key, t]) ?? [])

    const segments: PackSegment[] = verses.map((verse, index) => {
      const ref = verse.verse_key
      const words = verse.words
        .filter((w) => w.char_type_name === 'word')
        .map<PackWord>((w) => ({
          ar: w.text_uthmani,
          translit: w.transliteration?.text ?? undefined,
          en: w.translation?.text ?? undefined,
        }))

      const translations: Record<string, string> = {}
      for (const edition of EDITIONS) {
        const text = editionVerses.get(edition.id)?.get(ref)
        if (text) translations[edition.id] = text
      }

      const transliterations: Record<string, string> = {}
      for (const edition of TRANSLITERATIONS) {
        if (edition.cdnSlug) {
          const text = translitVerses.get(edition.id)?.get(ref)
          if (text) transliterations[edition.id] = text
        } else if (words.some((w) => w.translit)) {
          // Derived, so it keeps exactly one token per Arabic word.
          transliterations[edition.id] = words.map((w) => w.translit ?? '—').join(' ')
        }
      }

      const timing = timings.get(ref)
      /*
       * Upstream gives [wordPosition, from, to]. Position is authoritative and
       * NOT the array order: a reciter who repeats part of an ayah produces
       * several spans for the same word, and 78:40 revisits words 5–10. Storing
       * the index with each span keeps the highlight on the word being recited
       * even through a repeat.
       */
      const wordTimings = timing?.segments
        ?.map((seg) => [seg[0] - 1, seg[1], seg[2]] as [number, number, number])
        .filter(
          ([index, from, to]) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < words.length &&
            Number.isFinite(from) &&
            Number.isFinite(to) &&
            to > from,
        )

      /*
       * The per-word text carries pause and tajwid marks that the verse-level
       * field drops, and it attaches a waqf mark to the word it follows rather
       * than leaving it floating as its own token. Building content from the
       * words makes the two agree by construction — which the order-tap and
       * type-initials modes depend on, since a floating waqf mark became a chip
       * nobody could place and a letter slot nobody could type.
       */
      const content = words.length
        ? words.map((w) => w.ar).join(' ')
        : verse.text_uthmani.trim()

      return {
        index,
        ref,
        content,
        translations,
        transliterations: Object.keys(transliterations).length ? transliterations : undefined,
        words: words.length ? words : undefined,
        audio: timing
          ? {
              from: timing.timestamp_from,
              to: timing.timestamp_to,
              wordTimings: wordTimings?.length ? wordTimings : undefined,
            }
          : undefined,
      }
    })

    const audioUrl = audio?.audio_url?.startsWith('http')
      ? audio.audio_url
      : audio?.audio_url
        ? `${AUDIO_HOST}/${audio.audio_url.replace(/^\//, '')}`
        : undefined

    const text: PackText = {
      id: `${def.id}:${surah}`,
      packId: def.id,
      index: surah,
      title: chapter.name_simple,
      titleArabic: chapter.name_arabic,
      titleTr: chapter.translated_name.name,
      lang: 'ar',
      dir: 'rtl',
      revelationPlace: chapter.revelation_place,
      bismillahPre: chapter.bismillah_pre,
      audioUrl,
      segments,
    }

    const file = `${String(surah).padStart(3, '0')}.json`
    await writeFile(path.join(outDir, file), JSON.stringify(text))
    texts.push({
      id: text.id,
      index: surah,
      title: text.title,
      titleArabic: text.titleArabic,
      titleTr: text.titleTr,
      segmentCount: segments.length,
      file,
    })
    console.log(`  ${String(surah).padStart(3)} ${text.title} — ${segments.length} ayah`)
    await sleep(120)
  }

  const manifest: PackManifest = {
    schema: SCHEMA_VERSION,
    id: def.id,
    version: '1.2.0',
    builtAt: new Date().toISOString().slice(0, 10),
    title: def.title,
    subtitle: def.subtitle,
    lang: 'ar',
    dir: 'rtl',
    license:
      'Qur’anic text is not under copyright. Each translation and the recitation carry ' +
      'their own terms, listed per source below and in docs/CONTENT-SOURCES.md.',
    attribution: {
      source: turkish.provider === 'acikkuran' ? 'Açık Kuran' : 'Quran.com (Quran Foundation)',
      sourceUrl:
        turkish.provider === 'acikkuran'
          ? 'https://acikkuran.com'
          : 'https://quran.com',
      edition: 'KFGQPC Uthmanic Hafs',
      translator: 'see sources.translations',
    },
    sources: {
      arabic: {
        source: 'Quran.com API v4 (Quran Foundation)',
        edition: 'Uthmani, King Fahd Glorious Qur’an Printing Complex',
        sourceUrl: 'https://api-docs.quran.foundation',
        license: 'Qur’anic text is not under copyright.',
      },
      translations: EDITIONS.map((e) => ({
        id: e.id,
        lang: e.lang,
        title: e.title,
        translator: e.translator,
        sourceUrl: e.sourceUrl,
        license: e.license,
        source:
          e.id === 'elmalili-sadelestirilmis'
            ? turkish.source
            : 'quran-api CDN (github.com/fawazahmed0/quran-api)',
      })),
      transliterations: TRANSLITERATIONS.map((t) => ({
        id: t.id,
        title: t.title,
        hint: t.hint,
        source: t.cdnSlug
          ? 'quran-api CDN (github.com/fawazahmed0/quran-api)'
          : 'Derived from the Quran.com API v4 word transliterations',
        sourceUrl: t.sourceUrl,
        license: t.license,
      })),
      wordByWord: {
        source: 'Quran.com API v4 word-by-word gloss',
        sourceUrl: 'https://api-docs.quran.foundation',
      },
      audio: {
        source: 'QuranicAudio, timings from the Quran.com API',
        sourceUrl: 'https://quranicaudio.com',
        reciter: reciter?.name ?? 'none',
        style: reciter?.style ?? 'none',
      },
    },
    texts,
  }

  await writeFile(path.join(outDir, 'pack.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

async function main() {
  const only = arg('pack', '')
  const keys = only ? only.split(',') : Object.keys(PACKS)
  const built: Array<Pick<PackManifest, 'id' | 'title' | 'subtitle' | 'version'> & {
    file: string
    textCount: number
    segmentCount: number
  }> = []

  for (const key of keys) {
    const manifest = await build(key)
    built.push({
      id: manifest.id,
      title: manifest.title,
      subtitle: manifest.subtitle,
      version: manifest.version,
      file: `${manifest.id}/pack.json`,
      textCount: manifest.texts.length,
      segmentCount: manifest.texts.reduce((n, t) => n + t.segmentCount, 0),
    })
  }

  const outRoot = path.resolve(process.cwd(), arg('out', 'public/packs'))
  const indexPath = path.join(outRoot, 'index.json')

  // Rebuilding a subset must not drop the other packs from the index.
  let existing: typeof built = []
  try {
    const raw = await import('node:fs/promises').then((fs) => fs.readFile(indexPath, 'utf8'))
    existing = (JSON.parse(raw) as { packs: typeof built }).packs ?? []
  } catch {
    /* first run */
  }
  const merged = [...existing.filter((p) => !built.some((b) => b.id === p.id)), ...built].sort(
    (a, b) => a.id.localeCompare(b.id),
  )

  await writeFile(indexPath, JSON.stringify({ schema: SCHEMA_VERSION, packs: merged }, null, 2))
  console.log(`\nwrote ${indexPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
