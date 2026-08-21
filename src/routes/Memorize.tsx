import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { InkText } from '@/components/InkText'
import { Transliteration } from '@/components/Transliteration'
import { db } from '@/db/db'
import { addToPlan, getSegments, markStudied, promoteToReview } from '@/db/repo'
import { DEFAULT_ITEM_TYPES } from '@/engine/items'
import type { SegmentRecord, TextRecord } from '@/engine/types'
import { useT } from '@/i18n'
import { segmentWords } from '@/lib/text'
import { meaningLines, resolveMeaning, resolveTransliteration } from '@/lib/translations'
import { passageClass } from '@/lib/typography'
import { useAudio } from '@/lib/useAudio'
import { useSettings } from '@/state/settings'

const LISTEN_TIMES = 3

/**
 * A method, not a screen full of text.
 *
 * Showing the surah and calling it a memorisation app is not a method. This is
 * the way it is actually taught: hear it, say it with the voice, say it alone,
 * join it to what came before, and finish by reciting the whole passage. One
 * ayah at a time, with a stated goal for the sitting.
 */
type Step = 'listen' | 'along' | 'alone' | 'join' | 'whole' | 'done'

export default function Memorize() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const t = useT()
  const settings = useSettings()

  const textId = params.get('text') ?? ''
  const from = Number(params.get('from') ?? 0)
  const to = Number(params.get('to') ?? from)

  const [data, setData] = useState<{ text: TextRecord; segments: SegmentRecord[] } | null>(null)
  const [cursor, setCursor] = useState(from)
  const [step, setStep] = useState<Step>('listen')
  const [plays, setPlays] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const saved = useRef(false)

  useEffect(() => {
    ;(async () => {
      const text = await db.texts.get(textId)
      if (!text) return
      const all = await getSegments(textId)
      setData({ text, segments: all.filter((s) => s.index >= from && s.index <= to) })
    })()
  }, [from, textId, to])

  const audio = useAudio(data?.text, data?.segments)
  const segment = data?.segments.find((s) => s.index === cursor)
  const rangeLabel = useMemo(() => {
    if (!data?.segments.length) return ''
    const first = data.segments[0]
    const last = data.segments[data.segments.length - 1]
    return first === last ? (first.ref ?? '') : `${first.ref ?? ''} – ${last.ref ?? ''}`
  }, [data])

  // Count completed plays so "listen three times" means something.
  const wasPlaying = useRef(false)
  useEffect(() => {
    const playing = audio.playingIndex != null
    if (wasPlaying.current && !playing) setPlays((n) => n + 1)
    wasPlaying.current = playing
  }, [audio.playingIndex])

  const goto = useCallback((next: Step) => {
    setStep(next)
    setPlays(0)
    setRevealed(false)
  }, [])

  const finish = useCallback(async () => {
    if (saved.current || !data) return
    saved.current = true
    const indices = data.segments.map((s) => s.index)
    // Finishing the drill is what moves a passage into the review queue.
    await addToPlan({
      textId,
      indices,
      types: { ...DEFAULT_ITEM_TYPES, meaning: false },
      stage: 'review',
    })
    await promoteToReview(textId, indices)
    await markStudied(textId, indices)
    goto('done')
  }, [data, goto, textId])

  if (!data || !segment) return <Centered>{t('common.loading')}</Centered>

  const { text, segments } = data
  const position = segments.findIndex((s) => s.index === cursor) + 1
  const isLast = position === segments.length
  const meaning = resolveMeaning(segment, text, settings)
  const translit = resolveTransliteration(segment, text, settings)

  const advance = () => {
    if (step === 'listen') return goto('along')
    if (step === 'along') return goto('alone')
    if (step === 'alone') return position > 1 ? goto('join') : nextAyah()
    if (step === 'join') return nextAyah()
    if (step === 'whole') return void finish()
  }

  const nextAyah = () => {
    if (!isLast) {
      audio.stop()
      setCursor(segments[position].index)
      goto('listen')
      return
    }
    // A single-ayah goal has no passage to run through, so it is already done.
    if (segments.length > 1) goto('whole')
    else void finish()
  }

  if (step === 'done') {
    return (
      <Centered>
        <p className="text-base text-verified">{t('memorize.donePraise')}</p>
        <p className="mt-2 text-display">{t('memorize.doneTitle', { range: rangeLabel })}</p>
        <p className="mt-3 text-small text-ink-soft">{t('memorize.doneBody')}</p>
        <div className="mt-8 flex w-full flex-col gap-2">
          <button type="button" className="btn-primary py-3" onClick={() => navigate('/review')}>
            {t('memorize.reviewNow')}
          </button>
          <button type="button" className="btn-secondary py-3" onClick={() => navigate('/')}>
            {t('review.backToToday')}
          </button>
        </div>
      </Centered>
    )
  }

  // Never a lock, only a suggestion about which button is the obvious one.
  const listenedEnough = step !== 'listen' || plays >= LISTEN_TIMES
  const hiddenStep = step === 'alone' || step === 'join' || step === 'whole'
  const shown =
    step === 'join'
      ? segments.filter((s) => s.index <= cursor)
      : step === 'whole'
        ? segments
        : [segment]

  const body =
    step === 'listen'
      ? t('memorize.step.listenBody')
      : step === 'along'
        ? t('memorize.step.alongBody')
        : step === 'alone'
          ? t('memorize.step.aloneBody')
          : step === 'join'
            ? t('memorize.step.joinBody', {
                from: segments[0].ref ?? '',
                to: segment.ref ?? '',
              })
            : t('memorize.step.wholeBody', { range: rangeLabel })

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-column px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-text px-1"
              onClick={() => {
                audio.stop()
                navigate(-1)
              }}
              aria-label={t('memorize.leave')}
            >
              ←
            </button>
            <p className="me-auto truncate text-small">
              {text.title} · {t('memorize.goal', { range: rangeLabel })}
            </p>
          </div>
          {/* One mark per ayah in the goal, so the end is always in sight. */}
          <div className="mt-2 flex gap-1">
            {segments.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${
                  i + 1 < position ? 'bg-verified' : i + 1 === position ? 'bg-ink' : 'bg-rule'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-column flex-col px-5 pb-40 pt-6">
        <p className="label">
          {step === 'whole'
            ? t('memorize.step.whole')
            : `${t(`memorize.step.${step}`)} · ${t('memorize.ayahOf', { n: position, total: segments.length })}`}
        </p>
        <p className="mt-2 text-small text-ink-soft">{body}</p>

        <div className="mt-8 flex flex-1 flex-col justify-center space-y-6">
          {shown.map((s) => (
            <div key={s.id}>
              {shown.length > 1 && <p className="label mb-1">{s.ref}</p>}
              <InkText
                text={s.content}
                words={segmentWords(s)}
                level={hiddenStep && !revealed ? 3 : 0}
                dir={text.dir}
                lang={text.lang}
                className={passageClass(text)}
                peekable={hiddenStep && !revealed}
                activeWordIndex={audio.playingIndex === s.index ? audio.activeWord : null}
              />
            </div>
          ))}
        </div>

        {!hiddenStep && (
          <>
            <Transliteration line={translit} className="mt-4" />
            {meaningLines(meaning, settings).map((line) => (
              <p key={line.title} className="meaning mt-3">
                {line.text}
              </p>
            ))}
          </>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-column space-y-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {(step === 'listen' || step === 'along') && (
            <>
              {/* Whichever button the step is actually asking for is the black
                  one. Continue was the primary from the first frame, which
                  reads as "skip this" on a screen that says listen first. */}
              {audio.playingIndex != null ? (
                <button
                  type="button"
                  className={`${listenedEnough ? 'btn-secondary' : 'btn-primary'} w-full py-3`}
                  onClick={audio.stop}
                >
                  ■ {t('text.stop')}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${listenedEnough ? 'btn-secondary' : 'btn-primary'} w-full py-3`}
                  onClick={() => audio.playSegment(segment)}
                >
                  ▶ {plays === 0 ? t('memorize.play') : t('memorize.replay')}
                </button>
              )}
              {step === 'listen' && (
                <p className="text-center text-micro text-ink-soft">
                  {t('memorize.playCount', { done: Math.min(plays, LISTEN_TIMES), total: LISTEN_TIMES })}
                </p>
              )}
              {/* Say whose voice this is. A text you typed in has no reciter. */}
              {!audio.recorded && (
                <p className="text-center text-micro text-ink-soft">{t('audio.browserVoice')}</p>
              )}
              <button
                type="button"
                className={`${listenedEnough ? 'btn-primary' : 'btn-secondary'} w-full py-3`}
                onClick={advance}
              >
                {t('memorize.continue')}
              </button>
            </>
          )}

          {hiddenStep && !revealed && (
            <button
              type="button"
              className="btn-primary w-full py-3"
              onClick={() => setRevealed(true)}
            >
              {t('memorize.reveal')}
            </button>
          )}

          {hiddenStep && revealed && (
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1 py-3" onClick={() => goto('listen')}>
                {t('memorize.repeat')}
              </button>
              <button type="button" className="btn-primary flex-1 py-3" onClick={advance}>
                {t('memorize.gotIt')}
              </button>
            </div>
          )}
        </div>
      </footer>
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
