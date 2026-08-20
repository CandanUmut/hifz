/**
 * Checks the committed packs against the rules in docs/pack-schema.md.
 *
 * The packs are data, not code, so nothing else would catch a bad one — and a
 * pack that breaks an invariant does not crash, it quietly marks correct
 * answers wrong. This runs in CI.
 *
 *   npm run check:packs
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'public/packs')

const problems: string[] = []
let checked = 0

function fail(where: string, message: string) {
  problems.push(`${where}: ${message}`)
}

async function readJson<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(ROOT, ...parts), 'utf8')) as T
}

interface Manifest {
  schema: number
  id: string
  version: string
  sources: {
    translations: { id: string }[]
    transliterations?: { id: string }[]
  }
  texts: { id: string; file: string; segmentCount: number; title: string }[]
}

interface TextFile {
  id: string
  packId: string
  segments: {
    index: number
    ref?: string
    content: string
    translations: Record<string, string>
    transliterations?: Record<string, string>
    words?: { ar: string }[]
    audio?: { from: number; to: number; wordTimings?: [number, number, number][] }
  }[]
}

async function main() {
  const index = await readJson<{ schema: number; packs: { id: string; file: string }[] }>(
    'index.json',
  )
  const dirs = (await readdir(ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)

  for (const dir of dirs) {
    if (!index.packs.some((p) => p.id === dir)) fail(dir, 'directory is not listed in index.json')
  }

  for (const entry of index.packs) {
    const manifest = await readJson<Manifest>(entry.file)
    const where = manifest.id

    if (manifest.id !== entry.id) fail(where, `manifest id is "${manifest.id}", index says "${entry.id}"`)
    if (manifest.schema !== 1) fail(where, `unsupported schema ${manifest.schema}`)

    const translationIds = new Set(manifest.sources.translations.map((t) => t.id))
    const translitIds = new Set((manifest.sources.transliterations ?? []).map((t) => t.id))

    for (const text of manifest.texts) {
      const file = await readJson<TextFile>(manifest.id, text.file)
      const at = `${where}/${text.file}`

      if (file.id !== text.id) fail(at, `id is "${file.id}", manifest says "${text.id}"`)
      if (file.packId !== manifest.id) fail(at, `packId is "${file.packId}"`)
      if (file.segments.length !== text.segmentCount) {
        fail(at, `has ${file.segments.length} segments, manifest says ${text.segmentCount}`)
      }

      file.segments.forEach((segment, i) => {
        const seg = `${at} #${i}`
        checked++

        // Rule 2: contiguous from 0, or link items invent a join.
        if (segment.index !== i) fail(seg, `index is ${segment.index}, expected ${i}`)
        if (!segment.content.trim()) fail(seg, 'content is empty')

        // Rule 1: the response modes compare against `words`.
        if (segment.words) {
          const joined = segment.words.map((w) => w.ar).join(' ')
          if (joined !== segment.content) {
            fail(seg, 'words joined with spaces do not equal content')
          }
        }

        // Rule 4: no unknown edition keys.
        for (const id of Object.keys(segment.translations)) {
          if (!translationIds.has(id)) fail(seg, `unknown translation edition "${id}"`)
        }
        for (const id of Object.keys(segment.transliterations ?? {})) {
          if (!translitIds.has(id)) fail(seg, `unknown transliteration edition "${id}"`)
        }

        // Rule 6: "aligned" promises one token per word.
        const aligned = segment.transliterations?.aligned
        if (aligned && segment.words) {
          const tokens = aligned.split(/\s+/).filter(Boolean).length
          if (tokens !== segment.words.length) {
            fail(seg, `aligned transliteration has ${tokens} tokens for ${segment.words.length} words`)
          }
        }

        // Rule 3: every timing names a word that exists, and spans move forward.
        const timings = segment.audio?.wordTimings
        if (timings && segment.words) {
          for (const [index, from, to] of timings) {
            if (!Number.isInteger(index) || index < 0 || index >= segment.words.length) {
              fail(seg, `word timing points at word ${index} of ${segment.words.length}`)
            }
            if (!(to > from)) fail(seg, `word timing ${index} ends before it starts`)
          }
        }
        if (segment.audio && segment.audio.to <= segment.audio.from) {
          fail(seg, 'audio range ends before it starts')
        }
      })
    }
  }

  console.log(`checked ${checked} segments across ${index.packs.length} packs`)
  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`)
    for (const p of problems.slice(0, 40)) console.error(`  ${p}`)
    if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`)
    process.exit(1)
  }
  console.log('all packs match docs/pack-schema.md')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
