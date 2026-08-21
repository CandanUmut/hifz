import { describe, expect, it } from 'vitest'
import { ladder } from '../ladder'

const shape = (indices: number[], block?: number) =>
  ladder(indices, block).map((r) => r.indices.join('-'))

describe('the test ladder', () => {
  it('asks a single ayah once and stops', () => {
    expect(shape([4])).toEqual(['4'])
  })

  it('asks the first, the second, then both — the shape a teacher uses', () => {
    expect(shape([0, 1])).toEqual(['0', '1', '0-1'])
  })

  it('climbs to the middle, mirrors, then asks for all of it', () => {
    expect(shape([0, 1, 2, 3, 4])).toEqual([
      '0',
      '1',
      '0-1',
      '2',
      '0-1-2', // the whole first half, in one go
      '3',
      '4',
      '3-4', // the same climb over the second half
      '0-1-2-3-4',
    ])
  })

  it('never asks for a join of one', () => {
    for (const rung of ladder([0, 1, 2, 3])) {
      if (rung.kind === 'join') expect(rung.indices.length).toBeGreaterThan(1)
    }
  })

  it('ends on the whole passage, whatever the length', () => {
    for (const n of [2, 3, 6, 9, 20]) {
      const indices = Array.from({ length: n }, (_, i) => i)
      const last = ladder(indices).at(-1)!
      expect(last.kind).toBe('whole')
      expect(last.indices).toEqual(indices)
    }
  })

  it('breaks a long passage into blocks rather than into hundreds of rungs', () => {
    const long = Array.from({ length: 40 }, (_, i) => i)
    const rungs = ladder(long)
    // Quadratic over 40 would be past 400; blocks keep it walkable.
    expect(rungs.length).toBeLessThan(90)
    expect(rungs.at(-1)!.indices).toEqual(long)
  })

  it('sorts and dedupes whatever it is handed', () => {
    expect(shape([2, 0, 2, 1])).toEqual(['0', '1', '0-1', '2', '0-1-2'])
  })
})
