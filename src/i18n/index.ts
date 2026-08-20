import { useCallback } from 'react'
import { STRINGS, type StringKey } from './strings'
import { useSettings } from '@/state/settings'

export type Lang = 'tr' | 'en'

export const LANGS: Lang[] = ['tr', 'en']

/** Fills `{name}` placeholders. Missing values are left visible, not blanked. */
function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  )
}

export function translate(
  lang: Lang,
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  const entry = STRINGS[key]
  // English is the fallback so a missing Turkish string shows real words.
  return fill(entry[lang] ?? entry.en, vars)
}

export function useT() {
  const lang = useSettings((s) => s.lang) ?? 'en'
  return useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  )
}

export function useLang(): Lang {
  return useSettings((s) => s.lang) ?? 'en'
}

/** Best guess from the browser, offered as the pre-selected option. */
export function guessLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const list = navigator.languages?.length ? navigator.languages : [navigator.language]
  return list.some((tag) => tag?.toLowerCase().startsWith('tr')) ? 'tr' : 'en'
}
