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
  }
}

export const db = new HifzDB()

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
