import Dexie, { type EntityTable } from 'dexie'
import type {
  AttemptRecord,
  ColdCheckRun,
  EvidenceRecord,
  ItemRecord,
  SegmentRecord,
  TextRecord,
} from '@/engine/types'

/**
 * Everything lives here, on the device. There is no server in v0 and the data
 * model does not assume one arrives later beyond carrying stable string ids.
 */
export class HifzDB extends Dexie {
  texts!: EntityTable<TextRecord, 'id'>
  segments!: EntityTable<SegmentRecord, 'id'>
  items!: EntityTable<ItemRecord, 'id'>
  attempts!: EntityTable<AttemptRecord, 'id'>
  evidence!: EntityTable<EvidenceRecord, 'id'>
  coldChecks!: EntityTable<ColdCheckRun, 'id'>

  constructor() {
    super('hifz')
    this.version(1).stores({
      texts: 'id, source, packId, createdAt',
      segments: 'id, textId, [textId+index]',
      items: 'id, textId, segmentId, type, due, intent, [textId+type]',
      attempts: 'id, itemId, at',
      evidence: 'id, itemId, at',
      coldChecks: 'id, at',
    })

    // Everything that already existed was in the review queue, so that is
    // where it stays; nobody's schedule changes underneath them.
    this.version(2)
      .stores({
        items: 'id, textId, segmentId, type, due, intent, stage, [textId+type], [textId+stage]',
      })
      .upgrade((tx) =>
        tx
          .table('items')
          .toCollection()
          .modify((item) => {
            item.stage = 'review'
          }),
      )

    /*
     * One pack for the whole muṣḥaf, and ids that no longer name a pack.
     *
     * There used to be three overlapping packs, so surah 112 was
     * `quran-juz-amma:112` in one and `quran-all:112` in another, and progress
     * made on one copy was invisible on the other. Ids are now `quran:112`,
     * and anything already on this device is carried across rather than
     * stranded — item ids are their own uuids, so only the text and segment
     * references need rewriting.
     */
    this.version(3).upgrade(async (tx) => {
      const rename = (id: string) =>
        id.replace(/^quran-(juz-amma|al-fatiha|all):/, 'quran:')

      const texts = await tx.table('texts').toArray()
      for (const text of texts) {
        const id = rename(text.id)
        if (id === text.id) continue
        await tx.table('texts').delete(text.id)
        await tx.table('texts').put({ ...text, id, packId: 'quran' })
      }

      const segments = await tx.table('segments').toArray()
      for (const segment of segments) {
        const id = rename(segment.id)
        if (id === segment.id) continue
        await tx.table('segments').delete(segment.id)
        await tx.table('segments').put({ ...segment, id, textId: rename(segment.textId) })
      }

      await tx
        .table('items')
        .toCollection()
        .modify((item) => {
          item.textId = rename(item.textId)
          item.segmentId = rename(item.segmentId)
          if (item.nextSegmentId) item.nextSegmentId = rename(item.nextSegmentId)
        })
    })
  }
}

export const db = new HifzDB()

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
