import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeChoice = 'auto' | 'gunduz' | 'gece'
export type ResponseMode = 'self_grade' | 'order_tap' | 'type_initials'
export type HintAggressiveness = 'gentle' | 'normal' | 'steep'

export interface Settings {
  theme: ThemeChoice
  /** Translation edition ids as they appear in a pack's `translations` map. */
  trEdition: string
  enEdition: string
  defaultResponseMode: ResponseMode
  /** FSRS desired retention, 0.85–0.95. */
  desiredRetention: number
  dailyNewCap: number
  reciterId: number
  hintAggressiveness: HintAggressiveness
  /** Remembered per user on the text detail page. */
  showTranslationTr: boolean
  showTranslationEn: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  trEdition: 'elmalili-sadelestirilmis',
  enEdition: 'clear-quran',
  defaultResponseMode: 'self_grade',
  desiredRetention: 0.9,
  dailyNewCap: 10,
  reciterId: 7,
  hintAggressiveness: 'normal',
  showTranslationTr: true,
  showTranslationEn: false,
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  replaceAll: (settings: Partial<Settings>) => void
  reset: () => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      replaceAll: (settings) => set({ ...DEFAULT_SETTINGS, ...settings }),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'hifz.settings', version: 1 },
  ),
)

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
