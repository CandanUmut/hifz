import { Link } from 'react-router-dom'
import { InkText } from './InkText'
import type { Match } from '@/engine/similarity'
import type { SegmentRecord, TextRecord } from '@/engine/types'
import { segmentWords } from '@/lib/text'
import { passageClassSmall } from '@/lib/typography'

export interface ResolvedMatch extends Match {
  segment: SegmentRecord
  text: TextRecord
}

/**
 * The passages a line is easily confused with, with the words that actually
 * differ picked out. Highlighted in --focus, never --correction: nobody has
 * made a mistake here, this is the thing to pay attention to.
 */
export function SimilarPassages({
  matches,
  /** Word positions in the line the reader is looking at that differ. */
  ownDiffering,
  compact = false,
}: {
  matches: ResolvedMatch[]
  ownDiffering?: number[]
  compact?: boolean
}) {
  if (!matches.length) return null

  return (
    <section className={compact ? 'mt-3' : 'mt-8 border-t border-rule pt-5'}>
      {/* Nested under a row that already says what this is, the heading is noise. */}
      {!compact && (
        <>
          <h3 className="label mb-1">
            {matches.length === 1 ? 'Easily confused with' : 'Easily confused with these'}
          </h3>
          <p className="mb-4 text-micro text-ink-soft">
            {ownDiffering && ownDiffering.length > 0
              ? 'The words that tell them apart are marked.'
              : 'These read the same. The order they come in is the only thing separating them.'}
          </p>
        </>
      )}

      <ul className="space-y-5">
        {matches.map((match) => (
          <li key={match.segmentId}>
            <div className="mb-1 flex items-baseline gap-2">
              <Link
                to={`/text/${encodeURIComponent(match.text.id)}`}
                className="text-small underline-offset-4 hover:underline"
              >
                {match.text.title} {match.segment.ref ?? match.segment.index + 1}
              </Link>
              <span className="text-micro text-ink-soft">
                {match.identical ? 'word for word the same' : `${Math.round(match.score * 100)}% alike`}
              </span>
            </div>
            <InkText
              text={match.segment.content}
              words={segmentWords(match.segment)}
              level={0}
              dir={match.text.dir}
              lang={match.text.lang}
              className={passageClassSmall(match.text)}
              focusWordIndices={match.otherDiffering}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
