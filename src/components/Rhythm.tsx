import type { Rhythm as RhythmData } from '@/db/rhythm'
import { useT } from '@/i18n'

/**
 * Fourteen days as fourteen marks. A day you sat down is inked; a day you did
 * not is a rule. No number to lose, nothing to break — just the shape of how
 * it has been going, and what you are carrying.
 */
export function Rhythm({ data }: { data: RhythmData }) {
  const t = useT()
  const busiest = Math.max(1, ...data.days.map((d) => d.count))

  return (
    <div className="card mb-4 px-4 py-3">
      <p className="text-small">
        {data.todayCount > 0
          ? t('rhythm.todayDone', { count: data.todayCount })
          : t('rhythm.todayNone')}
      </p>

      <div className="mt-2.5 flex items-end gap-[3px]" aria-hidden>
        {data.days.map((day) => (
          <span
            key={day.date}
            className={`flex-1 rounded-full ${day.count > 0 ? 'bg-verified' : 'bg-rule'}`}
            /* Capped: a busy day is a taller mark, never a blob next to a rule. */
            style={{ height: day.count > 0 ? `${5 + (day.count / busiest) * 7}px` : '4px' }}
          />
        ))}
      </div>

      {/* One quiet line, so a fortnight with nothing in it is not a headline. */}
      <p className="mt-2.5 text-micro text-ink-soft">
        {data.activeDays > 0
          ? t('rhythm.window', { days: data.activeDays, total: data.days.length })
          : t('rhythm.windowEmpty')}
        {data.kept > 0 && <> · {t('rhythm.kept', { count: data.kept })}</>}
      </p>
    </div>
  )
}
