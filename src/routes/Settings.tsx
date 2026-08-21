import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { deleteAll, exportAll } from '@/db/repo'
import type { EditionInfo, TransliterationInfo } from '@/engine/types'
import { useT } from '@/i18n'
import { ASR_MODEL_MB } from '@/lib/asr-model'
import { useInstallPrompt } from '@/lib/useInstallPrompt'
import { useSettings, type ThemeChoice, type UiLang } from '@/state/settings'

/**
 * Deliberately short. The previous version offered a scheduling retention
 * slider, a hint-aggressiveness ramp and four answer modes; none of it meant
 * anything to someone trying to memorise a surah, and all of it was in the way.
 */
export default function Settings() {
  const settings = useSettings()
  const set = useSettings((s) => s.set)
  const t = useT()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const install = useInstallPrompt()

  const packs = useLiveQuery(async () => {
    const texts = await db.texts.toArray()
    const editions = new Map<string, EditionInfo>()
    for (const text of texts) for (const e of text.editions ?? []) editions.set(e.id, e)
    const translits = new Map<string, TransliterationInfo>()
    for (const text of texts)
      for (const e of text.transliterationEditions ?? []) translits.set(e.id, e)
    return {
      tr: [...editions.values()].filter((e) => e.lang === 'tr'),
      en: [...editions.values()].filter((e) => e.lang === 'en'),
      translits: [...translits.values()],
      reciter: texts.find((x) => x.reciter)?.reciter,
    }
  }, [])

  const download = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hifz-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-10">
      <h1 className="text-large font-medium">{t('settings.title')}</h1>

      <Group title={t('settings.language')}>
        <Row>
          {(['tr', 'en'] as UiLang[]).map((lang) => (
            <Pick
              key={lang}
              active={settings.lang === lang}
              onClick={() => set('lang', lang)}
              label={lang === 'tr' ? t('lang.turkish') : t('lang.english')}
            />
          ))}
        </Row>
      </Group>

      <Group title={t('settings.appearance')}>
        <Row>
          {(
            [
              ['auto', t('settings.theme.auto')],
              ['gunduz', t('settings.theme.light')],
              ['gece', t('settings.theme.dark')],
            ] as [ThemeChoice, string][]
          ).map(([id, label]) => (
            <Pick
              key={id}
              active={settings.theme === id}
              onClick={() => set('theme', id)}
              label={label}
            />
          ))}
        </Row>
      </Group>

      <Group title={t('settings.meanings')}>
        <Select
          label={t('settings.trEdition')}
          value={settings.trEdition}
          options={(packs?.tr ?? []).map((e) => ({ value: e.id, label: e.title }))}
          onChange={(v) => set('trEdition', v)}
          empty={t('settings.editionsLater')}
        />
        <Select
          label={t('settings.enEdition')}
          value={settings.enEdition}
          options={(packs?.en ?? []).map((e) => ({ value: e.id, label: e.title }))}
          onChange={(v) => set('enEdition', v)}
          empty={t('settings.editionsLater')}
        />
      </Group>

      <Group title={t('settings.transliteration')}>
        <Check
          checked={settings.showTransliteration}
          onChange={(v) => set('showTransliteration', v)}
          label={t('settings.showTranslit')}
        />
        {settings.showTransliteration && (packs?.translits.length ?? 0) > 0 && (
          <Row className="mt-3">
            {(packs?.translits ?? []).map((option) => (
              <Pick
                key={option.id}
                active={settings.translitEdition === option.id}
                onClick={() => set('translitEdition', option.id)}
                label={option.title}
              />
            ))}
          </Row>
        )}
        <Note>{t('settings.translitNote')}</Note>
      </Group>

      <Group title={t('settings.reciteGroup')}>
        <Note>{t('settings.reciteNote', { mb: ASR_MODEL_MB })}</Note>
      </Group>

      <Group title={t('settings.pace')}>
        <label className="block">
          <span className="text-small">
            {t('settings.newPerDay', { count: settings.dailyNewCap })}
          </span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={settings.dailyNewCap}
            onChange={(e) => set('dailyNewCap', Number(e.target.value))}
            className="mt-2 w-full accent-[rgb(var(--focus))]"
          />
        </label>
        <Note>{t('settings.newPerDayNote')}</Note>
      </Group>

      {packs?.reciter && (
        <Group title={t('settings.audio')}>
          <p className="text-small">{packs.reciter}</p>
          <Note>{t('settings.audioNote')}</Note>
        </Group>
      )}

      <Group title={t('settings.install')}>
        {install.installed ? (
          <p className="text-small text-ink-soft">{t('settings.installed')}</p>
        ) : install.canInstall ? (
          <>
            <p className="text-small text-ink-soft">{t('settings.installBody')}</p>
            <button type="button" className="btn-secondary mt-3" onClick={() => install.install()}>
              {t('settings.installAction')}
            </button>
          </>
        ) : (
          <p className="text-small text-ink-soft">
            {install.needsManualSteps ? t('settings.installIos') : t('settings.installOther')}
          </p>
        )}
        <button
          type="button"
          className="btn-text mt-3 px-0"
          onClick={() => set('introSeen', false)}
        >
          {t('settings.replayIntro')}
        </button>
      </Group>

      <Group title={t('settings.data')}>
        <p className="text-small text-ink-soft">{t('settings.dataNote')}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={download}>
            {t('settings.export')}
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
                {t('settings.deleteConfirm')}
              </button>
              <button type="button" className="btn-text" onClick={() => setConfirmDelete(false)}>
                {t('settings.cancel')}
              </button>
            </>
          ) : (
            <button type="button" className="btn-text" onClick={() => setConfirmDelete(true)}>
              {t('settings.delete')}
            </button>
          )}
        </div>
        {confirmDelete && <p className="mt-2 text-micro text-correction">{t('settings.deleteWarning')}</p>}
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

function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>
}

function Pick({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={active ? 'btn-primary' : 'btn-secondary'}
    >
      {label}
    </button>
  )
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[rgb(var(--focus))]"
      />
      <span className="text-small">{label}</span>
    </label>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-micro text-ink-soft">{children}</p>
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
          className="mt-1 min-h-[44px] w-full rounded-md border border-rule bg-paper-raised px-3 text-small"
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
