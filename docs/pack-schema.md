# Content pack schema (v1)

A pack is a folder of plain JSON under `public/packs/`. The app fetches it with
`fetch()` and nothing else — no API keys, no runtime calls to anyone's server.
If you want to add a pack (a dīwān, a duʿāʾ collection, a set of hadith, a
poem cycle), you only have to produce files in this shape and add the pack to
`public/packs/index.json`.

```
public/packs/
├── index.json                    every pack, for the library
└── <pack-id>/
    ├── pack.json                 manifest: metadata, attribution, text list
    ├── 001.json                  one text
    └── 078.json
```

Texts are separate files so the library can list a pack without downloading it.
A text is only fetched when the user opens or plans it.

## `index.json`

```jsonc
{
  "schema": 1,
  "packs": [
    {
      "id": "quran-juz-amma",
      "title": "Juz ʿAmma",
      "subtitle": "Surah 78–114, the last thirtieth",
      "version": "1.0.0",
      "file": "quran-juz-amma/pack.json",
      "textCount": 37,
      "segmentCount": 564
    }
  ]
}
```

## `pack.json`

```jsonc
{
  "schema": 1,
  "id": "quran-juz-amma",       // stable; used as a key in the local database
  "version": "1.0.0",           // bump when content changes
  "builtAt": "2026-08-20",
  "title": "Juz ʿAmma",
  "subtitle": "Surah 78–114, the last thirtieth",
  "lang": "ar",
  "dir": "rtl",                 // "rtl" | "ltr"

  "license": "Free prose. What may be done with this content.",
  "attribution": {              // shown on the text detail page
    "source": "Açık Kuran",
    "sourceUrl": "https://acikkuran.com",
    "edition": "KFGQPC Uthmanic Hafs",
    "translator": "see sources.translations"
  },

  // Per-stream provenance. Every stream that has its own terms gets a row.
  "sources": {
    "arabic":     { "source": "...", "edition": "...", "sourceUrl": "...", "license": "..." },
    "translations": [
      { "id": "elmalili-sadelestirilmis", "lang": "tr", "title": "…",
        "translator": "…", "source": "…", "sourceUrl": "…", "license": "…" }
    ],
    "transliterations": [
      { "id": "easy", "title": "Readable", "hint": "shown under the radio button",
        "source": "…", "sourceUrl": "…", "license": "…" }
    ],
    "wordByWord": { "source": "...", "sourceUrl": "..." },
    "audio":      { "source": "...", "sourceUrl": "...", "reciter": "...", "style": "..." }
  },

  "texts": [
    {
      "id": "quran-juz-amma:78",
      "index": 78,              // sort order within the pack
      "title": "An-Naba",
      "titleArabic": "النبإ",
      "titleTr": "Nebe",
      "segmentCount": 40,
      "file": "078.json"
    }
  ]
}
```

`sources.translations[].id` is what the user picks in Settings and what keys
the `translations` map on every segment. Ids must be stable across versions;
if an edition is replaced, use a new id.

## A text file

```jsonc
{
  "id": "quran-juz-amma:78",
  "packId": "quran-juz-amma",
  "index": 78,
  "title": "An-Naba",
  "titleArabic": "النبإ",
  "titleTr": "Nebe",
  "lang": "ar",
  "dir": "rtl",
  "revelationPlace": "makkah",  // optional, pack-specific metadata
  "bismillahPre": true,         // optional
  "audioUrl": "https://…/078.mp3",   // one file for the whole text

  "segments": [
    {
      "index": 0,               // 0-based, contiguous, defines recitation order
      "ref": "78:1",            // what a human calls this segment
      "content": "عَمَّ يَتَسَآءَلُونَ",
      "translations": {
        "elmalili-sadelestirilmis": "Neyi soruşturuyorlar",
        "clear-quran": "What are they asking one another about?"
      },
      "transliterations": {          // optional; the same text, another script
        "easy": "'Amma yatasaaa'aloon",
        "aligned": "ʿamma yatasāalūna"
      },
      "words": [                // the segment's tokenisation, plus the gloss
        { "ar": "عَمَّ", "translit": "ʿamma", "en": "About what" }
      ],
      "audio": {                // optional, offsets in ms into audioUrl
        "from": 0,
        "to": 6110,
        // [wordIndex, from, to] — see rule 3
        "wordTimings": [[0, 0, 330], [1, 330, 1230]]
      }
    }
  ]
}
```

### Rules the app relies on

1. **`words` is the tokenisation, and `words[].ar` joined with single spaces
   must equal `content`.** Where a segment has `words`, the app splits it there
   — for the ink fade, the response modes and the audio highlight alike — and
   never on whitespace. That matters because whitespace is not a word boundary
   in a mushaf: a waqf mark such as `ۖ` is written after a word with a space in
   front of it but belongs to that word, so `"صَفًّۭا ۖ"` is one entry in
   `words`, containing a space. Splitting on whitespace instead produced an
   order-tap chip nobody could place and a type-initials slot nobody could
   type. Omit `words` entirely rather than shipping an approximation; a text
   without it falls back to whitespace.
2. **`index` is contiguous from 0.** `link` items are generated between
   consecutive indices, so a gap invents a join that does not exist.
3. **`wordTimings` entries are `[wordIndex, from, to]`**, in ms from the start
   of `audioUrl`, and are *not* positional. A reciter who repeats part of a
   line produces several spans for the same word — 78:40 revisits words 5–10 —
   so each span names the word it covers, and the highlight follows the
   recitation back through the repeat. `wordIndex` is 0-based into `words`.
4. `translations` keys must appear in the manifest's `sources.translations`,
   and `transliterations` keys in `sources.transliterations`. Unknown keys are
   ignored, and a missing entry is simply not offered.
5. **A transliteration is not a translation.** Keep it out of `translations`:
   entries there make a segment eligible for `meaning` items, and a `meaning`
   item answered with a transliteration would ask the reader to recall the
   meaning of a line by reading the line. The app also never shows a
   transliteration as a hint during a test, for the same reason.
6. An id of `aligned` is a promise: exactly one whitespace-separated token per
   entry in `words`, so the app can highlight it in step with the recitation.
   If you cannot keep that promise, use a different id.
7. Text is stored exactly as it should be recited. The app never normalises,
   strips diacritics, or re-wraps it.

## Checking a pack

```sh
npm run check:packs
```

Verifies every rule above against everything in `public/packs`, and runs in
CI. A pack that breaks one of these does not crash — it quietly marks correct
answers wrong — so this is the only thing standing between a bad pack and the
reader.

## Regenerating the bundled packs

```sh
npm run build:packs                      # everything
npm run build:packs -- --pack=juz-amma   # one pack
npm run build:packs -- --no-audio        # skip audio timings
npm run build:packs -- --provider=mirror # skip the Açık Kuran lookup
```

The script is the only thing that talks to an upstream API. The built app
never does.
