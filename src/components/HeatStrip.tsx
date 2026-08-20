import type { EvidenceTier } from '@/engine/types'
import { useT } from '@/i18n'

/**
 * One square per segment, coloured by evidence tier. Not a progress bar — it
 * shows the shape of what is actually holding, gaps and all.
 */
const TONE: Record<EvidenceTier | 'unplanned', string> = {
  unplanned: 'border border-rule bg-transparent',
  untested: 'border border-rule bg-rule/40',
  weak: 'border border-correction/60 bg-correction/45',
  fair: 'border border-verified/40 bg-verified/35',
  strong: 'border border-verified/70 bg-verified/75',
  cold_verified: 'border border-verified bg-verified',
}

export function HeatStrip({
  count,
  tiers,
  max = 40,
  onSelect,
}: {
  count: number
  tiers: Map<number, EvidenceTier>
  max?: number
  onSelect?: (index: number) => void
}) {
  const t = useT()
  const shown = Math.min(count, max)
  const cells = Array.from({ length: shown }, (_, i) => i)
  return (
    <div className="flex flex-wrap items-center gap-[3px]" aria-hidden={!onSelect}>
      {cells.map((i) => {
        const tier = tiers.get(i)
        const tone = TONE[tier ?? 'unplanned']
        const label = `${i + 1}: ${tier ? t(`evidence.${tier}`) : ''}`
        return onSelect ? (
          <button
            key={i}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onSelect(i)}
            className={`h-3 w-3 rounded-[2px] ${tone}`}
          />
        ) : (
          <span key={i} title={label} className={`h-3 w-3 rounded-[2px] ${tone}`} />
        )
      })}
      {count > shown && <span className="text-micro text-ink-soft">+{count - shown}</span>}
    </div>
  )
}

export function HeatLegend() {
  const t = useT()
  const entries: EvidenceTier[] = ['untested', 'weak', 'fair', 'strong', 'cold_verified']
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-ink-soft">
      {entries.map((tier) => (
        <span key={tier} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[2px] ${TONE[tier]}`} />
          {t(`evidence.${tier}`)}
        </span>
      ))}
    </div>
  )
}
