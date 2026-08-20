import { useEffect, useMemo, useRef, useState } from 'react'
import type { ErrorKind } from '@/engine/types'
import { initialsOf, sameInitial } from '@/lib/text'

/**
 * Type the first letter of each word. Matched positionally, so it is fast to
 * type and hard to fake, and the per-word diff on completion shows exactly
 * where the line came apart.
 */
export function TypeInitials({
  words: expectedWords,
  dir = 'rtl',
  lang,
  wordClassName = 'font-sacred text-[24px] leading-[1.9]',
  onComplete,
}: {
  /** The segment's word list — the authoritative tokenisation. */
  words: string[]
  dir?: 'rtl' | 'ltr'
  lang?: string
  wordClassName?: string
  onComplete: (errors: { wordIndex: number; kind: ErrorKind }[]) => void
}) {
  const expected = useMemo(() => initialsOf(expectedWords), [expectedWords])
  const [typed, setTyped] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (letters: string[]) => {
    const errors = letters.flatMap((letter, i) =>
      sameInitial(letter, expected[i])
        ? []
        : [{ wordIndex: i, kind: 'wrong_word' as ErrorKind }],
    )
    onComplete(errors)
  }

  const onChange = (raw: string) => {
    const letters = [...raw.replace(/\s+/g, '')].slice(0, expected.length)
    setTyped(letters)
    if (letters.length === expected.length) submit(letters)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" dir={dir}>
        {expected.map((_, i) => {
          const letter = typed[i]
          const state = letter == null ? 'empty' : sameInitial(letter, expected[i]) ? 'ok' : 'bad'
          return (
            <span
              key={i}
              lang={lang}
              className={[
                `flex h-11 w-11 items-center justify-center rounded-md border ${wordClassName}`,
                state === 'empty'
                  ? 'border-rule text-ink-soft'
                  : state === 'ok'
                    ? 'border-verified/60 text-ink'
                    : 'border-correction bg-correction/10 text-correction',
                i === typed.length ? 'ring-1 ring-focus' : '',
              ].join(' ')}
            >
              {letter ?? ''}
            </span>
          )
        })}
      </div>

      <label className="mt-4 block">
        <span className="label">First letter of each word</span>
        <input
          ref={inputRef}
          dir={dir}
          lang={lang}
          value={typed.join('')}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={`mt-1 min-h-[44px] w-full rounded-md border border-rule bg-paper-raised px-3
            text-ink ${wordClassName}`}
          aria-label={`Type the first letter of each of the ${expected.length} words`}
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-micro text-ink-soft">
          {typed.length} of {expected.length}
        </p>
        <button type="button" className="btn-text" onClick={() => submit(typed)}>
          Check now
        </button>
      </div>
    </div>
  )
}

/** Per-word diff shown once an objective mode has been checked. */
export function InitialsDiff({
  words: wordList,
  errors,
  dir = 'rtl',
  lang,
  className = 'sacred sacred-sm',
}: {
  words: string[]
  errors: { wordIndex: number }[]
  dir?: 'rtl' | 'ltr'
  lang?: string
  className?: string
}) {
  const bad = new Set(errors.map((e) => e.wordIndex))
  return (
    <p dir={dir} lang={lang} className={className}>
      {wordList.map((w, i) => (
        <span key={i} className={bad.has(i) ? 'text-correction' : undefined}>
          {w}{' '}
        </span>
      ))}
    </p>
  )
}
