/**
 * Keeps the contract tests offline (AGENTS.md: no request to GitHub or Copilot).
 *
 * Importing this module, before anything else can run, replaces
 * `globalThis.fetch` and blocks every outgoing socket. A blocked attempt throws
 * where it happens, and is also recorded so the test fails loudly even when the
 * code under test swallows the error: the test that made it fails in
 * `afterEach`, and an attempt made after a test ended (an orphaned flow) fails
 * the file in `after`.
 *
 * A test that needs HTTP replies installs `fakeFetch()`, which answers from a
 * script and is removed again when the test ends.
 */
import net from 'node:net'
import { after, afterEach } from 'node:test'
import type { TestContext } from 'node:test'

const blocked: string[] = []
let reported = 0

function block(what: string): never {
  blocked.push(what)
  throw new Error(`contract tests are offline: blocked ${what}`)
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input)
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  // Like the real fetch, a request whose signal is already aborted never goes out.
  init?.signal?.throwIfAborted()
  return block(`fetch ${urlOf(input)}`)
}) as typeof fetch
net.Socket.prototype.connect = function connect() {
  return block('a socket connection')
} as typeof net.Socket.prototype.connect

afterEach(() => {
  const fresh = blocked.slice(reported)
  reported = blocked.length
  if (fresh.length > 0) throw new Error(`a real network request was attempted: ${fresh.join(', ')}`)
})

after(() => {
  const late = blocked.slice(reported)
  if (late.length > 0) throw new Error(`a real network request was attempted after a test ended: ${late.join(', ')}`)
})

/** One request the fake `fetch` received. */
export interface SeenRequest {
  method: string
  url: string
  headers: Headers
  body: string | undefined
}

/** Answers one request; throw for a request the script does not expect. */
export type Route = (request: SeenRequest) => Response | Promise<Response>

/**
 * Replace `fetch` for one test with a scripted one. Every request is recorded,
 * in order, and also appended to `timeline` as `"<METHOD> <url>"` when given.
 * An aborted request signal rejects, as the real `fetch` does.
 * @returns the recorded requests.
 */
export function fakeFetch(t: TestContext, route: Route, timeline?: string[]): SeenRequest[] {
  const seen: SeenRequest[] = []
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const request: SeenRequest = {
      method: (init.method ?? 'GET').toUpperCase(),
      url: urlOf(input),
      headers: new Headers(init.headers),
      body: init.body === undefined || init.body === null ? undefined : String(init.body),
    }
    seen.push(request)
    timeline?.push(`${request.method} ${request.url}`)
    init.signal?.throwIfAborted()
    return route(request)
  })
  return seen
}

/** A JSON reply. */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}
