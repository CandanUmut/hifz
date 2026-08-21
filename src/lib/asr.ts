import { ASR_CACHE, ASR_MODEL, ASR_MODEL_MB, ASR_SAMPLE_RATE } from './asr-model'

export { ASR_MODEL, ASR_MODEL_MB, ASR_SAMPLE_RATE }

/**
 * Recitation checking, entirely in the browser.
 *
 * This is the one part of the app that fetches something from a third party,
 * and only after the reader asks for it: a Qur'an-tuned Whisper (Tarteel's
 * fine-tune, converted to ONNX) is about 140 MB. Nothing is uploaded — the
 * audio never leaves the device — but the model has to come down once, and
 * the interface says so before it starts.
 *
 * The model itself lives in a worker; this file is only the way to it. Loading
 * the library at all is deferred to the first request, so nothing of it
 * reaches a reader who never turns recitation checking on.
 *
 * Point VITE_ASR_HOST at your own copy of the model files to avoid the third
 * party entirely; see docs/RECITATION.md.
 */

export type AsrStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface LoadProgress {
  file: string
  loaded: number
  total: number
}

interface Pending {
  resolve: (text: string) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let ready: Promise<void> | null = null
let loaded = false
let nextId = 1
const pending = new Map<number, Pending>()
let onProgress: ((progress: LoadProgress) => void) | undefined
let failLoad: ((error: Error) => void) | null = null

/** Everything waiting is failed, and the next call starts a fresh worker. */
function collapse(reason: string) {
  const error = new Error(reason)
  for (const p of pending.values()) p.reject(error)
  pending.clear()
  // The load promise has its own waiter, and leaving it unsettled would hang
  // every screen that asked for the model rather than telling them it failed.
  failLoad?.(error)
  failLoad = null
  ready = null
  loaded = false
  worker?.terminate()
  worker = null
}

function ensureWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('./asr.worker.ts', import.meta.url), { type: 'module' })
  /*
   * A worker that runs out of memory dies without answering, and every call
   * waiting on it would hang for ever — which on a phone is indistinguishable
   * from the app being broken. Losing the worker is a reportable failure, and
   * it is far better than losing the page: the model is heavy enough that
   * loading it on the main thread takes the whole tab down with it.
   */
  created.onerror = () => collapse('the model stopped running on this device')
  created.onmessageerror = () => collapse('the model sent something unreadable')
  created.onmessage = (event: MessageEvent) => {
    const message = event.data as {
      type: string
      id?: number
      text?: string
      message?: string
      file?: string
      loaded?: number
      total?: number
    }
    if (message.type === 'progress') {
      onProgress?.({ file: message.file ?? '', loaded: message.loaded ?? 0, total: message.total ?? 0 })
      return
    }
    if (message.type === 'text' && message.id != null) {
      pending.get(message.id)?.resolve(message.text ?? '')
      pending.delete(message.id)
      return
    }
    if (message.type === 'error') {
      if (message.id != null) {
        pending.get(message.id)?.reject(new Error(message.message ?? 'speech recognition failed'))
        pending.delete(message.id)
      } else {
        collapse(message.message ?? 'the model could not be loaded')
      }
    }
  }
  worker = created
  return created
}

/** Fetches the model if it is not here yet, reporting bytes as they arrive. */
export async function loadAsr(progress?: (p: LoadProgress) => void): Promise<void> {
  onProgress = progress
  if (loaded) return
  if (!ready) {
    const instance = ensureWorker()
    ready = new Promise<void>((resolve, reject) => {
      failLoad = reject
      const listener = (event: MessageEvent) => {
        const message = event.data as { type: string; id?: number; message?: string }
        if (message.type !== 'ready') return
        instance.removeEventListener('message', listener)
        failLoad = null
        loaded = true
        resolve()
      }
      instance.addEventListener('message', listener)
      instance.postMessage({ type: 'load' })
    })
  }
  try {
    await ready
  } finally {
    onProgress = undefined
  }
}

export function asrLoaded(): boolean {
  return loaded
}

/**
 * Has the model already been fetched on this device? Read from the Cache
 * Storage transformers.js writes to, so the interface can offer "check my
 * recitation" rather than "download 142 MB" the second time.
 */
export async function asrCached(): Promise<boolean> {
  if (loaded) return true
  if (typeof caches === 'undefined') return false
  try {
    const cache = await caches.open(ASR_CACHE)
    const keys = await cache.keys()
    return keys.some((request) => request.url.includes('decoder_model_merged'))
  } catch {
    return false
  }
}

/** Whisper reads thirty seconds at a time; older audio is never looked at. */
const MAX_WINDOW = 30 * ASR_SAMPLE_RATE

export async function transcribe(samples: Float32Array): Promise<string> {
  await loadAsr()
  const instance = ensureWorker()
  const id = nextId++
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    /* A copy, transferred: the caller keeps recording into its own buffer.
       Only the last thirty seconds — handing over more makes transformers.js
       chunk the audio, which multiplies both the time and the memory for
       nothing, since the line being checked is one ayah. */
    const window = samples.length > MAX_WINDOW ? samples.subarray(samples.length - MAX_WINDOW) : samples
    const copy = window.slice()
    instance.postMessage({ type: 'transcribe', id, samples: copy }, [copy.buffer])
  })
}
