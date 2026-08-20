import { useCallback, useEffect, useRef, useState } from 'react'
import type { SegmentRecord, TextRecord } from '@/engine/types'

/**
 * One audio element for the whole text. A segment is played by seeking into
 * the surah file and stopping at its end timestamp; word highlighting reads
 * the timings snapshotted into the pack, each of which names the word it
 * covers so a repeated phrase highlights the right word both times.
 *
 * This is the only thing in the app that touches the network at runtime, and
 * only once the user presses play.
 */
export function useAudio(text: TextRecord | undefined) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const stopAt = useRef<number | null>(null)
  const current = useRef<SegmentRecord | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [activeWord, setActiveWord] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!text?.audioUrl) return
    const audio = new Audio()
    audio.preload = 'none'
    audio.src = text.audioUrl
    audio.crossOrigin = 'anonymous'
    ref.current = audio

    const onTime = () => {
      const ms = audio.currentTime * 1000
      if (stopAt.current != null && ms >= stopAt.current) {
        audio.pause()
        setPlayingIndex(null)
        setActiveWord(null)
        stopAt.current = null
        return
      }
      const timings = current.current?.audio?.wordTimings
      if (!timings) return
      const span = timings.find(([, from, to]) => ms >= from && ms < to)
      setActiveWord(span ? span[0] : null)
    }
    const onError = () => setError('Audio could not be loaded.')

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('error', onError)
    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('error', onError)
      ref.current = null
    }
  }, [text?.audioUrl])

  const stop = useCallback(() => {
    ref.current?.pause()
    stopAt.current = null
    current.current = null
    setPlayingIndex(null)
    setActiveWord(null)
  }, [])

  const playSegment = useCallback(
    async (segment: SegmentRecord) => {
      const audio = ref.current
      if (!audio || !segment.audio) return
      if (playingIndex === segment.index) {
        stop()
        return
      }
      setError(null)
      current.current = segment
      stopAt.current = segment.audio.to
      audio.currentTime = segment.audio.from / 1000
      setPlayingIndex(segment.index)
      try {
        await audio.play()
      } catch {
        setError('Audio could not be played.')
        stop()
      }
    },
    [playingIndex, stop],
  )

  return { playSegment, stop, playingIndex, activeWord, error, available: !!text?.audioUrl }
}
