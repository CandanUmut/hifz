import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '@/i18n'

/** Screens where a reload would throw away work in progress. */
const MID_SESSION = /^\/(review|practise|cold-check|memorize|test)/

/** How often an installed app looks for a new version. */
const CHECK_MS = 30 * 60 * 1000

/**
 * Keeping an installed app up to date.
 *
 * This used to ask every time, which sounds respectful and is not: an
 * installed app on a phone rarely gets a fresh page load, so the question
 * often never appeared, and a device could sit on a build from weeks ago
 * wondering why a fixed bug was not fixed. Now the new version is applied the
 * moment it is safe to reload — which is everywhere except mid-session — and
 * the question is only asked when answering it would cost the reader a card.
 */
export function ServiceWorkerNotice() {
  const { pathname } = useLocation()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState === 'visible') void registration.update()
      }
      window.setInterval(check, CHECK_MS)
      document.addEventListener('visibilitychange', check)
    },
  })
  const [dismissedOffline, setDismissedOffline] = useState(false)
  const [postponed, setPostponed] = useState(false)
  const t = useT()

  const busy = MID_SESSION.test(pathname)

  useEffect(() => {
    if (!needRefresh || busy || postponed) return
    void updateServiceWorker(true)
  }, [busy, needRefresh, postponed, updateServiceWorker])

  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), 6000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (needRefresh && (busy || postponed)) {
    return (
      <Bar>
        <span className="me-auto">{t('sw.updateReady')}</span>
        <button type="button" className="btn-text" onClick={() => updateServiceWorker(true)}>
          {t('sw.reload')}
        </button>
        <button
          type="button"
          className="btn-text"
          onClick={() => {
            setPostponed(true)
            setNeedRefresh(false)
          }}
        >
          {t('sw.later')}
        </button>
      </Bar>
    )
  }

  if (offlineReady && !dismissedOffline) {
    return (
      <Bar>
        <span className="me-auto">{t('sw.offlineReady')}</span>
        <button
          type="button"
          className="btn-text"
          onClick={() => {
            setDismissedOffline(true)
            setOfflineReady(false)
          }}
        >
          {t('sw.dismiss')}
        </button>
      </Bar>
    )
  }

  return null
}

/**
 * Deliberately in the flow rather than pinned to the bottom of the window: as a
 * fixed bar it sat on top of the primary action on every screen that has one,
 * so "Ready to work offline" was hiding "Start memorising".
 */
function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="mx-auto mt-8 max-w-column px-5">
      <div className="card flex items-center gap-2 px-4 py-2 text-small">{children}</div>
    </div>
  )
}
