import { useCallback, useState } from 'react'
import { InkText } from './InkText'
import { asrCached, ASR_MODEL_MB, decodeToSamples, loadAsr, transcribe } from '@/lib/asr'
import { checkRecitation, suggestedRating, type RecitationCheck } from '@/engine/recitation'
import { useRecorder } from '@/lib/useRecorder'
import type { GradeRating } from '@/engine/scheduler'

type Phase = 'need_model' | 'loading' | 'ready' | 'thinking' | 'done'

/**
 * Recite the line out loud; the app listens on this device and shows what it
 * heard against what it expected. It suggests a grade but never sets one —
 * recognition mishears, and a machine's mistake must not become a lapse.
 */
export function Recite({
  expectedWords,
  dir = 'rtl',
  lang,
  passageClassName,
  onChecked,
}: {
  expectedWords: string[]
  dir?: 'rtl' | 'ltr'
  lang?: string
  passageClassName: string
  onChecked: (check: RecitationCheck, suggested: GradeRating) => void
}) {
  const recorder = useRecorder()
  const [phase, setPhase] = useState<Phase>('need_model')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [check, setCheck] = useState<RecitationCheck | null>(null)

  // Second time round the model is already on the device, so skip the warning.
  useState(() => {
    asrCached().then((cached) => setPhase(cached ? 'ready' : 'need_model'))
  })

  const fetchModel = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      await loadAsr((p) => {
        if (p.total > 0) setProgress(Math.round((p.loaded / p.total) * 100))
      })
      setPhase('ready')
    } catch (err) {
      setError(`The model could not be downloaded. ${String(err).slice(0, 120)}`)
      setPhase('need_model')
    }
  }, [])

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
    } catch (err) {
      setError(`That recording could not be read. ${String(err).slice(0, 120)}`)
      setPhase('ready')
    }
  }, [expectedWords, onChecked, recorder])

  if (recorder.state === 'unsupported') {
    return (
      <p className="text-small text-ink-soft">
        This browser has no microphone recording, so the recitation check is not available here.
      </p>
    )
  }

  return (
    <div>
      {phase === 'need_model' && (
        <div>
          <p className="text-small text-ink-soft">
            Checking recitation needs a Qur&apos;an-tuned speech model, about {ASR_MODEL_MB} MB. It
            downloads once and stays on this device. Your voice is never uploaded — the listening
            happens here.
          </p>
          <button type="button" className="btn-secondary mt-3" onClick={fetchModel}>
            Download the model
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div>
          <p className="text-small text-ink-soft">Downloading the model… {progress}%</p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rule">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex flex-wrap items-center gap-3">
          {recorder.state === 'recording' ? (
            <>
              <button type="button" className="btn-primary" onClick={finish}>
                Stop and check
              </button>
              <span className="text-small text-ink-soft" aria-live="polite">
                Listening… {recorder.seconds}s
              </span>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={recorder.start}>
              Recite it
            </button>
          )}
          {recorder.state === 'denied' && (
            <span className="text-small text-correction">
              The microphone was not allowed, so nothing can be heard.
            </span>
          )}
        </div>
      )}

      {phase === 'thinking' && (
        <p className="text-small text-ink-soft" aria-live="polite">
          Listening back…
        </p>
      )}

      {phase === 'done' && check && (
        <div>
          <p className="label mb-2">
            {check.missing.length === 0
              ? 'Heard every word.'
              : `${check.missing.length} word${check.missing.length === 1 ? '' : 's'} not heard.`}
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
          <p className="mt-3 text-micro text-ink-soft">Heard: {check.heard || '(nothing)'}</p>
          <p className="mt-2 text-micro text-ink-soft">
            Recognition is not a judge. Grade it yourself.
          </p>
          <button
            type="button"
            className="btn-text mt-1 px-0"
            onClick={() => {
              setCheck(null)
              setPhase('ready')
            }}
          >
            Try again
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-small text-correction">{error}</p>}
    </div>
  )
}
