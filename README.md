# hifz

A free, open-source app for memorising text word for word — and keeping it
memorised.

Everything runs in the browser. There is no account, no server, and nothing
you add ever leaves your device. The Qur'an is the bundled content, but the
engine is text-agnostic: paste a poem, a duʿāʾ, a speech or a vocabulary list
and it works the same way.

```
text → segmentation → item generation → scheduled review (FSRS)
     → graded recall → evidence record → schedule update
```

## What makes it different

**It schedules the joins, not just the lines.** Between every pair of
consecutive segments the app generates a `link` item — *end of this line, what
starts the next one?* — and schedules it on its own. Joins are where
recitation actually breaks, and no generic flashcard app tests them.

**Hints are ink leaving the page.** Not blanks, not asterisks. Five levels,
from full ink through first-letters and word-shaped ghost rules to blank
measured space. Word widths and line breaks never move between levels, so it
reads as ink drying rather than as redaction. Tap any faded word to peek for
1.8 seconds — and every peek is recorded and caps that item's grade.

**It knows which lines you will confuse.** Near-identical passages —
*mutashābihāt* — are where recitation takes the wrong branch after the joins.
The app builds an interference graph over the texts on your device and shows
you the twin, with the words that tell them apart marked, at the moment you
have just recalled the line. In Juz ʿAmma that finds the pairs any ḥāfiẓ would
name: 79:33 with 80:32, 82:13 with 83:22, 84:2 with 84:5, al-Falaq against
an-Nas.

**It never claims you know something.** Two separate statuses, never merged:

| | |
|---|---|
| **Intent** — yours | `learning` · `maintaining` · `paused`. You set it, the app never argues with it or overwrites it. |
| **Evidence** — the app's | `untested` · `weak` · `fair` · `strong` · `cold_verified`, derived from FSRS retrievability and how the last check was obtained. Read-only. |

Every check records *how* it was obtained, and the interface says so:
self-checked, reconstructed, typed from memory, cold-checked. There are no
streaks anywhere in the product. The honest metric is the **cold check** — a
monthly run over things you have not seen in thirty days, starting from blank,
with no peeks: *"You recalled 7 of 10 first-time."*

## Four ways to answer

`Self-check` (fastest, lowest confidence) · `Tap in order` · `Type initials`
(fast to type, hard to fake) · `Recite out loud`.

The last one listens on your device and shows you what it heard — no audio
leaves the browser. It is opt-in and experimental, because it needs a
Qur'an-tuned speech model of about 150 MB, the only thing this app ever fetches
from a third party. See [`docs/RECITATION.md`](docs/RECITATION.md), including
how to self-host the model and avoid that too.

## Install it

It is a PWA: install it from your browser and it opens from the home screen,
full screen, and works with no connection. The app, the fonts and the pack list
are stored for offline use; a surah is kept the first time you open it. Only
recitation audio needs the network.

`main` deploys to GitHub Pages on every push. One build serves a domain root
and a project sub-path alike — relative asset paths and a hash router, no
rebuild for a different base.

## Running it

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # static files in dist/ — deploy anywhere
npm test             # engine tests
npm run check:packs  # validate the bundled content against docs/pack-schema.md
```

`/#/design` is the ink-fade bench: one ayah at all five levels in both themes,
kept in the app so the fade can be re-judged after any change to type or
tokens.

## Content

Two packs ship with the app: **Al-Fātiḥa** and **Juz ʿAmma** (surah 78–114) —
Uthmani text, word-by-word gloss, three transliterations, two Turkish and two
English translations, and word-level recitation timings.

Transliteration is stored separately from translation, because it is the same
text in another script rather than its meaning. Three editions: **Readable**
(`Qul huwal laahu ahad`), **Scholarly** (`Qul Huwa Allāhu ʾAĥadun`), and
**Word-aligned** (`qul huwa l-lahu aḥadun`), which has one token per Arabic
word and so highlights in step with the recitation. It shows while you are
learning and once an answer is revealed — never as a hint during a test, since
it is the line itself.

Packs are static JSON snapshots taken at build time. **The app never calls an
upstream API at runtime**, so it works offline and no donation-funded server
carries our traffic.

```sh
npm run build:packs                       # rebuild both packs
npm run build:packs -- --pack=juz-amma    # just one
npm run build:packs -- --reciter=6        # different reciter's word timings
```

Sources, editions and their terms are listed in
[`docs/CONTENT-SOURCES.md`](docs/CONTENT-SOURCES.md). Thanks in particular to
[Açık Kuran](https://github.com/acik-kuran/acikkuran-api), the volunteer
project behind the Turkish text, to the
[Quran.com / Quran Foundation API](https://api-docs.quran.foundation) for the
Uthmani text and word-by-word gloss, and to
[quran-api](https://github.com/fawazahmed0/quran-api) for the translation
mirrors.

**Writing your own pack** — a dīwān, a hadith collection, a set of poems — only
means producing JSON in the documented shape:
[`docs/pack-schema.md`](docs/pack-schema.md). Contributions welcome.

## How it is built

Vite · React · TypeScript · Tailwind · Dexie (IndexedDB) · `ts-fsrs` · Zustand ·
React Router. No backend. Fonts are self-hosted under `public/fonts`, so the
built app makes no third-party request at all until you press play on audio.

```
src/engine/   data model, FSRS wrapper, item generation, evidence tiers,
              segmentation, the interference graph, recitation matching
src/db/       Dexie schema and every read and write
src/packs/    pack loading
src/routes/   Today · Library · Text detail · Review · Cold check · Add · Progress · Settings
src/components/ InkText (the fade), heat strips, response modes
scripts/      pack and font snapshots
```

Attempts are append-only. Nothing in the history is ever deleted — the honesty
of the evidence tiers depends on it, and later work (weak-word analysis,
browser-side recitation scoring) will read from it.

## Licence

MIT for the code. Bundled content carries its own terms, recorded in each pack
and in `docs/CONTENT-SOURCES.md`.
