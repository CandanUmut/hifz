import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { clusters, getInterferenceGraph, type Cluster } from '@/engine/similarity'
import type { ResolvedMatch } from '@/components/SimilarPassages'

/**
 * The interference graph over the texts on this device, resolved to records
 * the screens can render. It is memoised on the segment set, so opening a new
 * surah rebuilds it and nothing else does.
 */
export function useInterference() {
  const data = useLiveQuery(async () => {
    const [segments, texts] = await Promise.all([db.segments.toArray(), db.texts.toArray()])
    segments.sort((a, b) => a.textId.localeCompare(b.textId) || a.index - b.index)
    return {
      graph: getInterferenceGraph(segments),
      segments: new Map(segments.map((s) => [s.id, s])),
      texts: new Map(texts.map((t) => [t.id, t])),
    }
  }, [])

  const resolve = useCallback(
    (segmentId: string | undefined): ResolvedMatch[] => {
      if (!data || !segmentId) return []
      return (data.graph.get(segmentId) ?? []).flatMap((match) => {
        const segment = data.segments.get(match.segmentId)
        const text = segment ? data.texts.get(segment.textId) : undefined
        return segment && text ? [{ ...match, segment, text }] : []
      })
    },
    [data],
  )

  const groups: Cluster[] = useMemo(() => (data ? clusters(data.graph) : []), [data])

  return { ready: !!data, resolve, groups, segments: data?.segments, texts: data?.texts }
}
