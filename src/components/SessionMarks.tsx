import type { MarkStatus } from '@/state/session'

/** What is left, honestly — one mark per item, not a percentage. */
export function SessionMarks({ marks, current }: { marks: MarkStatus[]; current: number }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="img"
      aria-label={`${marks.filter((m) => m !== 'pending').length} of ${marks.length} done`}
    >
      {marks.map((mark, i) => (
        <span
          key={i}
          className={[
            'h-2.5 w-2.5 rounded-[2px] border transition-colors',
            mark === 'passed'
              ? 'border-ink bg-ink'
              : mark === 'missed'
                ? 'border-correction bg-correction/60'
                : 'border-ink-soft/60 bg-transparent',
            i === current ? 'ring-1 ring-focus ring-offset-1 ring-offset-paper' : '',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

/** One dot per peek used. Visible, because a peek changes what the grade means. */
export function PeekDots({ peeks }: { peeks: number }) {
  if (peeks <= 0) return null
  return (
    <div className="flex items-center gap-1.5 text-micro text-ink-soft">
      {Array.from({ length: Math.min(peeks, 8) }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
      ))}
      <span>
        {peeks} peek{peeks === 1 ? '' : 's'}
      </span>
    </div>
  )
}
