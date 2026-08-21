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
import {
  browserSpeechAvailable,
  startBrowserSpeech,
  type BrowserSpeech,
  type SpeechFailure,
} from '@/lib/speech'
import type { GradeRating } from '@/engine/scheduler'

export type RecitePhase = 'idle' | 'need_model' | 'loading' | 'listening' | 'thinking' | 'result'

/**
 * Which recogniser is doing the listening.
 *
 * `browser` is the one the browser already has: nothing to download, results
 * while you are still speaking. `ondevice` is the Qur'an-tuned Whisper, which
 * costs 150 MB and a few seconds a pass but never sends anything anywhere.
 */
export type Engine = 'browser' | 'ondevice'

/** How often the on-device transcript catches up while you are speaking. */
const INTERIM_MS = 1200
/** Less than this and there is not enough voice to read yet (~0.7 s). */
const MIN_SAMPLES = 11_000

/**
 * Reciting out loud, and watching the line fill in.
 *
 * Every word starts as a blank the exact width of the word it hides, and a
 * word appears only once it has been heard — so the answer is never on screen
 * while you are trying to remember it, and what you end up looking at is a
 * record of what you said rather than a crib of what you were supposed to say.
 *
 * It comes in two pieces because it belongs in two places: the line and the
 * microphone go where the reader is looking, in the middle of the screen, and
 * only the buttons go in the footer.
 */
export function useRecitation({
  expectedWords,
  lang,
  onChecked,
}: {
  expectedWords: string[]
  lang?: string
  onChecked: (check: RecitationCheck, suggested: GradeRating) => void
}) {
  const recorder = useRecorder()
  const t = useT()

  const [engine, setEngine] = useState<Engine>(() =>
    browserSpeechAvailable() ? 'browser' : 'ondevice',
  )
  const [phase, setPhase] = useState<RecitePhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<RecitationCheck | null>(null)
  const [silent, setSilent] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const busy = useRef(false)
  const pollRef = useRef<() => Promise<void>>(async () => {})
  const speech = useRef<BrowserSpeech | null>(null)
  const heardText = useRef('')

  useEffect(() => {
    let cancelled = false
    asrCached().then((cached) => {
      if (cancelled) return
      setModelReady(cached)
      // Someone who already paid the download gets the recogniser they paid for.
      if (cached) setEngine('ondevice')
      else if (!browserSpeechAvailable()) setPhase('need_model')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (engine === 'ondevice' && !modelReady) setPhase('need_model')
    else if (phase === 'need_model') setPhase('idle')
    // Only the engine switch should move the phase; `phase` is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, modelReady])

  useEffect(() => () => speech.current?.stop(), [])

  const fetchModel = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      await loadAsr((p) => {
        if (p.total > 0) setProgress(Math.round((p.loaded / p.total) * 100))
      })
      setModelReady(true)
      setEngine('ondevice')
      setPhase('idle')
    } catch {
      setError(t('recite.downloadFailed'))
      setPhase('need_model')
    }
  }, [t])

  const grade = useCallback(
    (text: string) => {
      const check = checkRecitation(text, expectedWords)
      setLive(check)
      return check
    },
    [expectedWords],
  )

  /* Whisper is not a streaming model, so the running transcript is the last
     stretch of the recording, re-read as often as the device can manage. */
  const pollInterim = useCallback(async () => {
    if (busy.current) return
    const samples = recorder.snapshot()
    if (!samples || samples.length < MIN_SAMPLES) return
    busy.current = true
    try {
      grade(await transcribe(samples))
    } catch {
      /* the next tick will try again */
    } finally {
      busy.current = false
    }
  }, [grade, recorder])

  /*
   * The interval is armed once per recording and reaches for the newest poll
   * through a ref. Depending on `pollInterim` directly looked right and did
   * nothing: the level meter re-renders about twelve times a second, every
   * render made a new poll, and the effect tore the interval down and started
   * it again before it had ever run.
   */
  useEffect(() => {
    pollRef.current = pollInterim
  }, [pollInterim])

  useEffect(() => {
    if (engine !== 'ondevice' || recorder.state !== 'recording') return
    const id = window.setInterval(() => void pollRef.current(), INTERIM_MS)
    return () => window.clearInterval(id)
  }, [engine, recorder.state])

  const onSpeechFailure = useCallback(
    (kind: SpeechFailure) => {
      speech.current?.stop()
      speech.current = null
      setPhase('idle')
      setError(
        kind === 'denied'
          ? t('recite.denied')
          : kind === 'network'
            ? t('recite.speechNetwork')
            : t('recite.speechUnavailable'),
      )
    },
    [t],
  )

  const begin = useCallback(async () => {
    setLive(null)
    setSilent(false)
    setError(null)
    heardText.current = ''

    if (engine === 'browser') {
      const session = startBrowserSpeech({
        lang: lang ?? 'ar',
        onText: (text) => {
          heardText.current = text
          grade(text)
        },
        onFailure: onSpeechFailure,
      })
      if (!session) {
        onSpeechFailure('unavailable')
        return
      }
      speech.current = session
      setPhase('listening')
      return
    }

    await recorder.start()
    setPhase('listening')
  }, [engine, grade, lang, onSpeechFailure, recorder])

  const finish = useCallback(async () => {
    if (engine === 'browser') {
      speech.current?.stop()
      speech.current = null
      if (!heardText.current.trim()) {
        setSilent(true)
        setLive(null)
        setPhase('idle')
        return
      }
      grade(heardText.current)
      setPhase('result')
      return
    }

    const samples = await recorder.stop()
    if (!samples || !recorder.heardSound()) {
      setSilent(true)
      setLive(null)
      setPhase('idle')
      return
    }
    setPhase('thinking')
    try {
      grade(await transcribe(samples))
      setPhase('result')
    } catch {
      setError(t('recite.modelStopped'))
      setPhase('idle')
    }
  }, [engine, grade, recorder, t])

  const retry = useCallback(() => {
    setLive(null)
    setSilent(false)
    setError(null)
    heardText.current = ''
    setPhase('idle')
  }, [])

  const accept = useCallback(() => {
    if (live) onChecked(live, suggestedRating(live))
  }, [live, onChecked])

  const heard = new Set(
    live ? live.expectedWords.map((_, i) => i).filter((i) => !live.missing.includes(i)) : [],
  )

  const listening = phase === 'listening'

  return {
    engine,
    setEngine,
    canSwitchEngine: browserSpeechAvailable(),
    modelReady,
    phase,
    progress,
    error,
    live,
    silent,
    heard,
    call: live ? verdict(live) : null,
    listening,
    starting: recorder.state === 'requesting',
    unsupported: engine === 'ondevice' && recorder.state === 'unsupported',
    /** Only the on-device path records, so only it has a level to show. */
    level: engine === 'ondevice' ? recorder.level : null,
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
 * underneath it, and something that visibly reacts while it is listening.
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
        {state.live?.heard || (state.listening ? t('recite.speakNow') : t('recite.tapHint'))}
      </p>

      {state.listening && <Listening level={state.level} seconds={state.seconds} />}

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
          {state.canSwitchEngine && (
            <button
              type="button"
              className="btn-text mt-1 w-full text-micro"
              onClick={() => state.setEngine('browser')}
            >
              {t('recite.useBrowserInstead')}
            </button>
          )}
          <div className="text-center">{back}</div>
        </>
      )}

      {state.phase === 'idle' && (
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
          <EngineNote state={state} />
          <div className="text-center">{back}</div>
        </>
      )}

      {state.listening && (
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

      {state.error && <p className="mt-2 text-small text-correction">{state.error}</p>}
    </div>
  )
}

/**
 * Where the audio goes, said plainly, next to the button that sends it.
 *
 * The browser's recogniser is the one that works on a phone, and on some
 * browsers it forwards the audio to the vendor. That is a real difference from
 * everything else this app does, so it is stated rather than buried — with the
 * private alternative one tap away.
 */
function EngineNote({ state }: { state: Recitation }) {
  const t = useT()
  if (state.engine === 'ondevice')
    return (
      <p className="mt-2 text-center text-micro text-ink-soft">
        {t('recite.onDeviceNote')}
        {state.canSwitchEngine && (
          <>
            {' · '}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => state.setEngine('browser')}
            >
              {t('recite.useBrowser')}
            </button>
          </>
        )}
      </p>
    )

  return (
    <p className="mt-2 text-center text-micro text-ink-soft">
      {t('recite.browserNote')}{' '}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => state.setEngine('ondevice')}
      >
        {state.modelReady
          ? t('recite.useOnDevice')
          : t('recite.useOnDeviceDownload', { mb: ASR_MODEL_MB })}
      </button>
    </p>
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

/**
 * Proof that it is listening. The on-device path has the samples, so the ring
 * follows your voice; the browser path never sees them, so it breathes on its
 * own — either way a microphone doing nothing looks like nothing.
 */
function Listening({ level, seconds }: { level: number | null; seconds: number }) {
  const t = useT()
  return (
    <div className="mt-6 flex items-center gap-3">
      <span
        className={`recite-mic${level == null ? ' is-idle' : ''}`}
        style={level == null ? undefined : { ['--recite-level' as string]: level.toFixed(3) }}
        aria-hidden
      >
        🎤
      </span>
      <span className="text-micro tabular-nums text-ink-soft">
        {level == null ? t('recite.listeningNow') : t('recite.listening', { seconds })}
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
