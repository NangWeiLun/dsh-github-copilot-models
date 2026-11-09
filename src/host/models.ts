/**
 * The Models controller (models.md A3–A6, A8): the `/models` fetch and its
 * queue, the row list and model list in Host memory, the user's stored
 * choices, and the model list published to DSH.
 *
 * Login tells it two things (A1): a host lookup succeeded (fetch), and the
 * stored credential was removed or replaced (clear). Nothing else sends a
 * request: a toggle, size or header change only rebuilds the model list.
 *
 * The token is read through pi-ai (A2), so an expiring Copilot token is
 * refreshed first. It never reaches the state, a log line or the Card.
 */
import type {
  CardError,
  LastFetch,
  LoginMethod,
  ModelsResponse,
  ModelsState,
  SetLimitsRequest,
  SetVisibilityRequest,
} from '../shared/api.ts'
import { INTEGRATION_ID } from '../shared/api.ts'
import { LoginError, messageOf, toCardError } from './errors.ts'
import { fetchModels, ModelsCancelled } from './models-fetch.ts'
import type { FetchLike, LoggerPort } from './ports.ts'
import { analyseRows, buildModels, checkSizes, positiveInt } from './rows.ts'
import type { AnalysedRow, PiModelSpec, StoredChoices } from './rows.ts'

/** Where a fetch goes (Login's output, models.md A1). */
export interface FetchTarget {
  readonly method: LoginMethod
  readonly host: string
}

/** One settings edit (models.md A5); written by the Host only. */
export type SettingsOp =
  | { readonly op: 'set'; readonly path: readonly string[]; readonly value: unknown }
  | { readonly op: 'unset'; readonly path: readonly string[] }

/** What a token read yields: a token, or no credential at all. */
export type TokenResult = { readonly token: string } | undefined

/** The model list as published to DSH (models.md A8). */
export interface PublishedModels {
  readonly host?: string
  readonly method?: LoginMethod
  readonly specs: readonly PiModelSpec[]
  readonly customHeaders: Readonly<Record<string, string>>
}

export interface ModelsControllerOptions {
  readonly fetch: FetchLike
  readonly logger: LoggerPort
  /**
   * The current token, read through pi-ai so it is refreshed first (A2).
   * Undefined when no credential is stored. Throws when the refresh fails.
   */
  readonly token: (signal: AbortSignal) => Promise<TokenResult>
  /** The stored choices and custom headers, read once per operation (A5). */
  readonly readChoices: () => StoredChoices
  readonly readHeaders: () => Readonly<Record<string, string>>
  /** Apply settings edits to the plugin's own `Config` (A5). */
  readonly writeSettings: (ops: readonly SettingsOp[]) => Promise<void>
  /** Publish a changed model list (A8); called only when it changed. */
  readonly publish: (models: PublishedModels) => void
  /** Why the route could not be registered (A10), if it could not. */
  readonly routeError?: () => CardError | undefined
  /** Where the adapter's peers resolved (models.md B1); reported in the state. */
  readonly peers?: Readonly<Record<string, string>>
  /** Clock, for the last fetch's time. */
  readonly now?: () => number
}

/** The row list of the last successful fetch (A3). */
interface RowList {
  readonly host: string
  readonly method: LoginMethod
  readonly rows: readonly AnalysedRow[]
  readonly fetchedAt: number
}

/** Why a POST failed, as a Card error. */
function refused(code: CardError['code'], params?: CardError['params']): CardError {
  return params === undefined ? { code } : { code, params }
}

/** A pi-ai token refresh failure (A10): `ModelsError` code `oauth`. */
function isRefreshFailure(error: unknown): boolean {
  return error instanceof Error && error.name === 'ModelsError' && (error as { code?: unknown }).code === 'oauth'
}

export class ModelsController {
  readonly #options: ModelsControllerOptions
  #list: RowList | undefined
  #lastFetch: LastFetch | undefined
  /** Bumped when the credential is removed or replaced: older fetches are dropped (A3). */
  #epoch = 0
  /** The fetch loop; undefined while no fetch runs. */
  #loop: Promise<void> | undefined
  #runningAbort: AbortController | undefined
  /** The one fetch waiting behind the running one; a newer trigger replaces it (A3). */
  #pending: { readonly target: FetchTarget; readonly epoch: number } | undefined
  #publishedKey = ''
  #disposed = false

  constructor(options: ModelsControllerOptions) {
    this.#options = options
  }

  /** Stop: withdraw a running fetch and publish nothing more. */
  dispose(): void {
    this.#disposed = true
    this.#pending = undefined
    this.#runningAbort?.abort()
  }

  /** A fetch runs (A3, A11). */
  get fetching(): boolean {
    return this.#loop !== undefined
  }

  /**
   * A host lookup succeeded (A1): fetch `/models`. Only one fetch runs at a
   * time; a trigger during a fetch runs one more fetch after it, and later
   * triggers before then replace that one (A3).
   * @returns resolves once no fetch runs or waits.
   */
  fetch(target: FetchTarget): Promise<void> {
    if (this.#disposed) return Promise.resolve()
    this.#pending = { target, epoch: this.#epoch }
    this.#loop ??= this.#drain()
    return this.#loop
  }

  /** Resolves once no fetch runs or waits. */
  whenIdle(): Promise<void> {
    return this.#loop ?? Promise.resolve()
  }

  async #drain(): Promise<void> {
    try {
      // Let the caller's synchronous code finish before the first await.
      await Promise.resolve()
      for (let next = this.#pending; next !== undefined && !this.#disposed; next = this.#pending) {
        this.#pending = undefined
        await this.#run(next.target, next.epoch)
      }
    } finally {
      this.#loop = undefined
    }
  }

  /** The stored credential was removed or replaced (A1, A3): clear the lists. Sends nothing. */
  credentialChanged(): void {
    this.#epoch += 1
    this.#pending = undefined
    this.#runningAbort?.abort()
    if (this.#list === undefined && this.#lastFetch === undefined) return
    this.#list = undefined
    this.#lastFetch = undefined
    this.#republish()
  }

  /** Stored choices changed (`loader/volatile-update`, A5): rebuild and republish. */
  choicesChanged(): void {
    this.#republish()
  }

  /** What the Card shows (A11). Local only. */
  state(): ModelsState {
    const list = this.#list
    const choices = this.#options.readChoices()
    const built = buildModels(list?.rows ?? [], choices)
    const routeError = this.#options.routeError?.()
    return {
      fetching: this.fetching,
      rows: built.rows,
      ...list === undefined ? {} : { host: list.host, method: list.method, fetchedAt: list.fetchedAt },
      ...this.#lastFetch === undefined ? {} : { lastFetch: this.#lastFetch },
      gone: built.gone,
      headers: { ...this.#options.readHeaders() },
      published: routeError === undefined ? built.specs.length : 0,
      ...routeError === undefined ? {} : { routeError },
      ...this.#options.peers === undefined ? {} : { peers: this.#options.peers },
    }
  }

  /** The model list to publish (A8). */
  published(): PublishedModels {
    const list = this.#list
    const built = buildModels(list?.rows ?? [], this.#options.readChoices())
    return {
      ...list === undefined ? {} : { host: list.host, method: list.method },
      specs: built.specs,
      customHeaders: { ...this.#options.readHeaders() },
    }
  }

  /** `setVisibility` (A11): one model entry per write (A5). */
  async setVisibility(request: SetVisibilityRequest): Promise<ModelsResponse> {
    const known = this.#knows(request.id)
    if (!known) return this.#fail(refused('UNKNOWN_MODEL', { id: request.id }))
    const op: SettingsOp = 'clear' in request
      ? { op: 'unset', path: ['modelVisibility', request.id] }
      : { op: 'set', path: ['modelVisibility', request.id], value: request.on }
    return this.#write([op])
  }

  /** `setLimits` (A11): checks the sizes (A4), then writes one model entry (A5). */
  async setLimits(request: SetLimitsRequest): Promise<ModelsResponse> {
    if (!this.#knows(request.id)) return this.#fail(refused('UNKNOWN_MODEL', { id: request.id }))
    const path = ['modelLimits', request.id]
    if ('clear' in request) return this.#write([{ op: 'unset', path }])

    for (const value of [request.context, request.output]) {
      if (value !== undefined && positiveInt(value) === undefined) return this.#fail(refused('LIMIT_REFUSED', { check: 'not-positive' }))
    }
    const row = this.#rowOf(request.id)
    if (row !== undefined) {
      const problem = checkSizes(row, request.context, request.output)
      if (problem !== undefined) {
        return this.#fail(refused('LIMIT_REFUSED', { check: problem.check, ...problem.limit === undefined ? {} : { limit: problem.limit } }))
      }
    }
    // The entry is replaced as a whole: a size left out means Copilot's value,
    // and keys of an earlier design (`tier`) are dropped.
    const next = {
      ...request.context === undefined ? {} : { context: request.context },
      ...request.output === undefined ? {} : { output: request.output },
    }
    return this.#write([Object.keys(next).length === 0 ? { op: 'unset', path } : { op: 'set', path, value: next }])
  }

  /** `setHeaders` (A11): validates the list (A6), then writes it as one value. */
  async setHeaders(headers: Readonly<Record<string, string>>): Promise<ModelsResponse> {
    const seen = new Set<string>()
    for (const [name, value] of Object.entries(headers)) {
      if (name.trim() === '') return this.#fail(refused('HEADER_REFUSED', { name, reason: 'empty' }))
      const lower = name.toLowerCase()
      if (seen.has(lower)) return this.#fail(refused('HEADER_REFUSED', { name, reason: 'duplicate' }))
      seen.add(lower)
      try {
        new Headers([[name, value]])
      } catch (error) {
        return this.#fail(refused('HEADER_REFUSED', { name, reason: 'invalid', message: messageOf(error) }))
      }
    }
    return this.#write([{ op: 'set', path: ['customHeaders'], value: { ...headers } }])
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** One fetch: token through pi-ai, then `GET /models` (A2). */
  async #run(target: FetchTarget, epoch: number): Promise<void> {
    const abort = new AbortController()
    this.#runningAbort = abort
    const url = `${target.host}/models`
    const now = this.#options.now ?? Date.now
    try {
      let token: TokenResult
      try {
        token = await this.#options.token(abort.signal)
      } catch (error) {
        if (abort.signal.aborted || epoch !== this.#epoch) return
        const error_: CardError = isRefreshFailure(error)
          ? { code: 'MODELS_FAILED', params: { url, reason: 'token-refresh', message: messageOf(error) } }
          : toCardError(error)
        this.#lastFetch = { at: now(), url, error: error_ }
        this.#options.logger.warn('github-copilot-models: could not read the token for /models (%s)', error_.code)
        return
      }
      if (abort.signal.aborted || epoch !== this.#epoch || this.#disposed) return
      if (token === undefined) {
        // No credential: no request, and the lists are cleared (A3).
        this.#list = undefined
        this.#lastFetch = { at: now(), url, error: { code: 'NOT_SIGNED_IN' } }
        this.#republish()
        return
      }
      try {
        const reply = await fetchModels({
          fetch: this.#options.fetch,
          host: target.host,
          token: token.token,
          integrationId: INTEGRATION_ID[target.method],
          customHeaders: this.#options.readHeaders(),
          signal: abort.signal,
        })
        if (epoch !== this.#epoch || this.#disposed) return
        const at = now()
        this.#list = { host: target.host, method: target.method, rows: analyseRows(reply.data), fetchedAt: at }
        this.#lastFetch = {
          at,
          url: reply.url,
          status: reply.status,
          ...reply.requestId === undefined ? {} : { requestId: reply.requestId },
          ...reply.serviceRequestId === undefined ? {} : { serviceRequestId: reply.serviceRequestId },
        }
        this.#republish()
        this.#options.logger.info('github-copilot-models: /models returned %d rows', reply.data.length)
      } catch (error) {
        if (error instanceof ModelsCancelled || epoch !== this.#epoch || this.#disposed) return
        const cardError = error instanceof LoginError ? error.toCard() : toCardError(error)
        const params = cardError.params ?? {}
        this.#lastFetch = {
          at: now(),
          url,
          ...typeof params.status === 'number' ? { status: params.status } : {},
          ...typeof params.requestId === 'string' ? { requestId: params.requestId } : {},
          ...typeof params.serviceRequestId === 'string' ? { serviceRequestId: params.serviceRequestId } : {},
          error: cardError,
        }
        this.#options.logger.warn('github-copilot-models: /models failed (%s %s)', cardError.code, String(params.status ?? params.reason ?? ''))
      }
    } finally {
      if (this.#runningAbort === abort) this.#runningAbort = undefined
    }
  }

  /** Whether an id has a row or a stored choice. */
  #knows(id: string): boolean {
    if (typeof id !== 'string' || id === '') return false
    if (this.#rowOf(id) !== undefined) return true
    const choices = this.#options.readChoices()
    return Object.hasOwn(choices.visibility, id) || Object.hasOwn(choices.limits, id)
  }

  /** The first serviceable row with this id (a duplicate is locked, A10). */
  #rowOf(id: string): AnalysedRow | undefined {
    return this.#list?.rows.find((row) => row.id === id && row.reason === undefined)
      ?? this.#list?.rows.find((row) => row.id === id)
  }

  async #write(ops: readonly SettingsOp[]): Promise<ModelsResponse> {
    try {
      await this.#options.writeSettings(ops)
    } catch (error) {
      this.#options.logger.warn('github-copilot-models: could not save a model choice (%s)', messageOf(error))
      return this.#fail(refused('SAVE_FAILED', { message: messageOf(error) }))
    }
    // The settings service applies the volatile value before it resolves.
    this.#republish()
    return { ok: true, models: this.state() }
  }

  #fail(error: CardError): ModelsResponse {
    return { ok: false, error, models: this.state() }
  }

  /** Publish the model list when it changed (A8). */
  #republish(): void {
    if (this.#disposed) return
    const models = this.published()
    const key = JSON.stringify(models)
    if (key === this.#publishedKey) return
    this.#publishedKey = key
    this.#options.publish(models)
  }
}
