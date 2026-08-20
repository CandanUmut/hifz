/**
 * Downloads every web font the app uses into public/fonts so the built app
 * makes no third-party requests at runtime. Run once; the files are committed.
 *
 *   npm run fonts
 *
 * Licences are recorded in public/fonts/LICENSES.md.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.cwd(), 'public/fonts')
const FS = (pkg: string, version: string, file: string) =>
  `https://cdn.jsdelivr.net/npm/@fontsource/${pkg}@${version}/files/${file}`

type Job = { url: string; as: string }

const jobs: Job[] = [
  // Interface — IBM Plex Sans. latin-ext carries the Turkish diacritics (ğ ı ş İ).
  ...['400', '500', '600'].flatMap((w) =>
    ['latin', 'latin-ext'].map((s) => ({
      url: FS('ibm-plex-sans', '5.1.0', `ibm-plex-sans-${s}-${w}-normal.woff2`),
      as: `ibm-plex-sans-${s}-${w}.woff2`,
    })),
  ),
  // Interface Arabic (user text, labels — never scripture).
  ...['400', '600'].map((w) => ({
    url: FS('ibm-plex-sans-arabic', '5.1.0', `ibm-plex-sans-arabic-arabic-${w}-normal.woff2`),
    as: `ibm-plex-sans-arabic-${w}.woff2`,
  })),
  // Meaning / translation — Newsreader.
  ...['400', '500'].flatMap((w) =>
    ['latin', 'latin-ext'].map((s) => ({
      url: FS('newsreader', '5.1.0', `newsreader-${s}-${w}-normal.woff2`),
      as: `newsreader-${s}-${w}.woff2`,
    })),
  ),
  // Scripture fallbacks.
  {
    url: FS('amiri-quran', '5.1.0', 'amiri-quran-arabic-400-normal.woff2'),
    as: 'amiri-quran-400.woff2',
  },
  {
    url: FS('scheherazade-new', '5.1.0', 'scheherazade-new-arabic-400-normal.woff2'),
    as: 'scheherazade-new-400.woff2',
  },
  // Scripture — KFGQPC Uthmanic Script HAFS.
  {
    url: 'https://raw.githubusercontent.com/quran/quran.com-frontend-next/master/public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2',
    as: 'uthmanic-hafs-ver18.woff2',
  },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const force = process.argv.includes('--force')
  for (const job of jobs) {
    const dest = path.join(OUT, job.as)
    if (existsSync(dest) && !force) {
      console.log(`skip  ${job.as}`)
      continue
    }
    const res = await fetch(job.url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${job.url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(dest, buf)
    console.log(`saved ${job.as} (${(buf.length / 1024).toFixed(1)} kB)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
