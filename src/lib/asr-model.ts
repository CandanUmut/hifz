/**
 * Shared by the worker and the page, and importing nothing — the worker must
 * not pull the app in behind it, and the app must not pull the model library
 * in just to name it.
 */

export const ASR_MODEL = 'eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran'

/**
 * Roughly, for the sentence shown before the download starts. Measured from
 * what the browser actually fetches: a ~23 MB encoder and a ~123 MB q4
 * decoder, plus the tokenizer.
 */
export const ASR_MODEL_MB = 150

/** Whisper wants mono 16 kHz. */
export const ASR_SAMPLE_RATE = 16000

/** Where transformers.js keeps what it has downloaded. */
export const ASR_CACHE = 'transformers-cache'
