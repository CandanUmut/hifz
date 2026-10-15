# How hifz works

The longer explanation behind the [README](../README.md).

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

## How a review actually goes

1. The ayah comes up **hidden** — word-shaped marks, nothing readable. Recite it
   from memory, out loud or in your head.
2. Stuck? **Tap a word** to uncover just that one. Every word you uncover is
   recorded, and it takes "Easily" off the table.
3. **Show the answer**, then answer one plain question — *Did you remember it?* —
   with *No idea · Barely · Yes · Easily*.
4. That answer only decides when the ayah comes back. Nobody is marking you.

There are two ways to answer and no more: check yourself, or **recite out loud**
and let the app listen (see below). Typing first letters and dragging words into
order were removed — they tested spelling and screen layout rather than recall.

Anything in your plan can be revised whenever you like: open it and press
**Practise**, which ignores due dates entirely.

## Turkish and English

The app asks which language you want the first time it opens, and explains in
three screens what it is going to ask of you. Both are changeable in Settings.

The last one listens on your device and shows you what it heard — no audio
leaves the browser. It is opt-in and experimental, because it needs a
Qur'an-tuned speech model of about 150 MB, the only thing this app ever fetches
from a third party. See [`docs/RECITATION.md`](RECITATION.md), including
how to self-host the model and avoid that too.

## Install it

It is a PWA: install it from your browser and it opens from the home screen,
full screen, and works with no connection. The app, the fonts and the pack list
are stored for offline use; a surah is kept the first time you open it. Only
recitation audio needs the network.

`main` deploys to GitHub Pages on every push. One build serves a domain root
and a project sub-path alike — relative asset paths and a hash router, no
rebuild for a different base.
