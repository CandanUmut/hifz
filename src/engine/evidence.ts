import {
  COLD_GAP_DAYS,
  METHOD_CONFIDENCE,
  type Confidence,
  type EvidenceTier,
  type ItemRecord,
  type VerificationMethod,
} from './types'
import { retrievability } from './scheduler'

/**
 * Axis B. Derived only from what was observed; nothing here can be set by the
 * user, and none of it is allowed to overwrite their intent.
 *
 *   untested       no graded recall yet
 *   weak           R < 0.6, or the last verification failed
 *   fair           R 0.6–0.9
 *   strong         R > 0.9 and at least 3 successful intervals
 *   cold_verified  passed a check after ≥ 30 days without exposure
 */
export function evidenceTier(item: ItemRecord, now = Date.now()): EvidenceTier {
  const last = item.lastEvidence
  if (!last) return 'untested'
  const r = retrievability(item.fsrs, now)
  if (!last.passed || r < 0.6) return 'weak'
  if (last.gapDays >= COLD_GAP_DAYS) return 'cold_verified'
  if (r > 0.9 && item.successStreak >= 3) return 'strong'
  return 'fair'
}

export function confidenceFor(method: VerificationMethod, gapDays: number): Confidence {
  if (gapDays >= COLD_GAP_DAYS) return 'highest'
  return METHOD_CONFIDENCE[method]
}

/** Loosely typed so this module stays free of the string table. */
type Phrase = (key: never, vars?: Record<string, string | number>) => string

/** "12 days ago", in whichever language the reader chose. */
export function relativeDays(at: number, now = Date.now(), t?: Phrase): string {
  const say = (t ?? ((key: string, vars?: Record<string, string | number>) =>
    `${vars?.count ?? ''} ${key}`.trim())) as (
    key: string,
    vars?: Record<string, string | number>,
  ) => string
  const days = Math.floor((now - at) / 86_400_000)
  if (days <= 0) {
    const hours = Math.floor((now - at) / 3_600_000)
    return hours <= 0 ? say('when.justNow') : say('when.hours', { count: hours })
  }
  if (days === 1) return say('when.yesterday')
  if (days < 30) return say('when.days', { count: days })
  const months = Math.round(days / 30.44)
  if (months < 12) return say('when.months', { count: months })
  return say('when.years', { count: Math.round(days / 365.25) })
}

/** Order used by the heat strip and the evidence distribution. */
export const TIER_ORDER: EvidenceTier[] = ['untested', 'weak', 'fair', 'strong', 'cold_verified']

export function tierRank(tier: EvidenceTier): number {
  return TIER_ORDER.indexOf(tier)
}
