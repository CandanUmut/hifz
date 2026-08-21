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
      <div className="flex items-baseline gap-3">
        <p className="me-auto text-small">
          {data.todayCount > 0
            ? t('rhythm.todayDone', { count: data.todayCount })
            : t('rhythm.todayNone')}
        </p>
        {data.kept > 0 && (
          <p className="text-micro text-ink-soft">{t('rhythm.kept', { count: data.kept })}</p>
        )}
      </div>

      <div className="mt-2 flex items-end gap-[3px]" aria-hidden>
        {data.days.map((day) => (
          <span
            key={day.date}
            className={`flex-1 rounded-full ${
              day.count > 0 ? 'bg-verified' : 'bg-rule'
            } ${day.today ? 'ring-1 ring-ink/40 ring-offset-2 ring-offset-[rgb(var(--paper-raised))]' : ''}`}
            style={{
              height: day.count > 0 ? `${6 + (day.count / busiest) * 14}px` : '4px',
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-micro text-ink-soft">
        {t('rhythm.window', { days: data.activeDays, total: data.days.length })}
      </p>
    </div>
  )
}
