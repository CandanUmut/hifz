# Content sources

Everything bundled in `public/packs/` is a build-time snapshot. The shipped app
never calls any of these APIs — see `scripts/build-packs.ts`.

## Arabic text

| | |
|---|---|
| Edition | Uthmani script, King Fahd Glorious Qur'an Printing Complex |
| Fetched from | [Quran.com API v4](https://api-docs.quran.foundation) (Quran Foundation) |
| Terms | The Qur'anic text itself is not under copyright. |

The Arabic text and the word-by-word list are taken from the same response on
purpose: the response modes that ask the user to reassemble a line depend on
`words` joining back into exactly `content`.

## Turkish translations

| Edition | Translator | Source | Terms |
|---|---|---|---|
| Elmalılı Hamdi Yazır (sadeleştirilmiş) — **default** | Elmalılı Muhammed Hamdi Yazır | [Açık Kuran](https://acikkuran.com), mirrored on the [quran-api CDN](https://github.com/fawazahmed0/quran-api) | Public domain (translator d. 1942) |
| Diyanet İşleri Meali | Diyanet İşleri Başkanlığı | [Tanzil.net](https://tanzil.net) via the quran-api CDN | Tanzil terms: free for non-commercial use with attribution |

**Açık Kuran** (`github.com/acik-kuran/acikkuran-api`) is the volunteer project
this app was designed around, and the build script asks it first. Their servers
are donation-funded, which is exactly why the app ships a snapshot instead of
calling them at runtime.

> Note on the currently committed packs: the machine that generated them could
> not reach `api.acikkuran.com`, so the script fell back to the same Elmalılı
> edition mirrored on the quran-api CDN and recorded that in each pack's
> `sources.translations[].source`. Re-running `npm run build:packs` from a host
> that can reach Açık Kuran will pull it from there instead.

## English translations

| Edition | Translator | Source | Terms |
|---|---|---|---|
| The Clear Quran — **default** | Dr. Mustafa Khattab | quran-api CDN | Distributed by the translator for non-commercial use |
| The Meaning of the Glorious Koran | Marmaduke Pickthall | Tanzil.net via the quran-api CDN | Public domain (1930) |

## Transliterations

The same text in Latin script — not a translation, and stored in its own field
so it can never be mistaken for one.

| Edition | Style | Source | Terms |
|---|---|---|---|
| Readable — **default** | `Qul huwal laahu ahad` — spelled the way it is recited | [quran411](https://quran411.com) via the quran-api CDN | Freely distributed; no restriction stated |
| Scholarly | `Qul Huwa Allāhu ʾAĥadun` — full diacritics | quran-api CDN | Freely distributed; no restriction stated |
| Word-aligned | `qul huwa l-lahu aḥadun` — one token per Arabic word | Derived from the Quran.com API v4 word transliterations | Same terms as the word-by-word gloss |

The word-aligned edition is built from the same word list as the gloss, so it
has exactly one token per Arabic word and follows the recitation word by word
when audio plays.

## Word-by-word gloss

English gloss and transliteration per word, from the
[Quran.com API v4](https://api-docs.quran.foundation). Shown under each word
in the word-by-word view, and the source of the word-aligned transliteration
above.

## Recitation audio

| | |
|---|---|
| Reciter | Mishari Rashid al-Afasy (Murattal) |
| Audio files | [QuranicAudio](https://quranicaudio.com) — streamed, never committed to this repo |
| Word timings | Quran.com API, snapshotted into the packs |

Audio is the one thing the app fetches over the network at runtime, and only
when the user presses play.

## Speech model (opt-in)

Not bundled and not fetched unless the reader turns on the recitation check.

| | |
|---|---|
| Model | ONNX build of Tarteel's Whisper fine-tuned on Qur'anic recitation |
| From | [`eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran`](https://huggingface.co/eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran), converted from [`tarteel-ai/whisper-base-ar-quran`](https://huggingface.co/tarteel-ai/whisper-base-ar-quran) |
| Licence | Apache 2.0 |
| Size | about 150 MB, downloaded once and cached |

This is the only third-party request the app ever makes, and it can be avoided
entirely by self-hosting the model — see [`RECITATION.md`](./RECITATION.md).

## Typefaces

| Family | Use | Licence |
|---|---|---|
| KFGQPC Uthmanic Script HAFS | Qur'anic text | Distributed free by the King Fahd Glorious Qur'an Printing Complex for rendering the Qur'an |
| Amiri Quran, Scheherazade New | Scripture fallbacks | SIL Open Font License 1.1 |
| IBM Plex Sans, IBM Plex Sans Arabic | Interface | SIL Open Font License 1.1 |
| Newsreader | Meaning and translation | SIL Open Font License 1.1 |

All are self-hosted under `public/fonts/` by `scripts/fetch-fonts.ts`. The app
loads no third-party font.

## Adding a source

Packs are just JSON — see [`pack-schema.md`](./pack-schema.md). A pack must
carry its own `license` and `attribution`; the text detail page shows them, and
new sources belong in this file too.
