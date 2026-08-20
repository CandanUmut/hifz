import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { SimilarPassages } from '@/components/SimilarPassages'
import { useInterference } from '@/lib/useInterference'
import { db } from '@/db/db'
import { parseSegmentIndex } from '@/db/repo'
import { evidenceTier, TIER_ORDER } from '@/engine/evidence'
import { retrievability } from '@/engine/scheduler'
import type { EvidenceTier } from '@/engine/types'
import { useT } from '@/i18n'

const TONE: Record<EvidenceTier, string> = {
  untested: 'bg-rule',
  weak: 'bg-correction/60',
  fair: 'bg-verified/40',
  strong: 'bg-verified/75',
  cold_verified: 'bg-verified',
}

export default function Progress() {
  const interference = useInterference()
  const [openCluster, setOpenCluster] = useState<string | null>(null)
  const t = useT()

  const data = useLiveQuery(async () => {
    const now = Date.now()
    const [items, texts, coldChecks] = await Promise.all([
      db.items.toArray(),
      db.texts.toArray(),
      db.coldChecks.orderBy('at').toArray(),
    ])
    const titles = new Map(texts.map((t) => [t.id, t.title]))

    const distribution = new Map<EvidenceTier, number>(TIER_ORDER.map((t) => [t, 0]))
    for (const item of items) {
      const tier = evidenceTier(item, now)
      distribution.set(tier, (distribution.get(tier) ?? 0) + 1)
    }

    // The joins are where recitation actually breaks, so they get their own list.
    const weakLinks = items
      .filter((i) => i.type === 'link' && i.intent !== 'paused')
      .map((i) => ({
        item: i,
        r: retrievability(i.fsrs, now),
        title: titles.get(i.textId) ?? 'Text',
        index: parseSegmentIndex(i.segmentId),
      }))
      .sort((a, b) => a.r - b.r)
      .slice(0, 12)

    return { items, distribution, weakLinks, coldChecks }
  }, [])

  if (!data) return <p className="text-small text-ink-soft">{t('common.loading')}</p>

  const { items, distribution, weakLinks, coldChecks } = data
  const total = items.length

  if (total === 0) {
    return (
      <section>
        <h1 className="text-large font-medium">{t('progress.title')}</h1>
        <p className="mt-3 text-small text-ink-soft">{t('progress.empty')}</p>
        <Link to="/library" className="btn-secondary mt-6">
          {t('today.openQuran')}
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-12">
      <div>
        <h1 className="text-large font-medium">{t('progress.title')}</h1>
        <p className="mt-1 text-small text-ink-soft">{t('progress.summary', { count: total })}</p>
      </div>

      <div>
        <h2 className="label mb-3">{t('progress.evidence')}</h2>
        <div className="flex h-4 overflow-hidden rounded-sm border border-rule">
          {TIER_ORDER.map((tier) => {
            const count = distribution.get(tier) ?? 0
            if (!count) return null
            return (
              <span
                key={tier}
                className={TONE[tier]}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${t(`evidence.${tier}`)}: ${count}`}
              />
            )
          })}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-micro text-ink-soft sm:grid-cols-3">
          {TIER_ORDER.map((tier) => (
            <li key={tier} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-[2px] ${TONE[tier]}`} />
              {t(`evidence.${tier}`)}
              <span className="ms-auto tabular-nums">{distribution.get(tier) ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="label mb-3">{t('progress.coldChecks')}</h2>
        {coldChecks.length === 0 ? (
          <p className="text-small text-ink-soft">{t('progress.noColdChecks')}</p>
        ) : (
          <ul className="flex flex-wrap items-end gap-4">
            {coldChecks.map((run) => (
              <li key={run.id} className="text-center">
                <span
                  className="mx-auto block w-8 rounded-sm bg-verified/70"
                  style={{ height: `${8 + (run.passedFirstTime / Math.max(1, run.total)) * 56}px` }}
                  aria-hidden
                />
                <span className="mt-1 block text-micro tabular-nums">
                  {run.passedFirstTime}/{run.total}
                </span>
                <span className="block text-micro text-ink-soft">
                  {new Date(run.at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="label mb-1">{t('progress.lookAlike')}</h2>
        <p className="mb-3 text-micro text-ink-soft">{t('progress.lookAlikeBody')}</p>
        {interference.groups.length === 0 ? (
          <p className="text-small text-ink-soft">{t('progress.noLookAlike')}</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {interference.groups.slice(0, 10).map((cluster) => {
              const key = cluster.segmentIds[0]
              const open = openCluster === key
              const refs = cluster.segmentIds
                .map((id) => {
                  const segment = interference.segments?.get(id)
                  const text = segment ? interference.texts?.get(segment.textId) : undefined
                  return segment && text
                    ? `${text.title} ${segment.ref ?? segment.index + 1}`
                    : null
                })
                .filter(Boolean)
              return (
                <li key={key} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenCluster(open ? null : key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 text-start"
                  >
                    <span className="me-auto min-w-0 text-small">{refs.join('  ·  ')}</span>
                    <span className="shrink-0 text-micro tabular-nums text-ink-soft">
                      {cluster.score === 1
                        ? t('progress.identical')
                        : t('progress.alike', { percent: Math.round(cluster.score * 100) })}
                    </span>
                  </button>
                  {open && (
                    <SimilarPassages matches={interference.resolve(key)} compact />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="label mb-1">{t('progress.weakJoins')}</h2>
        <p className="mb-3 text-micro text-ink-soft">{t('progress.weakJoinsBody')}</p>
        {weakLinks.length === 0 ? (
          <p className="text-small text-ink-soft">{t('progress.noJoins')}</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {weakLinks.map(({ item, r, title, index }) => (
              <li key={item.id}>
                <Link
                  to={`/review?item=${encodeURIComponent(item.id)}`}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="me-auto min-w-0 truncate text-small">
                    {title}
                    {index != null && (
                      <span className="text-ink-soft">
                        {' '}
                        {index + 1} → {index + 2}
                      </span>
                    )}
                  </span>
                  <span className="text-micro tabular-nums text-ink-soft">
                    {item.lastEvidence ? `${Math.round(r * 100)}%` : t('progress.notChecked')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
