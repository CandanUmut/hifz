import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useT } from '@/i18n'
import type { EditionInfo, TransliterationInfo } from '@/engine/types'

/**
 * Where everything came from, in one place.
 *
 * The attribution used to run down the bottom of every surah — most of a
 * screen of licence text under a page whose actual job was to get you
 * memorising, and repeated 114 times. It has to be somewhere; it does not have
 * to be everywhere.
 */
export default function About() {
  const t = useT()

  const credits = useLiveQuery(async () => {
    const texts = await db.texts.toArray()
    const sources = new Map<string, { source: string; url: string }>()
    const editions = new Map<string, EditionInfo>()
    const translits = new Map<string, TransliterationInfo>()
    const licences = new Set<string>()

    for (const text of texts) {
      if (text.attribution) {
        sources.set(text.attribution.source, {
          source: text.attribution.source,
          url: text.attribution.sourceUrl,
        })
      }
      for (const edition of text.editions ?? []) editions.set(edition.id, edition)
      for (const edition of text.transliterationEditions ?? []) translits.set(edition.id, edition)
      if (text.license) licences.add(text.license)
    }
    return {
      sources: [...sources.values()],
      editions: [...editions.values()],
      translits: [...translits.values()],
      licences: [...licences],
    }
  }, [])

  return (
    <section>
      <h1 className="text-large font-medium">{t('about.title')}</h1>
      <p className="mt-3 text-small text-ink-soft">{t('about.what')}</p>

      <Group title={t('about.privacy')}>
        <p>{t('about.privacyBody')}</p>
      </Group>

      {credits && credits.sources.length > 0 && (
        <Group title={t('about.sources')}>
          {credits.sources.map((source) => (
            <p key={source.source}>
              {source.source}{' '}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2"
              >
                {source.url.replace(/^https?:\/\//, '')}
              </a>
            </p>
          ))}
        </Group>
      )}

      {credits && credits.editions.length > 0 && (
        <Group title={t('about.translations')}>
          {credits.editions.map((edition) => (
            <p key={edition.id}>
              {edition.title} — {edition.translator}
              {edition.license ? ` · ${edition.license}` : ''}
            </p>
          ))}
        </Group>
      )}

      {credits && credits.translits.length > 0 && (
        <Group title={t('about.transliteration')}>
          {credits.translits.map((edition) => (
            <p key={edition.id}>
              {edition.title} — {edition.source}
              {edition.license ? ` · ${edition.license}` : ''}
            </p>
          ))}
        </Group>
      )}

      {credits && credits.licences.length > 0 && (
        <Group title={t('about.licences')}>
          {credits.licences.map((licence) => (
            <p key={licence}>{licence}</p>
          ))}
        </Group>
      )}

      <Group title={t('about.audio')}>
        <p>{t('about.audioBody')}</p>
      </Group>

      <Group title={t('about.code')}>
        <p>
          <a
            href="https://github.com/CandanUmut/hifz"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            github.com/CandanUmut/hifz
          </a>
          {' · MIT'}
        </p>
        {/* Which build this device is running — the first thing worth knowing
            when something is fixed everywhere except on one phone. */}
        <p className="mt-1 tabular-nums">{t('about.build', { id: __BUILD_ID__ })}</p>
      </Group>

      <Link to="/settings" className="btn-secondary mt-8">
        {t('about.backToSettings')}
      </Link>
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="label mb-2">{title}</h2>
      <div className="space-y-1 text-small text-ink-soft">{children}</div>
    </div>
  )
}
