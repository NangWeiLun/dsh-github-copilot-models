/**
 * Fakes for the Host ports: an in-memory credential store, an authorization
 * service that runs scripted flows the way DSH does (one attempt per key,
 * cancel → `cancelled`, a declined/failed prompt → throw), and a scripted
 * `fetch` that records every request.
 */
import { RECORD_KEY } from '../../src/host/ports.ts'
import type {
  AuthorizationInteraction,
  AuthorizationPort,
  AuthorizationPrompt,
  CredentialRecord,
  CredentialsPort,
  FetchLike,
} from '../../src/host/ports.ts'

/** The shared record, as the plugin names it (DSH's `recordKeyFor`). */
export const KEY = RECORD_KEY

/** An error shaped like DSH's `AuthorizationError`: name and a `code`. */
export class CodedError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'AuthorizationError'
    this.code = code
  }
}

/** An error shaped like pi-ai's `ModelsError`, which carries its own `code`. */
export class PiAiError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'ModelsError'
    this.code = code
  }
}

export class FakeCredentials implements CredentialsPort {
  records = new Map<string, CredentialRecord>()
  envConfigured = false
  listeners: ((key: string) => void)[] = []
  reads = 0
  describeCalls: string[] = []

  async readRecord(key: string): Promise<CredentialRecord | undefined> {
    this.reads += 1
    return this.records.get(key)
  }

  async deleteRecord(key: string): Promise<void> {
    const had = this.records.delete(key)
    if (had) this.emit(key)
  }

  async describe(ref: string): Promise<{ configured: boolean }> {
    this.describeCalls.push(ref)
    return { configured: this.envConfigured }
  }

  /** Commit a record the way `modifyRecord` does, firing `credentials/record-updated`. */
  write(key: string, record: CredentialRecord): void {
    this.records.set(key, record)
    this.emit(key)
  }

  emit(key: string): void {
    for (const listener of this.listeners) listener(key)
  }
}

/** A scripted flow body: runs inside `begin()` with the attempt's session. */
export type FlowScript = (session: {
  method: string
  signal: AbortSignal
  notify: AuthorizationInteraction['notify']
  prompt: (prompt: AuthorizationPrompt) => Promise<string>
  commit: (record: CredentialRecord) => void
}) => Promise<void>

export class FakeAuthorization implements AuthorizationPort {
  readonly credentials: FakeCredentials
  registered = true
  flows: Record<string, FlowScript> = {}
  begins: { key: string; method?: string }[] = []
  cancels: string[] = []
  #running: AbortController | undefined

  constructor(credentials: FakeCredentials) {
    this.credentials = credentials
  }

  describe(key: string): { inFlight: boolean } | undefined {
    if (key !== KEY || !this.registered) return undefined
    return { inFlight: this.#running !== undefined }
  }

  cancel(key: string): void {
    this.cancels.push(key)
    if (key === KEY) this.#running?.abort()
  }

  async begin(request: Parameters<AuthorizationPort['begin']>[0]): Promise<{ status: 'authorized' | 'cancelled' }> {
    this.begins.push({ key: request.key, ...request.method === undefined ? {} : { method: request.method } })
    if (!this.registered || request.key !== KEY) throw new CodedError(`no authorization flow is registered for "${request.key}"`, 'NO_FLOW')
    const method = request.method ?? 'oauth'
    const script = this.flows[method]
    if (script === undefined) throw new CodedError(`offers no method "${method}"`, 'UNKNOWN_METHOD')
    if (this.#running !== undefined) throw new CodedError('already running', 'ALREADY_IN_FLIGHT')
    if (request.signal?.aborted === true) return { status: 'cancelled' }
    const controller = new AbortController()
    const withdraw = () => controller.abort()
    request.signal?.addEventListener('abort', withdraw, { once: true })
    this.#running = controller
    let committed = false
    try {
      const withdrawn = new Promise<'withdrawn'>((resolve) => {
        controller.signal.addEventListener('abort', () => resolve('withdrawn'), { once: true })
      })
      const run = script({
        method,
        signal: controller.signal,
        notify: (notice) => request.interaction.notify(notice),
        prompt: (prompt) => request.interaction.prompt(prompt),
        commit: (record) => {
          committed = true
          this.credentials.write(KEY, record)
        },
      })
      try {
        if (await Promise.race([run.then(() => 'ran' as const), withdrawn]) === 'withdrawn') {
          run.catch(() => {})
          return { status: 'cancelled' }
        }
      } catch (error) {
        if (controller.signal.aborted) return { status: 'cancelled' }
        throw error
      }
      if (!committed) throw new CodedError('resolved without committing', 'NOT_COMMITTED')
      return { status: 'authorized' }
    } finally {
      request.signal?.removeEventListener('abort', withdraw)
      this.#running = undefined
    }
  }
}

/** pi-ai's api-key flow: one secret prompt, then `{ kind: 'api-key', key }` (login.md B2). */
export const patFlow: FlowScript = async (session) => {
  const key = await session.prompt({ kind: 'secret', message: 'Enter GitHub Copilot token' })
  session.commit({ kind: 'api-key', key })
}

/** pi-ai's oauth flow, scripted: one text prompt, a device-code notice, then a grant. */
export function browserFlow(options: {
  refresh?: string
  /** Called with the domain answer; return the stored `enterpriseUrl`. */
  onAnswer?: (answer: string) => void
  /** Resolve to continue after the notice (lets a test cancel meanwhile). */
  approve?: Promise<void>
  extraPrompt?: AuthorizationPrompt
  failWith?: Error
}): FlowScript {
  return async (session) => {
    const answer = await session.prompt({ kind: 'text', message: 'GitHub Enterprise URL/domain (blank for github.com)' })
    options.onAnswer?.(answer)
    if (options.extraPrompt !== undefined) await session.prompt(options.extraPrompt)
    session.notify({ message: 'Enter this code on the verification page to finish signing in.', url: 'https://github.com/login/device', code: 'ABCD-1234' })
    if (options.approve !== undefined) {
      await Promise.race([
        options.approve,
        new Promise<void>((_, reject) => session.signal.addEventListener('abort', () => reject(new Error('Login cancelled')), { once: true })),
      ])
    }
    if (options.failWith !== undefined) throw options.failWith
    const enterpriseUrl = answer.trim() === '' ? undefined : answer.trim()
    session.commit({
      kind: 'grant',
      payload: {
        type: 'oauth',
        refresh: options.refresh ?? 'gho_login_token',
        access: 'tid=1;exp=2',
        expires: Date.now() + 3_600_000,
        ...enterpriseUrl === undefined ? {} : { enterpriseUrl },
        availableModelIds: [],
      },
    })
  }
}

/** One recorded request. */
export interface RecordedRequest {
  readonly url: string
  readonly init: RequestInit
}

/** A scripted reply: a Response, a thrown error, or a function of the request. */
export type Reply = Response | Error | ((request: RecordedRequest) => Response | Promise<Response>)

export class FakeFetch {
  readonly requests: RecordedRequest[] = []
  readonly replies: Reply[] = []

  readonly fetch: FetchLike = async (url, init) => {
    const request = { url, init }
    this.requests.push(request)
    const reply = this.replies.shift()
    if (reply === undefined) throw new Error(`unexpected request to ${url}`)
    if (reply instanceof Error) throw reply
    if (typeof reply === 'function') return reply(request)
    return reply
  }
}

/** A JSON reply like GitHub's `/copilot_internal/user`. */
export function userReply(body: unknown = { login: 'octocat', endpoints: { api: 'https://api.business.githubcopilot.com' } }, init: ResponseInit & { requestId?: string } = {}): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (init.requestId !== undefined) headers.set('x-github-request-id', init.requestId)
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: init.status ?? 200, headers })
}

/** Resolve on the next macrotask, so pending promise chains settle. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
