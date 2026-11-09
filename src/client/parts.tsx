/**
 * Small view parts of the Card: result lines, one sign-in notice with its
 * code and link, a busy line, and a fold.
 */
import React, { useEffect, useRef, useState } from 'react'
import type { Notice } from '../shared/api.ts'
import type { Translate } from './locales.ts'
import { messageText } from './messages.ts'
import type { Line } from './messages.ts'

/**
 * Result lines, in one polite live region that stays mounted so screen
 * readers announce each new result.
 */
export function Lines(props: { readonly t: Translate; readonly lines: readonly Line[] }): React.JSX.Element {
  const { t, lines } = props
  return (
    <div className="gcm-lines" role="status" aria-live="polite">
      {lines.map((item, index) => (
        <p key={index} className={`gcm-line gcm-tone-${item.tone}`}>{messageText(t, item.message)}</p>
      ))}
    </div>
  )
}

/** A spinner and a caption. */
export function Busy(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="gcm-busy gcm-caption">
      <span className="gcm-spinner" aria-hidden="true" />
      <span>{props.children}</span>
    </p>
  )
}

/**
 * A fold, like the "Customized" section on DSH's Models page: a title with a
 * chevron, and the body under it (ui.md U3). The body is built only while
 * open; the state lives on the page and is not stored.
 */
export function Fold(props: {
  readonly title: string
  readonly defaultOpen: boolean
  /** An extra class for the fold, for example a separator line above it. */
  readonly className?: string
  readonly children: () => React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(props.defaultOpen)
  return (
    <details className={props.className === undefined ? 'gcm-fold' : `gcm-fold ${props.className}`} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="gcm-fold-summary">{props.title}</summary>
      {open && <div className="gcm-fold-body">{props.children()}</div>}
    </details>
  )
}

/** Only http(s) links are shown as links; anything else is shown as text. */
function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** Copy text with the Clipboard API; false where it is missing or refused (the code stays selectable). */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/**
 * One notice of the running browser sign-in: the message as received, the
 * code large and monospace with a Copy button, and the page to open. The
 * user types the code; the plugin never does (login.md A4 step 5).
 */
export function NoticeView(props: { readonly t: Translate; readonly notice: Notice }): React.JSX.Element {
  const { t, notice } = props
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onCopy = (code: string): void => {
    void copyText(code).then((ok) => {
      setCopy(ok ? 'copied' : 'failed')
      window.clearTimeout(timer.current)
      if (ok) timer.current = window.setTimeout(() => setCopy('idle'), 2000)
    })
  }

  const href = notice.url === undefined ? undefined : safeHref(notice.url)
  return (
    <div className="gcm-notice">
      {notice.message !== '' && <p className="gcm-text">{notice.message}</p>}
      {notice.code !== undefined && (
        <div className="gcm-code-row">
          <span className="gcm-code">{notice.code}</span>
          <button type="button" className="gcm-button" onClick={() => onCopy(notice.code ?? '')}>
            {copy === 'copied' ? t('copied') : t('copyCode')}
          </button>
        </div>
      )}
      {copy === 'failed' && <p className="gcm-line gcm-tone-error">{t('copyFailed')}</p>}
      {notice.url !== undefined && (href === undefined
        ? <p className="gcm-text">{notice.url}</p>
        : <a className="gcm-link" href={href} target="_blank" rel="noopener noreferrer">{notice.url}</a>)}
    </div>
  )
}
