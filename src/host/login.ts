/**
 * The login controller (login.md A2–A7): state, browser and PAT sign-in,
 * sign-out, Refresh, and changes made outside the plugin. Pure Host logic over
 * the ports in `ports.ts`; the plugin entry wires the real services.
 *
 * Memory only: the Copilot host, account name and the credential of the last
 * lookup never reach `Config`, logs, errors or the Card.
 */
import type { ActionResponse, CardError, LoginMethod, LoginState, ModelsState, Notice } from '../shared/api.ts'
import { configDomain, domainAnswer, normalizeDomain } from './domain.ts'
import { LookupCancelled, mapBeginError, toCardError } from './errors.ts'
import { lookupCopilotHost } from './lookup.ts'
import type { AuthorizationPort, AuthorizationPrompt, CredentialRecord, CredentialsPort, FetchLike, LoggerPort } from './ports.ts'
import { ENV_TOKEN_REF, RECORD_KEY } from './ports.ts'

/** What the Models component receives (login.md A7). */
export interface LoginOutput {
  readonly method: LoginMethod
  /** The Copilot host (A3). */
  readonly host: string
  /** The GitHub account name (A3), when GitHub returned one. */
  readonly account?: string
}

/**
 * Login's link to the Models component (models.md A1, A11): Login tells it
 * about a successful lookup and a removed or replaced credential, and every
 * reply carries its state.
 */
export interface ModelsLink {
  /** A host lookup succeeded: fetch `/models`. Resolves when that fetch has ended. */
  lookupSucceeded(output: LoginOutput): Promise<void>
  /** The stored credential was removed or replaced: clear the lists. Sends nothing. */
  credentialChanged(): void
  /** The models state every reply carries. */
  state(): ModelsState
  /** A `/models` fetch runs. */
  fetching(): boolean
}

/** The models state without a Models component. */
const NO_MODELS: ModelsState = { fetching: false, rows: [], gone: [], headers: {}, published: 0 }

/** Notices kept for the Card; older ones are dropped. */
const NOTICE_LIMIT = 64

/** The credential a record holds, as the plugin reads it (login.md B3). */
export interface StoredCredential {
  readonly method: LoginMethod
  /** The login token (`payload.refresh`) or the PAT; never leaves Host memory. */
  readonly secret: string
  /** pi-ai's stored domain (`payload.enterpriseUrl`), browser login only. */
  readonly enterpriseUrl?: string
}

/** Result of a lookup for a stored credential. */
type LookupOutcome = { readonly ok: true } | { readonly ok: false; readonly cancelled: true } | { readonly ok: false; readonly error: CardError }

export interface LoginControllerOptions {
  readonly credentials: () => CredentialsPort | undefined
  readonly authorization: () => AuthorizationPort | undefined
  readonly fetch: FetchLike
  readonly logger: LoggerPort
  /** Saved Domain field value (login.md A1); empty means github.com. */
  readonly readDomain: () => string
  /** Save the Domain field value; called only after a successful lookup. */
  readonly saveDomain: (value: string) => Promise<void>
  /** Called whenever the output to the Models component changes (A7). */
  readonly onOutputChange?: (output: LoginOutput | undefined) => void
  /** The Models component (models.md A1). */
  readonly models?: ModelsLink
}

/** Method of a record, by its kind (login.md B3). */
function methodOf(record: CredentialRecord): LoginMethod {
  return record.kind === 'api-key' ? 'pat' : 'browser'
}

/**
 * Read the credential a record holds (login.md B3).
 * @returns the credential, or undefined when the record holds none the plugin understands.
 */
export function readStoredCredential(record: CredentialRecord): StoredCredential | undefined {
  if (record.kind === 'api-key') {
    return typeof record.key === 'string' && record.key !== '' ? { method: 'pat', secret: record.key } : undefined
  }
  const payload = record.payload
  if (typeof payload !== 'object' || payload === null) return undefined
  const { refresh, enterpriseUrl } = payload as Record<string, unknown>
  if (typeof refresh !== 'string' || refresh === '') return undefined
  return typeof enterpriseUrl === 'string' && enterpriseUrl !== ''
    ? { method: 'browser', secret: refresh, enterpriseUrl }
    : { method: 'browser', secret: refresh }
}

function sameCredential(a: StoredCredential | undefined, b: StoredCredential | undefined): boolean {
  return a !== undefined && b !== undefined && a.method === b.method && a.secret === b.secret
}

export class LoginController {
  readonly #options: LoginControllerOptions
  /** Method of the stored record; undefined while none is stored. */
  #recordMethod: LoginMethod | undefined
  /** The credential of the last host lookup (A2), successful or not. */
  #lastCredential: StoredCredential | undefined
  /** Result of the last successful lookup for {@link #lastCredential}. */
  #verified: { readonly host: string; readonly account?: string } | undefined
  #error: CardError | undefined
  #changedOutside = false
  #checking = 0
  /** Our own sign-in or sign-out runs: `credentials/record-updated` is ignored (A2). */
  #busy = 0
  /** A record event arrived while busy; re-checked once the operation ends. */
  #missedRecordEvent = false
  #signIn: { readonly method: LoginMethod } | undefined
  /** Withdraws our own running sign-in (sign-out, dispose). */
  #signInAbort: AbortController | undefined
  /** Bumped to withdraw running lookups and drop their results. */
  #generation = 0
  #lookupAbort = new AbortController()
  #notices: Notice[] = []
  #noticeSeq = 0
  #lastOutput = ''
  #disposed = false

  constructor(options: LoginControllerOptions) {
    this.#options = options
  }

  /** Stop: withdraw lookups and sign-ins, and publish no further output. */
  dispose(): void {
    this.#disposed = true
    this.#signInAbort?.abort()
    this.#withdrawLookups()
  }

  /** The output for the Models component (A7); undefined unless verified. */
  output(): LoginOutput | undefined {
    const verified = this.#verified
    const method = this.#lastCredential?.method
    if (verified === undefined || method === undefined) return undefined
    return verified.account === undefined ? { method, host: verified.host } : { method, host: verified.host, account: verified.account }
  }

  /** What the Card shows. Local only: sends no request. */
  state(): LoginState {
    const entry = this.#options.authorization()?.describe(RECORD_KEY)
    const verified = this.#verified
    const status = this.#recordMethod === undefined ? 'signed-out' : verified === undefined ? 'unverified' : 'signed-in'
    return {
      status,
      ...this.#recordMethod === undefined ? {} : { method: this.#recordMethod },
      ...verified?.account === undefined ? {} : { account: verified.account },
      ...verified === undefined ? {} : { copilotHost: verified.host },
      domain: this.#options.readDomain(),
      checking: this.#checking > 0,
      flowAvailable: entry !== undefined,
      // Our own PAT sign-in runs its lookup before the attempt starts (A5).
      inFlight: entry?.inFlight === true || this.#signIn !== undefined,
      ...this.#signIn === undefined ? {} : { signIn: this.#signIn },
      ...this.#error === undefined ? {} : { error: this.#error },
      changedOutside: this.#changedOutside,
      noticeSeq: this.#noticeSeq,
      modelsFetching: this.#options.models?.fetching() ?? false,
    }
  }

  /** Notices newer than `after` (A4 step 4). */
  notices(after: number): Notice[] {
    return this.#notices.filter((notice) => notice.seq > after)
  }

  /**
   * Start-up (A3): when a record exists, run the lookup once. A failure keeps
   * the record and shows the error until Refresh (login.md A3).
   */
  async start(): Promise<void> {
    let record: CredentialRecord | undefined
    try {
      record = await this.#readRecord()
    } catch (error) {
      this.#options.logger.warn('github-copilot-models: could not read the credential record at start-up (%s)', toCardError(error).code)
      return
    }
    if (record === undefined || this.#disposed || this.#busy > 0) return
    await this.#verifyRecord(record)
  }

  /** Refresh (A3): run the lookup again for the stored record. */
  async refresh(): Promise<ActionResponse> {
    if (this.#signIn !== undefined) return this.#fail({ code: 'ALREADY_IN_FLIGHT' })
    const record = await this.#readRecord()
    if (record === undefined) {
      this.#clearSignedIn()
      return this.#fail({ code: 'NOT_SIGNED_IN' })
    }
    return this.#respond(await this.#verifyRecord(record))
  }

  /**
   * Browser sign-in (A4). Resolves when the attempt and its `/models` fetch end.
   * @param domainInput - the Domain field value.
   * @param signal - the abort signal of the Card request that started it.
   */
  async browserSignIn(domainInput: string, signal?: AbortSignal): Promise<ActionResponse> {
    // The reply's state is read after the attempt has fully ended.
    const response = await this.#browserSignIn(domainInput, signal)
    return { ...response, state: this.state(), models: this.#modelsState() }
  }

  async #browserSignIn(domainInput: string, signal?: AbortSignal): Promise<ActionResponse> {
    if (this.#signIn !== undefined) return this.#fail({ code: 'ALREADY_IN_FLIGHT' })
    let domain: string
    try {
      domain = normalizeDomain(domainInput)
    } catch (error) {
      return this.#fail(toCardError(error))
    }
    const authorization = this.#options.authorization()
    if (authorization === undefined) return this.#fail({ code: 'NO_FLOW' })

    let answered = false
    let unexpected = false
    const interaction = {
      notify: (notice: { message: string; url?: string; code?: string }) => {
        this.#pushNotice(notice)
      },
      prompt: async (prompt: AuthorizationPrompt): Promise<string> => {
        if (prompt.kind === 'text' && !answered) {
          answered = true
          return domainAnswer(domain)
        }
        unexpected = true
        throw new Error('Unexpected sign-in step')
      },
    }

    this.#busy += 1
    this.#signIn = { method: 'browser' }
    this.#notices = []
    const local = this.#beginSignIn(signal)
    try {
      let outcome: { readonly status: 'authorized' | 'cancelled' }
      try {
        outcome = await authorization.begin({ key: RECORD_KEY, method: 'oauth', interaction, signal: local })
      } catch (error) {
        return this.#fail(mapBeginError(error, unexpected))
      }
      if (outcome.status === 'cancelled' || local.aborted) return this.#cancelled()

      // pi-ai stored a new record: the previous login is gone (one record, A2),
      // and so are the models fetched with it (models.md A3).
      this.#options.models?.credentialChanged()
      const record = await this.#readRecord()
      if (record === undefined) {
        this.#clearSignedIn()
        return this.#fail({ code: 'UNREADABLE_RECORD' })
      }
      return this.#respond(await this.#verifyRecord(record, domain))
    } finally {
      this.#endSignIn()
    }
  }

  /** Cancel a running browser sign-in (A4). */
  cancel(): ActionResponse {
    this.#options.authorization()?.cancel(RECORD_KEY)
    return this.#ok()
  }

  /**
   * PAT sign-in (A5): the lookup runs before anything is stored.
   * @param domainInput - the Domain field value.
   * @param pat - the token as pasted.
   * @param signal - the abort signal of the Card request.
   */
  async patSignIn(domainInput: string, pat: string, signal?: AbortSignal): Promise<ActionResponse> {
    // The reply's state is read after the attempt has fully ended.
    const response = await this.#patSignIn(domainInput, pat, signal)
    return { ...response, state: this.state(), models: this.#modelsState() }
  }

  async #patSignIn(domainInput: string, pat: string, signal?: AbortSignal): Promise<ActionResponse> {
    if (this.#signIn !== undefined) return this.#fail({ code: 'ALREADY_IN_FLIGHT' })
    let domain: string
    try {
      domain = normalizeDomain(domainInput)
    } catch (error) {
      return this.#fail(toCardError(error))
    }
    const token = pat.trim()
    if (token === '') return this.#fail({ code: 'BAD_REQUEST', params: { message: 'the personal access token is empty' } })
    const authorization = this.#options.authorization()
    const entry = authorization?.describe(RECORD_KEY)
    // Checked before the lookup so a refused sign-in sends no request.
    if (authorization === undefined || entry === undefined) return this.#fail({ code: 'NO_FLOW' })
    if (entry.inFlight) return this.#fail({ code: 'ALREADY_IN_FLIGHT' })

    this.#busy += 1
    this.#signIn = { method: 'pat' }
    this.#checking += 1
    const local = this.#beginSignIn(signal)
    try {
      let result
      try {
        result = await lookupCopilotHost({ fetch: this.#options.fetch, domain, credential: token, signal: local })
      } catch (error) {
        if (error instanceof LookupCancelled) return this.#cancelled()
        return this.#fail(toCardError(error))
      } finally {
        this.#checking -= 1
      }
      if (this.#disposed || local.aborted) return this.#cancelled()

      let answered = false
      let unexpected = false
      const interaction = {
        notify: () => {},
        prompt: async (prompt: AuthorizationPrompt): Promise<string> => {
          if (prompt.kind === 'secret' && !answered) {
            answered = true
            return token
          }
          unexpected = true
          throw new Error('Unexpected sign-in step')
        },
      }
      let outcome: { readonly status: 'authorized' | 'cancelled' }
      try {
        outcome = await authorization.begin({ key: RECORD_KEY, method: 'api-key', interaction, signal: local })
      } catch (error) {
        return this.#fail(mapBeginError(error, unexpected))
      }
      if (outcome.status === 'cancelled' || local.aborted) return this.#cancelled()

      this.#withdrawLookups()
      // The new record replaces the old one, and the models fetched with it (models.md A3).
      this.#options.models?.credentialChanged()
      this.#recordMethod = 'pat'
      this.#lastCredential = { method: 'pat', secret: token }
      this.#verified = result.account === undefined ? { host: result.host } : { host: result.host, account: result.account }
      this.#error = undefined
      this.#changedOutside = false
      await this.#saveDomain(domain)
      this.#publish()
      await this.#fetchModels()
      return this.#ok()
    } finally {
      this.#endSignIn()
    }
  }

  /** Sign-out (A6). */
  async signOut(): Promise<ActionResponse> {
    const credentials = this.#options.credentials()
    if (credentials === undefined) return this.#fail({ code: 'INTERNAL', params: { message: 'the credentials service is not available' } })
    this.#busy += 1
    try {
      this.#signInAbort?.abort()
      this.#options.authorization()?.cancel(RECORD_KEY)
      this.#withdrawLookups()
      await credentials.deleteRecord(RECORD_KEY)
      this.#clearSignedIn()
      let envTokenSet = false
      try {
        envTokenSet = (await credentials.describe(ENV_TOKEN_REF)).configured
      } catch (error) {
        this.#options.logger.warn('github-copilot-models: could not check %s (%s)', ENV_TOKEN_REF, toCardError(error).code)
      }
      return { ok: true, envTokenSet, state: this.state(), models: this.#modelsState() }
    } finally {
      this.#busy -= 1
      this.#recheckMissedEvent()
    }
  }

  /**
   * `credentials/record-updated` for the shared key (A2). Sends no request.
   * While our own sign-in or sign-out runs, the event is noted and checked
   * once it ends: DSH lets a cancelled attempt's record write land later
   * (contract test "cancel() after pi-ai has queued its record write").
   */
  async recordUpdated(): Promise<void> {
    if (this.#disposed) return
    if (this.#busy > 0) {
      this.#missedRecordEvent = true
      return
    }
    const generation = this.#generation
    let record: CredentialRecord | undefined
    try {
      record = await this.#readRecord()
    } catch (error) {
      this.#options.logger.warn('github-copilot-models: could not read the changed credential record (%s)', toCardError(error).code)
      return
    }
    if (this.#disposed) return
    if (this.#busy > 0) {
      this.#missedRecordEvent = true
      return
    }
    if (generation !== this.#generation) return
    if (record === undefined) {
      this.#withdrawLookups()
      this.#clearSignedIn()
      return
    }
    const stored = readStoredCredential(record)
    if (sameCredential(stored, this.#lastCredential)) return
    this.#withdrawLookups()
    this.#recordMethod = methodOf(record)
    this.#lastCredential = undefined
    this.#error = undefined
    this.#changedOutside = true
    this.#clearVerified()
    // A different credential: the models fetched with the old one go (models.md A3).
    this.#options.models?.credentialChanged()
  }

  // ── internals ────────────────────────────────────────────────────────────

  /**
   * Mark our sign-in as running and return the signal that withdraws it:
   * the Card request's signal, sign-out, or dispose.
   */
  #beginSignIn(signal: AbortSignal | undefined): AbortSignal {
    const local = new AbortController()
    this.#signInAbort = local
    return signal === undefined ? local.signal : AbortSignal.any([signal, local.signal])
  }

  #endSignIn(): void {
    this.#signIn = undefined
    this.#signInAbort = undefined
    this.#busy -= 1
    this.#recheckMissedEvent()
  }

  /** Once no operation of ours runs, check a record event that arrived meanwhile. */
  #recheckMissedEvent(): void {
    if (this.#busy > 0 || !this.#missedRecordEvent) return
    this.#missedRecordEvent = false
    void this.recordUpdated()
  }

  /**
   * Run the host lookup for a stored record and keep the result. A failure
   * keeps the record and shows the error (start-up, Refresh, and a browser
   * sign-in whose lookup fails after pi-ai stored the record).
   * @param record - the stored record.
   * @param signInDomain - the domain of the browser sign-in that just stored it.
   */
  async #verifyRecord(record: CredentialRecord, signInDomain?: string): Promise<LookupOutcome> {
    this.#withdrawLookups()
    const generation = this.#generation
    const signal = this.#lookupAbort.signal
    this.#recordMethod = methodOf(record)
    this.#changedOutside = false
    const stored = readStoredCredential(record)
    if (stored === undefined) {
      this.#lastCredential = undefined
      this.#clearVerified()
      this.#error = { code: 'UNREADABLE_RECORD' }
      return { ok: false, error: this.#error }
    }
    if (!sameCredential(stored, this.#lastCredential)) {
      this.#clearVerified()
      // A credential the models were not fetched with (start-up: none were).
      if (this.#lastCredential !== undefined) this.#options.models?.credentialChanged()
    }
    this.#lastCredential = stored

    let domain: string
    try {
      domain = this.#domainFor(stored, signInDomain)
    } catch (error) {
      this.#clearVerified()
      this.#error = toCardError(error)
      return { ok: false, error: this.#error }
    }

    let verified = false
    this.#checking += 1
    try {
      const result = await lookupCopilotHost({ fetch: this.#options.fetch, domain, credential: stored.secret, signal })
      if (generation !== this.#generation || this.#disposed) return { ok: false, cancelled: true }
      this.#verified = result.account === undefined ? { host: result.host } : { host: result.host, account: result.account }
      this.#error = undefined
      this.#publish()
      // While signed in, the saved domain is the domain of the stored credential (A1).
      await this.#saveDomain(domain)
      verified = true
    } catch (error) {
      if (error instanceof LookupCancelled || generation !== this.#generation || this.#disposed) return { ok: false, cancelled: true }
      // A failed lookup keeps the models fetched before (models.md A3).
      this.#clearVerified()
      this.#error = toCardError(error)
      this.#options.logger.warn('github-copilot-models: Copilot host lookup failed (%s)', this.#error.code)
      return { ok: false, error: this.#error }
    } finally {
      this.#checking -= 1
    }
    // The lookup succeeded: fetch the models (models.md A3), after "checking" ends.
    if (verified && generation === this.#generation) await this.#fetchModels()
    return { ok: true }
  }

  /** Tell Models that a lookup succeeded, and wait for its fetch (models.md A3). */
  async #fetchModels(): Promise<void> {
    const output = this.output()
    const models = this.#options.models
    if (output === undefined || models === undefined || this.#disposed) return
    try {
      await models.lookupSucceeded(output)
    } catch (error) {
      this.#options.logger.warn('github-copilot-models: the /models fetch failed unexpectedly (%s)', toCardError(error).code)
    }
  }

  #modelsState(): ModelsState {
    return this.#options.models?.state() ?? NO_MODELS
  }

  /**
   * The domain to look a stored credential up on. A browser login was issued
   * by the domain pi-ai stored in the record; a PAT by the saved Domain field.
   */
  #domainFor(stored: StoredCredential, signInDomain: string | undefined): string {
    if (stored.method === 'browser') return normalizeDomain(stored.enterpriseUrl ?? signInDomain ?? '')
    return normalizeDomain(this.#options.readDomain())
  }

  async #readRecord(): Promise<CredentialRecord | undefined> {
    const credentials = this.#options.credentials()
    return credentials === undefined ? undefined : credentials.readRecord(RECORD_KEY)
  }

  async #saveDomain(domain: string): Promise<void> {
    const value = configDomain(domain)
    if (value === this.#options.readDomain()) return
    try {
      await this.#options.saveDomain(value)
    } catch (error) {
      this.#options.logger.warn('github-copilot-models: could not save the domain (%s)', toCardError(error).code)
    }
  }

  #pushNotice(notice: { message: string; url?: string; code?: string }): void {
    this.#noticeSeq += 1
    this.#notices.push({
      seq: this.#noticeSeq,
      message: typeof notice.message === 'string' ? notice.message : '',
      ...typeof notice.url === 'string' ? { url: notice.url } : {},
      ...typeof notice.code === 'string' ? { code: notice.code } : {},
    })
    if (this.#notices.length > NOTICE_LIMIT) this.#notices.splice(0, this.#notices.length - NOTICE_LIMIT)
  }

  #withdrawLookups(): void {
    this.#generation += 1
    this.#lookupAbort.abort()
    this.#lookupAbort = new AbortController()
  }

  #clearVerified(): void {
    if (this.#verified === undefined) return
    this.#verified = undefined
    this.#publish()
  }

  #clearSignedIn(): void {
    this.#recordMethod = undefined
    this.#lastCredential = undefined
    this.#error = undefined
    this.#changedOutside = false
    this.#clearVerified()
    // Sign-out, or the record removed: the models go too (models.md A3).
    this.#options.models?.credentialChanged()
  }

  #publish(): void {
    if (this.#disposed) return
    const output = this.output()
    const key = output === undefined ? '' : JSON.stringify(output)
    if (key === this.#lastOutput) return
    this.#lastOutput = key
    this.#options.onOutputChange?.(output)
  }

  #respond(outcome: LookupOutcome): ActionResponse {
    if (outcome.ok) return this.#ok()
    return 'cancelled' in outcome ? this.#cancelled() : this.#fail(outcome.error)
  }

  #ok(): ActionResponse {
    return { ok: true, state: this.state(), models: this.#modelsState() }
  }

  #fail(error: CardError): ActionResponse {
    return { ok: false, error, state: this.state(), models: this.#modelsState() }
  }

  #cancelled(): ActionResponse {
    return { ok: false, cancelled: true, state: this.state(), models: this.#modelsState() }
  }
}
