import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import {
  addToPlan,
  deriveIntent,
  ensurePackText,
  getItems,
  getSegments,
  setIntentForText,
  tiersFromItems,
} from '@/db/repo'
import { InkText } from '@/components/InkText'
import { EvidenceChip, IntentBadge } from '@/components/StatusBadges'
import { HeatStrip } from '@/components/HeatStrip'
import { DEFAULT_ITEM_TYPES } from '@/engine/items'
import type { Intent, SegmentRecord, TextRecord } from '@/engine/types'
import {
  hasMeaning,
  hasTransliteration,
  resolveMeaning,
  resolveTransliteration,
} from '@/lib/translations'
import { Transliteration } from '@/components/Transliteration'
import { SimilarPassages, type ResolvedMatch } from '@/components/SimilarPassages'
import { useInterference } from '@/lib/useInterference'
import { useAudio } from '@/lib/useAudio'
import { segmentWords } from '@/lib/text'
import { passageClass, wordClass } from '@/lib/typography'
import { listPacks, PackUnavailableError } from '@/packs/loader'
import { useSettings } from '@/state/settings'
import { useT } from '@/i18n'

const INTENTS: Intent[] = ['learning', 'maintaining', 'paused']

export default function TextDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const setSetting = useSettings((s) => s.set)
  const [importError, setImportError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [openGloss, setOpenGloss] = useState<number | null>(null)
  const [includeMeaning, setIncludeMeaning] = useState(false)
  const [openTwins, setOpenTwins] = useState<number | null>(null)
  const t = useT()
  const interference = useInterference()

  const packId = params.get('pack')
  const file = params.get('file')

  // Pack texts are copied into the local database the first time they open.
  useEffect(() => {
    if (!packId || !file) return
    let cancelled = false
    ;(async () => {
      try {
        const index = await listPacks()
        const entry = index.packs.find((p) => p.id === packId)
        if (!entry) throw new Error(`unknown pack ${packId}`)
        await ensurePackText(entry, file, id)
      } catch (err) {
        if (cancelled) return
        setImportError(
          err instanceof PackUnavailableError
            ? err.message
            : 'This one has not been downloaded yet, and it could not be fetched just now.',
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file, id, packId])

  const data = useLiveQuery(async () => {
    const text = await db.texts.get(id)
    if (!text) return null
    const [segments, items] = await Promise.all([getSegments(id), getItems(id)])
    return { text, segments, items }
  }, [id])

  const audio = useAudio(data?.text, data?.segments)

  const plannedIndices = useMemo(() => {
    if (!data) return new Set<number>()
    const byId = new Map(data.segments.map((s) => [s.id, s.index]))
    return new Set(
      data.items.map((i) => byId.get(i.segmentId)).filter((n): n is number => n != null),
    )
  }, [data])

  const add = useCallback(
    async (indices: number[], stage: 'study' | 'review') => {
      if (!data || !indices.length) return
      await addToPlan({
        textId: data.text.id,
        indices,
        types: { ...DEFAULT_ITEM_TYPES, meaning: includeMeaning && hasMeaning(data.segments) },
        stage,
      })
      setSelection(new Set())
    },
    [data, includeMeaning],
  )

  if (importError) {
    return (
      <div>
        <p className="text-base">{t('offline.notDownloaded')}</p>
        <p className="mt-2 text-small text-ink-soft">{t('offline.keptNote')}</p>
        <Link to="/library" className="btn-secondary mt-6">
          {t('text.backToLibrary')}
        </Link>
      </div>
    )
  }
  if (data === undefined) return <p className="text-small text-ink-soft">{t('common.loading')}</p>
  if (data === null) {
    return (
      <div>
        <p className="text-base">{t('text.notOnDevice')}</p>
        <Link to="/library" className="btn-secondary mt-4">
          {t('text.backToLibrary')}
        </Link>
      </div>
    )
  }

  const { text, segments, items } = data
  const tiers = tiersFromItems(items)
  const intent = deriveIntent(items)
  const lastEvidence = items
    .filter((i) => i.lastEvidence)
    .sort((a, b) => (b.lastEvidence?.at ?? 0) - (a.lastEvidence?.at ?? 0))[0]?.lastEvidence

  const indexById = new Map(segments.map((s) => [s.id, s.index]))
  const studyIndices = new Set(
    items.filter((i) => i.stage === 'study').map((i) => indexById.get(i.segmentId)),
  )
  const reviewIndices = new Set(
    items.filter((i) => i.stage === 'review').map((i) => indexById.get(i.segmentId)),
  )
  const unlisted = segments.map((s) => s.index).filter((index) => !plannedIndices.has(index))
  const selected = [...selection].sort((a, b) => a - b)

  // What a study sitting would cover: whatever is on the study list, or the
  // next few that are on neither list.
  const studyBatch = (studyIndices.size > 0
    ? [...studyIndices].filter((i): i is number => i != null).sort((a, b) => a - b)
    : unlisted.slice(0, settings.memorizeBatch))

  const toggle = (index: number) =>
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <section className="pb-24">
      <header>
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-display">{text.title}</h1>
          {text.titleTr && <span className="text-base text-ink-soft">{text.titleTr}</span>}
          {text.titleArabic && (
            <span className="font-ui-arabic text-base text-ink-soft" dir="rtl">
              {text.titleArabic}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntentBadge intent={intent} />
          <EvidenceChip last={lastEvidence} />
        </div>

        <div className="mt-4">
          <HeatStrip count={segments.length} tiers={tiers} max={segments.length} />
        </div>

        {items.length > 0 && (
          <div className="mt-5">
            <p className="label mb-2">{t('text.intent')}</p>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIntentForText(text.id, option)}
                  aria-pressed={intent === option}
                  className={intent === option ? 'btn-primary' : 'btn-secondary'}
                >
                  {t(`intent.${option}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Toggle
            label={t('text.turkish')}
            on={settings.showTranslationTr}
            onChange={(v) => setSetting('showTranslationTr', v)}
          />
          <Toggle
            label={t('text.english')}
            on={settings.showTranslationEn}
            onChange={(v) => setSetting('showTranslationEn', v)}
          />
          {hasTransliteration(segments) && (
            <Toggle
              label={t('text.transliteration')}
              on={settings.showTransliteration}
              onChange={(v) => setSetting('showTransliteration', v)}
            />
          )}

        </div>
        {audio.available && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {audio.playingIndex != null ? (
              <button type="button" className="btn-secondary" onClick={audio.stop}>
                ■ {t('text.stop')}
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => audio.playFrom(0)}>
                ▶ {t('text.playAll')}
              </button>
            )}
            {audio.playingIndex != null && (
              <span className="text-micro text-ink-soft">
                {segments.find((s) => s.index === audio.playingIndex)?.ref ?? ''}
              </span>
            )}
          </div>
        )}
        {audio.error && <p className="mt-2 text-micro text-correction">{t('text.audioError')}</p>}
      </header>

      <ol className="mt-8 divide-y divide-rule border-t border-rule">
        {segments.map((segment) => (
          <Ayah
            key={segment.id}
            segment={segment}
            text={text}
            planned={plannedIndices.has(segment.index)}
            selected={selection.has(segment.index)}
            onToggle={() => toggle(segment.index)}
            onAdd={() => add([segment.index], 'study')}
            glossOpen={openGloss === segment.index}
            onGloss={() => setOpenGloss((v) => (v === segment.index ? null : segment.index))}
            twins={interference.resolve(segment.id)}
            twinsOpen={openTwins === segment.index}
            onTwins={() => setOpenTwins((v) => (v === segment.index ? null : segment.index))}
            audio={audio}
          />
        ))}
      </ol>

      {text.attribution && (
        <footer className="mt-10 border-t border-rule pt-5 text-micro text-ink-soft">
          <p>
            {text.attribution.edition} · {text.attribution.source}{' '}
            <a
              href={text.attribution.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              {text.attribution.sourceUrl.replace(/^https?:\/\//, '')}
            </a>
          </p>
          {text.editions?.map((edition) => (
            <p key={edition.id} className="mt-1">
              {edition.title} — {edition.translator}
              {edition.license ? ` · ${edition.license}` : ''}
            </p>
          ))}
          {text.transliterationEditions?.map((edition) => (
            <p key={edition.id} className="mt-1">
              Transliteration ({edition.title}) — {edition.source}
              {edition.license ? ` · ${edition.license}` : ''}
            </p>
          ))}
          {text.license && <p className="mt-2">{text.license}</p>}
        </footer>
      )}

      {/* One primary action, thumb-reachable. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-column px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 text-center text-micro text-ink-soft">
            {selection.size > 0
              ? t('text.selected', { count: selection.size })
              : plannedIndices.size === 0
                ? t('text.notAddedYet')
                : `${t('text.onStudyList', { count: studyIndices.size })} · ${t('text.onReviewList', { count: reviewIndices.size })}`}
          </p>
          {hasMeaning(segments) && (
            <label className="mb-2 flex items-center justify-center gap-2 text-micro text-ink-soft">
              <input
                type="checkbox"
                checked={includeMeaning}
                onChange={(e) => setIncludeMeaning(e.target.checked)}
                className="h-4 w-4 accent-[rgb(var(--focus))]"
              />
              {t('text.alsoSchedule')}
            </label>
          )}
          <div className="flex items-center gap-3">
          {/*
            Two lists, two buttons, and never a decision made on the reader's
            behalf. Selecting ayah changes what the buttons add; selecting
            nothing means the whole surah.
          */}
          {selected.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => add(selected, 'study')}
              >
                {t('text.addToStudy', { count: selected.length })}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => add(selected, 'review')}
              >
                {t('text.addToReview', { count: selected.length })}
              </button>
            </div>
          ) : (
            <>
              {unlisted.length > 0 && (
                <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  <button
                    type="button"
                    className="text-micro text-ink-soft underline underline-offset-2 hover:text-ink"
                    onClick={() => add(unlisted, 'study')}
                  >
                    {t('text.addAllToStudy')}
                  </button>
                  <button
                    type="button"
                    className="text-micro text-ink-soft underline underline-offset-2 hover:text-ink"
                    onClick={() => add(unlisted, 'review')}
                  >
                    {t('text.addAllToReview')}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={studyBatch.length === 0}
                  onClick={() =>
                    navigate(
                      `/memorize?text=${encodeURIComponent(text.id)}&from=${studyBatch[0]}&to=${studyBatch[studyBatch.length - 1]}`,
                    )
                  }
                >
                  {t('text.study', { count: studyBatch.length })}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={reviewIndices.size === 0}
                  onClick={() => navigate(`/practise?text=${encodeURIComponent(text.id)}`)}
                >
                  {t('text.reviewNow', { count: reviewIndices.size })}
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Ayah({
  segment,
  text,
  planned,
  selected,
  onToggle,
  onAdd,
  glossOpen,
  onGloss,
  twins,
  twinsOpen,
  onTwins,
  audio,
}: {
  segment: SegmentRecord
  text: TextRecord
  planned: boolean
  selected: boolean
  onToggle: () => void
  onAdd: () => void
  glossOpen: boolean
  onGloss: () => void
  twins: ResolvedMatch[]
  twinsOpen: boolean
  onTwins: () => void
  audio: ReturnType<typeof useAudio>
}) {
  const settings = useSettings()
  const t = useT()
  const meaning = resolveMeaning(segment, text, settings)
  const translit = resolveTransliteration(segment, text, settings)
  const playing = audio.playingIndex === segment.index

  return (
    <li className="py-5">
      <div className="mb-2 flex items-center gap-2">
        <label className="flex min-h-[44px] items-center gap-2 text-micro text-ink-soft">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-4 w-4 accent-[rgb(var(--focus))]"
            aria-label={`Select ${segment.ref ?? segment.index + 1}`}
          />
          {segment.ref ?? segment.index + 1}
        </label>
        {planned && <span className="text-micro text-verified">✓</span>}
        <span className="ms-auto flex items-center gap-1">
          {segment.audio && audio.available && (
            <button
              type="button"
              className="btn-text"
              onClick={() => audio.playSegment(segment)}
              aria-label={playing ? t('text.stop') : `${t('text.play')} ${segment.ref ?? segment.index + 1}`}
            >
              {playing ? '■' : '▶'}
            </button>
          )}
          {segment.words && segment.words.length > 0 && (
            <button type="button" className="btn-text" onClick={onGloss} aria-expanded={glossOpen}>
              {t('text.words')}
            </button>
          )}
          {!planned && (
            <button type="button" className="btn-text" onClick={onAdd}>
              {t('text.addOne')}
            </button>
          )}
        </span>
      </div>

      <InkText
        text={segment.content}
        words={segmentWords(segment)}
        level={0}
        dir={text.dir}
        lang={text.lang}
        className={passageClass(text)}
        activeWordIndex={playing ? audio.activeWord : null}
      />

      <Transliteration
        line={translit}
        activeWordIndex={playing ? audio.activeWord : null}
        className="mt-2"
      />

      {settings.showTranslationTr && meaning.tr && (
        <p className="meaning mt-3">{meaning.tr.text}</p>
      )}
      {settings.showTranslationEn && meaning.en && (
        <p className="meaning mt-2">{meaning.en.text}</p>
      )}

      {twins.length > 0 && (
        <button
          type="button"
          onClick={onTwins}
          aria-expanded={twinsOpen}
          className="mt-2 text-micro text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {t('review.confusedWith')}{' '}
          {twins
            .slice(0, 3)
            .map((t) => t.segment.ref ?? t.segment.index + 1)
            .join(', ')}
          {twins.length > 3 && ` +${twins.length - 3}`}
        </button>
      )}

      {twinsOpen && (
        <SimilarPassages matches={twins} compact />
      )}

      {glossOpen && segment.words && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3" dir={text.dir}>
          {segment.words.map((w, i) => (
            <span key={i} className="text-center">
              <span className={`block ${wordClass(text)}`}>{w.ar}</span>
              {w.translit && (
                <span className="block text-micro text-ink-soft" dir="ltr">
                  {w.translit}
                </span>
              )}
              {w.en && (
                <span className="block text-micro text-ink-soft/70" dir="ltr">
                  {w.en}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex min-h-[44px] items-center gap-2 text-small text-ink-soft">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[rgb(var(--focus))]"
      />
      {label}
    </label>
  )
}
