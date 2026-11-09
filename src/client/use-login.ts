/**
 * The Card's model: the Host state, our pending request, the notices of our
 * browser sign-in, the Domain and PAT fields, and the result lines. All Host
 * traffic goes through host-api.ts.
 *
 * Polling, only while something runs (an idle page sends nothing):
 * - during our browser sign-in: notices about every 1 s, state about every 2 s
 *   (notices also while another tab runs this plugin's browser sign-in);
 * - otherwise, while the Host is checking or a sign-in runs anywhere: state
 *   about every 3 s, so the page catches up with other tabs and with the
 *   start-up lookup.
 *
 * Unmounting aborts our browser sign-in request, which cancels the sign-in
 * (closing the page cancels it, login.md B4). Other requests are left to
 * finish; their replies are then ignored.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResponse, LoginState, ModelsState, Notice } from '../shared/api.ts'
import * as api from './host-api.ts'
import type { CallResult, Problem } from './host-api.ts'
import type { Key } from './locales.ts'
import { cardError, text } from './messages.ts'
import type { Line, Tone } from './messages.ts'

/** A request of ours that is pending. */
export type Pending = 'browser' | 'pat' | 'signOut' | 'refresh'

/** Where a result is shown: the status card, or under the browser or PAT controls. */
export type Area = 'status' | 'browser' | 'pat'

/** The lines of the last action. */
export interface Result {
  readonly area: Area
  readonly lines: readonly Line[]
  /** The login the lines speak about; they are dropped once it changes. */
  readonly signature: string
}

const FIRST_NOTICE_POLL_MS = 400
const NOTICE_POLL_MS = 1000
const STATE_POLL_MS = 2000
const WATCH_POLL_MS = 3000
/** Notices kept on screen; a sign-in shows two or three. */
const MAX_NOTICES = 20

export interface LoginModel {
  /** Last Host state; undefined until the first load succeeds. */
  readonly state: LoginState | undefined
  /** The last state load failed. */
  readonly loadProblem: Problem | undefined
  readonly pending: Pending | undefined
  /** Cancel was pressed and has not been answered yet. */
  readonly cancelling: boolean
  /** Notices of our running browser sign-in. */
  readonly notices: readonly Notice[]
  readonly result: Result | undefined
  readonly domainDraft: string
  readonly patDraft: string
  setDomainDraft(value: string): void
  setPatDraft(value: string): void
  reload(): void
  signInBrowser(): void
  cancelBrowser(): void
  savePat(): void
  signOut(): void
  refresh(): void
}

/** The Domain field value a sign-in sends: as typed while signed out, else the saved domain (login.md A1). */
export function requestDomain(state: LoginState, draft: string): string {
  return state.status === 'signed-out' ? draft : state.domain
}

/** What a result line can depend on: the login and its error, not the running flags. */
function signatureOf(state: LoginState | undefined): string {
  if (state === undefined) return ''
  return JSON.stringify([state.status, state.method, state.account, state.copilotHost, state.error, state.changedOutside])
}

function line(tone: Tone, key: Key): Line {
  return { tone, message: text(key) }
}

function problemLine(problem: Problem): Line {
  return { tone: 'error', message: { kind: 'problem', problem } }
}

/**
 * A sign-in request that did not complete, or that a proxy answered while the
 * Host was away, was interrupted (login.md A8: Host restart during sign-in).
 */
function signInProblem(problem: Problem): Problem {
  if (problem.kind === 'network') return { kind: 'interrupted' }
  if (problem.kind === 'http' && problem.status >= 500) return { kind: 'interrupted' }
  return problem
}

/** Lines for an action reply. */
function replyLines(reply: ActionResponse, success: readonly Line[], cancelled?: Line): Line[] {
  if (reply.ok) return [...success]
  if (reply.cancelled === true) return cancelled === undefined ? [] : [cancelled]
  return reply.error === undefined ? [] : [{ tone: 'error', message: cardError(reply.error) }]
}

/** Load once on mount; `onModels` receives the models state of every Login reply (models.md A11). */
export function useLogin(onModels?: (models: ModelsState) => void): LoginModel {
  const onModelsRef = useRef(onModels)
  onModelsRef.current = onModels
  const [state, setState] = useState<LoginState | undefined>(undefined)
  const [loadProblem, setLoadProblem] = useState<Problem | undefined>(undefined)
  const [pending, setPendingState] = useState<Pending | undefined>(undefined)
  const [cancelling, setCancellingState] = useState(false)
  const [notices, setNotices] = useState<readonly Notice[]>([])
  const [result, setResult] = useState<Result | undefined>(undefined)
  const [domainDraft, setDomainDraft] = useState('')
  const [patDraft, setPatDraft] = useState('')

  const stateRef = useRef<LoginState | undefined>(undefined)
  const pendingRef = useRef<Pending | undefined>(undefined)
  const cancellingRef = useRef(false)
  const mountedRef = useRef(false)
  /** Bumped when one of our actions starts or ends; state replies requested before are dropped. */
  const epochRef = useRef(0)
  const noticeSeqRef = useRef(0)
  const beginAbortRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      beginAbortRef.current?.abort()
      beginAbortRef.current = undefined
    }
  }, [])

  const applyState = useCallback((next: LoginState): void => {
    const previous = stateRef.current
    stateRef.current = next
    setState(next)
    // The field starts from the saved domain each time it opens (A1).
    if (next.status === 'signed-out' && previous?.status !== 'signed-out') setDomainDraft(next.domain)
    // A result about a login that has since changed (another tab, outside the plugin) is stale.
    const signature = signatureOf(next)
    setResult((current) => current !== undefined && current.signature !== signature ? undefined : current)
  }, [])

  /** Show the lines of an action; they belong to the state now held. */
  const show = useCallback((area: Area, lines: readonly Line[]): void => {
    setResult({ area, lines, signature: signatureOf(stateRef.current) })
  }, [])

  const setPending = useCallback((value: Pending | undefined): void => {
    pendingRef.current = value
    epochRef.current += 1
    setPendingState(value)
  }, [])

  const setCancelling = useCallback((value: boolean): void => {
    cancellingRef.current = value
    setCancellingState(value)
  }, [])

  /** Load the state; true when a fresh state was applied. */
  const loadState = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const epoch = epochRef.current
    const reply = await api.getState(signal)
    if (!mountedRef.current || epoch !== epochRef.current || reply.kind === 'aborted') return false
    if (reply.kind === 'ok') {
      setLoadProblem(undefined)
      applyState(reply.value)
      return true
    }
    setLoadProblem(reply.problem)
    return false
  }, [applyState])

  const addNotices = useCallback((incoming: readonly Notice[]): void => {
    const fresh = incoming.filter((notice) => notice.seq > noticeSeqRef.current)
    if (fresh.length === 0) return
    noticeSeqRef.current = fresh.reduce((max, notice) => Math.max(max, notice.seq), noticeSeqRef.current)
    setNotices((current) => [...current, ...fresh].slice(-MAX_NOTICES))
  }, [])

  // Load once on mount.
  useEffect(() => {
    void loadState()
  }, [loadState])

  // While a browser sign-in of this plugin runs (ours, or one started in
  // another tab): notices about every 1 s.
  const browserRunning = pending === 'browser'
  const noticesRunning = browserRunning || state?.signIn?.method === 'browser'
  useEffect(() => {
    if (!noticesRunning) return undefined
    if (pendingRef.current !== 'browser') {
      // Another tab's sign-in: the Host holds only that attempt's notices.
      noticeSeqRef.current = 0
      setNotices([])
    }
    const controller = new AbortController()
    let timer: number | undefined
    const poll = async (): Promise<void> => {
      const reply = await api.getNotices(noticeSeqRef.current, controller.signal)
      if (controller.signal.aborted || !mountedRef.current) return
      if (reply.kind === 'ok') addNotices(reply.value)
      timer = window.setTimeout(() => { void poll() }, NOTICE_POLL_MS)
    }
    timer = window.setTimeout(() => { void poll() }, FIRST_NOTICE_POLL_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [noticesRunning, addNotices])

  // While our browser sign-in runs: state about every 2 s.
  useEffect(() => {
    if (!browserRunning) return undefined
    const controller = new AbortController()
    let timer: number | undefined
    const poll = async (): Promise<void> => {
      await loadState(controller.signal)
      if (!controller.signal.aborted) timer = window.setTimeout(() => { void poll() }, STATE_POLL_MS)
    }
    timer = window.setTimeout(() => { void poll() }, STATE_POLL_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [browserRunning, loadState])

  // No request of ours pending, but the Host is checking, a sign-in runs
  // anywhere, or a `/models` fetch runs: state about every 3 s.
  const watching = state !== undefined && (state.checking || state.inFlight || state.modelsFetching)
  const idle = pending === undefined
  useEffect(() => {
    if (!watching || !idle) return undefined
    const controller = new AbortController()
    let timer: number | undefined
    const tick = async (): Promise<void> => {
      await loadState(controller.signal)
      if (!controller.signal.aborted) timer = window.setTimeout(() => { void tick() }, WATCH_POLL_MS)
    }
    timer = window.setTimeout(() => { void tick() }, WATCH_POLL_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [watching, idle, loadState])

  /**
   * End one of our sign-in requests. The reply's state can predate the Host's
   * clean-up of the attempt (it may still say `inFlight`), so the state is
   * read once more before the buttons come back. State replies requested
   * while the attempt ran are dropped.
   * @returns whether the sign-in succeeded.
   */
  const finishSignIn = async (area: Area, reply: CallResult<ActionResponse>, success: Key): Promise<boolean> => {
    epochRef.current += 1
    if (reply.kind === 'ok') onModelsRef.current?.(reply.value.models)
    const fresh = await loadState()
    if (!mountedRef.current) return false
    if (!fresh && reply.kind === 'ok') applyState(reply.value.state)
    setPending(undefined)
    setCancelling(false)
    setNotices([])
    if (reply.kind === 'ok') {
      show(area, replyLines(reply.value, [line('success', success)], line('info', 'resultCancelled')))
      return reply.value.ok
    }
    if (reply.kind === 'failed') show(area, [problemLine(signInProblem(reply.problem))])
    return false
  }

  const signInBrowser = (): void => {
    const current = stateRef.current
    if (current === undefined || pendingRef.current !== undefined) return
    const controller = new AbortController()
    beginAbortRef.current = controller
    noticeSeqRef.current = current.noticeSeq
    setCancelling(false)
    setNotices([])
    setResult(undefined)
    setPending('browser')
    void api.browserBegin({ domain: requestDomain(current, domainDraft) }, controller.signal).then(async (reply) => {
      if (beginAbortRef.current === controller) beginAbortRef.current = undefined
      if (!mountedRef.current || reply.kind === 'aborted') return
      await finishSignIn('browser', reply, 'resultSignedIn')
    })
  }

  const cancelBrowser = (): void => {
    if (cancellingRef.current) return
    // Our own sign-in request then ends as cancelled and brings the state itself.
    const ours = pendingRef.current === 'browser'
    setCancelling(true)
    void api.browserCancel().then((reply) => {
      if (!mountedRef.current) return
      if (reply.kind === 'failed') {
        setCancelling(false)
        show('browser', [problemLine(reply.problem)])
        return
      }
      if (ours) return
      setCancelling(false)
      if (reply.kind === 'ok') {
        applyState(reply.value.state)
        onModelsRef.current?.(reply.value.models)
      }
    })
  }

  const savePat = (): void => {
    const current = stateRef.current
    const pat = patDraft
    if (current === undefined || pendingRef.current !== undefined || pat.trim() === '') return
    setResult(undefined)
    setPending('pat')
    void api.patSave({ domain: requestDomain(current, domainDraft), pat }).then(async (reply) => {
      if (!mountedRef.current || reply.kind === 'aborted') return
      // The field is cleared only after a successful save (A5).
      if (await finishSignIn('pat', reply, 'resultPatSaved')) setPatDraft('')
    })
  }

  const signOut = (): void => {
    if (stateRef.current === undefined || pendingRef.current !== undefined) return
    setResult(undefined)
    setPending('signOut')
    void api.signOut().then((reply) => {
      if (!mountedRef.current || reply.kind === 'aborted') return
      setPending(undefined)
      if (reply.kind === 'ok') {
        applyState(reply.value.state)
        onModelsRef.current?.(reply.value.models)
        const lines = replyLines(reply.value, [line('success', 'resultSignedOut')])
        // A6 step 4: DSH's built-in route keeps using the variable.
        if (reply.value.ok && reply.value.envTokenSet === true) lines.push(line('warn', 'envTokenSet'))
        show('status', lines)
      } else {
        show('status', [problemLine(reply.problem)])
        void loadState()
      }
    })
  }

  const refresh = (): void => {
    if (stateRef.current === undefined || pendingRef.current !== undefined) return
    setResult(undefined)
    setPending('refresh')
    void api.refresh().then((reply) => {
      if (!mountedRef.current || reply.kind === 'aborted') return
      setPending(undefined)
      if (reply.kind === 'ok') {
        applyState(reply.value.state)
        onModelsRef.current?.(reply.value.models)
        show('status', replyLines(reply.value, [line('success', 'resultRefreshed')]))
      } else {
        show('status', [problemLine(reply.problem)])
        void loadState()
      }
    })
  }

  const reload = (): void => {
    setLoadProblem(undefined)
    void loadState()
  }

  return {
    state,
    loadProblem,
    pending,
    cancelling,
    notices,
    result,
    domainDraft,
    patDraft,
    setDomainDraft,
    setPatDraft,
    reload,
    signInBrowser,
    cancelBrowser,
    savePat,
    signOut,
    refresh,
  }
}
