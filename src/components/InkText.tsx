import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/**
 * The signature element: hints rendered as ink leaving the page.
 *
 * Layout is defined by one always-present copy of the full text, so nothing
 * can reflow between levels — the head overlay and the ghost bar are absolutely
 * positioned and only fade in and out.
 *
 *   0  full ink        opacity 1
 *   1  drying          opacity 0.45
 *   2  first letters   first glyph 0.9, rest 0.06 (shape still visible)
 *   3  ghost           word-shaped baseline bars at 0.10, correct widths
 *   4  blank           measured empty space
 */
export type HintLevel = 0 | 1 | 2 | 3 | 4

export const HINT_LEVELS: HintLevel[] = [0, 1, 2, 3, 4]

export const HINT_LEVEL_NAMES: Record<HintLevel, string> = {
  0: 'Full',
  1: 'Drying',
  2: 'First letters',
  3: 'Ghost',
  4: 'Blank',
}

const PEEK_MS = 1800

type Token = { kind: 'word'; text: string; index: number } | { kind: 'space'; text: string }

/** Splits on whitespace while keeping the gaps, so spacing is never invented. */
function tokenize(text: string): Token[] {
  const out: Token[] = []
  let wordIndex = 0
  for (const piece of text.split(/(\s+)/)) {
    if (piece === '') continue
    if (/^\s+$/.test(piece)) out.push({ kind: 'space', text: piece })
    else out.push({ kind: 'word', text: piece, index: wordIndex++ })
  }
  return out
}

/** Length in code units of the first grapheme cluster — base letter plus its marks. */
function firstClusterLength(word: string): number {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Seg) {
    const seg = new Seg(undefined, { granularity: 'grapheme' })
    const first = seg.segment(word)[Symbol.iterator]().next()
    if (!first.done) return (first.value as { segment: string }).segment.length
  }
  const m = /^.[\p{M}ـ]*/u.exec(word)
  return m ? m[0].length : 1
}

export interface InkTextProps {
  text: string
  level: HintLevel
  dir?: 'rtl' | 'ltr'
  lang?: string
  /** Tapping a faded word restores it for 1.8s. Off in cold check. */
  peekable?: boolean
  onPeek?: (wordIndex: number) => void
  /** Word currently being recited, highlighted with --focus. */
  activeWordIndex?: number | null
  className?: string
  /** Words the user got wrong, tinted with --correction. */
  errorWordIndices?: number[]
}

export function InkText({
  text,
  level,
  dir = 'rtl',
  lang,
  peekable = false,
  onPeek,
  activeWordIndex = null,
  className = '',
  errorWordIndices,
}: InkTextProps) {
  const tokens = useMemo(() => tokenize(text), [text])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [peeked, setPeeked] = useState<Set<number>>(() => new Set())
  const timers = useRef(new Map<number, number>())
  const errorSet = useMemo(() => new Set(errorWordIndices ?? []), [errorWordIndices])

  useEffect(() => {
    setPeeked(new Set())
    const map = timers.current
    return () => {
      map.forEach((t) => window.clearTimeout(t))
      map.clear()
    }
  }, [text])

  const peek = useCallback(
    (index: number) => {
      if (!peekable || level === 0) return
      onPeek?.(index)
      setPeeked((prev) => {
        const next = new Set(prev)
        next.add(index)
        return next
      })
      const existing = timers.current.get(index)
      if (existing) window.clearTimeout(existing)
      timers.current.set(
        index,
        window.setTimeout(() => {
          timers.current.delete(index)
          setPeeked((prev) => {
            const next = new Set(prev)
            next.delete(index)
            return next
          })
        }, PEEK_MS),
      )
    },
    [level, onPeek, peekable],
  )

  return (
    <div
      ref={containerRef}
      dir={dir}
      lang={lang}
      className={className}
      data-ink-level={level}
      style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
    >
      {tokens.map((token, i) =>
        token.kind === 'space' ? (
          <span key={`s${i}`}>{token.text}</span>
        ) : (
          <InkWord
            key={`w${token.index}`}
            word={token.text}
            level={peeked.has(token.index) ? 0 : level}
            peekable={peekable && level !== 0}
            onPeek={() => peek(token.index)}
            active={activeWordIndex === token.index}
            errored={errorSet.has(token.index)}
          />
        ),
      )}
    </div>
  )
}

interface InkWordProps {
  word: string
  level: HintLevel
  peekable: boolean
  onPeek: () => void
  active: boolean
  errored: boolean
}

function InkWord({ word, level, peekable, onPeek, active, errored }: InkWordProps) {
  const baseRef = useRef<HTMLSpanElement | null>(null)
  const [headClip, setHeadClip] = useState<string | null>(null)
  const [measureKey, setMeasureKey] = useState(0)

  // Re-measure once webfonts have actually landed, and whenever the box resizes.
  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) setMeasureKey((k) => k + 1)
    })
    const el = baseRef.current
    if (!el || typeof ResizeObserver === 'undefined') return () => {
      cancelled = true
    }
    const ro = new ResizeObserver(() => setMeasureKey((k) => k + 1))
    ro.observe(el)
    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const el = baseRef.current
    const node = el?.firstChild
    if (!el || !node || node.nodeType !== Node.TEXT_NODE) return
    const headLen = Math.min(firstClusterLength(word), word.length)
    let range: Range
    try {
      range = document.createRange()
      range.setStart(node, 0)
      range.setEnd(node, headLen)
    } catch {
      return
    }
    const box = el.getBoundingClientRect()
    const head = range.getBoundingClientRect()
    range.detach?.()
    if (!box.width || !head.width) return
    // Inset relative to the word's own box, so line wrapping never affects it.
    const left = Math.max(0, head.left - box.left)
    const right = Math.max(0, box.right - head.right)
    setHeadClip(`inset(-0.75em ${right.toFixed(2)}px -0.75em ${left.toFixed(2)}px)`)
  }, [word, measureKey])

  const baseOpacity =
    level === 0
      ? 'var(--ink-level-0)'
      : level === 1
        ? 'var(--ink-level-1)'
        : level === 2
          ? 'var(--ink-tail)'
          : '0'

  const interactive = peekable && level !== 0

  return (
    <span
      className="ink-word"
      data-level={level}
      data-active={active || undefined}
      data-errored={errored || undefined}
      onClick={interactive ? onPeek : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPeek()
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Peek at this word' : undefined}
      style={{ cursor: interactive ? 'pointer' : undefined }}
    >
      <span ref={baseRef} className="ink-word__base" style={{ opacity: baseOpacity }}>
        {word}
      </span>
      <span
        aria-hidden="true"
        className="ink-word__head"
        style={{
          opacity: level === 2 && headClip ? 'var(--ink-head)' : 0,
          clipPath: headClip ?? 'inset(0 100% 0 0)',
        }}
      >
        {word}
      </span>
      <span
        aria-hidden="true"
        className="ink-word__ghost"
        style={{ opacity: level === 3 ? 'var(--ink-ghost)' : 0 }}
      />
    </span>
  )
}
