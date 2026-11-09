/**
 * The Card ↔ Host routes: Login's seven (login.md A10) and Models' four
 * (models.md A11), exact routes under `/api/github-copilot-models/`,
 * registered with `ctx.connection.fetch.register`, which DSH authenticates.
 * JSON in, JSON out. No route ever returns a token.
 */
import type { ActionResponse, CardError, ErrorResponse, ModelsResponse, NoticesResponse, RouteName, SetLimitsRequest, SetVisibilityRequest } from '../shared/api.ts'
import { ROUTE_BASE, ROUTES } from '../shared/api.ts'
import { messageOf } from './errors.ts'
import type { LoginController } from './login.ts'
import type { ModelsController } from './models.ts'

/** One exact route, in the shape `ctx.connection.fetch.register` takes. */
export interface FetchRoute {
  readonly path: string
  readonly methods: readonly ('GET' | 'POST')[]
  readonly requestBody: 'buffered'
  readonly fetch: (request: Request) => Promise<Response>
}

/** Largest accepted JSON body; a PAT and a domain are far smaller. */
const MAX_BODY_BYTES = 16 * 1024

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

/** Absolute path of one route. */
export function routePath(route: RouteName): string {
  return `/api/${ROUTE_BASE}/${ROUTES[route]}`
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function errorResponse(status: number, error: CardError): Response {
  const body: ErrorResponse = { error }
  return json(status, body)
}

/** A request the Card should never send. */
class BadRequest extends Error {}

/** Read a small JSON object body. */
async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new BadRequest('the request body is too large')
  if (text.trim() === '') return {}
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new BadRequest('the request body is not JSON')
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BadRequest('the request body is not a JSON object')
  return value as Record<string, unknown>
}

function stringField(body: Record<string, unknown>, name: string): string {
  const value = body[name] ?? ''
  if (typeof value !== 'string') throw new BadRequest(`"${name}" must be a string`)
  return value
}

/** A required, non-empty model id. */
function idField(body: Record<string, unknown>): string {
  const id = body.id
  if (typeof id !== 'string' || id === '') throw new BadRequest('"id" must be a non-empty string')
  return id
}

/** An optional size: a number, or absent. Range checks are the controller's (models.md A4). */
function sizeField(body: Record<string, unknown>, name: string): number | undefined {
  const value = body[name]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequest(`"${name}" must be a number`)
  return value
}

/** Body of `setVisibility` (models.md A11). */
function visibilityRequest(body: Record<string, unknown>): SetVisibilityRequest {
  const id = idField(body)
  if (body.clear === true) return { id, clear: true }
  if (typeof body.on !== 'boolean') throw new BadRequest('"on" must be a boolean, or "clear" true')
  return { id, on: body.on }
}

/** Body of `setLimits` (models.md A11). */
function limitsRequest(body: Record<string, unknown>): SetLimitsRequest {
  const id = idField(body)
  if (body.clear === true) return { id, clear: true }
  const context = sizeField(body, 'context')
  const output = sizeField(body, 'output')
  return { id, ...context === undefined ? {} : { context }, ...output === undefined ? {} : { output } }
}

/** Body of `setHeaders` (models.md A11): an object of string values. */
function headersRequest(body: Record<string, unknown>): Record<string, string> {
  const headers = body.headers
  if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) throw new BadRequest('"headers" must be an object')
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== 'string') throw new BadRequest(`header "${name}" must have a string value`)
    result[name] = value
  }
  return result
}

/**
 * Wrap a handler: a malformed request answers 400, any other throw 500. The
 * answer carries only the error message, which never contains a token.
 */
function handle(run: (request: Request) => Promise<unknown>): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return json(200, await run(request))
    } catch (error) {
      if (error instanceof BadRequest) return errorResponse(400, { code: 'BAD_REQUEST', params: { message: error.message } })
      return errorResponse(500, { code: 'INTERNAL', params: { message: messageOf(error) } })
    }
  }
}

/**
 * Build the routes over the login and models controllers.
 * @param login - the login controller.
 * @param models - the models controller.
 * @returns the routes to register.
 */
export function createRoutes(login: LoginController, models: ModelsController): FetchRoute[] {
  const get = (route: RouteName, run: (request: Request) => Promise<unknown>): FetchRoute => ({
    path: routePath(route),
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: handle(run),
  })
  const post = (route: RouteName, run: (request: Request) => Promise<ActionResponse | ModelsResponse>): FetchRoute => ({
    path: routePath(route),
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: handle(run),
  })
  return [
    get('state', async () => login.state()),
    get('notices', async (request) => {
      const after = Number(new URL(request.url).searchParams.get('after') ?? '0')
      if (!Number.isFinite(after) || after < 0) throw new BadRequest('"after" must be a non-negative number')
      const body: NoticesResponse = { notices: login.notices(after) }
      return body
    }),
    post('browserBegin', async (request) => {
      const body = await readJsonObject(request)
      // The request's signal aborts when the Card's connection closes, which
      // cancels the sign-in (login.md A4 step 2, B4).
      return login.browserSignIn(stringField(body, 'domain'), request.signal)
    }),
    post('browserCancel', async (request) => {
      await readJsonObject(request)
      return login.cancel()
    }),
    post('patSave', async (request) => {
      const body = await readJsonObject(request)
      return login.patSignIn(stringField(body, 'domain'), stringField(body, 'pat'), request.signal)
    }),
    post('signOut', async (request) => {
      await readJsonObject(request)
      return login.signOut()
    }),
    post('refresh', async (request) => {
      await readJsonObject(request)
      return login.refresh()
    }),
    get('models', async () => models.state()),
    post('setVisibility', async (request) => models.setVisibility(visibilityRequest(await readJsonObject(request)))),
    post('setLimits', async (request) => models.setLimits(limitsRequest(await readJsonObject(request)))),
    post('setHeaders', async (request) => models.setHeaders(headersRequest(await readJsonObject(request)))),
  ]
}
