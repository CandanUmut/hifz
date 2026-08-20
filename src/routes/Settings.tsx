import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { deleteAll, exportAll } from '@/db/repo'
import type { EditionInfo, TransliterationInfo } from '@/engine/types'
import {
  useSettings,
  type HintAggressiveness,
  type ResponseMode,
  type ThemeChoice,
} from '@/state/settings'

const THEMES: { id: ThemeChoice; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'follows your device' },
  { id: 'gunduz', label: 'Gündüz', hint: 'light' },
  { id: 'gece', label: 'Gece', hint: 'dark' },
]

const MODES: { id: ResponseMode; label: string; hint: string }[] = [
  { id: 'self_grade', label: 'Self-check', hint: 'Fastest. Recorded as self-checked.' },
  { id: 'order_tap', label: 'Tap in order', hint: 'Good on a phone. Recorded as reconstructed.' },
  {
    id: 'type_initials',
    label: 'Type initials',
    hint: 'Fast to type, hard to fake. Recorded as typed from memory.',
  },
]

const HINTS: { id: HintAggressiveness; label: string; hint: string }[] = [
  { id: 'gentle', label: 'Gentle', hint: 'more ink for longer' },
  { id: 'normal', label: 'Normal', hint: 'fades as an item holds' },
  { id: 'steep', label: 'Steep', hint: 'blank sooner' },
]

export default function Settings() {
  const settings = useSettings()
  const set = useSettings((s) => s.set)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editions = useLiveQuery(async () => {
    const texts = await db.texts.toArray()
    const map = new Map<string, EditionInfo>()
    for (const text of texts) for (const e of text.editions ?? []) map.set(e.id, e)
    const translits = new Map<string, TransliterationInfo>()
    for (const text of texts)
      for (const e of text.transliterationEditions ?? []) translits.set(e.id, e)
    const reciter = texts.find((t) => t.reciter)?.reciter
    return { editions: [...map.values()], translits: [...translits.values()], reciter }
  }, [])

  const tr = (editions?.editions ?? []).filter((e) => e.lang === 'tr')
  const en = (editions?.editions ?? []).filter((e) => e.lang === 'en')

  const download = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hifz-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-10">
      <h1 className="text-large font-medium">Settings</h1>

      <Group title="Theme">
        <Choice
          options={THEMES}
          value={settings.theme}
          onChange={(v) => set('theme', v)}
          name="theme"
        />
      </Group>

      <Group title="Meanings">
        <Select
          label="Turkish edition"
          value={settings.trEdition}
          options={tr.map((e) => ({ value: e.id, label: `${e.title} — ${e.translator}` }))}
          onChange={(v) => set('trEdition', v)}
          empty="Open a text first and its editions appear here."
        />
        <Select
          label="English edition"
          value={settings.enEdition}
          options={en.map((e) => ({ value: e.id, label: `${e.title} — ${e.translator}` }))}
          onChange={(v) => set('enEdition', v)}
          empty="Open a text first and its editions appear here."
        />
      </Group>

      <Group title="Transliteration">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={settings.showTransliteration}
            onChange={(e) => set('showTransliteration', e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--focus))]"
          />
          <span className="text-small">Show the line in Latin script</span>
        </label>
        {settings.showTransliteration && (
          <div className="mt-2 space-y-2">
            {(editions?.translits ?? []).length === 0 ? (
              <p className="text-micro text-ink-soft">
                Open a text first and its transliterations appear here.
              </p>
            ) : (
              (editions?.translits ?? []).map((option) => (
                <label
                  key={option.id}
                  className={[
                    'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2',
                    settings.translitEdition === option.id ? 'border-ink' : 'border-rule',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="translit"
                    checked={settings.translitEdition === option.id}
                    onChange={() => set('translitEdition', option.id)}
                    className="h-4 w-4 accent-[rgb(var(--focus))]"
                  />
                  <span>
                    <span className="block text-small">{option.title}</span>
                    <span className="block text-micro text-ink-soft">{option.hint}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}
        <p className="mt-2 text-micro text-ink-soft">
          It never appears as a hint during a test — it is the line itself, just in
          another script.
        </p>
      </Group>

      <Group title="Checking">
        <Choice
          options={MODES}
          value={settings.defaultResponseMode}
          onChange={(v) => set('defaultResponseMode', v)}
          name="mode"
        />
        <p className="mt-2 text-micro text-ink-soft">
          You can switch mode on any single item during a review.
        </p>
      </Group>

      <Group title="Hints">
        <Choice
          options={HINTS}
          value={settings.hintAggressiveness}
          onChange={(v) => set('hintAggressiveness', v)}
          name="hints"
        />
      </Group>

      <Group title="Scheduling">
        <label className="block">
          <span className="text-small">
            Desired retention — {Math.round(settings.desiredRetention * 100)}%
          </span>
          <input
            type="range"
            min={0.85}
            max={0.95}
            step={0.01}
            value={settings.desiredRetention}
            onChange={(e) => set('desiredRetention', Number(e.target.value))}
            className="mt-2 w-full accent-[rgb(var(--focus))]"
          />
          <span className="mt-1 block text-micro text-ink-soft">
            Higher means shorter intervals and more reviews.
          </span>
        </label>

        <label className="mt-6 block">
          <span className="text-small">New items per day — {settings.dailyNewCap}</span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={settings.dailyNewCap}
            onChange={(e) => set('dailyNewCap', Number(e.target.value))}
            className="mt-2 w-full accent-[rgb(var(--focus))]"
          />
        </label>
      </Group>

      <Group title="Recitation">
        <p className="text-small">{editions?.reciter ?? 'None bundled yet'}</p>
        <p className="mt-1 text-micro text-ink-soft">
          Word timings are recorded per reciter, so switching reciter means rebuilding the pack:
          <code className="ms-1">npm run build:packs -- --reciter=6</code>. Audio streams from
          QuranicAudio and is never stored here.
        </p>
      </Group>

      <Group title="Your data">
        <p className="text-small text-ink-soft">
          Everything is stored in this browser. Nothing is sent anywhere.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={download}>
            Export all data as JSON
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="btn border border-correction text-correction hover:bg-correction/10"
                onClick={async () => {
                  await deleteAll()
                  setConfirmDelete(false)
                }}
              >
                Yes, delete everything
              </button>
              <button type="button" className="btn-text" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn-text" onClick={() => setConfirmDelete(true)}>
              Delete all data
            </button>
          )}
        </div>
        {confirmDelete && (
          <p className="mt-2 text-micro text-correction">
            This removes every text, item and attempt on this device. Export first if you want it
            back.
          </p>
        )}
      </Group>
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="label mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Choice<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { id: T; label: string; hint: string }[]
  value: T
  onChange: (value: T) => void
  name: string
}) {
  return (
    <div role="radiogroup" aria-label={name} className="space-y-2">
      {options.map((option) => (
        <label
          key={option.id}
          className={[
            'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2',
            value === option.id ? 'border-ink' : 'border-rule',
          ].join(' ')}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="h-4 w-4 accent-[rgb(var(--focus))]"
          />
          <span>
            <span className="block text-small">{option.label}</span>
            <span className="block text-micro text-ink-soft">{option.hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
  empty,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  empty: string
}) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="text-small">{label}</span>
      {options.length === 0 ? (
        <span className="mt-1 block text-micro text-ink-soft">{empty}</span>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 min-h-[44px] w-full rounded-md border border-rule bg-paper-raised px-3
            text-small"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </label>
  )
}
