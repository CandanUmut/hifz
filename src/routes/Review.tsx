import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { InkText } from '@/components/InkText'
import { GradeButtons } from '@/components/GradeButtons'
import { Recite } from '@/components/Recite'
import { SessionMarks } from '@/components/SessionMarks'
import { SimilarPassages } from '@/components/SimilarPassages'
import { Transliteration } from '@/components/Transliteration'
import { db } from '@/db/db'
import {
  buildQueue,
  coldCheckCandidates,
  getItems,
  getSegments,
  readingOrder,
  recordAttempt,
} from '@/db/repo'
import type { SegmentRecord, TextRecord } from '@/engine/types'
import type { GradeRating } from '@/engine/scheduler'
import { useT } from '@/i18n'
import { resolveMeaning, resolveTransliteration } from '@/lib/translations'
import { segmentWords, words as splitWords } from '@/lib/text'
import { passageClass, passageClassSmall, wordClass } from '@/lib/typography'
import { useAudio } from '@/lib/useAudio'
import { useInterference } from '@/lib/useInterference'
import { useSettings } from '@/state/settings'
import { useSession, type SessionEntry, type SessionKind } from '@/state/session'

const TAIL_WORDS = 5

export default function Review({ kind = 'review' }: { kind?: SessionKind }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const focusItemId = params.get('item')
  const practiseTextId = params.get('text')
  const settings = useSettings()
  const session = useSession()
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      const items = await pickItems({
        kind,
        focusItemId,
        practiseTextId,
        dailyNewCap: settings.dailyNewCap,
      })
      const entries = await hydrate(items)
      if (!entries.length) {
        setEmpty(true)
        setLoading(false)
        return
      }
      session.start(kind, entries)
      setLoading(false)
    })()
  }, [focusItemId, kind, practiseTextId, session, settings.dailyNewCap])

  if (loading) return <Centered>{t('common.loading')}</Centered>

  if (empty) {
    return (
      <Centered>
        <p className="text-base">
          {kind === 'cold' ? t('review.nothingCold') : t('review.nothingDue')}
        </p>
        <Link to="/" className="btn-secondary mt-6">
          {t('review.backToToday')}
        </Link>
      </Centered>
    )
  }

  if (session.phase === 'done') return <SessionDone kind={kind} onLeave={() => navigate('/')} />

  return <Room kind={kind} />
}

// --- picking what to show --------------------------------------------------

async function pickItems({
  kind,
  focusItemId,
  practiseTextId,
  dailyNewCap,
}: {
  kind: SessionKind
  focusItemId: string | null
  practiseTextId: string | null
  dailyNewCap: number
}) {
  if (focusItemId) {
    const item = await db.items.get(focusItemId)
    return item ? [item] : []
  }
  // Practice ignores due dates and the daily cap: the reader asked for this
  // surah now, and refusing them is the thing that made the app feel locked.
  if (practiseTextId) {
    const items = await getItems(practiseTextId)
    return items.filter((i) => i.intent !== 'paused').sort(readingOrder)
  }
  if (kind === 'cold') return coldCheckCandidates(Date.now(), 10)
  return buildQueue({ dailyNewCap, limit: 60 })
}

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

// --- the room --------------------------------------------------------------

function Room({ kind }: { kind: SessionKind }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const t = useT()
  const { entries, marks, index, phase, mode, draft, setMode, peek, reveal, markChecked, beginTest, advance } =
    useSession()

  const entry = entries[index]
  const [peekSignal, setPeekSignal] = useState(0)
  const [busy, setBusy] = useState(false)
  const interference = useInterference()
  const audio = useAudio(entry?.text, entry ? [entry.segment, ...(entry.nextSegment ? [entry.nextSegment] : [])] : [])

  const answerSegment = entry
    ? entry.item.type === 'link'
      ? (entry.nextSegment ?? entry.segment)
      : entry.segment
    : undefined

  const meaning = useMemo(
    () => (entry && answerSegment ? resolveMeaning(answerSegment, entry.text, settings) : {}),
    [answerSegment, entry, settings],
  )
  const translit = useMemo(
    () =>
      entry && answerSegment ? resolveTransliteration(answerSegment, entry.text, settings) : undefined,
    [answerSegment, entry, settings],
  )

  // Looking is allowed, and it lowers the ceiling. A cold check allows nothing.
  const peekable = kind !== 'cold'
  const capped = draft.peeks > 0 || draft.errors.length > 0

  const grade = useCallback(
    async (rating: GradeRating) => {
      if (!entry || busy) return
      setBusy(true)
      audio.stop()
      try {
        const updated = await recordAttempt({
          item: entry.item,
          method: mode,
          rating,
          peeks: draft.peeks,
          meaningShown: false,
          durationMs: Date.now() - draft.startedAt,
          hintLevel: draft.hintLevel,
          errors: draft.errors,
          heard: draft.heard,
          cold: kind === 'cold',
          desiredRetention: settings.desiredRetention,
        })
        advance(rating, updated)
      } finally {
        setBusy(false)
      }
    },
    [advance, audio, busy, draft, entry, kind, mode, settings.desiredRetention],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /input|textarea/i.test(target.tagName)) return
      if (e.key === ' ' && phase !== 'answer') {
        e.preventDefault()
        if (phase === 'learn') beginTest()
        else reveal()
      }
      if ((e.key === 'p' || e.key === 'P') && peekable && phase === 'prompt') {
        e.preventDefault()
        setPeekSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [beginTest, peekable, phase, reveal])

  if (!entry || !answerSegment) return null

  const { item, segment, nextSegment, text } = entry
  const ref =
    item.type === 'link'
      ? `${segment.ref ?? segment.index + 1} → ${nextSegment?.ref ?? ''}`
      : (segment.ref ?? String(segment.index + 1))
  const showAnswer = phase === 'answer'

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-column items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              audio.stop()
              navigate('/')
            }}
            className="btn-text px-1"
            aria-label={t('review.leave')}
          >
            ←
          </button>
          <div className="me-auto min-w-0">
            <p className="truncate text-small">
              {text.title} {ref}
            </p>
            {kind === 'cold' && <p className="text-micro text-ink-soft">{t('review.coldLabel')}</p>}
          </div>
          <SessionMarks marks={marks} current={index} />
        </div>
      </header>

      <div
        className={[
          'mx-auto flex max-w-column flex-col px-5 pt-8',
          phase === 'learn' ? 'pb-16' : 'min-h-[calc(100dvh-4.25rem)] justify-center pb-52',
        ].join(' ')}
      >
        {phase === 'learn' ? (
          <LearnPane
            entry={entry}
            segment={answerSegment}
            meaning={meaning}
            translit={translit}
            audio={audio}
            onReady={beginTest}
          />
        ) : (
          <>
            {/* Context for a join: the tail of the line before it. */}
            {item.type === 'link' && (
              <>
                <InkText
                  text={splitWords(segment.content).slice(-TAIL_WORDS).join(' ')}
                  level={0}
                  dir={text.dir}
                  lang={text.lang}
                  className={passageClass(text)}
                />
                <hr className="my-6 border-rule" />
                <p className="label mb-3">{t('review.whatComesNext')}</p>
              </>
            )}

            {item.type === 'meaning' && (
              <>
                <InkText
                  text={segment.content}
                  words={segmentWords(segment)}
                  level={0}
                  dir={text.dir}
                  lang={text.lang}
                  className={passageClass(text)}
                />
                <hr className="my-6 border-rule" />
                <p className="label mb-3">{t('review.whatDoesItMean')}</p>
              </>
            )}

            {item.type === 'meaning' ? (
              showAnswer ? (
                <p className="meaning text-ink">{meaning.tr?.text ?? meaning.en?.text}</p>
              ) : (
                <p className="text-small text-ink-soft">{t('review.recallPrompt')}</p>
              )
            ) : (
              <>
                <InkText
                  text={answerSegment.content}
                  words={segmentWords(answerSegment)}
                  level={showAnswer ? 0 : draft.hintLevel}
                  dir={text.dir}
                  lang={text.lang}
                  className={passageClass(text)}
                  peekable={peekable && !showAnswer}
                  onPeek={peek}
                  peekSignal={peekSignal}
                  activeWordIndex={audio.playingIndex != null ? audio.activeWord : null}
                  errorWordIndices={showAnswer ? draft.errors.map((e) => e.wordIndex) : undefined}
                />
                {!showAnswer && (
                  <p className="mt-6 text-small text-ink-soft">{t('review.recallPrompt')}</p>
                )}
              </>
            )}

            {showAnswer && (
              <>
                <Transliteration line={translit} className="mt-4" />
                {meaning.tr && item.type !== 'meaning' && (
                  <p className="meaning mt-3">{meaning.tr.text}</p>
                )}
                {audio.available && answerSegment.audio && (
                  <button
                    type="button"
                    className="btn-text mt-4 self-start px-0"
                    onClick={() => audio.playSegment(answerSegment)}
                  >
                    {audio.playingIndex != null ? `■ ${t('text.stop')}` : `▶ ${t('text.play')}`}
                  </button>
                )}
                <SimilarPassages matches={interference.resolve(answerSegment.id)} />
              </>
            )}
          </>
        )}
      </div>

      {phase !== 'learn' && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
          <div className="mx-auto max-w-column px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {showAnswer ? (
              <>
                <p className="mb-2 text-center text-base">{t('review.didYouRemember')}</p>
                <GradeButtons capped={capped} onGrade={grade} />
                <p className="mt-2 text-center text-micro text-ink-soft">
                  {capped ? t('review.easyOffAfterPeek') : t('review.gradeHint')}
                </p>
              </>
            ) : mode === 'recite_asr' && item.type !== 'meaning' ? (
              <Recite
                expectedWords={segmentWords(answerSegment)}
                dir={text.dir}
                lang={text.lang}
                passageClassName={passageClassSmall(text)}
                onChecked={(check) =>
                  markChecked(
                    check.missing.map((wordIndex) => ({ wordIndex, kind: 'missing' })),
                    check.heard,
                  )
                }
                onCancel={() => setMode('self_grade')}
              />
            ) : (
              <>
                <button type="button" className="btn-primary w-full py-3" onClick={reveal}>
                  {t('review.show')}
                </button>
                {/* Offered here, not hidden behind a settings toggle: nobody
                    could tell the feature existed. Tapping it explains the
                    one-time download before anything is fetched. */}
                {item.type !== 'meaning' && (
                  <button
                    type="button"
                    className="btn-secondary mt-2 w-full py-3"
                    onClick={() => setMode('recite_asr')}
                  >
                    🎤 {t('review.recite')}
                  </button>
                )}
                {draft.peeks > 0 && (
                  <p className="mt-1 text-center text-micro text-ink-soft">
                    {t(draft.peeks === 1 ? 'review.peeks' : 'review.peeksPlural', {
                      count: draft.peeks,
                    })}
                  </p>
                )}
              </>
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
  segment,
  meaning,
  translit,
  audio,
  onReady,
}: {
  entry: SessionEntry
  segment: SegmentRecord
  meaning: ReturnType<typeof resolveMeaning>
  translit: ReturnType<typeof resolveTransliteration>
  audio: ReturnType<typeof useAudio>
  onReady: () => void
}) {
  const { text } = entry
  const t = useT()
  return (
    <div>
      <p className="label mb-4">{t('review.learnTitle')}</p>
      <InkText
        text={segment.content}
        words={segmentWords(segment)}
        level={0}
        dir={text.dir}
        lang={text.lang}
        className={passageClass(text)}
        activeWordIndex={audio.playingIndex != null ? audio.activeWord : null}
      />
      <Transliteration line={translit} className="mt-3" />
      {meaning.tr && <p className="meaning mt-5">{meaning.tr.text}</p>}
      {meaning.en && <p className="meaning mt-2">{meaning.en.text}</p>}

      {audio.available && segment.audio && (
        <button type="button" className="btn-secondary mt-6" onClick={() => audio.playSegment(segment)}>
          {audio.playingIndex != null ? `■ ${t('text.stop')}` : `▶ ${t('text.play')}`}
        </button>
      )}

      {segment.words && segment.words.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2">{t('text.words')}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-3" dir={text.dir}>
            {segment.words.map((w, i) => (
              <span key={i} className="text-center">
                <span className={`block ${wordClass(text)}`}>{w.ar}</span>
                {w.translit && (
                  <span className="block text-micro text-ink-soft" dir="ltr">
                    {w.translit}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="btn-primary mt-10 w-full py-3" onClick={onReady}>
        {t('review.ready')}
      </button>
    </div>
  )
}

function SessionDone({ kind, onLeave }: { kind: SessionKind; onLeave: () => void }) {
  const { marks, passedFirstTime, entries, reset } = useSession()
  const t = useT()
  const total = marks.length
  const missed = marks.filter((m) => m === 'missed').length
  const saved = useRef(false)

  useEffect(() => {
    if (kind !== 'cold' || saved.current || !total) return
    saved.current = true
    import('@/db/db').then(({ db: database, newId }) =>
      database.coldChecks.add({
        id: newId(),
        at: Date.now(),
        itemIds: entries.map((e) => e.item.id),
        passedFirstTime,
        total,
      }),
    )
  }, [entries, kind, passedFirstTime, total])

  return (
    <Centered>
      {kind === 'cold' ? (
        <>
          <p className="text-display">
            {t('review.coldResult', { passed: passedFirstTime, total })}
          </p>
          <p className="mt-3 text-small text-ink-soft">{t('review.coldNote')}</p>
        </>
      ) : (
        <>
          <p className="text-display">{t('review.doneTitle', { count: total })}</p>
          <p className="mt-3 text-small text-ink-soft">
            {missed === 0 ? t('review.doneNoneMissed') : t('review.doneMissed', { count: missed })}
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
        {t('review.backToToday')}
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
