/**
 * The `/models` request (models.md A2): one GET to the Copilot host, no
 * retry, a 10-second timeout, redirects refused. The token is passed in and
 * never appears in an error, a log line or the reply.
 */
import { LoginError } from './errors.ts'
import type { FetchLike } from './ports.ts'

/** `/models` timeout (models.md A2). */
export const MODELS_TIMEOUT_MS = 10_000

/** The Copilot API version the custom headers start with (models.md A2, A5). */
export const DEFAULT_API_VERSION = '2026-08-01'

/** The default custom headers (models.md A5, A6). */
export const DEFAULT_CUSTOM_HEADERS: Readonly<Record<string, string>> = { 'X-GitHub-Api-Version': DEFAULT_API_VERSION }

/** A `/models` request was withdrawn by its caller. */
export class ModelsCancelled extends Error {
  constructor() {
    super('/models request cancelled')
    this.name = 'ModelsCancelled'
  }
}

/** A successful fetch. */
export interface ModelsReply {
  readonly url: string
  readonly status: number
  readonly requestId?: string
  readonly serviceRequestId?: string
  /** The reply's `data` array, as received; never empty. */
  readonly data: readonly unknown[]
}

/**
 * Merge header sets in order; a later name replaces an earlier one, compared
 * without case (models.md A2, A6).
 */
export function mergeHeaders(...sets: readonly (Readonly<Record<string, string>> | undefined)[]): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const set of sets) {
    for (const [name, value] of Object.entries(set ?? {})) {
      for (const existing of Object.keys(merged)) {
        if (existing.toLowerCase() === name.toLowerCase()) delete merged[existing]
      }
      merged[name] = value
    }
  }
  return merged
}

/** Read the request ids Copilot returns (models.md B2). */
function requestIds(headers: Headers): { requestId?: string; serviceRequestId?: string } {
  const requestId = headers.get('x-github-request-id')
  const serviceRequestId = headers.get('x-copilot-service-request-id')
  return {
    ...requestId === null || requestId === '' ? {} : { requestId },
    ...serviceRequestId === null || serviceRequestId === '' ? {} : { serviceRequestId },
  }
}

/** The `message` of a JSON error body, when Copilot sent one. Never a token: it is Copilot's text. */
function errorMessage(text: string): string | undefined {
  try {
    const body: unknown = JSON.parse(text)
    if (typeof body !== 'object' || body === null) return undefined
    const record = body as Record<string, unknown>
    const nested = typeof record.error === 'object' && record.error !== null ? (record.error as Record<string, unknown>).message : undefined
    const message = typeof record.message === 'string' ? record.message : typeof nested === 'string' ? nested : undefined
    return message === undefined || message === '' ? undefined : message.slice(0, 300)
  } catch {
    const trimmed = text.trim()
    return trimmed === '' || trimmed.startsWith('<') ? undefined : trimmed.slice(0, 300)
  }
}

/**
 * Send `GET <host>/models`.
 * @param options.host - the Copilot host (an https origin, from Login).
 * @param options.token - the Copilot token or the PAT.
 * @param options.integrationId - the integration id of the login method.
 * @param options.customHeaders - applied last (models.md A6).
 * @param options.signal - withdraws the request; it then throws {@link ModelsCancelled}.
 * @returns the reply's rows.
 * @throws {LoginError} `MODELS_FAILED`, never containing the token.
 */
export async function fetchModels(options: {
  fetch: FetchLike
  host: string
  token: string
  integrationId: string
  customHeaders: Readonly<Record<string, string>>
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<ModelsReply> {
  const url = `${options.host}/models`
  const timeout = AbortSignal.timeout(options.timeoutMs ?? MODELS_TIMEOUT_MS)
  const signal = options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout])
  const failed = (reason: string, extra?: Record<string, string | number>, cause?: unknown): Error => {
    if (options.signal?.aborted === true) return new ModelsCancelled()
    return new LoginError('MODELS_FAILED', { url, ...extra, reason: timeout.aborted ? 'timeout' : reason }, { cause })
  }

  const headers = mergeHeaders(
    { Accept: 'application/json', Authorization: `Bearer ${options.token}`, 'Copilot-Integration-Id': options.integrationId },
    options.customHeaders,
  )
  let response: Response
  try {
    response = await options.fetch(url, { method: 'GET', headers, redirect: 'error', signal })
  } catch (error) {
    throw failed('network', undefined, error)
  }

  const ids = requestIds(response.headers)
  const facts: Record<string, string | number> = { status: response.status, ...ids }
  let text: string
  try {
    text = await response.text()
  } catch (error) {
    throw failed('network', facts, error)
  }
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after')
    const message = errorMessage(text)
    throw failed('http', {
      ...facts,
      ...retryAfter === null || retryAfter === '' ? {} : { retryAfter },
      ...message === undefined ? {} : { message },
    })
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw failed('not-json', facts)
  }
  const data = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).data : undefined
  if (!Array.isArray(data) || data.length === 0) throw failed('no-rows', facts)
  return { url, status: response.status, ...ids, data }
}
