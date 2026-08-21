/**
 * The order a passage is actually tested in.
 *
 * Asking each ayah on its own, one after another, never answers the question
 * the reader is asking. Someone who can produce every ayah when it is named
 * still cannot recite the surah, because what breaks is never the ayah — it is
 * the join, the moment one ends and you have to find the next.
 *
 * So the test climbs: the new ayah on its own, then everything from the top
 * joined to it. Halfway through it asks for the whole first half in one go,
 * then mirrors the same climb over the second half, and finishes by asking for
 * all of it from the beginning. This is how it is taught, and it is the only
 * shape that tells you whether you have memorised a passage or a list.
 */

export type RungKind = 'single' | 'join' | 'whole'

export interface Rung {
  /** Segment indices, in reading order. */
  indices: number[]
  kind: RungKind
}

/**
 * Long passages are climbed in blocks.
 *
 * The ladder is quadratic in the number of ayah, so a full surah of 286 would
 * be several hundred rungs and nobody would reach the end. Eight is about as
 * much as anyone joins in one sitting.
 */
const BLOCK = 8

function climb(indices: number[]): Rung[] {
  if (indices.length <= 1) return indices.length ? [{ indices: [...indices], kind: 'single' }] : []

  const rungs: Rung[] = []
  const half = Math.ceil(indices.length / 2)

  const section = (part: number[]) => {
    part.forEach((index, i) => {
      rungs.push({ indices: [index], kind: 'single' })
      // A join of one is the ayah again, so the first one does not get one.
      if (i > 0) rungs.push({ indices: part.slice(0, i + 1), kind: 'join' })
    })
  }

  section(indices.slice(0, half))
  section(indices.slice(half))
  rungs.push({ indices: [...indices], kind: 'whole' })
  return rungs
}

export function ladder(indices: number[], blockSize = BLOCK): Rung[] {
  const ordered = [...new Set(indices)].sort((a, b) => a - b)
  if (ordered.length <= blockSize) return climb(ordered)

  const rungs: Rung[] = []
  for (let at = 0; at < ordered.length; at += blockSize) {
    rungs.push(...climb(ordered.slice(at, at + blockSize)))
  }
  // Whatever the blocks were, the passage is still one passage.
  rungs.push({ indices: ordered, kind: 'whole' })
  return rungs
}
