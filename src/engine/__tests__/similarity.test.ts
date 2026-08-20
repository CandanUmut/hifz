import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  alignTokens,
  buildInterferenceGraph,
  clusters,
  normalizeTokens,
  similarity,
  type SegmentLike,
} from '../similarity'
import { checkRecitation, suggestedRating } from '../recitation'

const seg = (id: string, content: string, index = 0): SegmentLike => ({
  id,
  textId: 't',
  index,
  ref: id,
  content,
})

describe('token alignment', () => {
  it('folds diacritics and alef variants before comparing', () => {
    expect(normalizeTokens(['ٱلْحَمْدُ', 'أَحَدٌ'])).toEqual(['الحمد', 'احد'])
  })

  it('scores identical lines at 1 and disjoint lines at 0', () => {
    expect(similarity(['a', 'b', 'c'], ['a', 'b', 'c']).score).toBe(1)
    expect(similarity(['a', 'b'], ['x', 'y']).score).toBe(0)
  })

  it('is order aware, so a reordering is not the same line', () => {
    const shuffled = similarity(['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a']).score
    expect(shuffled).toBeLessThan(0.6)
  })

  it('reports which positions matched, so the caller can show what differs', () => {
    expect(alignTokens(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual([
      [0, 0],
      [2, 2],
    ])
  })
})

describe('interference graph', () => {
  it('links two lines that differ by one word, and says which word', () => {
    const graph = buildInterferenceGraph([
      seg('a', 'كلا سوف تعلمون', 0),
      seg('b', 'ثم كلا سوف تعلمون', 1),
    ])
    const match = graph.get('b')?.[0]
    expect(match?.segmentId).toBe('a')
    // "ثم" is in b and not in a.
    expect(match?.differing).toEqual([0])
    expect(match?.otherDiffering).toEqual([])
  })

  it('marks an exact repeat as identical', () => {
    const graph = buildInterferenceGraph([
      seg('a', 'على الارائك ينظرون', 0),
      seg('b', 'على الارائك ينظرون', 1),
    ])
    expect(graph.get('a')?.[0].identical).toBe(true)
    expect(graph.get('a')?.[0].score).toBe(1)
  })

  it('leaves unrelated lines out of the graph entirely', () => {
    const graph = buildInterferenceGraph([
      seg('a', 'قل هو الله احد', 0),
      seg('b', 'تبت يدا ابي لهب وتب', 1),
    ])
    expect(graph.size).toBe(0)
  })

  it('ignores lines too short to mean anything', () => {
    const graph = buildInterferenceGraph([seg('a', 'الحاقة', 0), seg('b', 'الحاقة', 1)])
    expect(graph.size).toBe(0)
  })

  it('groups a family of near-identical lines into one cluster', () => {
    const graph = buildInterferenceGraph([
      seg('a', 'وانذرهم يوم الحسرة', 0),
      seg('b', 'وانذرهم يوم الحسرة', 1),
      seg('c', 'ثم وانذرهم يوم الحسرة', 2),
    ])
    const groups = clusters(graph)
    expect(groups).toHaveLength(1)
    expect(groups[0].segmentIds.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('over the shipped packs', () => {
  async function loadPacks() {
    const ROOT = path.resolve(process.cwd(), 'public/packs')
    const segments: SegmentLike[] = []
    const label = new Map<string, string>()
    for (const dir of ['quran-al-fatiha', 'quran-juz-amma']) {
      const manifest = JSON.parse(await readFile(path.join(ROOT, dir, 'pack.json'), 'utf8'))
      for (const t of manifest.texts) {
        const file = JSON.parse(await readFile(path.join(ROOT, dir, t.file), 'utf8'))
        for (const s of file.segments) {
          const id = `${file.id}#${s.index}`
          segments.push({
            id,
            textId: file.id,
            index: s.index,
            ref: s.ref,
            content: s.content,
            words: s.words,
          })
          label.set(id, s.ref)
        }
      }
    }
    return { segments, label }
  }

  it('finds the well-known confusion pairs in Juz Amma', async () => {
    const { segments, label } = await loadPacks()
    const graph = buildInterferenceGraph(segments)
    const byRef = new Map([...label].map(([id, ref]) => [ref, id]))

    const linked = (a: string, b: string) =>
      (graph.get(byRef.get(a)!) ?? []).some((m) => m.segmentId === byRef.get(b))

    // Pairs any ḥāfiẓ will name as places recitation slips.
    expect(linked('79:33', '80:32')).toBe(true) // identical
    expect(linked('82:13', '83:22')).toBe(true) // identical
    expect(linked('84:2', '84:5')).toBe(true) // identical
    expect(linked('109:3', '109:5')).toBe(true) // identical
    expect(linked('102:3', '102:4')).toBe(true) // differs by ثم
    expect(linked('113:1', '114:1')).toBe(true) // al-Falaq vs an-Nas opening
  })

  it('stays selective and fast enough to run on a phone', async () => {
    const { segments } = await loadPacks()
    const started = Date.now()
    const graph = buildInterferenceGraph(segments)
    const elapsed = Date.now() - started

    expect(elapsed).toBeLessThan(1500)
    // Juz Amma is repetitive, but most of it is still unique.
    expect(graph.size).toBeGreaterThan(20)
    expect(graph.size).toBeLessThan(segments.length * 0.3)
  })
})

describe('recitation check', () => {
  const ayah = ['قُلْ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ']

  it('forgives orthography a transcript will not reproduce', () => {
    // Exactly what the model returned for 112:1 in the feasibility run.
    const check = checkRecitation('قُلْ هُوَ اللَّهُ أَحَدٌ', ayah)
    expect(check.missing).toEqual([])
    expect(check.extra).toEqual([])
    expect(check.score).toBe(1)
    expect(suggestedRating(check)).toBe(3)
  })

  it('forgives the dropped small waw in 112:4', () => {
    const check = checkRecitation('وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ', [
      'وَلَمْ',
      'يَكُن',
      'لَّهُۥ',
      'كُفُوًا',
      'أَحَدٌۢ',
    ])
    expect(check.score).toBe(1)
  })

  it('names the word that was skipped', () => {
    const check = checkRecitation('قل هو احد', ayah)
    expect(check.missing).toEqual([2])
    expect(suggestedRating(check)).toBe(1)
  })

  it('never suggests Easy — recognition mishears, and a grade is the reader’s', () => {
    const perfect = checkRecitation('قُلْ هُوَ اللَّهُ أَحَدٌ', ayah)
    expect(suggestedRating(perfect)).toBeLessThan(4)
  })

  it('treats silence as nothing recalled rather than as a pass', () => {
    const check = checkRecitation('', ayah)
    expect(check.score).toBe(0)
    expect(check.missing).toHaveLength(4)
    expect(suggestedRating(check)).toBe(1)
  })
})
