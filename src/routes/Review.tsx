import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { InkText, type HintLevel } from '@/components/InkText'
import { GradeButtons } from '@/components/GradeButtons'
import { OrderTap } from '@/components/OrderTap'
import { InitialsDiff, TypeInitials } from '@/components/TypeInitials'
import { PeekDots, SessionMarks } from '@/components/SessionMarks'
import { db, newId } from '@/db/db'
import {
  buildQueue,
  coldCheckCandidates,
  getSegments,
  recordAttempt,
} from '@/db/repo'
import { ITEM_TYPE_LABELS, type ErrorKind, type SegmentRecord, type TextRecord } from '@/engine/types'
import type { GradeRating } from '@/engine/scheduler'
import { resolveMeaning } from '@/lib/translations'
import { passageClass, passageClassSmall, wordClass } from '@/lib/typography'
import { words as splitWords } from '@/lib/text'
import { useSettings } from '@/state/settings'
import { useSession, type SessionEntry, type SessionKind } from '@/state/session'

const TAIL_WORDS = 5

export default function Review({ kind = 'review' }: { kind?: SessionKind }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const focusItemId = params.get('item')
  const settings = useSettings()
  const session = useSession()
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    let cancelled = false
    ;(async () => {
      // A single item, when arriving from a weak-link row on Progress.
      const focused = focusItemId ? await db.items.get(focusItemId) : undefined
      const items = focused
        ? [focused]
        : kind === 'cold'
          ? await coldCheckCandidates(Date.now(), 10)
          : await buildQueue({ dailyNewCap: settings.dailyNewCap, limit: 60 })
      const entries = await hydrate(items)
      if (cancelled) return
      if (!entries.length) {
        setEmpty(true)
        setLoading(false)
        return
      }
      session.start(kind, entries, settings.defaultResponseMode, settings.hintAggressiveness)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [
    focusItemId,
    kind,
    session,
    settings.dailyNewCap,
    settings.defaultResponseMode,
    settings.hintAggressiveness,
  ])

  if (loading) return <Centered>Loading…</Centered>

  if (empty) {
    return (
      <Centered>
        <p className="text-base">
          {kind === 'cold'
            ? 'Nothing has been left alone for a month yet. Come back later.'
            : 'Nothing due. Enjoy the quiet.'}
        </p>
        <Link to="/" className="btn-secondary mt-6">
          Back to today
        </Link>
      </Centered>
    )
  }

  if (session.phase === 'done') return <SessionDone kind={kind} onLeave={() => navigate('/')} />

  return <Room kind={kind} />
}

// --- loading ---------------------------------------------------------------

async function hydrate(items: Awaited<ReturnType<typeof buildQueue>>): Promise<SessionEntry[]> {
  const textIds = [...new Set(items.map((i) => i.textId))]
  const texts = new Map<string, TextRecord>()
  const segments = new Map<string, SegmentRecord>()
  for (const id of textIds) {
    const text = await db.texts.get(id)
    if (text) texts.set(id, text)
    for (const segment of await getSegments(id)) segments.set(segment.id, segment)
  }
  return items.flatMap((item) => {
    const text = texts.get(item.textId)
    const segment = segments.get(item.segmentId)
    if (!text || !segment) return []
    return [
      {
        item,
        segment,
        nextSegment: item.nextSegmentId ? segments.get(item.nextSegmentId) : undefined,
        text,
      },
    ]
  })
}

// --- the quiet room --------------------------------------------------------

function Room({ kind }: { kind: SessionKind }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const {
    entries,
    marks,
    index,
    phase,
    mode,
    draft,
    setMode,
    moreHint,
    peek,
    showMeaning,
    reveal,
    markChecked,
    beginTest,
    advance,
  } = useSession()

  const entry = entries[index]
  const [peekSignal, setPeekSignal] = useState(0)
  const [busy, setBusy] = useState(false)

  const meaning = useMemo(
    () => (entry ? resolveMeaning(entry.segment, entry.text, settings) : {}),
    [entry, settings],
  )

  // Peeks are not allowed in a cold check — that is the whole point of one.
  const peekable = kind !== 'cold'
  const capped = draft.peeks > 0 || draft.meaningShown || draft.errors.length > 0

  const onPeek = useCallback(() => peek(), [peek])

  const grade = useCallback(
    async (rating: GradeRating) => {
      if (!entry || busy) return
      setBusy(true)
      try {
        const updated = await recordAttempt({
          item: entry.item,
          method: mode,
          rating,
          peeks: draft.peeks,
          meaningShown: draft.meaningShown,
          durationMs: Date.now() - draft.startedAt,
          hintLevel: draft.hintLevel,
          errors: draft.errors,
          cold: kind === 'cold',
          desiredRetention: settings.desiredRetention,
        })
        advance(rating, updated)
      } finally {
        setBusy(false)
      }
    },
    [advance, busy, draft, entry, kind, mode, settings.desiredRetention],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /input|textarea/i.test(target.tagName)) return
      if (e.key === ' ' && phase !== 'answer') {
        e.preventDefault()
        if (phase === 'learn') beginTest()
        else if (mode === 'self_grade') reveal()
      }
      if ((e.key === 'p' || e.key === 'P') && peekable && phase === 'prompt') {
        e.preventDefault()
        setPeekSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [beginTest, mode, peekable, phase, reveal])

  if (!entry) return null

  const { item, segment, nextSegment, text } = entry
  const answerSegment = item.type === 'link' ? (nextSegment ?? segment) : segment
  const ref =
    item.type === 'link'
      ? `${segment.ref ?? segment.index + 1} → ${nextSegment?.ref ?? ''}`
      : (segment.ref ?? String(segment.index + 1))

  const showAnswer = phase === 'answer'
  const level: HintLevel = showAnswer ? 0 : draft.hintLevel

  return (
    <div className="min-h-dvh">
      {/* No nav in here. One back affordance and the marks. */}
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-column items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-text px-1"
            aria-label="Leave this session"
          >
            ←
          </button>
          <div className="me-auto min-w-0">
            <p className="truncate text-small">
              {text.title} {ref}
            </p>
            <p className="text-micro text-ink-soft">
              {ITEM_TYPE_LABELS[item.type]}
              {kind === 'cold' && ' · cold check'}
            </p>
          </div>
          <SessionMarks marks={marks} current={index} />
        </div>
      </header>

      <div
        className={[
          'mx-auto flex max-w-column flex-col px-5 pt-8',
          phase === 'learn'
            ? 'pb-16'
            : 'min-h-[calc(100dvh-4.25rem)] justify-center pb-44',
        ].join(' ')}
      >
        {phase === 'learn' ? (
          <LearnPane entry={entry} meaning={meaning} onReady={beginTest} />
        ) : (
          <>
            <Prompt
              entry={entry}
              level={level}
              peekable={peekable && !showAnswer}
              onPeek={onPeek}
              peekSignal={peekSignal}
              showAnswer={showAnswer}
              meaningText={meaning.tr?.text ?? meaning.en?.text}
              meaningShown={draft.meaningShown}
              mode={mode}
              suppressAnswerBlock={showAnswer && draft.checked}
            />

            {!showAnswer && mode === 'order_tap' && item.type !== 'meaning' && (
              <div className="mt-8">
                <OrderTap
                  content={answerSegment.content}
                  dir={text.dir}
                  lang={text.lang}
                  passageClassName={passageClassSmall(text)}
                  wordClassName={wordClass(text)}
                  onComplete={(errors) => markChecked(errors)}
                />
              </div>
            )}

            {!showAnswer && mode === 'type_initials' && item.type !== 'meaning' && (
              <div className="mt-8">
                <TypeInitials
                  content={answerSegment.content}
                  dir={text.dir}
                  lang={text.lang}
                  wordClassName={wordClass(text)}
                  onComplete={(errors) => markChecked(errors)}
                />
              </div>
            )}

            {showAnswer && draft.checked && (
              <CheckResult
                content={answerSegment.content}
                errors={draft.errors}
                dir={text.dir}
                lang={text.lang}
                passageClassName={passageClassSmall(text)}
              />
            )}
          </>
        )}
      </div>

      {phase !== 'learn' && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
          <div className="mx-auto max-w-column px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <PeekDots peeks={draft.peeks} />
            {showAnswer ? (
              <div className="mt-2">
                <GradeButtons
                  card={item.fsrs}
                  desiredRetention={settings.desiredRetention}
                  capped={capped}
                  onGrade={grade}
                />
                {capped && (
                  <p className="mt-2 text-micro text-ink-soft">
                    {draft.errors.length > 0
                      ? 'Easy is off after a wrong word.'
                      : 'Easy is off after a peek.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {mode === 'self_grade' && (
                  <button type="button" className="btn-primary w-full" onClick={reveal}>
                    Show answer
                  </button>
                )}
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <button
                    type="button"
                    className="btn-text"
                    onClick={moreHint}
                    disabled={draft.hintLevel === 0 || kind === 'cold'}
                    title={kind === 'cold' ? 'No hints in a cold check' : undefined}
                  >
                    More hint
                  </button>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={showMeaning}
                    disabled={draft.meaningShown || !(meaning.tr || meaning.en)}
                  >
                    Meaning
                  </button>
                  <ModeSwitch mode={mode} disabled={item.type === 'meaning'} onChange={setMode} />
                </div>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}

// --- panes -----------------------------------------------------------------

function LearnPane({
  entry,
  meaning,
  onReady,
}: {
  entry: SessionEntry
  meaning: ReturnType<typeof resolveMeaning>
  onReady: () => void
}) {
  const { segment, nextSegment, item, text } = entry
  const shown = item.type === 'link' ? (nextSegment ?? segment) : segment
  return (
    <div>
      <p className="label mb-4">Learn — nothing is graded here</p>
      <InkText
        text={shown.content}
        level={0}
        dir={text.dir}
        lang={text.lang}
        className={passageClass(text)}
      />
      {meaning.tr && <p className="meaning mt-6">{meaning.tr.text}</p>}
      {meaning.en && <p className="meaning mt-3">{meaning.en.text}</p>}
      {shown.words && shown.words.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2">Word by word</p>
          <div className="flex flex-wrap gap-x-5 gap-y-3" dir={text.dir}>
            {shown.words.map((w, i) => (
              <span key={i} className="text-center">
                <span className={`block ${wordClass(text)}`}>{w.ar}</span>
                <span className="block text-micro text-ink-soft" dir="ltr">
                  {w.en ?? w.translit}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="btn-primary mt-10 w-full sm:w-auto" onClick={onReady}>
        Ready to check
      </button>
    </div>
  )
}

function Prompt({
  entry,
  level,
  peekable,
  onPeek,
  peekSignal,
  showAnswer,
  meaningText,
  meaningShown,
  mode,
  suppressAnswerBlock = false,
}: {
  entry: SessionEntry
  level: HintLevel
  peekable: boolean
  onPeek: () => void
  peekSignal: number
  showAnswer: boolean
  meaningText?: string
  meaningShown: boolean
  mode: string
  /** The diff below is the answer; do not print the line twice. */
  suppressAnswerBlock?: boolean
}) {
  const { item, segment, nextSegment, text } = entry
  const passage = passageClass(text)

  if (item.type === 'link') {
    const tail = splitWords(segment.content).slice(-TAIL_WORDS).join(' ')
    return (
      <div>
        <InkText text={tail} level={0} dir={text.dir} lang={text.lang} className={passage} />
        <hr className="my-6 border-rule" />
        <p className="label mb-3">What comes next?</p>
        {!suppressAnswerBlock && (
          <InkText
            text={nextSegment?.content ?? ''}
            level={level}
            dir={text.dir}
            lang={text.lang}
            className={passage}
            peekable={peekable && mode === 'self_grade'}
            onPeek={onPeek}
            peekSignal={peekSignal}
          />
        )}
        {meaningShown && meaningText && <p className="meaning mt-6">{meaningText}</p>}
      </div>
    )
  }

  if (item.type === 'meaning') {
    const toMeaning = item.meaningDirection !== 'from_meaning'
    return toMeaning ? (
      <div>
        <InkText
          text={segment.content}
          level={0}
          dir={text.dir}
          lang={text.lang}
          className={passage}
        />
        <hr className="my-6 border-rule" />
        <p className="label mb-3">What does it mean?</p>
        {showAnswer ? (
          <p className="meaning text-ink">{meaningText}</p>
        ) : (
          <p className="text-small text-ink-soft">Say it, then show the answer.</p>
        )}
      </div>
    ) : (
      <div>
        <p className="meaning text-ink">{meaningText}</p>
        <hr className="my-6 border-rule" />
        <p className="label mb-3">Which line is this?</p>
        <InkText
          text={segment.content}
          level={level}
          dir={text.dir}
          lang={text.lang}
          className={passage}
          peekable={peekable}
          onPeek={onPeek}
          peekSignal={peekSignal}
        />
      </div>
    )
  }

  return (
    <div>
      {!suppressAnswerBlock && (
        <InkText
          text={segment.content}
          level={level}
          dir={text.dir}
          lang={text.lang}
          className={passage}
          peekable={peekable && mode === 'self_grade'}
          onPeek={onPeek}
          peekSignal={peekSignal}
        />
      )}
      {meaningShown && meaningText && <p className="meaning mt-6">{meaningText}</p>}
    </div>
  )
}

function CheckResult({
  content,
  errors,
  dir,
  lang,
  passageClassName,
}: {
  content: string
  errors: { wordIndex: number; kind: ErrorKind }[]
  dir: 'rtl' | 'ltr'
  lang: string
  passageClassName: string
}) {
  return (
    <div className="mt-8 border-t border-rule pt-6">
      <p className="label mb-3">
        {errors.length === 0
          ? 'Every word in place.'
          : `${errors.length} off — marked below.`}
      </p>
      <InitialsDiff
        content={content}
        errors={errors}
        dir={dir}
        lang={lang}
        className={passageClassName}
      />
    </div>
  )
}

function ModeSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: string
  disabled: boolean
  onChange: (mode: 'self_grade' | 'order_tap' | 'type_initials') => void
}) {
  return (
    <label className="flex items-center gap-2 text-micro text-ink-soft">
      <span className="sr-only">Response mode</span>
      <select
        value={mode}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as 'self_grade')}
        className="min-h-[44px] rounded-md border border-rule bg-paper-raised px-2 text-micro
          text-ink-soft disabled:opacity-40"
      >
        <option value="self_grade">Self-check</option>
        <option value="order_tap">Tap in order</option>
        <option value="type_initials">Type initials</option>
      </select>
    </label>
  )
}

// --- end -------------------------------------------------------------------

function SessionDone({ kind, onLeave }: { kind: SessionKind; onLeave: () => void }) {
  const { marks, passedFirstTime, entries, reset } = useSession()
  const total = marks.length
  const missed = marks.filter((m) => m === 'missed').length
  const saved = useRef(false)

  useEffect(() => {
    if (kind !== 'cold' || saved.current || !total) return
    saved.current = true
    db.coldChecks.add({
      id: newId(),
      at: Date.now(),
      itemIds: entries.map((e) => e.item.id),
      passedFirstTime,
      total,
    })
  }, [entries, kind, passedFirstTime, total])

  return (
    <Centered>
      {kind === 'cold' ? (
        <>
          <p className="text-display">
            You recalled {passedFirstTime} of {total} first-time.
          </p>
          <p className="mt-3 text-small text-ink-soft">
            That is the honest number. The ones you missed are back in the schedule.
          </p>
        </>
      ) : (
        <>
          <p className="text-display">Done — {total} items.</p>
          <p className="mt-3 text-small text-ink-soft">
            {missed === 0
              ? 'Nothing missed.'
              : `${missed} missed, and each one comes back sooner.`}
          </p>
        </>
      )}
      <button
        type="button"
        className="btn-primary mt-8"
        onClick={() => {
          reset()
          onLeave()
        }}
      >
        Back to today
      </button>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-column flex-col items-center justify-center px-5 text-center">
      {children}
    </div>
  )
}
