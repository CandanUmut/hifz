# Reciting out loud

The recitation check listens while you recite and shows you what it heard
against what it expected. It is off until you switch it on in Settings, and it
is marked experimental because it is.

## What it does and does not do

**Your voice never leaves the device.** Recognition runs in the browser. The
recording is decoded, transcribed and dropped; nothing is uploaded, and the
only thing kept is the transcript, in the local attempt history alongside every
other attempt.

**It suggests, it does not judge.** Speech recognition mishears — background
noise, a fast qirāʾah, a phone microphone. The app shows the words it did not
hear and leaves the grade to you, exactly like every other response mode. An
attempt checked this way is recorded with method `recite_asr` and labelled
*Recited*.

**Orthography is forgiven, words are not.** A transcript writes `الله` where
the mushaf writes `ٱللَّه`, and marking that wrong would be the app being wrong.
Diacritics, alef variants and the small Uthmani marks are folded away before
comparing. A missing or substituted *word* is reported.

## The download

Turning it on costs one download of about **150 MB**, once, cached by the
browser afterwards:

| | |
|---|---|
| Model | [`eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran`](https://huggingface.co/eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran) |
| Which is | an ONNX conversion of [`tarteel-ai/whisper-base-ar-quran`](https://huggingface.co/tarteel-ai/whisper-base-ar-quran) — Whisper fine-tuned on Qur'anic recitation |
| Licence | Apache 2.0 |
| Runtime | [transformers.js](https://github.com/huggingface/transformers.js) with onnxruntime-web |

**This is the only thing the app ever fetches from a third party**, which is
exactly why it is opt-in. Everything else — the text, the translations, the
fonts — ships with the app.

## Self-hosting the model

To avoid the third-party request entirely, mirror the model files and point the
build at your copy:

```sh
VITE_ASR_HOST="https://example.com/models/" \
VITE_ASR_WASM="https://example.com/wasm/" \
npm run build
```

`VITE_ASR_HOST` is joined with the model id, so the files must sit at
`<host>/eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran/…` mirroring the
repository layout. `VITE_ASR_WASM` points at the onnxruntime-web `.wasm`
binaries. Both default to the public CDNs when unset.

## What to expect

Measured in Chromium on WASM, one ayah of Al-Ikhlas: model load about 9
seconds from cache, transcription about 6–7 seconds for a 3-second recitation.
It is not instant, and it is not meant to be used on every card — it is the
strongest check the app can make, for when you want one.

Accuracy on clean recitation is good. From the run that decided whether to
build this at all, Al-Ikhlas 112:1–4 came back word for word, differing only in
the orthography described above.
