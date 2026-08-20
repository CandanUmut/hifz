import {
  createEmptyCard,
  forgetting_curve,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type FSRS,
} from 'ts-fsrs'
import type { StoredCard } from './types'

export type GradeRating = 1 | 2 | 3 | 4

export const RATING_LABELS: Record<GradeRating, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
}

type Grade = Exclude<Rating, Rating.Manual>

const RATINGS: Record<GradeRating, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
}

/**
 * Hard counts as recalled — that is what FSRS means by it, and pretending
 * otherwise would make the evidence tiers harsher than the schedule.
 */
export const PASS_THRESHOLD: GradeRating = 2

export function isPass(rating: GradeRating): boolean {
  return rating >= PASS_THRESHOLD
}

const engines = new Map<number, FSRS>()

function engineFor(desiredRetention: number): FSRS {
  const key = Math.round(desiredRetention * 1000)
  let engine = engines.get(key)
  if (!engine) {
    engine = fsrs(generatorParameters({ request_retention: desiredRetention, enable_fuzz: true }))
    engines.set(key, engine)
  }
  return engine
}

export function newCard(now = Date.now()): StoredCard {
  return toStored(createEmptyCard(new Date(now)))
}

export function toStored(card: Card): StoredCard {
  return {
    due: new Date(card.due).getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review).getTime() : undefined,
  }
}

export function toCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as State,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  } as Card
}

export function schedule(
  stored: StoredCard,
  rating: GradeRating,
  desiredRetention: number,
  now = Date.now(),
): StoredCard {
  const engine = engineFor(desiredRetention)
  const result = engine.repeat(toCard(stored), new Date(now))
  return toStored(result[RATINGS[rating]].card)
}

/** What the four buttons would do, for the "in 3 days" hints under them. */
export function preview(
  stored: StoredCard,
  desiredRetention: number,
  now = Date.now(),
): Record<GradeRating, StoredCard> {
  const engine = engineFor(desiredRetention)
  const result = engine.repeat(toCard(stored), new Date(now))
  return {
    1: toStored(result[Rating.Again].card),
    2: toStored(result[Rating.Hard].card),
    3: toStored(result[Rating.Good].card),
    4: toStored(result[Rating.Easy].card),
  }
}

const DAY = 86_400_000

/** Probability of recall right now. 0 for a card that has never been graded. */
export function retrievability(stored: StoredCard, now = Date.now()): number {
  if (stored.state === State.New || !stored.last_review || stored.stability <= 0) return 0
  const elapsedDays = Math.max(0, (now - stored.last_review) / DAY)
  return forgetting_curve(elapsedDays, stored.stability)
}

export function daysSince(at: number | undefined, now = Date.now()): number {
  if (!at) return Infinity
  return Math.max(0, (now - at) / DAY)
}

/** Human interval for the grade buttons: "10m", "3d", "2mo". */
export function formatInterval(from: number, to: number): string {
  const ms = Math.max(0, to - from)
  const minutes = ms / 60_000
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)}h`
  const days = hours / 24
  if (days < 31) return `${Math.round(days)}d`
  const months = days / 30.44
  if (months < 12) return `${Math.round(months)}mo`
  return `${(days / 365.25).toFixed(1)}y`
}
