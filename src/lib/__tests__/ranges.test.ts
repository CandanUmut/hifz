import { describe, expect, it } from 'vitest'
import { decodeRanges, encodeRanges } from '../ranges'

describe('ayah sets in a URL', () => {
  it('keeps a single ayah a single ayah', () => {
    expect(encodeRanges([254])).toBe('254')
    expect(decodeRanges('254')).toEqual([254])
  })

  it('collapses a run and keeps the gaps', () => {
    expect(encodeRanges([0, 1, 2, 5, 9, 10])).toBe('0-2,5,9-10')
    expect(decodeRanges('0-2,5,9-10')).toEqual([0, 1, 2, 5, 9, 10])
  })

  it('never fills in a gap the reader did not ask for', () => {
    // The old from/to pair turned this into two hundred ayah.
    expect(decodeRanges(encodeRanges([4, 203]))).toEqual([4, 203])
  })

  it('survives a round trip over a whole surah, and stays short', () => {
    const baqara = Array.from({ length: 286 }, (_, i) => i)
    const encoded = encodeRanges(baqara)
    expect(encoded).toBe('0-285')
    expect(decodeRanges(encoded)).toEqual(baqara)
  })

  it('sorts and dedupes', () => {
    expect(encodeRanges([5, 1, 5, 3, 2])).toBe('1-3,5')
  })

  it('ignores rubbish rather than throwing', () => {
    expect(decodeRanges('')).toEqual([])
    expect(decodeRanges(null)).toEqual([])
    expect(decodeRanges('x,-3,7-2,4')).toEqual([4])
  })
})
