import { useCallback, useEffect, useRef, useState } from 'react'
import type { SegmentRecord, TextRecord } from '@/engine/types'

/**
 * One audio element for the whole text; an ayah is played by seeking into the
 * surah file and stopping at the right moment.
 *
 * Two things had to be got right, and were not:
 *
 *  - The stored verse boundary is not where the reciter actually starts. In
 *    112:3 the first word begins 45 ms before it, so seeking to the boundary
 *    clipped the opening consonant. The word timings give the true edges.
 *  - Stopping used `timeupdate`, which fires about four times a second, so
 *    playback ran up to 250 ms past the end and bled into the next ayah.
 *    A frame loop stops it within about 16 ms.
 */

/** A breath of silence either side, so nothing is clipped. */
const LEAD_IN_MS = 90
const TAIL_MS = 140
/** Never run closer than this to where the next ayah begins. */
const GUARD_MS = 30

function edgesOf(segment: SegmentRecord): { first: number; last: number } | null {
  if (!segment.audio) return null
  let first = segment.audio.from
  let last = segment.audio.to
  for (const [, start, end] of segment.audio.wordTimings ?? []) {
    if (start < first) first = start
    if (end > last) last = end
  }
  return { first, last }
}

/**
 * The stored verse boundary is not where the reciter starts or stops, so the
 * word timings decide. The tail is then clamped against whatever comes next:
 * the gap between 112:2 and 112:3 is only 65 ms, and a fixed pad ran straight
 * into the following ayah.
 */
function boundsOf(
  segment: SegmentRecord,
  neighbours?: SegmentRecord[],
): { from: number; to: number } | null {
  const edges = edgesOf(segment)
  if (!edges) return null

  const next = neighbours?.find((s) => s.index === segment.index + 1)
  const nextStart = next ? edgesOf(next)?.first : undefined
  const ceiling = nextStart != null ? nextStart - GUARD_MS : Infinity

  return {
    from: Math.max(0, edges.first - LEAD_IN_MS),
    to: Math.max(edges.last, Math.min(edges.last + TAIL_MS, ceiling)),
  }
}

export function useAudio(text: TextRecord | undefined, segments?: SegmentRecord[]) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const stopAt = useRef<number | null>(null)
  const current = useRef<SegmentRecord | null>(null)
  const frame = useRef<number | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [activeWord, setActiveWord] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!text?.audioUrl) return
    const audio = new Audio()
    // metadata, not none: the duration has to be known before a seek can land.
    audio.preload = 'metadata'
    audio.src = text.audioUrl
    audio.crossOrigin = 'anonymous'
    ref.current = audio

    const onError = () => setError('audio')
    audio.addEventListener('error', onError)
    return () => {
      audio.pause()
      audio.removeEventListener('error', onError)
      ref.current = null
    }
  }, [text?.audioUrl])

  const clearFrame = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const stop = useCallback(() => {
    clearFrame()
    ref.current?.pause()
    stopAt.current = null
    current.current = null
    setPlayingIndex(null)
    setActiveWord(null)
  }, [clearFrame])

  useEffect(() => stop, [stop])

  /** Watches the clock every frame: precise end, and a steady word highlight. */
  const watch = useCallback(() => {
    const audio = ref.current
    if (!audio) return
    const tick = () => {
      const ms = audio.currentTime * 1000
      if (stopAt.current != null && ms >= stopAt.current) {
        stop()
        return
      }
      const timings = current.current?.audio?.wordTimings
      if (timings) {
        const span = timings.find(([, from, to]) => ms >= from && ms < to)
        setActiveWord(span ? span[0] : null)
      }
      frame.current = requestAnimationFrame(tick)
    }
    clearFrame()
    frame.current = requestAnimationFrame(tick)
  }, [clearFrame, stop])

  const playSegment = useCallback(
    async (segment: SegmentRecord) => {
      const audio = ref.current
      const bounds = boundsOf(segment, segments)
      if (!audio || !bounds) return
      if (playingIndex === segment.index) {
        stop()
        return
      }
      setError(null)
      current.current = segment
      stopAt.current = bounds.to

      const target = bounds.from / 1000
      try {
        // A seek before the metadata arrives is ignored on some browsers, which
        // played the surah from the beginning instead of the chosen ayah.
        if (audio.readyState < 1) {
          await new Promise<void>((resolve, reject) => {
            const ok = () => {
              cleanup()
              resolve()
            }
            const bad = () => {
              cleanup()
              reject(new Error('metadata'))
            }
            const cleanup = () => {
              audio.removeEventListener('loadedmetadata', ok)
              audio.removeEventListener('error', bad)
            }
            audio.addEventListener('loadedmetadata', ok, { once: true })
            audio.addEventListener('error', bad, { once: true })
            audio.load()
          })
        }
        audio.currentTime = target
        if (Math.abs(audio.currentTime - target) > 0.05) {
          await new Promise<void>((resolve) =>
            audio.addEventListener('seeked', () => resolve(), { once: true }),
          )
        }
        setPlayingIndex(segment.index)
        await audio.play()
        watch()
      } catch {
        setError('audio')
        stop()
      }
    },
    [playingIndex, segments, stop, watch],
  )

  return { playSegment, stop, playingIndex, activeWord, error, available: !!text?.audioUrl }
}
