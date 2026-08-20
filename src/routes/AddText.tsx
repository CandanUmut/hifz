import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addToPlan, createUserText } from '@/db/repo'
import { DEFAULT_ITEM_TYPES, type ItemTypeChoice } from '@/engine/items'
import {
  guessDirection,
  mergeAt,
  segmentText,
  splitAt,
  STRATEGY_LABELS,
  type SegmentationStrategy,
} from '@/engine/segmentation'

type Step = 'paste' | 'segment' | 'confirm'

const STRATEGIES = Object.keys(STRATEGY_LABELS) as SegmentationStrategy[]

export default function AddText() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('paste')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [lang, setLang] = useState('')
  const [dir, setDir] = useState<'rtl' | 'ltr' | 'auto'>('auto')
  const [strategy, setStrategy] = useState<SegmentationStrategy>('newline')
  const [wordsPerSegment, setWordsPerSegment] = useState(8)
  const [edited, setEdited] = useState<string[] | null>(null)
  const [types, setTypes] = useState<ItemTypeChoice>(DEFAULT_ITEM_TYPES)
  const [saving, setSaving] = useState(false)

  const auto = useMemo(
    () => segmentText(body, strategy, { wordsPerSegment }),
    [body, strategy, wordsPerSegment],
  )
  const segments = edited ?? auto
  const resolvedDir = dir === 'auto' ? guessDirection(body) : dir

  const save = async (addNow: boolean) => {
    setSaving(true)
    try {
      const text = await createUserText({
        title,
        lang: lang || (resolvedDir === 'rtl' ? 'ar' : 'en'),
        dir: resolvedDir,
        segments: segments.map((content) => ({ content })),
      })
      if (addNow) {
        await addToPlan({
          textId: text.id,
          indices: segments.map((_, i) => i),
          types: { ...types, meaning: false },
        })
      }
      navigate(`/text/${encodeURIComponent(text.id)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pb-10">
      <div className="flex items-center gap-3">
        <h1 className="text-large font-medium">Add a text</h1>
        <span className="ms-auto text-micro text-ink-soft">
          {step === 'paste' ? '1' : step === 'segment' ? '2' : '3'} of 3
        </span>
      </div>

      {step === 'paste' && (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-small">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ṣalāt al-ḥājah, a poem, a speech…"
              className="mt-1 min-h-[44px] w-full rounded-md border border-rule bg-paper-raised px-3
                text-base"
            />
          </label>

          <label className="block">
            <span className="text-small">The text</span>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setEdited(null)
              }}
              rows={10}
              dir={resolvedDir}
              className="mt-1 w-full rounded-md border border-rule bg-paper-raised p-3 text-base"
              placeholder="Paste it here. One line per unit is easiest, but you can split it in the next step."
            />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="text-small">Language tag</span>
              <input
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                placeholder={resolvedDir === 'rtl' ? 'ar' : 'en'}
                className="mt-1 min-h-[44px] w-28 rounded-md border border-rule bg-paper-raised px-3
                  text-small"
              />
            </label>
            <label className="block">
              <span className="text-small">Direction</span>
              <select
                value={dir}
                onChange={(e) => setDir(e.target.value as typeof dir)}
                className="mt-1 min-h-[44px] rounded-md border border-rule bg-paper-raised px-3
                  text-small"
              >
                <option value="auto">Auto ({guessDirection(body)})</option>
                <option value="rtl">Right to left</option>
                <option value="ltr">Left to right</option>
              </select>
            </label>
          </div>

          <p className="text-micro text-ink-soft">
            {auto.length} segment{auto.length === 1 ? '' : 's'} detected. This text stays on your
            device — it is never uploaded.
          </p>

          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            disabled={!body.trim()}
            onClick={() => setStep('segment')}
          >
            Next
          </button>
        </div>
      )}

      {step === 'segment' && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            {STRATEGIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStrategy(s)
                  setEdited(null)
                }}
                aria-pressed={strategy === s}
                className={strategy === s ? 'btn-primary' : 'btn-secondary'}
              >
                {STRATEGY_LABELS[s]}
              </button>
            ))}
          </div>

          {strategy === 'word_count' && (
            <label className="mt-4 block">
              <span className="text-small">Words per segment — {wordsPerSegment}</span>
              <input
                type="range"
                min={3}
                max={20}
                value={wordsPerSegment}
                onChange={(e) => {
                  setWordsPerSegment(Number(e.target.value))
                  setEdited(null)
                }}
                className="mt-2 w-full accent-[rgb(var(--focus))]"
              />
            </label>
          )}

          <p className="mt-4 text-micro text-ink-soft">
            {segments.length} segments. Merge a line into the one above it, or split it in two.
          </p>

          <ol className="mt-3 divide-y divide-rule border-y border-rule">
            {segments.map((segment, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <span className="w-6 shrink-0 pt-1 text-micro tabular-nums text-ink-soft">
                  {i + 1}
                </span>
                <span dir={resolvedDir} className="me-auto text-base">
                  {segment}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <button
                    type="button"
                    className="btn-text"
                    disabled={i === 0}
                    onClick={() => setEdited(mergeAt(segments, i))}
                  >
                    Merge up
                  </button>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setEdited(splitAt(segments, i))}
                  >
                    Split
                  </button>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => setStep('paste')}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={segments.length === 0}
              onClick={() => setStep('confirm')}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="mt-6 space-y-6">
          <div>
            <h2 className="label mb-3">What to schedule</h2>
            <div className="space-y-2">
              <TypeRow
                label="Lines"
                hint="Each segment on its own. Always on."
                checked
                disabled
                onChange={() => {}}
              />
              <TypeRow
                label="Joins"
                hint={`${Math.max(0, segments.length - 1)} joins between consecutive segments — where memorisation actually breaks.`}
                checked={types.link}
                onChange={(v) => setTypes((t) => ({ ...t, link: v }))}
              />
              <TypeRow
                label="Meanings"
                hint="Needs translations, which this text does not have yet."
                checked={false}
                disabled
                onChange={() => {}}
              />
            </div>
          </div>

          <p className="text-small text-ink-soft">
            {title.trim() || 'Untitled'} — {segments.length} segments.
          </p>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => setStep('segment')}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => save(true)}
            >
              Add to plan
            </button>
            <button type="button" className="btn-text" disabled={saving} onClick={() => save(false)}>
              Save for later
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function TypeRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      className={[
        'flex min-h-[44px] items-start gap-3 rounded-md border px-3 py-2',
        disabled ? 'border-rule opacity-60' : 'cursor-pointer border-rule',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[rgb(var(--focus))]"
      />
      <span>
        <span className="block text-small">{label}</span>
        <span className="block text-micro text-ink-soft">{hint}</span>
      </span>
    </label>
  )
}
