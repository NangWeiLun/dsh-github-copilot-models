/**
 * The Card's calls to the plugin's Host (contract: src/shared/api.ts).
 *
 * Every route resolves `api/github-copilot-models/<route>` against
 * `document.baseURI`, so a mount prefix keeps working. `GET` for `state` and
 * `notices`, `POST` with a JSON body for the rest. DSH authenticates the
 * routes; its session cookie rides along (`credentials: 'same-origin'`).
 *
 * Replies are checked before use: a 2xx body must follow the contract, a
 * 400/500 body is an `ErrorResponse`, anything else is reported by status.
 */
import { ROUTE_BASE, ROUTES } from '../shared/api.ts'
import type {
  ActionResponse,
  BrowserBeginRequest,
  CardError,
  ErrorCode,
  GoneModel,
  InfoMessage,
  LastFetch,
  LimitCheck,
  LoginMethod,
  LoginState,
  ModelRow,
  ModelSizes,
  ModelsResponse,
  ModelsState,
  Notice,
  PatSaveRequest,
  Prices,
  PriceTier,
  ReasonCode,
  RouteName,
  SetHeadersRequest,
  SetLimitsRequest,
  SetVisibilityRequest,
  StoredChoice,
  Wire,
} from '../shared/api.ts'

/** Why a call produced no usable reply. */
export type Problem =
  /** The Host's own error (`ErrorResponse`, or `ActionResponse.error`). */
  | { readonly kind: 'card'; readonly error: CardError }
  /** A reply without a usable JSON body: 401/403/404, a proxy page, a non-JSON body. */
  | { readonly kind: 'http'; readonly status: number }
  /** The request did not complete. */
  | { readonly kind: 'network' }
  /** A 2xx JSON body that does not follow the contract. */
  | { readonly kind: 'reply' }
  /** A sign-in request did not complete (Host restart, connection lost). Set by the caller. */
  | { readonly kind: 'interrupted' }

/** Result of one call. `aborted`: the caller's signal fired (the page went away). */
export type CallResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'failed'; readonly problem: Problem }
  | { readonly kind: 'aborted' }

/** `GET state`. Local to the Host: never sends a request to GitHub. */
export function getState(signal?: AbortSignal): Promise<CallResult<LoginState>> {
  return call('state', { method: 'GET' }, parseState, signal)
}

/** `GET notices?after=<seq>`: notices newer than `after`. */
export function getNotices(after: number, signal?: AbortSignal): Promise<CallResult<readonly Notice[]>> {
  return call('notices', { method: 'GET' }, parseNotices, signal, { after: String(after) })
}

/** `POST browserBegin`. Stays pending until the sign-in ends; aborting `signal` cancels it. */
export function browserBegin(body: BrowserBeginRequest, signal?: AbortSignal): Promise<CallResult<ActionResponse>> {
  return post('browserBegin', body, signal)
}

/** `POST browserCancel`. */
export function browserCancel(signal?: AbortSignal): Promise<CallResult<ActionResponse>> {
  return post('browserCancel', {}, signal)
}

/** `POST patSave`. The PAT goes to the Host only and never comes back. */
export function patSave(body: PatSaveRequest, signal?: AbortSignal): Promise<CallResult<ActionResponse>> {
  return post('patSave', body, signal)
}

/** `POST signOut`. */
export function signOut(signal?: AbortSignal): Promise<CallResult<ActionResponse>> {
  return post('signOut', {}, signal)
}

/** `POST refresh`: runs the Copilot host lookup again (login.md A3), then the `/models` fetch (models.md A3). */
export function refresh(signal?: AbortSignal): Promise<CallResult<ActionResponse>> {
  return post('refresh', {}, signal)
}

/** `GET models`. Local to the Host. */
export function getModels(signal?: AbortSignal): Promise<CallResult<ModelsState>> {
  return call('models', { method: 'GET' }, parseModels, signal)
}

/** `POST setVisibility` (models.md A11). */
export function setVisibility(body: SetVisibilityRequest, signal?: AbortSignal): Promise<CallResult<ModelsResponse>> {
  return postModels('setVisibility', body, signal)
}

/** `POST setLimits` (models.md A11). */
export function setLimits(body: SetLimitsRequest, signal?: AbortSignal): Promise<CallResult<ModelsResponse>> {
  return postModels('setLimits', body, signal)
}

/** `POST setHeaders` (models.md A11). */
export function setHeaders(body: SetHeadersRequest, signal?: AbortSignal): Promise<CallResult<ModelsResponse>> {
  return postModels('setHeaders', body, signal)
}

function postModels(route: RouteName, body: object, signal: AbortSignal | undefined): Promise<CallResult<ModelsResponse>> {
  return call(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, parseModelsResponse, signal)
}

function post(route: RouteName, body: object, signal: AbortSignal | undefined): Promise<CallResult<ActionResponse>> {
  return call(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, parseAction, signal)
}

async function call<T>(
  route: RouteName,
  init: RequestInit,
  parse: (body: unknown) => T | undefined,
  signal: AbortSignal | undefined,
  query?: Readonly<Record<string, string>>,
): Promise<CallResult<T>> {
  const url = new URL(`api/${ROUTE_BASE}/${ROUTES[route]}`, document.baseURI)
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value)
  let status: number
  let text: string
  try {
    const response = await fetch(url, {
      ...init,
      headers: { accept: 'application/json', ...init.headers as Record<string, string> | undefined },
      credentials: 'same-origin',
      cache: 'no-store',
      ...signal === undefined ? {} : { signal },
    })
    status = response.status
    text = await response.text()
  } catch {
    return signal?.aborted === true ? { kind: 'aborted' } : { kind: 'failed', problem: { kind: 'network' } }
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return { kind: 'failed', problem: { kind: 'http', status } }
  }
  if (status >= 200 && status < 300) {
    const value = parse(body)
    return value === undefined ? { kind: 'failed', problem: { kind: 'reply' } } : { kind: 'ok', value }
  }
  if (status === 400 || status === 500) {
    const error = isRecord(body) ? parseCardError(body['error']) : undefined
    if (error !== undefined) return { kind: 'failed', problem: { kind: 'card', error } }
  }
  return { kind: 'failed', problem: { kind: 'http', status } }
}

/** Every code in the contract; a code outside it is shown as an `INTERNAL` message. */
const ERROR_CODES: Readonly<Record<ErrorCode, true>> = {
  INVALID_DOMAIN: true,
  NO_FLOW: true,
  ALREADY_IN_FLIGHT: true,
  DSH_ERROR: true,
  UNEXPECTED_PROMPT: true,
  SIGN_IN_FAILED: true,
  LOOKUP_FAILED: true,
  INVALID_API_ADDRESS: true,
  UNREADABLE_RECORD: true,
  NOT_SIGNED_IN: true,
  BAD_REQUEST: true,
  INTERNAL: true,
  MODELS_FAILED: true,
  LIMIT_REFUSED: true,
  HEADER_REFUSED: true,
  UNKNOWN_MODEL: true,
  SAVE_FAILED: true,
  ROUTE_IN_USE: true,
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERROR_CODES, value)
}

function isStatus(value: unknown): value is LoginState['status'] {
  return value === 'signed-out' || value === 'signed-in' || value === 'unverified'
}

function isMethod(value: unknown): value is LoginMethod {
  return value === 'browser' || value === 'pat'
}

/** A `CardError`, keeping only string and number params. */
export function parseCardError(value: unknown): CardError | undefined {
  if (!isRecord(value)) return undefined
  const { code } = value
  if (typeof code !== 'string' || code === '') return undefined
  if (!isErrorCode(code)) return { code: 'INTERNAL', params: { message: code } }
  const raw = value['params']
  if (!isRecord(raw)) return { code }
  const params: Record<string, string | number> = {}
  for (const [name, param] of Object.entries(raw)) {
    if (typeof param === 'string' || (typeof param === 'number' && Number.isFinite(param))) params[name] = param
  }
  return { code, params }
}

/** A `LoginState`: required fields must be right; a malformed optional field is dropped. */
export function parseState(value: unknown): LoginState | undefined {
  if (!isRecord(value)) return undefined
  const { status, domain, checking, flowAvailable, inFlight, changedOutside, noticeSeq } = value
  if (!isStatus(status) || typeof domain !== 'string') return undefined
  if (typeof checking !== 'boolean' || typeof flowAvailable !== 'boolean' || typeof inFlight !== 'boolean') return undefined
  if (typeof changedOutside !== 'boolean' || typeof noticeSeq !== 'number' || !Number.isFinite(noticeSeq)) return undefined
  const { method, account, copilotHost, signIn } = value
  const error = parseCardError(value['error'])
  return {
    status,
    domain,
    checking,
    flowAvailable,
    inFlight,
    changedOutside,
    noticeSeq,
    modelsFetching: value['modelsFetching'] === true,
    ...isMethod(method) ? { method } : {},
    ...typeof account === 'string' && account !== '' ? { account } : {},
    ...typeof copilotHost === 'string' && copilotHost !== '' ? { copilotHost } : {},
    ...isRecord(signIn) && isMethod(signIn['method']) ? { signIn: { method: signIn['method'] } } : {},
    ...error === undefined ? {} : { error },
  }
}

function parseNotices(value: unknown): readonly Notice[] | undefined {
  if (!isRecord(value)) return undefined
  const list: unknown = value['notices']
  if (!Array.isArray(list)) return undefined
  const notices: Notice[] = []
  for (const item of list as readonly unknown[]) {
    if (!isRecord(item)) continue
    const { seq, message, url, code } = item
    if (typeof seq !== 'number' || !Number.isFinite(seq) || typeof message !== 'string') continue
    notices.push({
      seq,
      message,
      ...typeof url === 'string' && url !== '' ? { url } : {},
      ...typeof code === 'string' && code !== '' ? { code } : {},
    })
  }
  return notices
}

function parseAction(value: unknown): ActionResponse | undefined {
  if (!isRecord(value)) return undefined
  const { ok, cancelled, envTokenSet } = value
  const state = parseState(value['state'])
  const models = parseModels(value['models'])
  if (typeof ok !== 'boolean' || state === undefined || models === undefined) return undefined
  const error = parseCardError(value['error'])
  return {
    ok,
    state,
    models,
    ...cancelled === true ? { cancelled: true } : {},
    ...error === undefined ? {} : { error },
    ...typeof envTokenSet === 'boolean' ? { envTokenSet } : {},
  }
}

function parseModelsResponse(value: unknown): ModelsResponse | undefined {
  if (!isRecord(value)) return undefined
  const models = parseModels(value['models'])
  if (typeof value['ok'] !== 'boolean' || models === undefined) return undefined
  const error = parseCardError(value['error'])
  return { ok: value['ok'], models, ...error === undefined ? {} : { error } }
}

// ── Models state (models.md A11). Malformed optional parts are dropped. ─────

const WIRES: readonly Wire[] = ['openai-responses', 'anthropic-messages', 'openai-completions']
const REASONS: readonly ReasonCode[] = ['NO_ID', 'NOT_CHAT', 'NO_ENDPOINT', 'NO_LIMITS', 'DUPLICATE_ID']

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Copy the listed number fields that are present. */
function numbers<K extends string>(value: Readonly<Record<string, unknown>>, keys: readonly K[]): Partial<Record<K, number>> {
  const result: Partial<Record<K, number>> = {}
  for (const key of keys) {
    const found = num(value[key])
    if (found !== undefined) result[key] = found
  }
  return result
}

function parseStored(value: unknown): StoredChoice {
  if (!isRecord(value)) return {}
  return {
    ...typeof value['visible'] === 'boolean' ? { visible: value['visible'] } : {},
    ...numbers(value, ['context', 'output'] as const),
  }
}

function parseSizes(value: unknown): ModelSizes | undefined {
  if (!isRecord(value)) return undefined
  const problem = isRecord(value['problem']) && typeof value['problem']['check'] === 'string'
    ? { check: value['problem']['check'] as LimitCheck, ...numbers(value['problem'], ['limit'] as const) }
    : undefined
  return {
    ...numbers(value, ['storedContext', 'storedOutput', 'copilotContext', 'copilotOutput', 'effectiveContext', 'effectiveOutput', 'longContext'] as const),
    ...problem === undefined ? {} : { problem },
  }
}

function parsePrices(value: unknown): Prices | undefined {
  if (!isRecord(value) || !Array.isArray(value['tiers'])) return undefined
  const tiers: PriceTier[] = []
  for (const tier of value['tiers'] as readonly unknown[]) {
    if (!isRecord(tier) || typeof tier['name'] !== 'string') continue
    tiers.push({ name: tier['name'], ...numbers(tier, ['maxPromptTokens', 'input', 'output', 'cacheRead', 'cacheWrite', 'cacheWrite1h'] as const) })
  }
  const batchSize = num(value['batchSize'])
  return batchSize === undefined ? { tiers } : { batchSize, tiers }
}

function parseInfo(value: unknown): InfoMessage[] | undefined {
  if (!Array.isArray(value)) return undefined
  const info = (value as readonly unknown[]).flatMap((entry): InfoMessage[] => {
    if (!isRecord(entry) || typeof entry['message'] !== 'string') return []
    const code = str(entry['code'])
    return [{ ...code === undefined ? {} : { code }, message: entry['message'] }]
  })
  return info.length === 0 ? undefined : info
}

function parseRow(value: unknown): ModelRow | undefined {
  if (!isRecord(value)) return undefined
  const { key, name, toggle } = value
  if (typeof key !== 'string' || typeof name !== 'string') return undefined
  if (toggle !== 'on' && toggle !== 'off' && toggle !== 'locked') return undefined
  const reason = REASONS.find((code) => code === value['reason'])
  const wire = WIRES.find((entry) => entry === value['wire'])
  const sizes = parseSizes(value['sizes'])
  const prices = parsePrices(value['prices'])
  const id = str(value['id'])
  const policy = str(value['policy'])
  const info = parseInfo(value['info'])
  return {
    key,
    name,
    toggle,
    stored: parseStored(value['stored']),
    row: value['row'],
    ...id === undefined ? {} : { id },
    ...reason === undefined ? {} : { reason },
    ...policy === undefined ? {} : { policy },
    ...info === undefined ? {} : { info },
    ...wire === undefined ? {} : { wire },
    ...sizes === undefined ? {} : { sizes },
    ...prices === undefined ? {} : { prices },
  }
}

function parseLastFetch(value: unknown): LastFetch | undefined {
  if (!isRecord(value)) return undefined
  const at = num(value['at'])
  const url = str(value['url'])
  if (at === undefined || url === undefined) return undefined
  const error = parseCardError(value['error'])
  const requestId = str(value['requestId'])
  const serviceRequestId = str(value['serviceRequestId'])
  return {
    at,
    url,
    ...numbers(value, ['status'] as const),
    ...requestId === undefined ? {} : { requestId },
    ...serviceRequestId === undefined ? {} : { serviceRequestId },
    ...error === undefined ? {} : { error },
  }
}

/** A `ModelsState`: the lists must be arrays; malformed entries are dropped. */
export function parseModels(value: unknown): ModelsState | undefined {
  if (!isRecord(value)) return undefined
  const { fetching, rows, gone, headers } = value
  if (typeof fetching !== 'boolean' || !Array.isArray(rows) || !Array.isArray(gone) || !isRecord(headers)) return undefined
  const parsedHeaders: Record<string, string> = {}
  for (const [name, header] of Object.entries(headers)) if (typeof header === 'string') parsedHeaders[name] = header
  const parsedGone: GoneModel[] = []
  for (const entry of gone as readonly unknown[]) {
    if (isRecord(entry) && typeof entry['id'] === 'string') parsedGone.push({ id: entry['id'], stored: parseStored(entry['stored']) })
  }
  const host = str(value['host'])
  const method = value['method']
  const lastFetch = parseLastFetch(value['lastFetch'])
  const routeError = parseCardError(value['routeError'])
  return {
    fetching,
    rows: (rows as readonly unknown[]).flatMap((row) => parseRow(row) ?? []),
    gone: parsedGone,
    headers: parsedHeaders,
    published: num(value['published']) ?? 0,
    ...host === undefined ? {} : { host },
    ...isMethod(method) ? { method } : {},
    ...numbers(value, ['fetchedAt'] as const),
    ...lastFetch === undefined ? {} : { lastFetch },
    ...routeError === undefined ? {} : { routeError },
  }
}
