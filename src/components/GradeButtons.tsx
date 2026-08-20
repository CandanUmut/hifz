import { useEffect } from 'react'
import { formatInterval, preview, RATING_LABELS, type GradeRating } from '@/engine/scheduler'
import type { StoredCard } from '@/engine/types'

/**
 * Grades map to FSRS ratings 1–4. Easy is disabled and visually inert when the
 * user peeked or made an error: a hinted answer cannot claim to be effortless.
 */
export function GradeButtons({
  card,
  desiredRetention,
  capped,
  onGrade,
}: {
  card: StoredCard
  desiredRetention: number
  capped: boolean
  onGrade: (rating: GradeRating) => void
}) {
  const now = Date.now()
  const outcomes = preview(card, desiredRetention, now)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /input|textarea/i.test(target.tagName)) return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) {
        if (n === 4 && capped) return
        e.preventDefault()
        onGrade(n as GradeRating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capped, onGrade])

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {([1, 2, 3, 4] as GradeRating[]).map((rating) => {
        const disabled = rating === 4 && capped
        return (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onGrade(rating)}
            className={[
              'btn min-h-[52px] flex-col gap-0.5 border',
              rating === 1
                ? 'border-correction/60 text-correction hover:bg-correction/10'
                : 'border-rule text-ink hover:border-ink-soft',
              disabled ? 'cursor-not-allowed opacity-30' : '',
            ].join(' ')}
            title={disabled ? 'Not available after a peek' : undefined}
          >
            <span className="text-small font-medium">{RATING_LABELS[rating]}</span>
            <span className="text-micro text-ink-soft">
              {formatInterval(now, outcomes[rating].due)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
