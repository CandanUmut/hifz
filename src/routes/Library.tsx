import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { deriveIntent, tiersFromItems } from '@/db/repo'
import { EvidenceChip, IntentBadge } from '@/components/StatusBadges'
import { HeatLegend, HeatStrip } from '@/components/HeatStrip'
import { listPacks, loadManifest, type PackIndexEntry, type PackManifest } from '@/packs/loader'
import { tierRank } from '@/engine/evidence'
import { useT } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import type { EvidenceTier, ItemRecord } from '@/engine/types'

type Filter = 'all' | 'in_plan' | 'weak' | 'unchecked'
type Sort = 'order' | 'weakest' | 'checked'

const FILTERS: { id: Filter; key: StringKey }[] = [
  { id: 'all', key: 'library.filter.all' },
  { id: 'in_plan', key: 'library.filter.inPlan' },
  { id: 'weak', key: 'library.filter.weak' },
  { id: 'unchecked', key: 'library.filter.unchecked' },
]

const SORTS: { id: Sort; key: StringKey }[] = [
  { id: 'order', key: 'library.sort.order' },
  { id: 'weakest', key: 'library.sort.weakest' },
  { id: 'checked', key: 'library.sort.checked' },
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
  const t = useT()

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

  // The colour key means something only once something has been graded.
  const anyEvidence = useMemo(
    () => [...(local?.byText.values() ?? [])].some((list) => list.some((i) => i.lastEvidence)),
    [local],
  )

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
      <h1 className="text-large font-medium">{t('library.title')}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Full width, so the last filter is never clipped behind the sort. */}
        <div className="-mx-1 flex w-full gap-1 overflow-x-auto px-1" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={[
                'min-h-[44px] shrink-0 rounded-md px-3 text-small',
                filter === f.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
        <label className="ms-auto flex shrink-0 items-center gap-2 text-micro text-ink-soft">
          <span className="sr-only">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-[44px] rounded-md border border-rule bg-paper-raised px-2 text-micro"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* The key explains colours nobody has earned yet on a first visit. */}
      {anyEvidence && (
        <div className="mt-4">
          <HeatLegend />
        </div>
      )}

      {error && (
        <p className="mt-6 text-small text-correction">{error}</p>
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
          <h2 className="text-base font-medium">{t('library.mine')}</h2>
          <Link to="/add" className="btn-text ms-auto">
            {t('library.addText')}
          </Link>
        </div>
        {userRows.length === 0 ? (
          <p className="mt-2 text-small text-ink-soft">{t('library.noneOfMine')}</p>
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
  const t = useT()

  return (
    <div className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-medium">{manifest.title}</h2>
        <p className="text-micro text-ink-soft">{manifest.subtitle}</p>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-small text-ink-soft">{t('library.noMatch')}</p>
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
  const t = useT()
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
            {t(row.packEntry ? 'library.segments' : 'library.segmentsGeneric', {
              count: row.segmentCount,
            })}
            {inPlan > 0 && ` · ${t('library.inPlan', { count: inPlan })}`}
          </span>
          {/* A row of empty squares for a surah nobody has opened says nothing
              and takes two lines to say it. */}
          {inPlan > 0 && (
            <span className="ms-auto">
              <HeatStrip count={row.segmentCount} tiers={tiers} />
            </span>
          )}
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
