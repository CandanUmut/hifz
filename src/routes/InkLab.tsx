import { useEffect, useState } from 'react'
import { HINT_LEVELS, HINT_LEVEL_NAMES, InkText, type HintLevel } from '@/components/InkText'
import { applyTheme, useSettings, type ThemeChoice } from '@/state/settings'

/**
 * Phase 0 bench. One ayah at all five ink levels, side by side, with peek live.
 * Kept in the app so the fade can be re-judged after any type or token change.
 */
const AYAH = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'
const LONG =
  'إِنَّ لِلْمُتَّقِينَ مَفَازًا حَدَآئِقَ وَأَعْنَٰبًا وَكَوَاعِبَ أَتْرَابًا وَكَأْسًا دِهَاقًا'

export default function InkLab() {
  const theme = useSettings((s) => s.theme)
  const setSetting = useSettings((s) => s.set)
  const [peeks, setPeeks] = useState(0)
  const [live, setLive] = useState<HintLevel>(2)

  useEffect(() => applyTheme(theme), [theme])

  return (
    <div className="mx-auto max-w-column px-5 py-10">
      <header className="mb-8">
        <h1 className="text-large font-medium">Ink fade</h1>
        <p className="mt-1 text-small text-ink-soft">
          Five levels of the same line. Word widths and line breaks must be identical in every
          row.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['auto', 'gunduz', 'gece'] as ThemeChoice[]).map((t) => (
            <button
              key={t}
              className={t === theme ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setSetting('theme', t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <section className="space-y-6">
        {HINT_LEVELS.map((level) => (
          <div key={level} className="card p-5">
            <div className="label mb-2">
              level {level} · {HINT_LEVEL_NAMES[level]}
            </div>
            <InkText text={AYAH} level={level} lang="ar" className="sacred" />
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-large font-medium">Wrapping</h2>
        <p className="mb-4 mt-1 text-small text-ink-soft">
          A line long enough to wrap, at every level. If a break moves, the illusion is gone.
        </p>
        <div className="space-y-4">
          {HINT_LEVELS.map((level) => (
            <div key={level} className="card p-5">
              <div className="label mb-2">level {level}</div>
              <InkText text={LONG} level={level} lang="ar" className="sacred sacred-sm" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-large font-medium">Peek</h2>
        <p className="mb-4 mt-1 text-small text-ink-soft">
          Tap any word: full ink for 1.8 s, then it re-fades. Peeks used: {peeks}
        </p>
        <div className="card p-5" data-testid="peek-block">
          <InkText
            text={LONG}
            level={live}
            lang="ar"
            className="sacred sacred-sm"
            peekable
            onPeek={() => setPeeks((p) => p + 1)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {HINT_LEVELS.map((l) => (
              <button
                key={l}
                className={l === live ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setLive(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-large font-medium">Type check</h2>
        <div className="card mt-4 space-y-3 p-5">
          <p className="text-large">İşığın — IBM Plex Sans 400</p>
          <p className="text-large font-medium">İşığın — 500</p>
          <p className="text-large font-semibold">İşığın — 600</p>
          <p className="meaning">
            Newsreader at 18px: Rahmân ve Rahîm olan Allah&apos;ın adıyla. Övgü, âlemlerin Rabbi
            Allah&apos;a mahsustur.
          </p>
          <p className="font-ui-arabic text-large" dir="rtl">
            IBM Plex Sans Arabic — نص واجهة، وليس قرآنًا
          </p>
        </div>
      </section>
    </div>
  )
}
