import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { asrCached, loadAsr, transcribe } from '@/lib/asr'
import { ASR_MODEL_MB } from '@/lib/asr-model'
import {
  checkRecitation,
  suggestedRating,
  verdict,
  type RecitationCheck,
  type Verdict,
} from '@/engine/recitation'
import { useT } from '@/i18n'
import { useRecorder } from '@/lib/useRecorder'
import type { GradeRating } from '@/engine/scheduler'

export type RecitePhase = 'checking_cache' | 'need_model' | 'loading' | 'ready' | 'thinking' | 'result'

/** How often the running transcript catches up while you are still speaking. */
const INTERIM_MS = 1200
/** Less than this and there is not enough voice to read yet (~0.7 s). */
const MIN_SAMPLES = 11_000

/**
 * Reciting out loud, and watching the line fill in.
 *
 * The old panel printed the whole ayah in grey and lit up the words it
 * recognised — which meant the answer was on screen the entire time you were
 * meant to be reciting it from memory. Nothing was being tested.
 *
 * Now every word starts as a blank the exact width of the word it hides, and a
 * word only appears once it has been heard. The line is a record of what you
 * said, not a crib of what you were supposed to say.
 *
 * It comes in two pieces because it belongs in two places: the line and the
 * microphone go where the reader is looking, in the middle of the screen, and
 * only the buttons go in the footer. Squeezing all of it into the footer put
 * the thing being tested below the thing testing it, under an empty card.
 */
export function useRecitation({
  expectedWords,
  onChecked,
}: {
  expectedWords: string[]
  onChecked: (check: RecitationCheck, suggested: GradeRating) => void
}) {
  const recorder = useRecorder()
  const t = useT()
  const [phase, setPhase] = useState<RecitePhase>('checking_cache')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<RecitationCheck | null>(null)
  const [silent, setSilent] = useState(false)
  const busy = useRef(false)
  const pollRef = useRef<() => Promise<void>>(async () => {})

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

  const read = useCallback(
    async (samples: Float32Array) => checkRecitation(await transcribe(samples), expectedWords),
    [expectedWords],
  )

  /* Whisper is not a streaming model, so the running transcript is the whole
     recording so far, re-read as often as the device can manage. It trails
     your voice rather than keeping up with it word by word — but it is honest
     about what it has actually heard, which is what makes the blanks mean
     something. */
  const pollInterim = useCallback(async () => {
    if (busy.current) return
    const samples = recorder.snapshot()
    if (!samples || samples.length < MIN_SAMPLES) return
    busy.current = true
    try {
      setLive(await read(samples))
    } catch {
      /* the next tick will try again */
    } finally {
      busy.current = false
    }
  }, [read, recorder])

  /*
   * The interval is armed once per recording, and reaches for the newest poll
   * through a ref.
   *
   * Depending on `pollInterim` directly looked right and did nothing at all:
   * the level meter re-renders about twelve times a second, every render made
   * a new poll, and the effect tore the interval down and started it again
   * before it had ever run. Which is why the line stayed blank while you were
   * speaking and only filled in at the end.
   */
  useEffect(() => {
    pollRef.current = pollInterim
  }, [pollInterim])

  useEffect(() => {
    if (recorder.state !== 'recording') return
    const id = window.setInterval(() => void pollRef.current(), INTERIM_MS)
    return () => window.clearInterval(id)
  }, [recorder.state])

  const begin = useCallback(async () => {
    setLive(null)
    setSilent(false)
    setError(null)
    await recorder.start()
  }, [recorder])

  const finish = useCallback(async () => {
    const samples = await recorder.stop()
    if (!samples || !recorder.heardSound()) {
      setSilent(true)
      setLive(null)
      setPhase('ready')
      return
    }
    setPhase('thinking')
    try {
      const result = await read(samples)
      setLive(result)
      setPhase('result')
    } catch {
      setError(t('recite.failed'))
      setPhase('ready')
    }
  }, [read, recorder, t])

  const retry = useCallback(() => {
    setLive(null)
    setSilent(false)
    setError(null)
    setPhase('ready')
  }, [])

  const accept = useCallback(() => {
    if (live) onChecked(live, suggestedRating(live))
  }, [live, onChecked])

  const heard = new Set(
    live ? live.expectedWords.map((_, i) => i).filter((i) => !live.missing.includes(i)) : [],
  )

  return {
    phase,
    progress,
    error,
    live,
    silent,
    heard,
    call: live ? verdict(live) : null,
    recording: recorder.state === 'recording',
    starting: recorder.state === 'requesting',
    denied: recorder.state === 'denied',
    unsupported: recorder.state === 'unsupported',
    level: recorder.level,
    seconds: recorder.seconds,
    expectedWords,
    fetchModel,
    begin,
    finish,
    retry,
    accept,
  }
}

export type Recitation = ReturnType<typeof useRecitation>

/**
 * The middle of the screen while reciting: the line as blanks, what was heard
 * underneath it, and a microphone that visibly reacts to your voice.
 */
export function ReciteStage({
  state,
  dir = 'rtl',
  lang,
  passageClassName,
}: {
  state: Recitation
  dir?: 'rtl' | 'ltr'
  lang?: string
  passageClassName: string
}) {
  const t = useT()

  if (state.unsupported) return <p className="text-small text-ink-soft">{t('recite.noMic')}</p>

  if (state.phase === 'checking_cache')
    return <p className="text-small text-ink-soft">{t('common.loading')}</p>

  if (state.phase === 'need_model' || state.phase === 'loading')
    return (
      <div>
        <p className="text-small text-ink-soft">{t('recite.needModel', { mb: ASR_MODEL_MB })}</p>
        {state.phase === 'loading' && (
          <>
            <p className="mt-4 text-small">{t('recite.downloading', { percent: state.progress })}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
              <div
                className="h-full rounded-full bg-verified transition-[width]"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </>
        )}
      </div>
    )

  return (
    <div>
      <BlankLine
        words={state.expectedWords}
        heard={state.heard}
        reveal={state.phase === 'result' && state.call === 'accepted'}
        dir={dir}
        lang={lang}
        className={passageClassName}
      />

      {/* What it heard, in the reader's own words. Only ever tagged as the
          passage's language when there is actually a transcript in it. */}
      <p
        {...(state.live?.heard ? { dir, lang } : {})}
        className="mt-6 min-h-[1.5em] border-t border-rule pt-4 text-small text-ink-soft"
      >
        {state.live?.heard || (state.recording ? t('recite.speakNow') : t('recite.tapHint'))}
      </p>

      {state.recording && <MicMeter level={state.level} seconds={state.seconds} />}

      {state.phase === 'thinking' && (
        <p className="mt-4 text-small text-ink-soft" aria-live="polite">
          {t('recite.thinking')}
        </p>
      )}

      {state.phase === 'result' && state.call && state.live && (
        <Verdict call={state.call} check={state.live} />
      )}
    </div>
  )
}

/** The buttons, and nothing else, so the footer stays a footer. */
export function ReciteControls({
  state,
  onCancel,
}: {
  state: Recitation
  onCancel?: () => void
}) {
  const t = useT()

  const back = onCancel && (
    <button type="button" className="btn-text px-0 text-micro" onClick={onCancel}>
      {t('recite.ratherSelfCheck')}
    </button>
  )

  if (state.unsupported) return <div className="text-center">{back}</div>

  return (
    <div>
      {state.phase === 'need_model' && (
        <>
          <button type="button" className="btn-primary w-full py-3" onClick={state.fetchModel}>
            {t('recite.download')}
          </button>
          <div className="mt-1 text-center">{back}</div>
        </>
      )}

      {state.phase === 'ready' && !state.recording && (
        <>
          {state.silent && (
            <p className="mb-2 text-center text-small text-correction">{t('recite.silence')}</p>
          )}
          <button
            type="button"
            className="btn-primary w-full py-3"
            onClick={state.begin}
            disabled={state.starting}
          >
            🎤 {t('recite.tapToStart')}
          </button>
          <div className="mt-1 text-center">{back}</div>
        </>
      )}

      {state.recording && (
        <button type="button" className="btn-primary w-full py-3" onClick={state.finish}>
          {t('recite.stop')}
        </button>
      )}

      {state.phase === 'result' && (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 py-3" onClick={state.retry}>
            {t('recite.tryAgain')}
          </button>
          <button type="button" className="btn-primary flex-1 py-3" onClick={state.accept}>
            {t('recite.continue')}
          </button>
        </div>
      )}

      {state.denied && <p className="mt-2 text-small text-correction">{t('recite.denied')}</p>}
      {state.error && <p className="mt-2 text-small text-correction">{state.error}</p>}
    </div>
  )
}

/**
 * The line as blanks.
 *
 * Each blank is the word itself, painted in nothing and covered by a bar the
 * exact size of the glyphs underneath. It gives away no more than its length,
 * and because the text is really there the line cannot reflow when a word
 * arrives — it just stops being hidden.
 */
function BlankLine({
  words,
  heard,
  reveal,
  dir,
  lang,
  className,
}: {
  words: string[]
  heard: Set<number>
  reveal: boolean
  dir: 'rtl' | 'ltr'
  lang?: string
  className: string
}) {
  return (
    <p dir={dir} lang={lang} className={`${className} leading-[2.1]`} aria-live="polite">
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className={`recite-word${heard.has(i) ? ' is-heard' : reveal ? ' is-shown' : ''}`}>
            {word}
          </span>
        </Fragment>
      ))}
    </p>
  )
}

/** A ring that grows with your voice, so it is obvious the mic is alive. */
function MicMeter({ level, seconds }: { level: number; seconds: number }) {
  const t = useT()
  return (
    <div className="mt-6 flex items-center gap-3">
      <span
        className="recite-mic"
        style={{ ['--recite-level' as string]: level.toFixed(3) }}
        aria-hidden
      >
        🎤
      </span>
      <span className="text-micro tabular-nums text-ink-soft">
        {t('recite.listening', { seconds })}
      </span>
    </div>
  )
}

function Verdict({ call, check }: { call: Verdict; check: RecitationCheck }) {
  const t = useT()
  const tone =
    call === 'accepted'
      ? 'border-verified/40 bg-verified/10 text-verified'
      : call === 'partial'
        ? 'border-rule text-ink'
        : 'border-correction/40 bg-correction/10 text-correction'

  return (
    <div className={`mt-6 rounded-lg border px-4 py-3 ${tone}`} role="status">
      <p className="text-base font-medium">
        {call === 'accepted'
          ? t('recite.great')
          : call === 'partial'
            ? t('recite.almost')
            : t('recite.notCaught')}
      </p>
      <p className="mt-1 text-micro opacity-80">
        {t('recite.matched', {
          done: check.expectedWords.length - check.missing.length,
          total: check.expectedWords.length,
        })}
      </p>
      <p className="mt-2 text-micro text-ink-soft">{t('recite.notAJudge')}</p>
    </div>
  )
}
