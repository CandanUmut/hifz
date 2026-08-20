import { useMemo, useState } from 'react'
import type { ErrorKind } from '@/engine/types'
import { hashString, shuffle, words as splitWords } from '@/lib/text'

/**
 * Words of the segment as chips, tapped back into order. Wrong taps flash in
 * --correction and are recorded on the attempt.
 */
export function OrderTap({
  content,
  dir = 'rtl',
  lang,
  onComplete,
}: {
  content: string
  dir?: 'rtl' | 'ltr'
  lang?: string
  onComplete: (errors: { wordIndex: number; kind: ErrorKind }[]) => void
}) {
  const expected = useMemo(() => splitWords(content), [content])
  const pool = useMemo(
    () => shuffle(expected.map((w, i) => ({ w, i })), hashString(content)),
    [content, expected],
  )
  const [placed, setPlaced] = useState<number[]>([])
  const [wrong, setWrong] = useState<number | null>(null)
  const [errors, setErrors] = useState<{ wordIndex: number; kind: ErrorKind }[]>([])

  const position = placed.length
  const used = new Set(placed)

  const tap = (chip: { w: string; i: number }, chipIndex: number) => {
    if (used.has(chip.i)) return
    // Matched on text, so a repeated word can be tapped from either chip.
    if (chip.w === expected[position]) {
      const next = [...placed, chip.i]
      setPlaced(next)
      setWrong(null)
      if (next.length === expected.length) onComplete(errors)
    } else {
      setWrong(chipIndex)
      window.setTimeout(() => setWrong((v) => (v === chipIndex ? null : v)), 450)
      setErrors((prev) => [...prev, { wordIndex: position, kind: 'wrong_order' as ErrorKind }])
    }
  }

  return (
    <div>
      <div
        dir={dir}
        lang={lang}
        className="sacred sacred-sm min-h-[3.2em] border-b border-rule pb-3"
        aria-live="polite"
      >
        {placed.map((i, n) => (
          <span key={n}>{expected[i]} </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" dir={dir}>
        {pool.map((chip, chipIndex) => (
          <button
            key={chipIndex}
            type="button"
            disabled={used.has(chip.i)}
            onClick={() => tap(chip, chipIndex)}
            lang={lang}
            className={[
              'min-h-[44px] rounded-md border px-3 py-1 font-sacred text-[24px] leading-[1.9] transition-colors',
              used.has(chip.i)
                ? 'invisible'
                : wrong === chipIndex
                  ? 'border-correction bg-correction/15 text-correction'
                  : 'border-rule bg-paper-raised hover:border-ink-soft',
            ].join(' ')}
          >
            {chip.w}
          </button>
        ))}
      </div>

      <p className="mt-3 text-micro text-ink-soft">
        {position} of {expected.length} placed
        {errors.length > 0 && ` · ${errors.length} wrong tap${errors.length === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}
