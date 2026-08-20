import { describe, expect, it } from 'vitest'
import { guessDirection, mergeAt, segmentText, splitAt } from '../segmentation'
import { generateItems } from '../items'
import { evidenceTier } from '../evidence'
import { isPass, newCard, retrievability, schedule } from '../scheduler'
import { initialsOf, sameInitial, shuffle } from '@/lib/text'
import { resolveTransliteration } from '@/lib/translations'
import type { ItemRecord, SegmentRecord } from '../types'

const segments = (contents: string[]): SegmentRecord[] =>
  contents.map((content, index) => ({
    id: `t#${index}`,
    textId: 't',
    index,
    content,
    translations: {},
  }))

describe('segmentation', () => {
  it('splits on newlines by default and drops blank lines', () => {
    expect(segmentText('one\n\ntwo\nthree', 'newline')).toEqual(['one', 'two', 'three'])
  })

  it('keeps sentence punctuation with the sentence', () => {
    expect(segmentText('A first one. And a second!', 'sentence')).toEqual([
      'A first one.',
      'And a second!',
    ])
  })

  it('splits after verse markers, keeping the marker', () => {
    const out = segmentText('اهدنا الصراط (1) صراط الذين (2)', 'verse_marker')
    expect(out).toEqual(['اهدنا الصراط (1)', 'صراط الذين (2)'])
  })

  it('chunks by word count', () => {
    expect(segmentText('a b c d e', 'word_count', { wordsPerSegment: 2 })).toEqual([
      'a b',
      'c d',
      'e',
    ])
  })

  it('merges and splits without losing words', () => {
    const merged = mergeAt(['one two', 'three'], 1)
    expect(merged).toEqual(['one two three'])
    expect(splitAt(merged, 0, 2)).toEqual(['one two', 'three'])
  })

  it('guesses direction from script', () => {
    expect(guessDirection('عم يتساءلون')).toBe('rtl')
    expect(guessDirection('About what are they asking')).toBe('ltr')
  })
})

describe('item generation', () => {
  const all = segments(['one', 'two', 'three'])

  it('creates a block per segment and a link per consecutive pair', () => {
    const created = generateItems({
      textId: 't',
      allSegments: all,
      selectedIndices: [0, 1, 2],
      existingIndices: [],
      existing: [],
      types: { block: true, link: true, meaning: false },
      intent: 'learning',
    })
    expect(created.filter((i) => i.type === 'block')).toHaveLength(3)
    expect(created.filter((i) => i.type === 'link')).toHaveLength(2)
  })

  it('closes a join against something added in an earlier session', () => {
    const first = generateItems({
      textId: 't',
      allSegments: all,
      selectedIndices: [0],
      existingIndices: [],
      existing: [],
      types: { block: true, link: true, meaning: false },
      intent: 'learning',
    })
    expect(first.filter((i) => i.type === 'link')).toHaveLength(0)

    const second = generateItems({
      textId: 't',
      allSegments: all,
      selectedIndices: [1],
      existingIndices: [0],
      existing: first,
      types: { block: true, link: true, meaning: false },
      intent: 'learning',
    })
    const link = second.find((i) => i.type === 'link')
    expect(link?.segmentId).toBe('t#0')
    expect(link?.nextSegmentId).toBe('t#1')
  })

  it('never duplicates an item that already exists', () => {
    const first = generateItems({
      textId: 't',
      allSegments: all,
      selectedIndices: [0, 1],
      existingIndices: [],
      existing: [],
      types: { block: true, link: true, meaning: false },
      intent: 'learning',
    })
    const again = generateItems({
      textId: 't',
      allSegments: all,
      selectedIndices: [0, 1],
      existingIndices: [0, 1],
      existing: first,
      types: { block: true, link: true, meaning: false },
      intent: 'learning',
    })
    expect(again).toHaveLength(0)
  })

  it('skips meaning items for segments with no translation', () => {
    const created = generateItems({
      textId: 't',
      allSegments: all,
      selectedIndices: [0],
      existingIndices: [],
      existing: [],
      types: { block: false, link: false, meaning: true },
      intent: 'learning',
    })
    expect(created).toHaveLength(0)
  })
})

describe('scheduling and evidence', () => {
  const DAY = 86_400_000
  const base = (overrides: Partial<ItemRecord> = {}): ItemRecord => ({
    id: 'i',
    textId: 't',
    segmentId: 't#0',
    type: 'block',
    fsrs: newCard(),
    due: Date.now(),
    intent: 'learning',
    successStreak: 0,
    createdAt: Date.now(),
    ...overrides,
  })

  it('treats Hard and above as recalled', () => {
    expect(isPass(1)).toBe(false)
    expect(isPass(2)).toBe(true)
  })

  it('pushes the due date out further for a better grade', () => {
    const card = newCard()
    const again = schedule(card, 1, 0.9)
    const easy = schedule(card, 4, 0.9)
    expect(easy.due).toBeGreaterThan(again.due)
  })

  it('reports no retrievability for a card never graded', () => {
    expect(retrievability(newCard())).toBe(0)
  })

  it('decays retrievability as time passes', () => {
    const now = Date.now()
    const graded = schedule(newCard(now), 3, 0.9, now)
    const soon = retrievability(graded, now + DAY)
    const later = retrievability(graded, now + 30 * DAY)
    expect(soon).toBeGreaterThan(later)
  })

  it('is untested with no evidence, whatever the intent says', () => {
    expect(evidenceTier(base({ intent: 'maintaining' }))).toBe('untested')
  })

  it('is weak when the last check failed', () => {
    const now = Date.now()
    const item = base({
      fsrs: schedule(newCard(now), 3, 0.9, now),
      lastEvidence: {
        id: 'e',
        at: now,
        method: 'self_grade',
        confidence: 'low',
        passed: false,
        gapDays: 1,
      },
    })
    expect(evidenceTier(item, now)).toBe('weak')
  })

  it('needs three successful intervals before it counts as strong', () => {
    const now = Date.now()
    const fsrs = schedule(newCard(now), 3, 0.9, now)
    const evidence = {
      id: 'e',
      at: now,
      method: 'type_initials' as const,
      confidence: 'medium' as const,
      passed: true,
      gapDays: 1,
    }
    expect(evidenceTier(base({ fsrs, successStreak: 2, lastEvidence: evidence }), now)).toBe('fair')
    expect(evidenceTier(base({ fsrs, successStreak: 3, lastEvidence: evidence }), now)).toBe(
      'strong',
    )
  })

  it('marks a pass after a month away as cold-verified', () => {
    const now = Date.now()
    const item = base({
      fsrs: schedule(newCard(now), 3, 0.9, now),
      successStreak: 1,
      lastEvidence: {
        id: 'e',
        at: now,
        method: 'self_grade',
        confidence: 'highest',
        passed: true,
        gapDays: 45,
      },
    })
    expect(evidenceTier(item, now)).toBe('cold_verified')
  })
})

describe('typed initials', () => {
  it('ignores diacritics and alef variants', () => {
    expect(initialsOf('ٱلْحَمْدُ لِلَّهِ')).toEqual(['ا', 'ل'])
    expect(sameInitial('أ', 'ا')).toBe(true)
  })

  it('shuffles deterministically for a given seed', () => {
    const input = [1, 2, 3, 4, 5, 6]
    expect(shuffle(input, 42)).toEqual(shuffle(input, 42))
  })
})

describe('transliteration', () => {
  const text = {
    id: 't',
    title: 'T',
    source: 'pack' as const,
    lang: 'ar',
    dir: 'rtl' as const,
    segmentCount: 1,
    createdAt: 0,
    transliterationEditions: [
      { id: 'easy', title: 'Readable', hint: '' },
      { id: 'aligned', title: 'Word-aligned', hint: '' },
    ],
  }
  const segment: SegmentRecord = {
    id: 't#0',
    textId: 't',
    index: 0,
    content: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
    translations: {},
    transliterations: { easy: 'Qul huwal laahu ahad', aligned: 'qul huwa l-lahu aḥadun' },
  }

  it('returns nothing when the reader has it switched off', () => {
    expect(
      resolveTransliteration(segment, text, { translitEdition: 'easy', showTransliteration: false }),
    ).toBeUndefined()
  })

  it('picks the chosen edition and names it', () => {
    const out = resolveTransliteration(segment, text, {
      translitEdition: 'easy',
      showTransliteration: true,
    })
    expect(out).toEqual({ text: 'Qul huwal laahu ahad', title: 'Readable', aligned: false })
  })

  it('flags the word-aligned edition so it can follow the recitation', () => {
    const out = resolveTransliteration(segment, text, {
      translitEdition: 'aligned',
      showTransliteration: true,
    })
    expect(out?.aligned).toBe(true)
    expect(out?.text.split(' ')).toHaveLength(segment.content.split(' ').length)
  })

  it('falls back to what the pack has rather than showing nothing', () => {
    const out = resolveTransliteration(segment, text, {
      translitEdition: 'not-in-this-pack',
      showTransliteration: true,
    })
    expect(out?.text).toBe('Qul huwal laahu ahad')
  })

  it('is never treated as a translation, so it cannot generate meaning items', () => {
    const created = generateItems({
      textId: 't',
      allSegments: [segment],
      selectedIndices: [0],
      existingIndices: [],
      existing: [],
      types: { block: false, link: false, meaning: true },
      intent: 'learning',
    })
    expect(created).toHaveLength(0)
  })
})
