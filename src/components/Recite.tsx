import { useCallback, useEffect, useState } from 'react'
import { InkText } from './InkText'
import { asrCached, ASR_MODEL_MB, decodeToSamples, loadAsr, transcribe } from '@/lib/asr'
import { checkRecitation, suggestedRating, type RecitationCheck } from '@/engine/recitation'
import { useT } from '@/i18n'
import { useRecorder } from '@/lib/useRecorder'
import type { GradeRating } from '@/engine/scheduler'

type Phase = 'checking_cache' | 'need_model' | 'loading' | 'ready' | 'thinking' | 'done'

/**
 * Recite the line out loud; the app listens here on the device and shows what
 * it heard against what it expected. It suggests nothing louder than a diff —
 * recognition mishears, and a machine's mistake must not become a lapse.
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
  /** Back out to plain self-checking without leaving the card. */
  onCancel?: () => void
}) {
  const recorder = useRecorder()
  const t = useT()
  const [phase, setPhase] = useState<Phase>('checking_cache')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [check, setCheck] = useState<RecitationCheck | null>(null)

  // Second time round the model is already here, so skip the warning.
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

  const finish = useCallback(async () => {
    const blob = await recorder.stop()
    if (!blob) return
    setPhase('thinking')
    setError(null)
    try {
      const samples = await decodeToSamples(blob)
      const heard = await transcribe(samples)
      const result = checkRecitation(heard, expectedWords)
      setCheck(result)
      setPhase('done')
      onChecked(result, suggestedRating(result))
    } catch {
      setError(t('recite.failed'))
      setPhase('ready')
    }
  }, [expectedWords, onChecked, recorder, t])

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

  return (
    <div>
      {phase === 'checking_cache' && <p className="text-small text-ink-soft">{t('common.loading')}</p>}

      {phase === 'need_model' && (
        <div>
          <p className="text-small text-ink-soft">{t('recite.needModel', { mb: ASR_MODEL_MB })}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={fetchModel}>
              {t('recite.download')}
            </button>
            {back}
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div>
          <p className="text-small text-ink-soft">{t('recite.downloading', { percent: progress })}</p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rule">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div>
          {recorder.state === 'recording' ? (
            <button type="button" className="btn-primary w-full py-3" onClick={finish}>
              ■ {t('recite.stop')}
            </button>
          ) : (
            <button type="button" className="btn-primary w-full py-3" onClick={recorder.start}>
              🎤 {t('recite.start')}
            </button>
          )}
          <div className="mt-1 flex items-center justify-between gap-3">
            {back}
            {recorder.state === 'recording' && (
              <span className="text-micro text-ink-soft" aria-live="polite">
                {t('recite.listening', { seconds: recorder.seconds })}
              </span>
            )}
          </div>
          {recorder.state === 'denied' && (
            <p className="mt-2 text-small text-correction">{t('recite.denied')}</p>
          )}
        </div>
      )}

      {phase === 'thinking' && (
        <p className="text-small text-ink-soft" aria-live="polite">
          {t('recite.thinking')}
        </p>
      )}

      {phase === 'done' && check && (
        <div>
          <p className="label mb-2">
            {check.missing.length === 0
              ? `${t('recite.allHeard')} · ${Math.round(check.score * 100)}%`
              : `${t(check.missing.length === 1 ? 'recite.missed' : 'recite.missedPlural', {
                  count: check.missing.length,
                })} · ${Math.round(check.score * 100)}%`}
          </p>
          <InkText
            text={check.expectedWords.join(' ')}
            words={check.expectedWords}
            level={0}
            dir={dir}
            lang={lang}
            className={passageClassName}
            errorWordIndices={check.missing}
          />
          {/* What it heard, in full and in the same script — you cannot judge
              the check without seeing this, and it used to be a footnote. */}
          <div className="mt-3 rounded-md border border-rule bg-paper-raised p-3">
            <p className="label mb-1">{t('recite.heard')}</p>
            <p dir={dir} lang={lang} className={check.heard ? passageClassName : 'text-small text-ink-soft'}>
              {check.heard || t('recite.heardNothing')}
            </p>
          </div>
          <p className="mt-2 text-micro text-ink-soft">{t('recite.notAJudge')}</p>
        </div>
      )}

      {error && <p className="mt-3 text-small text-correction">{error}</p>}
    </div>
  )
}
