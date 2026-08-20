import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { parseSegmentIndex } from '@/db/repo'
import { evidenceTier, TIER_ORDER } from '@/engine/evidence'
import { retrievability } from '@/engine/scheduler'
import { EVIDENCE_LABELS, type EvidenceTier } from '@/engine/types'

const TONE: Record<EvidenceTier, string> = {
  untested: 'bg-rule',
  weak: 'bg-correction/60',
  fair: 'bg-verified/40',
  strong: 'bg-verified/75',
  cold_verified: 'bg-verified',
}

export default function Progress() {
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

  if (!data) return <p className="text-small text-ink-soft">Loading…</p>

  const { items, distribution, weakLinks, coldChecks } = data
  const total = items.length

  if (total === 0) {
    return (
      <section>
        <h1 className="text-large font-medium">Progress</h1>
        <p className="mt-3 text-small text-ink-soft">
          Nothing in your plan yet, so there is nothing honest to show.
        </p>
        <Link to="/library" className="btn-secondary mt-6">
          Open the library
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-12">
      <div>
        <h1 className="text-large font-medium">Progress</h1>
        <p className="mt-1 text-small text-ink-soft">
          {total} items in plan. No streaks here — the cold check is the number that counts.
        </p>
      </div>

      <div>
        <h2 className="label mb-3">Evidence</h2>
        <div className="flex h-4 overflow-hidden rounded-sm border border-rule">
          {TIER_ORDER.map((tier) => {
            const count = distribution.get(tier) ?? 0
            if (!count) return null
            return (
              <span
                key={tier}
                className={TONE[tier]}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${EVIDENCE_LABELS[tier]}: ${count}`}
              />
            )
          })}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-micro text-ink-soft sm:grid-cols-3">
          {TIER_ORDER.map((tier) => (
            <li key={tier} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-[2px] ${TONE[tier]}`} />
              {EVIDENCE_LABELS[tier]}
              <span className="ms-auto tabular-nums">{distribution.get(tier) ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="label mb-3">Cold checks</h2>
        {coldChecks.length === 0 ? (
          <p className="text-small text-ink-soft">
            None yet. One is offered when something has been left alone for a month.
          </p>
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
        <h2 className="label mb-1">Weak links</h2>
        <p className="mb-3 text-micro text-ink-soft">
          The joins most likely to break next. Each one opens straight into practising it.
        </p>
        {weakLinks.length === 0 ? (
          <p className="text-small text-ink-soft">No joins in your plan yet.</p>
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
                    {item.lastEvidence ? `${Math.round(r * 100)}%` : 'not checked'}
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
