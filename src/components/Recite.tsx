import { useCallback, useEffect, useRef, useState } from 'react'
import { asrCached, ASR_MODEL_MB, decodeToSamples, loadAsr, transcribe } from '@/lib/asr'
import { checkRecitation, suggestedRating, type RecitationCheck } from '@/engine/recitation'
import { useT } from '@/i18n'
import { useRecorder } from '@/lib/useRecorder'
import type { GradeRating } from '@/engine/scheduler'

type Phase = 'checking_cache' | 'need_model' | 'loading' | 'ready' | 'thinking' | 'done'

/** How often the running transcript catches up while you are still speaking. */
const INTERIM_MS = 1800

/**
 * Recite out loud and watch the words light up as they are heard.
 *
 * Showing nothing until the very end was the problem: you could not tell
 * whether the microphone was working, whether it had understood you, or why it
 * disagreed. Now the expected words fill in as they are recognised and the raw
 * transcript runs underneath, so the check is something you can watch rather
 * than a verdict handed down at the end.
 */
export function Recite({
  expectedWords,
  dir = 'rtl',
  lang,
  passageClassName,
  onChecked,
  onCancel,
}: {
  expectedWords: string[]
  dir?: 'rtl' | 'ltr'
  lang?: string
  passageClassName: string
  onChecked: (check: RecitationCheck, suggested: GradeRating) => void
  onCancel?: () => void
}) {
  const recorder = useRecorder()
  const t = useT()
  const [phase, setPhase] = useState<Phase>('checking_cache')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<RecitationCheck | null>(null)
  const busy = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    asrCached().then((cached) => {
      if (!cancelled) setPhase(cached ? 'ready' : 'need_model')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const fetchModel = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      await loadAsr((p) => {
        if (p.total > 0) setProgress(Math.round((p.loaded / p.total) * 100))
      })
      setPhase('ready')
    } catch {
      setError(t('recite.downloadFailed'))
      setPhase('need_model')
    }
  }, [t])

  const transcribeSnapshot = useCallback(
    async (blob: Blob) => {
      const samples = await decodeToSamples(blob)
      const heard = await transcribe(samples)
      return checkRecitation(heard, expectedWords)
    },
    [expectedWords],
  )

  /* Whisper is not a streaming model, so the running transcript is the whole
     recording so far, re-read every couple of seconds. It trails your voice by
     a second or two rather than keeping up with it word by word. */
  const pollInterim = useCallback(async () => {
    if (busy.current) return
    const blob = recorder.snapshot()
    if (!blob || blob.size < 2000) return
    busy.current = true
    try {
      setLive(await transcribeSnapshot(blob))
    } catch {
      /* a partial chunk may not decode yet; the next tick will */
    } finally {
      busy.current = false
    }
  }, [recorder, transcribeSnapshot])

  useEffect(() => {
    if (recorder.state !== 'recording') {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
      return
    }
    timer.current = window.setInterval(() => void pollInterim(), INTERIM_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [pollInterim, recorder.state])

  const begin = useCallback(async () => {
    setLive(null)
    setError(null)
    await recorder.start()
  }, [recorder])

  const finish = useCallback(async () => {
    const blob = await recorder.stop()
    if (!blob) return
    setPhase('thinking')
    try {
      const result = await transcribeSnapshot(blob)
      setLive(result)
      setPhase('done')
      onChecked(result, suggestedRating(result))
    } catch {
      setError(t('recite.failed'))
      setPhase('ready')
    }
  }, [onChecked, recorder, t, transcribeSnapshot])

  const back = onCancel && (
    <button type="button" className="btn-text px-0 text-micro" onClick={onCancel}>
      ← {t('review.show')}
    </button>
  )

  if (recorder.state === 'unsupported') {
    return (
      <div>
        <p className="text-small text-ink-soft">{t('recite.noMic')}</p>
        <div className="mt-2">{back}</div>
      </div>
    )
  }

  const heardSet = new Set(
    live ? live.expectedWords.map((_, i) => i).filter((i) => !live.missing.includes(i)) : [],
  )

  return (
    <div>
      {phase === 'checking_cache' && <p className="text-small text-ink-soft">{t('common.loading')}</p>}

      {phase === 'need_model' && (
        <div>
          <p className="text-small text-ink-soft">{t('recite.needModel', { mb: ASR_MODEL_MB })}</p>
          <button type="button" className="btn-primary mt-3 w-full py-3" onClick={fetchModel}>
            {t('recite.download')}
          </button>
          <div className="mt-1 text-center">{back}</div>
        </div>
      )}

      {phase === 'loading' && (
        <div>
          <p className="text-small text-ink-soft">{t('recite.downloading', { percent: progress })}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
            <div
              className="h-full rounded-full bg-verified transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {(phase === 'ready' || phase === 'thinking' || phase === 'done') && (
        <div>
          {/* The line, filling in word by word as it is recognised. */}
          {(live || recorder.state === 'recording') && (
            <div className="mb-3">
              <p dir={dir} lang={lang} className={`${passageClassName} leading-relaxed`}>
                {expectedWords.map((word, i) => (
                  <span
                    key={i}
                    className={
                      heardSet.has(i)
                        ? 'text-verified transition-colors'
                        : 'text-ink-soft/30 transition-colors'
                    }
                  >
                    {word}{' '}
                  </span>
                ))}
              </p>
              <p dir={dir} lang={lang} className="mt-2 min-h-[1.5em] text-small text-ink-soft">
                {live?.heard || (recorder.state === 'recording' ? '…' : '')}
              </p>
              {live && (
                <p className="mt-1 text-micro text-ink-soft">
                  {Math.round(live.score * 100)}%
                </p>
              )}
            </div>
          )}

          {phase === 'thinking' ? (
            <p className="text-small text-ink-soft" aria-live="polite">
              {t('recite.thinking')}
            </p>
          ) : recorder.state === 'recording' ? (
            <button type="button" className="btn-primary w-full py-3" onClick={finish}>
              ■ {t('recite.stop')} · {recorder.seconds}s
            </button>
          ) : phase === 'done' ? null : (
            <button type="button" className="btn-primary w-full py-3" onClick={begin}>
              🎤 {t('recite.start')}
            </button>
          )}

          {phase !== 'done' && recorder.state !== 'recording' && (
            <div className="mt-1 text-center">{back}</div>
          )}
          {recorder.state === 'denied' && (
            <p className="mt-2 text-small text-correction">{t('recite.denied')}</p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-small text-correction">{error}</p>}
    </div>
  )
}
