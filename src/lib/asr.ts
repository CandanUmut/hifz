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

function ensureWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('./asr.worker.ts', import.meta.url), { type: 'module' })
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
      const error = new Error(message.message ?? 'speech recognition failed')
      if (message.id != null) {
        pending.get(message.id)?.reject(error)
        pending.delete(message.id)
      } else {
        // A load failure: fail everyone waiting and let the next call retry.
        for (const p of pending.values()) p.reject(error)
        pending.clear()
        ready = null
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
      const listener = (event: MessageEvent) => {
        const message = event.data as { type: string; id?: number; message?: string }
        if (message.type === 'ready') {
          instance.removeEventListener('message', listener)
          loaded = true
          resolve()
        } else if (message.type === 'error' && message.id == null) {
          instance.removeEventListener('message', listener)
          ready = null
          reject(new Error(message.message ?? 'the model could not be loaded'))
        }
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

export async function transcribe(samples: Float32Array): Promise<string> {
  await loadAsr()
  const instance = ensureWorker()
  const id = nextId++
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    // A copy, transferred: the caller keeps recording into its own buffer.
    const copy = samples.slice()
    instance.postMessage({ type: 'transcribe', id, samples: copy }, [copy.buffer])
  })
}
