/**
 * Reading a passage with the voice the browser already has.
 *
 * The packs carry a recitation for every ayah, but a text you typed in
 * yourself carries nothing — and the Play button sat there doing nothing at
 * all, which is worse than not offering it. Every browser ships a speech
 * synthesiser; it is not a qāri', and for Arabic it may not even be installed,
 * but it can read your own text back to you, and that is what the button
 * promised.
 */

export interface SpeakHandle {
  cancel(): void
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Where each word starts in the text, so a boundary event can be turned into
 * a word to highlight. Words are matched in order; anything the tokenisation
 * disagrees about is simply skipped rather than shifting everything after it.
 */
function wordOffsets(text: string, words: string[]): number[] {
  const offsets: number[] = []
  let at = 0
  for (const word of words) {
    const found = text.indexOf(word, at)
    if (found < 0) {
      offsets.push(-1)
      continue
    }
    offsets.push(found)
    at = found + word.length
  }
  return offsets
}

/** The best installed voice for a language, or none — `lang` alone still works. */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  // Never awaited: waiting for `voiceschanged` would leave the user's tap
  // behind, and Safari refuses to speak outside a gesture.
  const voices = window.speechSynthesis.getVoices?.() ?? []
  const base = lang.split('-')[0].toLowerCase()
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(`${base}-`)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  )
}

export function speak({
  text,
  lang = 'ar',
  words,
  rate = 0.8,
  onWord,
  onEnd,
}: {
  text: string
  lang?: string
  words?: string[]
  /** Recitation pace, not conversation pace. */
  rate?: number
  onWord?: (index: number | null) => void
  onEnd?: () => void
}): SpeakHandle | null {
  if (!speechAvailable() || !text.trim()) return null

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = rate
  const voice = pickVoice(lang)
  if (voice) utterance.voice = voice

  if (words?.length && onWord) {
    const offsets = wordOffsets(text, words)
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return
      // The last word whose start the reader has reached.
      let index: number | null = null
      for (let i = 0; i < offsets.length; i++) {
        if (offsets[i] >= 0 && offsets[i] <= event.charIndex) index = i
      }
      onWord(index)
    }
  }

  let done = false
  const finish = () => {
    if (done) return
    done = true
    onWord?.(null)
    onEnd?.()
  }
  utterance.onend = finish
  utterance.onerror = finish

  synth.speak(utterance)

  return {
    cancel() {
      done = true
      utterance.onend = null
      utterance.onerror = null
      utterance.onboundary = null
      synth.cancel()
    },
  }
}

export function cancelSpeech(): void {
  if (speechAvailable()) window.speechSynthesis.cancel()
}
