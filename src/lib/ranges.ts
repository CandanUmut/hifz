/**
 * A set of ayah in a URL, without turning it into a range.
 *
 * The drill and the test used to be handed a first and a last index and take
 * everything between them. That is fine for a block and silently wrong for
 * anything else: picking one ayah of al-Baqara and one two hundred later asked
 * for all two hundred, and picking a single ayah of a long surah could only be
 * expressed as a range of one — so the moment the scope came from anywhere but
 * a contiguous block, the app studied something nobody had asked for.
 *
 * "3", "3-7", "3-7,12,40-42" — short enough for a URL even when it is a whole
 * surah, and exact.
 */

export function encodeRanges(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  if (!sorted.length) return ''

  const parts: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (const index of sorted.slice(1)) {
    if (index === end + 1) {
      end = index
      continue
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`)
    start = index
    end = index
  }
  parts.push(start === end ? `${start}` : `${start}-${end}`)
  return parts.join(',')
}

export function decodeRanges(value: string | null | undefined): number[] {
  if (!value) return []
  const out = new Set<number>()

  for (const part of value.split(',')) {
    // Digits only: `Number('')` is 0, so "-3" would otherwise read as 0 to 3.
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim())
    if (!match) continue
    const from = Number(match[1])
    if (match[2] === undefined) {
      out.add(from)
      continue
    }
    const to = Number(match[2])
    if (to < from) continue
    // A malformed or hostile range must not spin here.
    for (let i = from; i <= Math.min(to, from + 10_000); i++) out.add(i)
  }

  return [...out].sort((a, b) => a - b)
}
