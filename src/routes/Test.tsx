import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { InkText } from '@/components/InkText'
import { ReciteControls, ReciteStage, useRecitation } from '@/components/Recite'
import { db } from '@/db/db'
import { getItems, getSegments, recordAttempt } from '@/db/repo'
import { ladder, type Rung } from '@/engine/ladder'
import { verdict } from '@/engine/recitation'
import type { ItemRecord, SegmentRecord, TextRecord } from '@/engine/types'
import type { GradeRating } from '@/engine/scheduler'
import { useT } from '@/i18n'
import { segmentWords } from '@/lib/text'
import { passageClass } from '@/lib/typography'
import { useSettings } from '@/state/settings'

/**
 * Testing whether a passage is memorised — which is not the same as being
 * asked each ayah in turn.
 *
 * Someone who can produce every ayah when it is named still cannot recite the
 * surah, because what breaks is never the ayah, it is the join. So the test
 * climbs: the new ayah alone, then everything from the top joined to it, the
 * whole first half in one go, the same again over the second half, and finally
 * all of it from the beginning.
 */
export default function Test() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const t = useT()
  const settings = useSettings()

  const textId = params.get('text') ?? ''
  const from = Number(params.get('from') ?? 0)
  const to = Number(params.get('to') ?? from)

  const [data, setData] = useState<{
    text: TextRecord
    segments: SegmentRecord[]
    items: ItemRecord[]
  } | null>(null)
  const [step, setStep] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [mode, setMode] = useState<'self' | 'recite'>('self')
  const startedAt = useRef(Date.now())

  useEffect(() => {
    ;(async () => {
      const text = await db.texts.get(textId)
      if (!text) return
      const [all, items] = await Promise.all([getSegments(textId), getItems(textId)])
      setData({ text, segments: all.filter((s) => s.index >= from && s.index <= to), items })
    })()
  }, [from, textId, to])

  const rungs: Rung[] = useMemo(
    () => (data ? ladder(data.segments.map((s) => s.index)) : []),
    [data],
  )
  const rung = rungs[step]

  const shown = useMemo(
    () => (data && rung ? rung.indices.map((i) => data.segments.find((s) => s.index === i)!) : []),
    [data, rung],
  )

  /* Every word of the rung, so a join is checked as one passage rather than as
     a series of ayah that happen to be next to each other. */
  const expectedWords = useMemo(() => shown.flatMap((s) => segmentWords(s)), [shown])

  /**
   * Only a single ayah moves the schedule.
   *
   * A join is the thing worth practising and the thing worth reporting, but it
   * is not evidence about any one ayah: failing "1 through 3" says the join
   * broke somewhere, not that ayah 2 is gone. Writing that against all three
   * would teach the scheduler something untrue.
   */
  const record = useCallback(
    async (rating: GradeRating) => {
      if (!data || !rung || rung.kind !== 'single') return
      const segment = data.segments.find((s) => s.index === rung.indices[0])
      const item = data.items.find((i) => i.segmentId === segment?.id && i.type === 'block')
      if (!item) return
      await recordAttempt({
        item,
        method: mode === 'recite' ? 'recite_asr' : 'self_grade',
        rating,
        peeks: revealed ? 1 : 0,
        meaningShown: false,
        durationMs: Date.now() - startedAt.current,
        cold: false,
        desiredRetention: settings.desiredRetention,
      })
    },
    [data, mode, revealed, rung, settings.desiredRetention],
  )

  const answer = useCallback(
    async (passed: boolean) => {
      await record(passed ? 3 : 1)
      setResults((r) => [...r, passed])
      setRevealed(false)
      setMode('self')
      startedAt.current = Date.now()
      setStep((n) => n + 1)
    },
    [record],
  )

  const recitation = useRecitation({
    expectedWords,
    lang: data?.text.lang,
    subject: `${step}`,
    onChecked: (check) => void answer(verdict(check) === 'accepted'),
  })

  if (!data) return <Centered>{t('common.loading')}</Centered>
  const { text, segments } = data

  if (!rungs.length)
    return (
      <Centered>
        <p className="text-base">{t('test.nothing')}</p>
        <button type="button" className="btn-primary mt-6" onClick={() => navigate(-1)}>
          {t('common.back')}
        </button>
      </Centered>
    )

  if (!rung) {
    const passed = results.filter(Boolean).length
    const whole = results[results.length - 1]
    return (
      <Centered>
        <p className={`text-base ${whole ? 'text-verified' : 'text-ink-soft'}`}>
          {whole ? t('test.doneWhole') : t('test.donePartly')}
        </p>
        <p className="mt-2 text-display">{t('test.score', { passed, total: results.length })}</p>
        <p className="mt-3 text-small text-ink-soft">{t('test.doneBody')}</p>
        <div className="mt-8 flex w-full flex-col gap-2">
          <button
            type="button"
            className="btn-secondary py-3"
            onClick={() => {
              setStep(0)
              setResults([])
              setRevealed(false)
            }}
          >
            {t('test.again')}
          </button>
          <button type="button" className="btn-primary py-3" onClick={() => navigate('/')}>
            {t('review.backToToday')}
          </button>
        </div>
      </Centered>
    )
  }

  const first = shown[0]
  const last = shown[shown.length - 1]
  const label =
    rung.kind === 'single'
      ? t('test.single', { ref: first?.ref ?? String(rung.indices[0] + 1) })
      : rung.kind === 'whole'
        ? t('test.whole', { from: first?.ref ?? '', to: last?.ref ?? '' })
        : t('test.join', { from: first?.ref ?? '', to: last?.ref ?? '' })

  const reciting = mode === 'recite' && !revealed

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-column px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-text px-1"
              onClick={() => navigate(-1)}
              aria-label={t('test.leave')}
            >
              ←
            </button>
            <p className="me-auto truncate text-small">
              {text.title} · {t('test.progress', { step: step + 1, total: rungs.length })}
            </p>
          </div>
          {/* One mark per rung, so the shape of the climb is visible. */}
          <div className="mt-2 flex gap-[3px]">
            {rungs.map((r, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  results[i] === true
                    ? 'bg-verified'
                    : results[i] === false
                      ? 'bg-correction'
                      : i === step
                        ? 'bg-ink'
                        : r.kind === 'single'
                          ? 'bg-rule'
                          : 'bg-rule/60'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-column flex-col justify-center px-5 pb-44 pt-6">
        <p className="label">{label}</p>
        <p className="mt-2 text-small text-ink-soft">
          {rung.kind === 'single' ? t('test.singleBody') : t('test.joinBody')}
        </p>

        <div className="card mt-6 flex min-h-[34vh] flex-col justify-center px-5 py-6">
          {reciting ? (
            <ReciteStage
              state={recitation}
              dir={text.dir}
              lang={text.lang}
              passageClassName={passageClass(text)}
            />
          ) : (
            <div className="space-y-5">
              {shown.map((s) => (
                <div key={s.id}>
                  {shown.length > 1 && <p className="label mb-1">{s.ref}</p>}
                  <InkText
                    text={s.content}
                    words={segmentWords(s)}
                    level={revealed ? 0 : 3}
                    dir={text.dir}
                    lang={text.lang}
                    className={passageClass(text)}
                    peekable={!revealed}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-column space-y-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {reciting ? (
            <ReciteControls state={recitation} onCancel={() => setMode('self')} />
          ) : revealed ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1 py-3"
                onClick={() => void answer(false)}
              >
                {t('test.missed')}
              </button>
              <button
                type="button"
                className="btn-primary flex-1 py-3"
                onClick={() => void answer(true)}
              >
                {t('test.knew')}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary w-full py-3"
                onClick={() => setRevealed(true)}
              >
                {t('review.show')}
              </button>
              <button
                type="button"
                className="btn-secondary w-full py-3"
                onClick={() => setMode('recite')}
              >
                🎤 {t('review.recite')}
              </button>
            </>
          )}
        </div>
      </footer>
      {segments.length === 0 && null}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-column flex-col items-center justify-center px-5 text-center">
      {children}
    </div>
  )
}
