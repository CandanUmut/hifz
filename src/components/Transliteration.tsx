import type { ResolvedTransliteration } from '@/lib/translations'

/**
 * The line in Latin script. When the word-aligned edition is selected it has
 * exactly one token per Arabic word, so it can follow the recitation the same
 * way the Arabic does.
 */
export function Transliteration({
  line,
  activeWordIndex = null,
  className = '',
}: {
  line: ResolvedTransliteration | undefined
  activeWordIndex?: number | null
  className?: string
}) {
  if (!line) return null

  if (!line.aligned || activeWordIndex == null) {
    return (
      <p dir="ltr" lang="en" className={`translit ${className}`}>
        {line.text}
      </p>
    )
  }

  return (
    <p dir="ltr" lang="en" className={`translit ${className}`}>
      {line.text.split(/\s+/).map((token, i) => (
        <span key={i}>
          {i === activeWordIndex ? <em>{token}</em> : token}
          {' '}
        </span>
      ))}
    </p>
  )
}
