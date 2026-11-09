/**
 * The Models section's model (models.md A11): the models state, the action
 * that runs, and the result lines per model and for the headers.
 *
 * Requests to the Host only; none reaches Copilot. The state is loaded on
 * mount and comes back with every reply, Login's included. It is re-read
 * only while a fetch runs (the start-up fetch, or one in another tab):
 * about every 2 s, until the Host says no fetch runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GoneModel, ModelsResponse, ModelsState, SetLimitsRequest, SetVisibilityRequest } from '../shared/api.ts'
import * as api from './host-api.ts'
import type { CallResult, Problem } from './host-api.ts'
import { cardError, text } from './messages.ts'
import type { Line } from './messages.ts'

const FETCH_POLL_MS = 2000

/**
 * Where a result is shown: under one model's block (its switch), beside one
 * model's Save (its sizes, ui.md U3), or under the headers.
 */
export type ModelsArea =
  | { readonly kind: 'model'; readonly key: string }
  | { readonly kind: 'sizes'; readonly key: string }
  | { readonly kind: 'headers' }

export interface ModelsResult {
  readonly area: ModelsArea
  readonly lines: readonly Line[]
}

export interface ModelsModel {
  readonly models: ModelsState | undefined
  readonly loadProblem: Problem | undefined
  /** The key of the area whose action runs. */
  readonly pending: string | undefined
  readonly result: ModelsResult | undefined
  /** Apply a models state from any reply (Login's included). */
  apply(models: ModelsState): void
  setVisibility(key: string, request: SetVisibilityRequest): void
  setLimits(key: string, request: SetLimitsRequest): void
  setHeaders(headers: Readonly<Record<string, string>>): Promise<boolean>
  /** Clear every stored choice of a model no longer returned (models.md A4), one write per field. */
  clearGone(entry: GoneModel): void
  reload(): void
}

function areaKey(area: ModelsArea): string {
  return area.kind === 'headers' ? 'headers' : `${area.kind}:${area.key}`
}

/**
 * @param watch - re-read the state while this is true (a fetch runs, per the login state).
 */
export function useModels(watch: boolean): ModelsModel {
  const [models, setModels] = useState<ModelsState | undefined>(undefined)
  const [loadProblem, setLoadProblem] = useState<Problem | undefined>(undefined)
  const [pending, setPending] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<ModelsResult | undefined>(undefined)
  const mountedRef = useRef(false)
  /** Bumped on every applied state; a load requested before is dropped. */
  const versionRef = useRef(0)
  const pendingRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const apply = useCallback((next: ModelsState): void => {
    versionRef.current += 1
    setModels(next)
  }, [])

  const load = useCallback(async (signal?: AbortSignal): Promise<ModelsState | undefined> => {
    const version = versionRef.current
    const reply = await api.getModels(signal)
    if (!mountedRef.current || reply.kind === 'aborted') return undefined
    if (reply.kind === 'failed') {
      setLoadProblem(reply.problem)
      return undefined
    }
    setLoadProblem(undefined)
    // A reply of an action that ended meanwhile is newer.
    if (version === versionRef.current) apply(reply.value)
    return reply.value
  }, [apply])

  useEffect(() => {
    void load()
  }, [load])

  // Re-read while a fetch runs (models.md A11): the login state says so (it
  // is itself re-read while a fetch runs), or the last models state does.
  const fetching = watch || models?.fetching === true
  useEffect(() => {
    if (!fetching) return undefined
    const controller = new AbortController()
    let timer: number | undefined
    const tick = async (): Promise<void> => {
      await load(controller.signal)
      if (!controller.signal.aborted) timer = window.setTimeout(() => { void tick() }, FETCH_POLL_MS)
    }
    timer = window.setTimeout(() => { void tick() }, FETCH_POLL_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [fetching, load])

  /** Run one action; its reply carries the state. */
  const run = async (area: ModelsArea, call: () => Promise<CallResult<ModelsResponse>>, success?: Line): Promise<boolean> => {
    const key = areaKey(area)
    if (pendingRef.current !== undefined) return false
    pendingRef.current = key
    setPending(key)
    setResult(undefined)
    const reply = await call()
    if (!mountedRef.current) return false
    pendingRef.current = undefined
    setPending(undefined)
    if (reply.kind === 'aborted') return false
    if (reply.kind === 'failed') {
      setResult({ area, lines: [{ tone: 'error', message: { kind: 'problem', problem: reply.problem } }] })
      void load()
      return false
    }
    apply(reply.value.models)
    if (!reply.value.ok) {
      const error = reply.value.error
      setResult({ area, lines: error === undefined ? [] : [{ tone: 'error', message: cardError(error) }] })
      return false
    }
    if (success !== undefined) setResult({ area, lines: [success] })
    return true
  }

  return {
    models,
    loadProblem,
    pending,
    result,
    apply,
    setVisibility: (key, request) => {
      void run({ kind: 'model', key }, () => api.setVisibility(request))
    },
    setLimits: (key, request) => {
      void run({ kind: 'sizes', key }, () => api.setLimits(request), { tone: 'success', message: text('sizesSaved') })
    },
    setHeaders: (headers) => run({ kind: 'headers' }, () => api.setHeaders({ headers }), { tone: 'success', message: text('headersSaved') }),
    clearGone: (entry) => {
      const area: ModelsArea = { kind: 'model', key: entry.id }
      // An entry with no visibility choice came from `modelLimits`, which may
      // hold keys the Card does not show (an earlier `tier`): clear it too.
      const clearLimits = entry.stored.visible === undefined || entry.stored.context !== undefined || entry.stored.output !== undefined
      void (async () => {
        if (entry.stored.visible !== undefined && !await run(area, () => api.setVisibility({ id: entry.id, clear: true }))) return
        if (clearLimits) await run(area, () => api.setLimits({ id: entry.id, clear: true }))
      })()
    },
    reload: () => {
      setLoadProblem(undefined)
      void load()
    },
  }
}
