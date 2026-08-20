import { useState } from 'react'
import { InkText } from '@/components/InkText'
import { guessLang, translate, type Lang } from '@/i18n'
import { useSettings, type UiLang } from '@/state/settings'

/**
 * Two things before anything else: which language, and what this app actually
 * asks of you. The second one exists because the app is not self-evident —
 * it hides the text on purpose, and nobody expects that.
 */
export function Welcome() {
  const lang = useSettings((s) => s.lang)
  const introSeen = useSettings((s) => s.introSeen)
  const set = useSettings((s) => s.set)
  const [step, setStep] = useState(0)

  // The chooser cannot use useT: there is no language yet.
  const [preview, setPreview] = useState<Lang>(() => guessLang())

  if (!lang) {
    const t = (key: Parameters<typeof translate>[1]) => translate(preview, key)
    return (
      <Screen>
        <p className="text-display">{t('app.tagline')}</p>
        <p className="mt-8 text-base text-ink-soft">{t('lang.question')}</p>
        <div className="mt-4 flex w-full flex-col gap-3">
          {(['tr', 'en'] as UiLang[]).map((option) => (
            <button
              key={option}
              type="button"
              onMouseEnter={() => setPreview(option)}
              onFocus={() => setPreview(option)}
              onClick={() => set('lang', option)}
              className="btn-secondary w-full py-4 text-base"
            >
              {option === 'tr' ? 'Türkçe' : 'English'}
            </button>
          ))}
        </div>
        <p className="mt-6 text-micro text-ink-soft">{t('lang.change')}</p>
      </Screen>
    )
  }

  if (introSeen) return null

  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key)
  const steps = [
    { title: t('intro.1.title'), body: t('intro.1.body') },
    { title: t('intro.2.title'), body: t('intro.2.body') },
    { title: t('intro.3.title'), body: t('intro.3.body') },
  ]
  const last = step === steps.length - 1

  return (
    <Screen>
      {/* The fade itself, so the idea lands before a word of explanation. */}
      <div className="mb-10 w-full">
        <InkText
          text="قُلْ هُوَ ٱللَّهُ أَحَدٌ"
          level={step === 0 ? 3 : step === 1 ? 1 : 0}
          lang="ar"
          className="sacred sacred-sm"
        />
      </div>

      <p className="text-large font-medium">{steps[step].title}</p>
      <p className="mt-3 text-base text-ink-soft">{steps[step].body}</p>

      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full ${i === step ? 'bg-ink' : 'bg-rule'}`}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn-primary mt-8 w-full py-3"
        onClick={() => (last ? set('introSeen', true) : setStep(step + 1))}
      >
        {last ? t('intro.start') : t('add.next')}
      </button>
      {!last && (
        <button type="button" className="btn-text mt-1" onClick={() => set('introSeen', true)}>
          {t('intro.skip')}
        </button>
      )}
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="mx-auto flex min-h-dvh max-w-column flex-col items-center justify-center px-6 py-10 text-center">
        {children}
      </div>
    </div>
  )
}
