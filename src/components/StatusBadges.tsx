import {
  EVIDENCE_LABELS,
  INTENT_LABELS,
  type EvidenceRef,
  type EvidenceTier,
  type Intent,
} from '@/engine/types'
import { evidenceLabel } from '@/engine/evidence'

/**
 * Two badges, never merged. The filled one is the user's word for what they
 * are working on; the outlined one is what the app actually observed.
 */
export function IntentBadge({ intent }: { intent: Intent }) {
  if (intent === 'not_started') return null
  const tone =
    intent === 'learning'
      ? 'bg-ink text-paper'
      : intent === 'maintaining'
        ? 'bg-verified text-paper'
        : 'bg-rule text-ink-soft'
  return (
    <span className={`rounded-full px-2 py-0.5 text-micro font-medium ${tone}`}>
      {INTENT_LABELS[intent]}
    </span>
  )
}

export function EvidenceChip({
  last,
  tier,
  className = '',
}: {
  last?: EvidenceRef
  tier?: EvidenceTier
  className?: string
}) {
  const tone =
    tier === 'weak'
      ? 'border-correction/50 text-correction'
      : tier === 'strong' || tier === 'cold_verified'
        ? 'border-verified/50 text-verified'
        : 'border-rule text-ink-soft'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-micro ${tone} ${className}`}
      title={tier ? EVIDENCE_LABELS[tier] : undefined}
    >
      {evidenceLabel(last)}
    </span>
  )
}
