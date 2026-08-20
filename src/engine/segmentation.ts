/**
 * Splitting a pasted text into the units that get memorised. Newlines are the
 * default because that is how people already lay out what they are learning;
 * the rest are there for text that arrived as one paragraph.
 */
export type SegmentationStrategy =
  | 'newline'
  | 'blank_line'
  | 'sentence'
  | 'verse_marker'
  | 'word_count'

export const STRATEGY_LABELS: Record<SegmentationStrategy, string> = {
  newline: 'One per line',
  blank_line: 'Blank line between stanzas',
  sentence: 'One per sentence',
  verse_marker: 'At verse markers',
  word_count: 'Fixed word count',
}

export interface SegmentationOptions {
  wordsPerSegment?: number
}

/** ۝ ۞ and bracketed numerals all end a verse in one tradition or another. */
const VERSE_MARKER = /[۝۞][٠-٩۰-۹\d]*|\(\s*\d+\s*\)|\[\s*\d+\s*\]/g

export function segmentText(
  input: string,
  strategy: SegmentationStrategy,
  options: SegmentationOptions = {},
): string[] {
  const text = input.replace(/\r\n?/g, '\n').trim()
  if (!text) return []

  switch (strategy) {
    case 'newline':
      return clean(text.split(/\n+/))

    case 'blank_line':
      return clean(text.split(/\n\s*\n+/).map((s) => s.replace(/\n+/g, ' ')))

    case 'sentence':
      // Keeps the punctuation with the sentence it closes.
      return clean(text.split(/(?<=[.!?؟۔…])\s+/))

    case 'verse_marker': {
      const parts: string[] = []
      let last = 0
      for (const match of text.matchAll(VERSE_MARKER)) {
        const end = (match.index ?? 0) + match[0].length
        parts.push(text.slice(last, end))
        last = end
      }
      parts.push(text.slice(last))
      return clean(parts)
    }

    case 'word_count': {
      const size = Math.max(1, options.wordsPerSegment ?? 8)
      const words = text.split(/\s+/).filter(Boolean)
      const out: string[] = []
      for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '))
      return out
    }
  }
}

function clean(parts: string[]): string[] {
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** Merge a segment into the one before it. */
export function mergeAt(segments: string[], index: number): string[] {
  if (index <= 0 || index >= segments.length) return segments
  const out = [...segments]
  out[index - 1] = `${out[index - 1]} ${out[index]}`.trim()
  out.splice(index, 1)
  return out
}

/** Split a segment in half at a word boundary near the middle. */
export function splitAt(segments: string[], index: number, wordOffset?: number): string[] {
  const target = segments[index]
  if (!target) return segments
  const words = target.split(/\s+/)
  if (words.length < 2) return segments
  const at = Math.min(Math.max(1, wordOffset ?? Math.floor(words.length / 2)), words.length - 1)
  const out = [...segments]
  out.splice(index, 1, words.slice(0, at).join(' '), words.slice(at).join(' '))
  return out
}

/** rtl if the text is mostly Arabic-script. */
export function guessDirection(text: string): 'rtl' | 'ltr' {
  const arabic = (text.match(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g) ?? []).length
  const latin = (text.match(/[A-Za-zÀ-ÿĀ-ſ]/g) ?? []).length
  return arabic > latin ? 'rtl' : 'ltr'
}
