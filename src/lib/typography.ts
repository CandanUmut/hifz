import type { TextRecord } from '@/engine/types'

/**
 * Scripture gets the Uthmanic face; anything else gets the book face. A poem
 * in Latin script rendered in a Qur'an font would fall through to whatever
 * serif happened to be around, which is worse than choosing one.
 */
export function isScripture(text: Pick<TextRecord, 'source' | 'lang'> | undefined): boolean {
  return text?.source === 'pack' && text.lang === 'ar'
}

/** Class for a whole passage — always the largest thing on screen. */
export function passageClass(text: Pick<TextRecord, 'source' | 'lang'> | undefined): string {
  return isScripture(text) ? 'sacred' : 'passage'
}

/** Same, one step down, for a line shown alongside something else. */
export function passageClassSmall(text: Pick<TextRecord, 'source' | 'lang'> | undefined): string {
  return isScripture(text) ? 'sacred sacred-sm' : 'passage passage-sm'
}

/** Class for a single word shown on its own: a chip, a slot, a gloss. */
export function wordClass(text: Pick<TextRecord, 'source' | 'lang'> | undefined): string {
  return isScripture(text)
    ? 'font-sacred text-[24px] leading-[1.9]'
    : 'font-meaning text-[20px] leading-[1.5]'
}
