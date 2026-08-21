import { db } from './db'

/**
 * The rhythm of the last two weeks.
 *
 * Deliberately not a streak counter. A streak is a number you can lose, and
 * losing it is a punishment for a day you were ill or busy — which is exactly
 * the kind of pressure this app is not for. What is worth seeing is the shape
 * of the habit: the days you sat down, the days you did not, and how much is
 * behind you. You cannot fail at a shape.
 */

export interface Day {
  /** Local date, yyyy-mm-dd. */
  date: string
  count: number
  today: boolean
}

export interface Rhythm {
  days: Day[]
  /** Reviews graded since local midnight. */
  todayCount: number
  /** Days out of the window with at least one review. */
  activeDays: number
  /** Ayah and lines being kept — the total that is actually memorised. */
  kept: number
}

function localDate(at: number): string {
  const d = new Date(at)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function startOfDay(at: number): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export async function recentRhythm(window = 14, now = Date.now()): Promise<Rhythm> {
  const from = startOfDay(now) - (window - 1) * 86_400_000
  const [attempts, items] = await Promise.all([
    db.attempts.where('at').aboveOrEqual(from).toArray(),
    db.items.toArray(),
  ])

  const counts = new Map<string, number>()
  for (const attempt of attempts) {
    const key = localDate(attempt.at)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const today = localDate(now)
  const days: Day[] = []
  for (let i = 0; i < window; i++) {
    const date = localDate(from + i * 86_400_000)
    days.push({ date, count: counts.get(date) ?? 0, today: date === today })
  }

  // One segment can carry several items; what the reader is keeping is lines.
  const kept = new Set(
    items.filter((i) => i.stage === 'review' && i.intent !== 'paused').map((i) => i.segmentId),
  ).size

  return {
    days,
    todayCount: counts.get(today) ?? 0,
    activeDays: days.filter((d) => d.count > 0).length,
    kept,
  }
}
