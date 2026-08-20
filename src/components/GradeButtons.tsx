import { useEffect } from 'react'
import type { GradeRating } from '@/engine/scheduler'
import { useT } from '@/i18n'
import type { StringKey } from '@/i18n/strings'

const LABELS: Record<GradeRating, StringKey> = {
  1: 'review.grade.again',
  2: 'review.grade.hard',
  3: 'review.grade.good',
  4: 'review.grade.easy',
}

/**
 * Four plain answers to one plain question. The scheduling intervals used to be
 * printed under each one; they were noise, and reading "15d" told nobody
 * whether they had remembered the ayah.
 *
 * "Easily" is off after a peek: a line you looked at cannot have been effortless.
 */
export function GradeButtons({
  capped,
  onGrade,
}: {
  capped: boolean
  onGrade: (rating: GradeRating) => void
}) {
  const t = useT()

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
              'btn min-h-[52px] border text-small font-medium',
              rating === 1
                ? 'border-correction/60 text-correction hover:bg-correction/10'
                : rating === 3
                  ? 'border-verified/60 text-ink hover:bg-verified/10'
                  : 'border-rule text-ink hover:border-ink-soft',
              disabled ? 'cursor-not-allowed opacity-30' : '',
            ].join(' ')}
          >
            {t(LABELS[rating])}
          </button>
        )
      })}
    </div>
  )
}
