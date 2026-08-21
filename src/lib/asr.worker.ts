/// <reference lib="webworker" />
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { ASR_MODEL } from './asr-model'

/**
 * The listening model, kept off the main thread.
 *
 * Whisper runs for a second or two every time the running transcript catches
 * up, and on the main thread that is a second or two in which nothing repaints
 * and no tap registers — the words stopped appearing and the Stop button
 * stopped answering, on the one screen where the reader is mid-sentence and
 * needs both. Here it can take as long as it likes.
 */

async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    return (await gpu.requestAdapter()) != null
  } catch {
    return false
  }
}

let pipe: AutomaticSpeechRecognitionPipeline | null = null
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null

type Incoming =
  | { type: 'load' }
  | { type: 'transcribe'; id: number; samples: Float32Array }

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
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

    const build = (device: 'webgpu' | 'wasm') =>
      pipeline('automatic-speech-recognition', ASR_MODEL, {
        device,
        // q4 keeps the download near 140 MB rather than 230 MB — and keeping
        // the same weights on both devices means switching costs no download.
        dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' },
        progress_callback: (event: unknown) => {
          const p = event as { status?: string; file?: string; loaded?: number; total?: number }
          if (p.status === 'progress' && p.file) {
            self.postMessage({
              type: 'progress',
              file: p.file,
              loaded: p.loaded ?? 0,
              total: p.total ?? 0,
            })
          }
        },
      })

    /*
     * On the CPU a pass costs several seconds whatever the clip length —
     * Whisper pads everything to thirty. On the GPU it is roughly a second,
     * which is the difference between words that appear as you recite and
     * words that appear well after you have stopped. Threads would help too,
     * but they need cross-origin isolation, and a static host cannot set the
     * headers for that.
     */
    let created: AutomaticSpeechRecognitionPipeline
    if (await hasWebGPU()) {
      try {
        created = (await build('webgpu')) as AutomaticSpeechRecognitionPipeline
      } catch {
        created = (await build('wasm')) as AutomaticSpeechRecognitionPipeline
      }
    } else {
      created = (await build('wasm')) as AutomaticSpeechRecognitionPipeline
    }
    pipe = created
    return created
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data
  try {
    if (message.type === 'load') {
      await load()
      self.postMessage({ type: 'ready' })
      return
    }
    if (message.type === 'transcribe') {
      const asr = await load()
      /* The fine-tune has its language fixed in its own generation config, so
         passing `language` or `task` here is rejected as an English-only model. */
      const output = (await asr(message.samples)) as { text?: string } | Array<{ text?: string }>
      const text = Array.isArray(output) ? output[0]?.text : output.text
      self.postMessage({ type: 'text', id: message.id, text: (text ?? '').trim() })
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: message.type === 'transcribe' ? message.id : undefined,
      message: String(error).slice(0, 300),
    })
  }
}
