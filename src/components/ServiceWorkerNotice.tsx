import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '@/i18n'

/**
 * Updates are offered, never forced: a reader mid-session should not have the
 * page swapped under them. Both notices are one quiet line at the bottom.
 */
export function ServiceWorkerNotice() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [dismissedOffline, setDismissedOffline] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), 6000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <Bar>
        <span className="me-auto">{t('sw.updateReady')}</span>
        <button type="button" className="btn-text" onClick={() => updateServiceWorker(true)}>
          {t('sw.reload')}
        </button>
        <button type="button" className="btn-text" onClick={() => setNeedRefresh(false)}>
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
