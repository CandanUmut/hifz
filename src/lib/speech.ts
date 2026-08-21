/**
 * The browser's own speech recognition.
 *
 * The app shipped with one way to hear a recitation: a 150 MB Whisper running
 * in WebAssembly. It works on a laptop and it kills the tab on a phone —
 * Safari's "a problem repeatedly occurred" is the web content process being
 * killed for memory, and no amount of tuning makes a 150 MB model comfortable
 * next to a page. Meanwhile every browser has shipped a speech recogniser for
 * years: nothing to download, results while you are still speaking, and no
 * chance of taking the page down with it.
 *
 * The cost is honesty about where the audio goes — some browsers send it to
 * their own servers — so the interface says so, in a sentence, next to the
 * button, and the on-device model stays available for anyone who would rather
 * nothing left the device at all.
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechResultEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechResultEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: { isFinal: boolean; 0: { transcript: string } }
  }
}

function ctor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function browserSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && ctor() !== null
}

/** A bare language becomes the tag the recognisers actually accept. */
export function speechTag(lang: string | undefined): string {
  const base = (lang ?? 'ar').split('-')[0].toLowerCase()
  if (lang && lang.includes('-')) return lang
  return { ar: 'ar-SA', tr: 'tr-TR', en: 'en-US' }[base] ?? base
}

export type SpeechFailure = 'denied' | 'unavailable' | 'network' | 'unknown'

export interface BrowserSpeech {
  /** Ends the session; the last transcript has already been delivered. */
  stop(): void
}

export function startBrowserSpeech({
  lang,
  onText,
  onFailure,
}: {
  lang: string
  /** The whole transcript so far, final parts plus what is still being said. */
  onText: (text: string) => void
  onFailure: (kind: SpeechFailure) => void
}): BrowserSpeech | null {
  const Ctor = ctor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = speechTag(lang)
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let settled = ''
  let stopped = false

  recognition.onresult = (event) => {
    let pending = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) settled = `${settled} ${text}`.trim()
      else pending = `${pending} ${text}`.trim()
    }
    onText(`${settled} ${pending}`.trim())
  }

  recognition.onerror = (event) => {
    const error = event.error
    // Silence is not a failure — someone thinking before they start is normal.
    if (error === 'no-speech' || error === 'aborted') return
    if (error === 'not-allowed' || error === 'service-not-allowed') onFailure('denied')
    else if (error === 'network') onFailure('network')
    else if (error === 'language-not-supported') onFailure('unavailable')
    else onFailure('unknown')
  }

  /*
   * Safari ends the session after a pause whatever `continuous` says, and a
   * recitation has pauses in it. Restarting keeps one long recitation as one
   * session instead of cutting it off at the first breath.
   */
  recognition.onend = () => {
    if (stopped) return
    try {
      recognition.start()
    } catch {
      /* already restarting */
    }
  }

  try {
    recognition.start()
  } catch {
    onFailure('unknown')
    return null
  }

  return {
    stop() {
      stopped = true
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        /* nothing to stop */
      }
    },
  }
}
