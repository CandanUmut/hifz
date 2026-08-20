import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { applyTheme, useSettings } from '@/state/settings'
import { ServiceWorkerNotice } from './ServiceWorkerNotice'

const NAV = [
  { to: '/', label: 'Today', end: true },
  { to: '/library', label: 'Library', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export function AppShell() {
  const theme = useSettings((s) => s.theme)
  const { pathname } = useLocation()

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50
          focus:rounded focus:bg-paper-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="border-b border-rule">
        <nav className="mx-auto flex max-w-column items-center gap-1 px-5 py-3" aria-label="Main">
          <span className="me-auto text-small font-medium tracking-tight">hifz</span>
          {NAV.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              className={({ isActive }) =>
                [
                  'rounded-md px-2.5 py-2 text-small transition-colors',
                  isActive ? 'text-ink underline underline-offset-4' : 'text-ink-soft hover:text-ink',
                ].join(' ')
              }
            >
              {entry.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-column px-5 pb-24 pt-6">
        <Outlet />
      </main>

      {/* Deliberately not rendered in the review room — that screen stays quiet. */}
      <ServiceWorkerNotice />
    </div>
  )
}
