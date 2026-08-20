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

interface GraphemeSegmenter {
  segment(input: string): Iterable<{ segment: string }>
}

/** Length in code units of the first grapheme cluster — base letter plus its marks. */
function firstClusterLength(word: string): number {
  const Seg = (
    Intl as unknown as {
      Segmenter?: new (locale?: string, options?: { granularity: string }) => GraphemeSegmenter
    }
  ).Segmenter
  if (Seg) {
    const first = new Seg(undefined, { granularity: 'grapheme' })
      .segment(word)
      [Symbol.iterator]()
      .next()
    if (!first.done) return first.value.segment.length
  }
  // Tatweel is kept with the base letter so an elongated first glyph stays whole.
  const m = /^.[\p{M}\u0640]*/u.exec(word)
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
  /** Incrementing counter from the keyboard shortcut; peeks the next word. */
  peekSignal?: number
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
  peekSignal = 0,
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

  // P from the keyboard peeks the next word that is not already showing.
  const wordCount = tokens.filter((t) => t.kind === 'word').length
  useEffect(() => {
    if (!peekSignal || !peekable || level === 0) return
    for (let i = 0; i < wordCount; i++) {
      if (!peeked.has(i)) {
        peek(i)
        return
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peekSignal])

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
  const [headPx, setHeadPx] = useState<number | null>(null)
  const [measureKey, setMeasureKey] = useState(0)

  // Re-measure once webfonts have actually landed, and whenever the box resizes.
  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) setMeasureKey((k) => k + 1)
    })
    const el = baseRef.current
    if (!el || typeof ResizeObserver === 'undefined')
      return () => {
        cancelled = true
      }
    const ro = new ResizeObserver(() => setMeasureKey((k) => k + 1))
    ro.observe(el)
    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [])

  /**
   * Level 2 shows the first glyph and little else. Rather than splitting the
   * word — which would break Arabic cursive shaping and change its width — the
   * one copy of the word is masked: opaque over the first cluster, nearly
   * transparent after it. The cluster's advance is measured in context with a
   * Range, so the join is exactly where the letter really ends.
   */
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
    const rtl = getComputedStyle(el).direction === 'rtl'
    // Distance from the word's own start edge to the end of the first cluster.
    const extent = rtl ? box.right - head.left : head.right - box.left
    setHeadPx(Math.max(0, Math.min(box.width, extent)))
  }, [word, measureKey])

  const baseOpacity =
    level === 0
      ? 'var(--ink-level-0)'
      : level === 1
        ? 'var(--ink-level-1)'
        : level === 2
          ? 'var(--ink-head)'
          : '0'

  // Everything past the first cluster is scaled by this; 1 leaves the word whole.
  const tailAlpha = level === 2 && headPx != null ? 'var(--ink-tail-ratio)' : '1'
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
      <span
        ref={baseRef}
        className="ink-word__base"
        style={
          {
            opacity: baseOpacity,
            '--ink-head-px': `${(headPx ?? 0).toFixed(2)}px`,
            '--ink-tail-alpha': tailAlpha,
          } as React.CSSProperties
        }
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
