# Reciting out loud

The recitation check listens while you recite. The line starts as blanks, and
a word appears only once it has actually been heard — so the answer is never on
screen while you are trying to remember it, and you can watch the check happen
instead of waiting for a verdict. It is offered directly on the review screen;
tapping it explains the one-time download before anything is fetched.

## Two listeners

**The browser's own recogniser is the default.** Every browser has shipped one
for years: nothing to download, and words appear while you are still speaking
rather than a few seconds after you stop. The cost is that some browsers send
the audio to their own servers, which is a real difference from everything else
this app does — so it is said in a sentence next to the button rather than
buried, and the alternative is one tap away.

**The on-device model is the private one.** A Qur'an-tuned Whisper, about
150 MB, running in a worker on this device. Nothing is uploaded. It is the
better recogniser for recitation and the worse one for a phone: 150 MB of
weights next to a page is enough to have the tab killed for memory on iOS,
which is what "a problem repeatedly occurred" means. It is offered, not
imposed, and if the worker dies the app says so instead of going down with it.

Either way the only thing kept is the transcript, in the local attempt history
alongside every other attempt.

## What it does and does not do

**The microphone is read as raw samples, not as a recording.** On the
on-device path there is no MediaRecorder and no container: the audio is taken
off the Web Audio graph, resampled to 16 kHz and handed to the model as
numbers. That is what makes a
partial read free — the running transcript costs nothing to take — and it is
what makes it work on iOS Safari, where MediaRecorder produces a fragmented
MP4 whose fragments cannot be decoded on their own. Recitation checking used to
fail on every iPhone for exactly that reason.

**It suggests, it does not judge.** Speech recognition mishears — background
noise, a fast qirāʾah, a phone microphone. The app shows the words it did not
hear and leaves the grade to you, exactly like every other response mode. An
attempt checked this way is recorded with method `recite_asr` and labelled
*Recited*.

**It is forgiving on purpose.** A transcript writes `الله` where the mushaf
writes `ٱللَّه`, glues a conjunction onto the next word, and drops a short
particle in a long breath. Diacritics, alef variants and the small Uthmani
marks are folded away; a word matches if it reads the same, differs by a
spelling's worth of letters, shares a stem, or is the start of its neighbour.
On top of that, the two lines are compared a second time as one run of letters,
so a transcript that split the words differently still lands — only unbroken
runs of four letters or more count, because Arabic has few enough letters that
any two lines share a long scattered subsequence.

A line passes when half of it lands. That is deliberate: the check exists to
tell a recitation from a blank, not to grade tajwīd, and telling someone they
failed a line they recited correctly is the fastest way to make them stop
opening the app. The grade is still theirs.

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

The model runs on WebGPU where the browser has it and falls back to WASM where
it does not, with the same weights either way, so switching costs no download.
Threads would help too, but they need cross-origin isolation, and a static host
cannot set the headers for it.

Measured in Chromium on WASM in a slow container, one ayah of Al-Ikhlas: about
6 seconds per pass. Whisper pads every clip to thirty seconds, so a short clip
costs the same as a long one — which is why the running transcript refreshes
every few seconds rather than word by word. On a GPU it is roughly a second.

The work happens in a worker. On the main thread each pass froze the page for
those six seconds, which meant the words stopped appearing and the Stop button
stopped answering, on the one screen where you are mid-sentence and need both.

Accuracy on clean recitation is good. From the run that decided whether to
build this at all, Al-Ikhlas 112:1–4 came back word for word, differing only in
the orthography described above.
