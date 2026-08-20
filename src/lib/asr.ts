import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

/**
 * Recitation checking, entirely in the browser.
 *
 * This is the one part of the app that fetches something from a third party,
 * and only after the reader asks for it: a Qur'an-tuned Whisper (Tarteel's
 * fine-tune, converted to ONNX) is about 140 MB. Nothing is uploaded — the
 * audio never leaves the device — but the model has to come down once, and
 * the interface says so before it starts.
 *
 * Point VITE_ASR_HOST at your own copy of the model files to avoid the third
 * party entirely; see docs/RECITATION.md.
 */

export const ASR_MODEL = 'eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran'

/**
 * Roughly, for the sentence shown before the download starts. Measured from
 * what the browser actually fetches: a ~23 MB encoder and a ~123 MB q4
 * decoder, plus the tokenizer.
 */
export const ASR_MODEL_MB = 150

export type AsrStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface LoadProgress {
  file: string
  loaded: number
  total: number
}

let pipe: AutomaticSpeechRecognitionPipeline | null = null
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null

/**
 * Loads the model, importing the library only at this point so none of it
 * lands in the bundle for readers who never turn recitation checking on.
 */
export async function loadAsr(
  onProgress?: (progress: LoadProgress) => void,
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (pipe) return pipe
  if (loading) return loading

  loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers')

    const host = import.meta.env.VITE_ASR_HOST
    if (host) {
      // A self-hosted copy: no third-party request at all.
      env.remoteHost = host
      env.remotePathTemplate = '{model}/'
    }
    const wasmPaths = import.meta.env.VITE_ASR_WASM
    if (wasmPaths && env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = wasmPaths
    env.allowLocalModels = false

    const created = (await pipeline('automatic-speech-recognition', ASR_MODEL, {
      // q4 keeps the download near 140 MB rather than 230 MB.
      dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' },
      progress_callback: (event: unknown) => {
        const p = event as { status?: string; file?: string; loaded?: number; total?: number }
        if (p.status === 'progress' && p.file) {
          onProgress?.({ file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 })
        }
      },
    })) as AutomaticSpeechRecognitionPipeline
    pipe = created
    return created
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

export function asrLoaded(): boolean {
  return pipe !== null
}

/**
 * Has the model already been fetched on this device? Read from the Cache
 * Storage transformers.js writes to, so the interface can offer "check my
 * recitation" rather than "download 142 MB" the second time.
 */
export async function asrCached(): Promise<boolean> {
  if (pipe) return true
  if (typeof caches === 'undefined') return false
  try {
    const cache = await caches.open('transformers-cache')
    const keys = await cache.keys()
    return keys.some((request) => request.url.includes('decoder_model_merged'))
  } catch {
    return false
  }
}

/**
 * The fine-tune has its language fixed in its own generation config, so
 * passing `language` or `task` here is rejected as an English-only model.
 */
export async function transcribe(samples: Float32Array): Promise<string> {
  const asr = await loadAsr()
  const output = (await asr(samples)) as { text?: string } | Array<{ text?: string }>
  const text = Array.isArray(output) ? output[0]?.text : output.text
  return (text ?? '').trim()
}

/** Whisper wants mono 16 kHz. */
export const ASR_SAMPLE_RATE = 16000

export async function decodeToSamples(blob: Blob): Promise<Float32Array> {
  const buffer = await blob.arrayBuffer()
  const scratch = new OfflineAudioContext(1, 1, 44100)
  const decoded = await scratch.decodeAudioData(buffer)
  const target = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * ASR_SAMPLE_RATE)),
    ASR_SAMPLE_RATE,
  )
  const source = target.createBufferSource()
  source.buffer = decoded
  source.connect(target.destination)
  source.start()
  const rendered = await target.startRendering()
  return rendered.getChannelData(0)
}
