import { Component, type ReactNode } from 'react'

/**
 * A crash should say something.
 *
 * Without this, one thrown error anywhere in the tree leaves a white page —
 * indistinguishable, on a phone, from the browser having killed the tab, and
 * impossible to report. Here at least it says what broke and offers the two
 * things that actually help: try again, or go back to a screen that works.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto flex min-h-dvh max-w-column flex-col justify-center px-5">
        <h1 className="text-large font-medium">Something broke.</h1>
        <p className="mt-3 text-small text-ink-soft">
          Nothing you have memorised is lost — it is all stored on this device.
        </p>
        <pre className="card mt-5 overflow-x-auto p-4 text-micro text-ink-soft">
          {error.message}
        </pre>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="btn-primary py-3"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <button
            type="button"
            className="btn-secondary py-3"
            onClick={() => {
              window.location.hash = '#/'
              window.location.reload()
            }}
          >
            Back to today
          </button>
        </div>
      </div>
    )
  }
}
