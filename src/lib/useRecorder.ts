import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported'

/**
 * Microphone capture for the recitation check. The recording is decoded and
 * transcribed on this device and then dropped; it is never stored and never
 * uploaded.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>(() => {
    const supported =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof MediaRecorder !== 'undefined'
    return supported ? 'idle' : 'unsupported'
  })
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | null>(null)

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    recorder.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  /** Everything captured so far, decodable on its own. */
  const snapshot = useCallback((): Blob | null => {
    if (!chunks.current.length) return null
    return new Blob(chunks.current, { type: recorder.current?.mimeType || 'audio/webm' })
  }, [])

  const start = useCallback(async () => {
    if (state === 'unsupported') return
    setState('requesting')
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      stream.current = media
      chunks.current = []
      const rec = new MediaRecorder(media)
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }
      recorder.current = rec
      // A timeslice makes partial audio available while recording, which is
      // what lets the interface show words as they are said.
      rec.start(1000)
      setSeconds(0)
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      setState('recording')
    } catch {
      setState('denied')
      cleanup()
    }
  }, [cleanup, state])

  /** Resolves with the recording, or null if nothing was captured. */
  const stop = useCallback(async (): Promise<Blob | null> => {
    const rec = recorder.current
    if (!rec || rec.state === 'inactive') {
      cleanup()
      setState('idle')
      return null
    }
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }))
      rec.stop()
    })
    cleanup()
    setState('idle')
    return blob.size > 0 ? blob : null
  }, [cleanup])

  return { state, seconds, start, stop, snapshot }
}
