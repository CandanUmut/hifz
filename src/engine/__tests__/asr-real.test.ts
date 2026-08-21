import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkRecitation } from '../recitation'
import { segmentWords } from '@/lib/text'

/** Real transcripts, produced by the shipped model from real recitation. */
const HEARD: Record<string, string> = {
  '1:1': 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
  '1:2': 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
  '78:1': 'عَمَّ يَتَسَاءَلُونَ',
  '78:2': 'عَنِ النَّبَإِ الْعَظِيمِ',
  '112:4': 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ',
  '114:1': 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
}

async function segmentFor(ref: string) {
  const [surah] = ref.split(':')
  const dir = surah === '1' ? 'quran-al-fatiha' : 'quran-juz-amma'
  const file = `${String(surah).padStart(3, '0')}.json`
  const text = JSON.parse(
    await readFile(path.resolve(process.cwd(), 'public/packs', dir, file), 'utf8'),
  )
  return text.segments.find((s: { ref: string }) => s.ref === ref)
}

describe('recitation matching against real transcripts', () => {
  it('still refuses a recitation that is actually wrong', async () => {
    const segment = await segmentFor('112:4')
    // The wrong surah entirely.
    const wrong = checkRecitation('قُلْ أَعُوذُ بِرَبِّ النَّاسِ', segmentWords(segment))
    expect(wrong.score).toBeLessThan(0.5)

    // The right ayah with a word left out.
    const skipped = checkRecitation('وَلَمْ يَكُنْ كُفُوًا أَحَدٌ', segmentWords(segment))
    expect(skipped.missing.length).toBeGreaterThan(0)
  })

  it('tolerates one letter but not two', async () => {
    const segment = await segmentFor('78:2')
    const oneOff = checkRecitation('عَنِ النَّبَإِ الْعَظِيم', segmentWords(segment))
    expect(oneOff.score).toBe(1)
    const twoOff = checkRecitation('عَنِ النَّبَإِ الْقَدِير', segmentWords(segment))
    expect(twoOff.missing.length).toBeGreaterThan(0)
  })

  it('accepts a correct recitation of every sampled ayah', async () => {
    const report: string[] = []
    for (const [ref, heard] of Object.entries(HEARD)) {
      const segment = await segmentFor(ref)
      const check = checkRecitation(heard, segmentWords(segment))
      report.push(
        `${ref}: ${Math.round(check.score * 100)}% · missing ${JSON.stringify(check.missing)} · extra ${JSON.stringify(check.extra)}`,
      )
    }
    console.log(report.join('\n'))
    for (const [ref, heard] of Object.entries(HEARD)) {
      const segment = await segmentFor(ref)
      const check = checkRecitation(heard, segmentWords(segment))
      expect(check.missing, `${ref} should have nothing missing`).toEqual([])
      expect(check.score, `${ref} should score 1`).toBe(1)
    }
  })
})
