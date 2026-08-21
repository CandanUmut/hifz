import { useCallback, useEffect, useRef, useState } from 'react'
import { ASR_SAMPLE_RATE } from '@/lib/asr-model'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported'

/** Below this peak the microphone heard a room, not a voice. */
const SILENCE_PEAK = 0.012

/**
 * A hard ceiling on how much audio is kept.
 *
 * Whisper reads thirty seconds at a time whatever you give it, so anything
 * older than that is never looked at — and on a phone an unbounded buffer is
 * how a forgotten recording turns into a killed tab. Two minutes of 16 kHz
 * floats is about 15 MB, and the oldest second falls off the front after that.
 */
const MAX_SAMPLES = 120 * 16_000

/**
 * Microphone capture for the recitation check.
 *
 * This used to be a MediaRecorder whose blobs were handed to
 * `decodeAudioData`. On iOS Safari that produced a fragmented MP4, and a
 * fragment on its own is not a decodable file — so on an iPhone every partial
 * read threw, the running transcript stayed empty, and the check appeared to
 * understand nothing no matter how well the ayah was recited.
 *
 * So there is no container any more. The samples are taken straight off the
 * audio graph, resampled to the 16 kHz the model wants, and kept as numbers.
 * Nothing to encode, nothing to decode, identical on every browser — and
 * because the samples are already there, a partial read is free, which is what
 * lets words appear while you are still speaking.
 *
 * The audio is transcribed on this device and then dropped. It is never
 * stored and never uploaded.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>(() =>
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof audioContextClass() === 'function'
      ? 'idle'
      : 'unsupported',
  )
  const [seconds, setSeconds] = useState(0)
  /** 0–1, for the ring around the microphone. */
  const [level, setLevel] = useState(0)

  const chunks = useRef<Float32Array[]>([])
  const total = useRef(0)
  const peak = useRef(0)
  const ctx = useRef<AudioContext | null>(null)
  const node = useRef<ScriptProcessorNode | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | null>(null)

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    node.current?.disconnect()
    node.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    void ctx.current?.close().catch(() => {})
    ctx.current = null
    setLevel(0)
  }, [])

  useEffect(() => cleanup, [cleanup])

  /**
   * The last `limit` samples, at the model's sample rate.
   *
   * Copying only the tail matters more than it looks: the running transcript
   * asks for this every second or so, and copying the whole recording each
   * time meant a growing allocation on every tick for the whole sitting.
   */
  const snapshot = useCallback((limit = MAX_SAMPLES): Float32Array | null => {
    if (!total.current) return null
    const size = Math.min(total.current, limit)
    const out = new Float32Array(size)
    let skip = total.current - size
    let at = 0
    for (const chunk of chunks.current) {
      if (skip >= chunk.length) {
        skip -= chunk.length
        continue
      }
      const part = skip > 0 ? chunk.subarray(skip) : chunk
      skip = 0
      out.set(part, at)
      at += part.length
    }
    return out
  }, [])

  const start = useCallback(async () => {
    if (state === 'unsupported' || state === 'recording') return
    setState('requesting')
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      stream.current = media

      const Ctor = audioContextClass()
      const audio = new Ctor()
      // iOS starts contexts suspended even inside a gesture.
      if (audio.state === 'suspended') await audio.resume()
      ctx.current = audio

      chunks.current = []
      total.current = 0
      peak.current = 0

      const resample = makeResampler(audio.sampleRate, ASR_SAMPLE_RATE)
      const source = audio.createMediaStreamSource(media)
      const processor = audio.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        let loudest = 0
        let sum = 0
        for (let i = 0; i < input.length; i++) {
          const value = Math.abs(input[i])
          if (value > loudest) loudest = value
          sum += input[i] * input[i]
        }
        if (loudest > peak.current) peak.current = loudest
        setLevel(Math.min(1, Math.sqrt(sum / input.length) * 6))

        const out = resample(input)
        if (out.length) {
          chunks.current.push(out)
          total.current += out.length
          // Drop from the front rather than growing without limit.
          while (total.current - chunks.current[0].length >= MAX_SAMPLES) {
            total.current -= chunks.current[0].length
            chunks.current.shift()
          }
        }
      }
      source.connect(processor)
      // A ScriptProcessor only runs while it is connected downstream; the
      // silent gain keeps the microphone out of the speakers.
      const mute = audio.createGain()
      mute.gain.value = 0
      processor.connect(mute)
      mute.connect(audio.destination)
      node.current = processor

      setSeconds(0)
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      setState('recording')
    } catch {
      setState('denied')
      cleanup()
    }
  }, [cleanup, state])

  /**
   * The recording, or null if nothing was captured. The peak survives cleanup
   * so `heardSound()` can still tell silence from a bad transcript afterwards.
   */
  const stop = useCallback(async (): Promise<Float32Array | null> => {
    const samples = snapshot()
    cleanup()
    setState('idle')
    return samples
  }, [cleanup, snapshot])

  return {
    state,
    seconds,
    level,
    start,
    stop,
    snapshot,
    /** Did the microphone actually pick up a voice? */
    heardSound: () => peak.current >= SILENCE_PEAK,
  }
}

function audioContextClass(): typeof AudioContext {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return (w.AudioContext ?? w.webkitAudioContext) as typeof AudioContext
}

/**
 * Linear resampling that carries its phase across chunks.
 *
 * Resampling each buffer independently would put a step at every boundary —
 * eighty clicks a second, which the model hears as noise. Keeping the
 * fractional read position and the previous chunk's last sample makes the
 * stream continuous.
 */
function makeResampler(from: number, to: number): (input: Float32Array) => Float32Array {
  if (from === to) return (input) => Float32Array.from(input)
  const ratio = from / to
  let pos = 0
  let prev = 0
  let primed = false

  return (input: Float32Array) => {
    if (!input.length) return new Float32Array(0)
    const offset = primed ? 1 : 0
    const length = input.length + offset
    const at = (i: number) => (i < offset ? prev : input[i - offset])

    const out = new Float32Array(Math.ceil((length - pos) / ratio) + 1)
    let n = 0
    while (pos < length - 1) {
      const i = Math.floor(pos)
      const f = pos - i
      out[n++] = at(i) * (1 - f) + at(i + 1) * f
      pos += ratio
    }
    pos -= length - 1
    prev = input[input.length - 1]
    primed = true
    return out.subarray(0, n)
  }
}
