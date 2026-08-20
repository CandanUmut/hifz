import type { EvidenceRef, EvidenceTier, Intent } from '@/engine/types'
import { useT } from '@/i18n'
import { relativeDays } from '@/engine/evidence'
import { COLD_GAP_DAYS } from '@/engine/types'

/**
 * Two badges, never merged. The filled one is the user's word for what they
 * are working on; the outlined one is what the app actually observed.
 */
export function IntentBadge({ intent }: { intent: Intent }) {
  const t = useT()
  if (intent === 'not_started') return null
  const tone =
    intent === 'learning'
      ? 'bg-ink text-paper'
      : intent === 'maintaining'
        ? 'bg-verified text-paper'
        : 'bg-rule text-ink-soft'
  return (
    <span className={`rounded-full px-2 py-0.5 text-micro font-medium ${tone}`}>
      {t(`intent.${intent}`)}
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
  const t = useT()
  const tone =
    tier === 'weak'
      ? 'border-correction/50 text-correction'
      : tier === 'strong' || tier === 'cold_verified'
        ? 'border-verified/50 text-verified'
        : 'border-rule text-ink-soft'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-micro ${tone} ${className}`}
      title={tier ? t(`evidence.${tier}`) : undefined}
    >
      {last
        ? `${t(last.gapDays >= COLD_GAP_DAYS ? 'method.recite_asr' : `method.${last.method}`)} · ${relativeDays(last.at, Date.now(), t)}`
        : t('evidence.untested')}
    </span>
  )
}
