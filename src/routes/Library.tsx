import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { deriveIntent, tiersFromItems } from '@/db/repo'
import { EvidenceChip, IntentBadge } from '@/components/StatusBadges'
import { HeatLegend, HeatStrip } from '@/components/HeatStrip'
import { listPacks, loadManifest, type PackIndexEntry, type PackManifest } from '@/packs/loader'
import { tierRank } from '@/engine/evidence'
import type { EvidenceTier, ItemRecord } from '@/engine/types'

type Filter = 'all' | 'in_plan' | 'weak' | 'unchecked'
type Sort = 'order' | 'weakest' | 'checked'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_plan', label: 'In plan' },
  { id: 'weak', label: 'Weak' },
  { id: 'unchecked', label: 'Not checked' },
]

const SORTS: { id: Sort; label: string }[] = [
  { id: 'order', label: 'In order' },
  { id: 'weakest', label: 'Weakest first' },
  { id: 'checked', label: 'Last checked' },
]

interface Row {
  id: string
  index: number
  title: string
  titleTr: string
  segmentCount: number
  packEntry?: PackIndexEntry
  file?: string
  items: ItemRecord[]
}

export default function Library() {
  const [packs, setPacks] = useState<{ entry: PackIndexEntry; manifest: PackManifest }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('order')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const index = await listPacks()
        const loaded = await Promise.all(
          index.packs.map(async (entry) => ({ entry, manifest: await loadManifest(entry) })),
        )
        if (!cancelled) setPacks(loaded)
      } catch (err) {
        if (!cancelled) setError(String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const local = useLiveQuery(async () => {
    const [texts, items] = await Promise.all([db.texts.toArray(), db.items.toArray()])
    const byText = new Map<string, ItemRecord[]>()
    for (const item of items) {
      const list = byText.get(item.textId) ?? []
      list.push(item)
      byText.set(item.textId, list)
    }
    return { texts, byText }
  }, [])

  const userRows: Row[] = useMemo(() => {
    if (!local) return []
    return local.texts
      .filter((t) => t.source === 'user')
      .map((t) => ({
        id: t.id,
        index: 0,
        title: t.title,
        titleTr: '',
        segmentCount: t.segmentCount,
        items: local.byText.get(t.id) ?? [],
      }))
  }, [local])

  return (
    <section>
      <h1 className="text-large font-medium">Library</h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={[
                'min-h-[44px] rounded-md px-3 text-small',
                filter === f.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="ms-auto flex items-center gap-2 text-micro text-ink-soft">
          <span className="sr-only">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-[44px] rounded-md border border-rule bg-paper-raised px-2 text-micro"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <HeatLegend />
      </div>

      {error && (
        <p className="mt-6 text-small text-correction">Could not load the packs: {error}</p>
      )}

      {packs.map(({ entry, manifest }) => (
        <PackSection
          key={entry.id}
          entry={entry}
          manifest={manifest}
          byText={local?.byText ?? new Map()}
          filter={filter}
          sort={sort}
        />
      ))}

      <div className="mt-12">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-medium">My texts</h2>
          <Link to="/add" className="btn-text ms-auto">
            Add a text
          </Link>
        </div>
        {userRows.length === 0 ? (
          <p className="mt-2 text-small text-ink-soft">
            Nothing of your own yet. A poem, a duʿāʾ, a speech — anything works.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {filterRows(userRows, filter)
              .sort(sorter(sort))
              .map((row) => (
                <TextRow key={row.id} row={row} />
              ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function PackSection({
  entry,
  manifest,
  byText,
  filter,
  sort,
}: {
  entry: PackIndexEntry
  manifest: PackManifest
  byText: Map<string, ItemRecord[]>
  filter: Filter
  sort: Sort
}) {
  const rows: Row[] = manifest.texts.map((t) => ({
    id: t.id,
    index: t.index,
    title: t.title,
    titleTr: t.titleTr,
    segmentCount: t.segmentCount,
    packEntry: entry,
    file: t.file,
    items: byText.get(t.id) ?? [],
  }))

  const shown = filterRows(rows, filter).sort(sorter(sort))

  return (
    <div className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-medium">{manifest.title}</h2>
        <p className="text-micro text-ink-soft">{manifest.subtitle}</p>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-small text-ink-soft">Nothing here matches that filter.</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {shown.map((row) => (
            <TextRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TextRow({ row }: { row: Row }) {
  const tiers = tiersFromItems(row.items)
  const intent = deriveIntent(row.items)
  const inPlan = new Set(row.items.map((i) => i.segmentId)).size
  const last = row.items
    .filter((i) => i.lastEvidence)
    .sort((a, b) => (b.lastEvidence?.at ?? 0) - (a.lastEvidence?.at ?? 0))[0]?.lastEvidence

  const to = `/text/${encodeURIComponent(row.id)}${
    row.packEntry ? `?pack=${encodeURIComponent(row.packEntry.id)}&file=${row.file}` : ''
  }`

  return (
    <li>
      <Link to={to} className="block py-3">
        <div className="flex items-baseline gap-2">
          {row.index > 0 && <span className="text-micro tabular-nums text-ink-soft">{row.index}</span>}
          <span className="text-base">{row.title}</span>
          {row.titleTr && <span className="text-small text-ink-soft">{row.titleTr}</span>}
          <span className="ms-auto">
            <IntentBadge intent={intent} />
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-micro text-ink-soft">
            {row.segmentCount} {row.segmentCount === 1 ? 'segment' : 'segments'}
            {inPlan > 0 && ` · ${inPlan} in plan`}
          </span>
          <span className="ms-auto">
            <HeatStrip count={row.segmentCount} tiers={tiers} />
          </span>
        </div>
        {last && (
          <div className="mt-1.5 flex justify-end">
            <EvidenceChip last={last} />
          </div>
        )}
      </Link>
    </li>
  )
}

// --- filtering and sorting -------------------------------------------------

function weakestTier(items: ItemRecord[]): EvidenceTier | null {
  const tiers = [...tiersFromItems(items).values()]
  if (!tiers.length) return null
  return tiers.reduce((a, b) => (tierRank(a) <= tierRank(b) ? a : b))
}

function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === 'all') return rows
  if (filter === 'in_plan') return rows.filter((r) => r.items.length > 0)
  if (filter === 'weak') return rows.filter((r) => weakestTier(r.items) === 'weak')
  return rows.filter((r) => r.items.length > 0 && r.items.some((i) => !i.lastEvidence))
}

function lastCheckedAt(row: Row): number {
  return row.items.reduce((max, i) => Math.max(max, i.lastEvidence?.at ?? 0), 0)
}

function sorter(sort: Sort) {
  if (sort === 'weakest') {
    return (a: Row, b: Row) => {
      const ta = weakestTier(a.items)
      const tb = weakestTier(b.items)
      if (ta === tb) return a.index - b.index
      if (ta == null) return 1
      if (tb == null) return -1
      return tierRank(ta) - tierRank(tb)
    }
  }
  if (sort === 'checked') return (a: Row, b: Row) => lastCheckedAt(b) - lastCheckedAt(a)
  return (a: Row, b: Row) => a.index - b.index
}
