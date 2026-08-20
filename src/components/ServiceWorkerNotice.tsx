import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

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

  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), 6000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <Bar>
        <span className="me-auto">A newer version is ready.</span>
        <button type="button" className="btn-text" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
        <button type="button" className="btn-text" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </Bar>
    )
  }

  if (offlineReady && !dismissedOffline) {
    return (
      <Bar>
        <span className="me-auto">Ready to work offline.</span>
        <button
          type="button"
          className="btn-text"
          onClick={() => {
            setDismissedOffline(true)
            setOfflineReady(false)
          }}
        >
          Dismiss
        </button>
      </Bar>
    )
  }

  return null
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-raised"
    >
      <div className="mx-auto flex max-w-column items-center gap-2 px-5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-small">
        {children}
      </div>
    </div>
  )
}
