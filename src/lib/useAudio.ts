import { useCallback, useEffect, useRef, useState } from 'react'
import { segmentWords } from '@/lib/text'
import { speak, speechAvailable, type SpeakHandle } from '@/lib/tts'
import type { SegmentRecord, TextRecord } from '@/engine/types'

/**
 * Playback, one ayah per file — and a spoken fallback when there is no file.
 *
 * This used to seek into the whole-surah mp3. Seeking an mp3 is approximate —
 * the browser lands on a frame boundary and its idea of the position drifts
 * through a long file — so verses began in the wrong place, ran into their
 * neighbour, and the word highlight never matched what you were hearing. The
 * packs now carry one small file per ayah, so there is nothing to seek: the
 * file starts where the ayah starts and ends where it ends, and the word
 * timings are measured from the beginning of that same file.
 *
 * A text you added yourself has no recording, and Play used to do nothing at
 * all for it. Those fall through to the browser's own voice.
 */
export function useAudio(text: TextRecord | undefined, segments?: SegmentRecord[]) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const queue = useRef<SegmentRecord[]>([])
  const current = useRef<SegmentRecord | null>(null)
  const speech = useRef<SpeakHandle | null>(null)
  const frame = useRef<number | null>(null)
  const advanceRef = useRef<() => void>(() => {})
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [activeWord, setActiveWord] = useState<number | null>(null)
  const [continuous, setContinuous] = useState(false)
  const [error, setError] = useState(false)

  const clearFrame = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const stop = useCallback(() => {
    clearFrame()
    speech.current?.cancel()
    speech.current = null
    const audio = ref.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    queue.current = []
    current.current = null
    setPlayingIndex(null)
    setActiveWord(null)
    setContinuous(false)
  }, [clearFrame])

  useEffect(() => stop, [stop])

  /** Follows the clock every frame so the highlighted word matches the voice. */
  const watch = useCallback(() => {
    const audio = ref.current
    if (!audio) return
    const tick = () => {
      const ms = audio.currentTime * 1000
      const timings = current.current?.audio?.wordTimings
      if (timings) {
        const span = timings.find(([, from, to]) => ms >= from && ms < to)
        setActiveWord(span ? span[0] : null)
      }
      frame.current = requestAnimationFrame(tick)
    }
    clearFrame()
    frame.current = requestAnimationFrame(tick)
  }, [clearFrame])

  /* One element, created once, with the listener that keeps a queue moving
     attached for its whole life — reattaching it per play was how a second
     ayah sometimes never started. */
  const element = useCallback(() => {
    if (!ref.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.addEventListener('ended', () => advanceRef.current())
      ref.current = audio
    }
    return ref.current
  }, [])

  const playOne = useCallback(
    async (segment: SegmentRecord) => {
      speech.current?.cancel()
      speech.current = null
      current.current = segment
      setPlayingIndex(segment.index)
      setActiveWord(null)

      const url = segment.audio?.url
      if (url) {
        const audio = element()
        audio.src = url
        try {
          await audio.play()
          watch()
          return true
        } catch {
          setError(true)
          return false
        }
      }

      // No recording for this line: read it aloud instead.
      const handle = speak({
        text: segment.content,
        lang: text?.lang ?? 'ar',
        words: segmentWords(segment),
        onWord: setActiveWord,
        onEnd: () => advanceRef.current(),
      })
      if (!handle) {
        setError(true)
        setPlayingIndex(null)
        return false
      }
      speech.current = handle
      return true
    },
    [element, text?.lang, watch],
  )

  // Kept in a ref so the queue can advance from a callback without either the
  // element listener or the utterance holding a stale copy of it.
  useEffect(() => {
    advanceRef.current = () => {
      const next = queue.current.shift()
      if (next) void playOne(next)
      else stop()
    }
  }, [playOne, stop])

  const playSegment = useCallback(
    async (segment: SegmentRecord, repeats = 1) => {
      if (playingIndex === segment.index && !continuous) {
        stop()
        return
      }
      setError(false)
      setContinuous(false)
      queue.current = Array.from({ length: Math.max(0, repeats - 1) }, () => segment)
      await playOne(segment)
    },
    [continuous, playOne, playingIndex, stop],
  )

  /** The whole surah, or everything from one ayah onwards. */
  const playFrom = useCallback(
    async (startIndex = 0) => {
      const list = (segments ?? []).filter((s) => s.index >= startIndex)
      if (!list.length) return
      setError(false)
      setContinuous(true)
      queue.current = list.slice(1)
      await playOne(list[0])
    },
    [playOne, segments],
  )

  return {
    playSegment,
    playFrom,
    stop,
    playingIndex,
    activeWord,
    continuous,
    error,
    /** Whether this line has a recording, as opposed to being read aloud. */
    recorded: (segments ?? []).some((s) => !!s.audio?.url) || !!text?.audioUrl,
    available:
      (segments ?? []).some((s) => !!s.audio?.url) || !!text?.audioUrl || speechAvailable(),
  }
}
