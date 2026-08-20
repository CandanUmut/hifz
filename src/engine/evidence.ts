import {
  COLD_GAP_DAYS,
  METHOD_CONFIDENCE,
  METHOD_LABELS,
  type Confidence,
  type EvidenceRef,
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

/**
 * What the chip says. The app reports what it saw, never what the user knows.
 */
export function evidenceLabel(last: EvidenceRef | undefined, now = Date.now()): string {
  if (!last) return 'Not checked yet'
  const label = last.gapDays >= COLD_GAP_DAYS ? 'Cold-checked' : METHOD_LABELS[last.method]
  return `${label} · ${relativeDays(last.at, now)}`
}

export function relativeDays(at: number, now = Date.now()): string {
  const days = Math.floor((now - at) / 86_400_000)
  if (days <= 0) {
    const hours = Math.floor((now - at) / 3_600_000)
    if (hours <= 0) return 'just now'
    return `${hours}h ago`
  }
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30.44)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = (days / 365.25).toFixed(1)
  return `${years} years ago`
}

/** Order used by the heat strip and the evidence distribution. */
export const TIER_ORDER: EvidenceTier[] = ['untested', 'weak', 'fair', 'strong', 'cold_verified']

export function tierRank(tier: EvidenceTier): number {
  return TIER_ORDER.indexOf(tier)
}
