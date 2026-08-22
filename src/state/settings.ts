import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeChoice = 'auto' | 'gunduz' | 'gece'
export type UiLang = 'tr' | 'en'
/**
 * Two ways to answer, and that is deliberate. Typing first letters and tapping
 * words into order were dropped: they tested spelling and layout memory rather
 * than recall, and they made the screen unreadable.
 */
export type ResponseMode = 'self_grade' | 'recite_asr'

export interface Settings {
  /** null until the reader has picked one — that is what triggers the chooser. */
  lang: UiLang | null
  /** Whether the three-screen explanation has been seen. */
  introSeen: boolean
  theme: ThemeChoice
  /** Translation edition ids as they appear in a pack's `translations` map. */
  trEdition: string
  enEdition: string
  /** FSRS desired retention, 0.85–0.95. */
  desiredRetention: number
  dailyNewCap: number
  /** How many ayah one memorisation sitting covers. */
  /** Remembered per user on the text detail page. */
  showTranslationTr: boolean
  showTranslationEn: boolean
  showTransliteration: boolean
  /** Which transliteration edition, from a pack's `transliterations`. */
  translitEdition: string
}

export const DEFAULT_SETTINGS: Settings = {
  lang: null,
  introSeen: false,
  theme: 'auto',
  trEdition: 'elmalili-sadelestirilmis',
  enEdition: 'clear-quran',
  desiredRetention: 0.9,
  dailyNewCap: 10,
  showTranslationTr: true,
  showTranslationEn: false,
  showTransliteration: true,
  translitEdition: 'easy',
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  /** The interface language, and the translations that go with it. */
  chooseLang: (lang: UiLang) => void
  replaceAll: (settings: Partial<Settings>) => void
  reset: () => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      /*
       * Picking English used to leave the Turkish translation switched on
       * under every ayah, because the language choice and the translation
       * choice were unrelated settings. They are the same choice to the reader.
       */
      chooseLang: (lang) =>
        set({ lang, showTranslationTr: lang === 'tr', showTranslationEn: lang === 'en' }),
      replaceAll: (settings) => set({ ...DEFAULT_SETTINGS, ...settings }),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'hifz.settings', version: 1 },
  ),
)

/**
 * Tells the document which language it is in.
 *
 * Not cosmetic: CSS `text-transform: uppercase` is language sensitive, and
 * without this the Turkish label "Dinle" uppercased to DINLE instead of DİNLE.
 */
export function applyLang(lang: UiLang | null) {
  document.documentElement.setAttribute('lang', lang ?? 'en')
}

/** Applies the theme choice to the document. Auto follows the OS. */
export function applyTheme(choice: ThemeChoice) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme = choice === 'auto' ? (dark ? 'gece' : 'gunduz') : choice
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem('hifz.theme', choice)
  } catch {
    /* private mode — the in-memory theme still applies */
  }
}
