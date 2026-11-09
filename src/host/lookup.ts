/**
 * The Copilot host lookup (login.md A3): one request, no retry, no fallback.
 */
import { LoginError, LookupCancelled } from './errors.ts'
import type { FetchLike } from './ports.ts'

/** Lookup timeout (login.md A3). */
export const LOOKUP_TIMEOUT_MS = 10_000

/** What a successful lookup yields. */
export interface LookupResult {
  /** The Copilot host: the validated origin of `endpoints.api`. */
  readonly host: string
  /** The GitHub account name (`login`), when the reply has one. */
  readonly account?: string
}

/** The lookup URL for a normalised domain. */
export function lookupUrl(domain: string): string {
  return `https://api.${domain}/copilot_internal/user`
}

/**
 * Validate `endpoints.api` (login.md A3).
 * @param value - the field as received.
 * @returns the origin, or undefined when the value is not a valid address.
 */
export function validateApiAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  if (url.username !== '' || url.password !== '') return undefined
  // URL drops a port equal to the scheme default, so 443 reads as ''.
  if (url.port !== '') return undefined
  if (url.pathname !== '/') return undefined
  if (url.search !== '' || url.hash !== '' || /[?#]/.test(value)) return undefined
  return url.origin
}

/**
 * Run the host lookup.
 * @param options.fetch - the fetch to send the request with.
 * @param options.domain - a normalised domain.
 * @param options.credential - the login token (browser) or the PAT.
 * @param options.signal - withdraws the lookup; it then throws {@link LookupCancelled}.
 * @param options.timeoutMs - defaults to {@link LOOKUP_TIMEOUT_MS}.
 * @returns the Copilot host and account name.
 * @throws {LoginError} `LOOKUP_FAILED` or `INVALID_API_ADDRESS`; never containing the credential.
 */
export async function lookupCopilotHost(options: {
  fetch: FetchLike
  domain: string
  credential: string
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<LookupResult> {
  const url = lookupUrl(options.domain)
  const timeout = AbortSignal.timeout(options.timeoutMs ?? LOOKUP_TIMEOUT_MS)
  const signal = options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout])
  const failed = (reason: string, extra?: Record<string, string | number>, cause?: unknown): LoginError => {
    if (options.signal?.aborted === true) return new LookupCancelled() as never
    return new LoginError('LOOKUP_FAILED', { url, ...extra, reason: timeout.aborted ? 'timeout' : reason }, { cause })
  }

  let response: Response
  try {
    response = await options.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `token ${options.credential}` },
      redirect: 'error',
      signal,
    })
  } catch (error) {
    throw failed('network', undefined, error)
  }

  const requestId = response.headers.get('x-github-request-id')
  const facts: Record<string, string | number> = { status: response.status }
  if (requestId !== null && requestId !== '') facts.requestId = requestId

  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw failed('http', facts)
  }

  let text: string
  try {
    text = await response.text()
  } catch (error) {
    throw failed('network', facts, error)
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw failed('not-json', facts)
  }

  const record = typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const endpoints = record.endpoints
  const api = typeof endpoints === 'object' && endpoints !== null ? (endpoints as Record<string, unknown>).api : undefined
  if (api === undefined || api === null) throw failed('missing-api', facts)

  const host = validateApiAddress(api)
  if (host === undefined) throw new LoginError('INVALID_API_ADDRESS', { url, ...facts })

  const login = record.login
  return typeof login === 'string' && login !== '' ? { host, account: login } : { host }
}
