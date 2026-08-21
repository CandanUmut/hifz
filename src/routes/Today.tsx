import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import {
  buildQueue,
  coldCheckCandidates,
  estimateSecondsPerItem,
  getSegments,
  studyItems,
  summarise,
} from '@/db/repo'
import { EvidenceChip, IntentBadge } from '@/components/StatusBadges'
import { useSettings } from '@/state/settings'
import { useT } from '@/i18n'

export default function Today() {
  const dailyNewCap = useSettings((s) => s.dailyNewCap)
  const t = useT()

  const data = useLiveQuery(async () => {
    const [queue, cold, seconds, texts, items, waiting] = await Promise.all([
      buildQueue({ dailyNewCap }),
      coldCheckCandidates(),
      estimateSecondsPerItem(),
      db.texts.toArray(),
      db.items.toArray(),
      studyItems(),
    ])

    // The study list, grouped so "continue where you left off" has somewhere
    // to go without the reader hunting for the surah.
    const studyByText = new Map<string, { text: (typeof texts)[number]; indices: number[] }>()
    for (const item of waiting) {
      const text = texts.find((x) => x.id === item.textId)
      if (!text) continue
      const index = Number(item.segmentId.slice(item.segmentId.lastIndexOf('#') + 1))
      const entry = studyByText.get(text.id) ?? { text, indices: [] }
      if (Number.isInteger(index) && !entry.indices.includes(index)) entry.indices.push(index)
      studyByText.set(text.id, entry)
    }
    const study = [...studyByText.values()].map((e) => ({
      ...e,
      indices: e.indices.sort((a, b) => a - b),
    }))

    const byText = new Map<string, typeof items>()
    for (const item of items) {
      const list = byText.get(item.textId) ?? []
      list.push(item)
      byText.set(item.textId, list)
    }

    const learning = []
    for (const text of texts) {
      const own = byText.get(text.id) ?? []
      if (!own.some((i) => i.intent === 'learning')) continue
      learning.push(summarise(text, await getSegments(text.id), own))
    }
    learning.sort((a, b) => b.dueNow - a.dueNow)

    return { queue, cold, seconds, learning, study, hasAnything: items.length > 0 }
  }, [dailyNewCap])

  if (!data) return <p className="text-small text-ink-soft">{t('common.loading')}</p>

  const { queue, cold, seconds, learning, study, hasAnything } = data
  const studyCount = study.reduce((n, e) => n + e.indices.length, 0)
  const minutes = Math.max(1, Math.round((queue.length * seconds) / 60))

  if (!hasAnything) {
    return (
      <section>
        <h1 className="text-display">{t('today.emptyTitle')}</h1>
        <p className="mt-3 text-base text-ink-soft">{t('today.emptyBody')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/library" className="btn-primary py-3">
            {t('today.openQuran')}
          </Link>
          <Link to="/add" className="btn-secondary py-3">
            {t('today.addOwn')}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      {/* Two lists, side by side, neither one pushed on the reader. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <h2 className="label mb-1">{t('today.studyHeading')}</h2>
          <p className="text-base">
            {studyCount > 0
              ? t('today.studyWaiting', { count: studyCount })
              : t('today.nothingToStudy')}
          </p>
          {studyCount > 0 ? (
            <Link
              to={`/memorize?text=${encodeURIComponent(study[0].text.id)}&from=${study[0].indices[0]}&to=${study[0].indices[Math.min(study[0].indices.length, 3) - 1]}`}
              className="btn-primary mt-3 w-full py-3"
            >
              {t('today.studyStart')}
            </Link>
          ) : (
            <Link to="/library" className="btn-secondary mt-3 w-full py-3">
              {t('today.addMore')}
            </Link>
          )}
        </div>

        <div className="card p-4">
          <h2 className="label mb-1">{t('today.reviewHeading')}</h2>
          <p className="text-base">
            {queue.length === 0
              ? t('today.nothingDue')
              : t('today.due', { count: queue.length, minutes })}
          </p>
          {queue.length > 0 && (
            <Link to="/review" className="btn-primary mt-3 w-full py-3">
              {t('today.start')}
            </Link>
          )}
        </div>
      </div>

      {cold.length > 0 && (
        <div className="card mt-8 p-4">
          <p className="text-small">{t('today.coldTitle', { count: cold.length })}</p>
          <Link to="/cold-check" className="btn-secondary mt-3">
            {t('today.coldStart')}
          </Link>
        </div>
      )}

      {learning.length > 0 && (
        <div className="mt-10">
          <h2 className="label mb-3">{t('today.learning')}</h2>
          <ul className="divide-y divide-rule border-y border-rule">
            {learning.slice(0, 5).map((summary) => (
              <li key={summary.text.id}>
                <Link
                  to={`/text/${encodeURIComponent(summary.text.id)}`}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="me-auto min-w-0">
                    <span className="block truncate text-base">{summary.text.title}</span>
                    <span className="mt-1 block">
                      <EvidenceChip last={summary.lastEvidence} />
                    </span>
                  </span>
                  <IntentBadge intent={summary.intent} />
                  {summary.dueNow > 0 && (
                    <span className="text-micro text-ink-soft">
                      {t('today.dueShort', { count: summary.dueNow })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
