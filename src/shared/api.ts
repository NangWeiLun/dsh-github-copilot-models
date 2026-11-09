/**
 * Card ↔ Host contract of the Login component (login.md A10) and the Models
 * component (models.md A11).
 *
 * Shared by both halves: types and constants only, no runtime dependencies.
 * Nothing here ever carries a token.
 *
 * Every route lives at `/api/github-copilot-models/<route>` on the Host. The
 * Card resolves `api/github-copilot-models/<route>` against `document.baseURI`
 * so a mount prefix keeps working. DSH authenticates every route
 * (`ctx.connection.fetch.register`); the browser session cookie rides along.
 */

/** Path segment below `/api` that every route of this plugin shares. */
export const ROUTE_BASE = 'github-copilot-models'

/** Route names. `GET` for `state`, `notices` and `models`, `POST` with a JSON body for the rest. */
export const ROUTES = {
  /** `GET` → {@link LoginState}. Local only: never sends a request to GitHub. */
  state: 'state',
  /** `GET ?after=<seq>` → {@link NoticesResponse}: notices newer than `after`. */
  notices: 'notices',
  /** `POST` {@link BrowserBeginRequest} → {@link ActionResponse}. Pending until the attempt and its `/models` fetch end. */
  browserBegin: 'browserBegin',
  /** `POST {}` → {@link ActionResponse}. Cancels the running attempt for the shared key. */
  browserCancel: 'browserCancel',
  /** `POST` {@link PatSaveRequest} → {@link ActionResponse}. Pending until the `/models` fetch ends. */
  patSave: 'patSave',
  /** `POST {}` → {@link ActionResponse} with `envTokenSet`. */
  signOut: 'signOut',
  /** `POST {}` → {@link ActionResponse}. Runs the host lookup again (login.md A3), then the `/models` fetch (models.md A3). */
  refresh: 'refresh',
  /** `GET` → {@link ModelsState}. Local only. */
  models: 'models',
  /** `POST` {@link SetVisibilityRequest} → {@link ModelsResponse}. */
  setVisibility: 'setVisibility',
  /** `POST` {@link SetLimitsRequest} → {@link ModelsResponse}. */
  setLimits: 'setLimits',
  /** `POST` {@link SetHeadersRequest} → {@link ModelsResponse}. */
  setHeaders: 'setHeaders',
} as const

export type RouteName = keyof typeof ROUTES

/** How the stored credential was obtained. */
export type LoginMethod = 'browser' | 'pat'

/**
 * `Copilot-Integration-Id` per login method (models.md A1). Copilot accepts a
 * PAT only with `copilot-developer-cli`; a browser sign-in sends `vscode-chat`,
 * the value pi-ai uses. The Host sends it, and the Card shows it under each method.
 */
export const INTEGRATION_ID = { browser: 'vscode-chat', pat: 'copilot-developer-cli' } as const satisfies Record<LoginMethod, string>

/**
 * Error codes, one per row of login.md A8 plus the Card-only and Host-only
 * cases. The Card turns a code and its params into localized text.
 */
export type ErrorCode =
  /** A8: `domain` cannot be parsed. No request was sent. */
  | 'INVALID_DOMAIN'
  /** A8: DSH's `llm-pi-ai` plugin is off (`NO_FLOW`). */
  | 'NO_FLOW'
  /** A8: a sign-in is already running for the shared key (`ALREADY_IN_FLIGHT`). */
  | 'ALREADY_IN_FLIGHT'
  /** A8: any other DSH authorization code. Params: `code`. */
  | 'DSH_ERROR'
  /** A8: the pi-ai flow asked something the Host does not answer. */
  | 'UNEXPECTED_PROMPT'
  /** A8: any other failure inside the pi-ai flow. Params: `message` (pi-ai's, as received). */
  | 'SIGN_IN_FAILED'
  /**
   * A8: the host lookup (A3) failed. Params: `url`, optional `status`,
   * optional `requestId` (`x-github-request-id`), and `reason`
   * ({@link LookupFailureReason}).
   */
  | 'LOOKUP_FAILED'
  /** A8: `endpoints.api` fails validation. Params: `url` (the lookup URL). */
  | 'INVALID_API_ADDRESS'
  /** The stored record holds no credential the plugin can read. Sign out and sign in again. */
  | 'UNREADABLE_RECORD'
  /** Refresh was pressed with no stored record. */
  | 'NOT_SIGNED_IN'
  /** The Card sent a malformed request. Params: `message`. */
  | 'BAD_REQUEST'
  /** Unexpected Host failure. Params: `message`. */
  | 'INTERNAL'
  /**
   * models.md A10: the `/models` fetch failed. Params: `url`, `reason`
   * ({@link ModelsFailureReason}), optional `status`, `requestId`
   * (`x-github-request-id`), `serviceRequestId` (`x-copilot-service-request-id`),
   * `retryAfter` (429), and `message` (Copilot's own message for a 400, or
   * pi-ai's for a failed token refresh).
   */
  | 'MODELS_FAILED'
  /** models.md A10: a size failed a check (A4). Params: `check` ({@link LimitCheck}), `limit`. */
  | 'LIMIT_REFUSED'
  /**
   * models.md A10: a custom header was refused. Params: `name`, and `reason`
   * (`invalid`: `new Headers()` refused the pair, `message` holds its error;
   * `duplicate`: the name is given twice; `empty`: the name is empty).
   */
  | 'HEADER_REFUSED'
  /** A model id the plugin has no row and no stored choice for. Params: `id`. */
  | 'UNKNOWN_MODEL'
  /** A stored choice could not be saved. Params: `message`. */
  | 'SAVE_FAILED'
  /** models.md A10: another plugin holds the route id (`DUPLICATE_ADAPTER`). Params: `route`. */
  | 'ROUTE_IN_USE'

/** Why a `/models` fetch failed; rides `MODELS_FAILED` as `params.reason`. */
export type ModelsFailureReason =
  /** No reply within 10 seconds. */
  | 'timeout'
  /** The request did not complete (DNS, TLS, connection, refused redirect). */
  | 'network'
  /** A non-2xx status; `params.status` holds it. */
  | 'http'
  /** The body is not JSON. */
  | 'not-json'
  /** The JSON has no `data` array, or it is empty. */
  | 'no-rows'
  /** pi-ai could not refresh the Copilot token; `params.message` holds pi-ai's message. */
  | 'token-refresh'

/** Why a host lookup failed; rides `LOOKUP_FAILED` as `params.reason`. */
export type LookupFailureReason =
  /** No reply within 10 seconds. */
  | 'timeout'
  /** The request did not complete (DNS, TLS, connection, refused redirect). */
  | 'network'
  /** A non-2xx status; `params.status` holds it. */
  | 'http'
  /** The body is not JSON. */
  | 'not-json'
  /** The JSON has no `endpoints.api`. */
  | 'missing-api'

/** One error for the Card to show. Never carries a token. */
export interface CardError {
  readonly code: ErrorCode
  readonly params?: Readonly<Record<string, string | number>>
}

/** One notice from the running browser sign-in (login.md A4 step 4). */
export interface Notice {
  /** Increases by one for every notice the Host stores, across attempts. */
  readonly seq: number
  readonly message: string
  /** A page the user opens to continue, shown as received. */
  readonly url?: string
  /** The code the user types on that page. */
  readonly code?: string
}

/** Everything the Card shows. */
export interface LoginState {
  /**
   * `signed-out`: no stored record. `signed-in`: a record and a successful host
   * lookup for it. `unverified`: a record, but no successful lookup for it yet
   * (start-up or Refresh failed, a lookup is running, or it changed outside
   * the plugin).
   */
  readonly status: 'signed-out' | 'signed-in' | 'unverified'
  /** Method of the stored record, when one exists. */
  readonly method?: LoginMethod
  /** GitHub account name from the last successful lookup (`login`). */
  readonly account?: string
  /** Copilot host from the last successful lookup (`endpoints.api` origin). */
  readonly copilotHost?: string
  /** Saved Domain field value; empty means github.com (login.md A1). */
  readonly domain: string
  /** A host lookup is running (start-up, Refresh, or after a sign-in). */
  readonly checking: boolean
  /** DSH's llm-pi-ai GitHub Copilot sign-in flow is registered. */
  readonly flowAvailable: boolean
  /** An attempt is running for the shared key, from any surface (B4). */
  readonly inFlight: boolean
  /** This plugin's own running sign-in, if any. */
  readonly signIn?: { readonly method: LoginMethod }
  /** Last host-lookup failure for the stored record (start-up or Refresh). */
  readonly error?: CardError
  /** The record was replaced outside the plugin; the Card says "Press Refresh" (A2). */
  readonly changedOutside: boolean
  /** Sequence number of the newest stored notice (0 when none). */
  readonly noticeSeq: number
  /** A `/models` fetch runs (models.md A3); the Card re-reads `models` meanwhile (A11). */
  readonly modelsFetching: boolean
}

/** Body of `browserBegin`. */
export interface BrowserBeginRequest {
  /** Domain field value as typed; the Host normalizes it (A1). */
  readonly domain: string
}

/** Body of `patSave`. The PAT travels to the Host only, never back. */
export interface PatSaveRequest {
  readonly domain: string
  readonly pat: string
}

/** Reply of every Login `POST` route. */
export interface ActionResponse {
  /** The action succeeded (for a sign-in: signed in). */
  readonly ok: boolean
  /** A sign-in ended as cancelled (by Cancel, Sign out, or a closed page). */
  readonly cancelled?: boolean
  /** Why the action failed. */
  readonly error?: CardError
  /** `signOut` only: `COPILOT_GITHUB_TOKEN` is still set (login.md A6 step 4). */
  readonly envTokenSet?: boolean
  /** State after the action. */
  readonly state: LoginState
  /** Models state after the action (models.md A11). */
  readonly models: ModelsState
}

/** Reply of `notices`. */
export interface NoticesResponse {
  readonly notices: readonly Notice[]
}

/** Reply of any route for a malformed request (HTTP 400) or a Host failure (HTTP 500). */
export interface ErrorResponse {
  readonly error: CardError
}

// ── Models (models.md A4–A11) ───────────────────────────────────────────────

/** How Copilot's model requests are sent (models.md A7). */
export type Wire = 'openai-responses' | 'anthropic-messages' | 'openai-completions'

/** Why a row cannot be served, the first that applies (models.md A10). */
export type ReasonCode = 'NO_ID' | 'NOT_CHAT' | 'NO_ENDPOINT' | 'NO_LIMITS' | 'DUPLICATE_ID'

/** A size check (models.md A4); rides `LIMIT_REFUSED` and {@link ModelSizes.problem}. */
export type LimitCheck =
  /** A typed value is not digits 0–9 only: the Card's own check as you type (models.md A4); the Host never reports it. */
  | 'not-digits'
  /** A typed value is not a positive integer. */
  | 'not-positive'
  /** context ≤ `max_context_window_tokens`. */
  | 'context-above-window'
  /** output ≤ `max_output_tokens`. */
  | 'output-above-max'
  /** output < context. */
  | 'output-not-below-context'
  /** context − output ≤ the row's prompt limit: the long tier's `max_prompt_tokens`, else the default tier's. */
  | 'prompt-above-tier'

/** The toggle (models.md A4). */
export type ToggleState = 'on' | 'off' | 'locked'

/** A row's sizes (models.md A4). */
export interface ModelSizes {
  /** Stored sizes, when any. */
  readonly storedContext?: number
  readonly storedOutput?: number
  /** Copilot's values (A4), when the reply gives them. On a two-tier row, Copilot's context is the Default size. */
  readonly copilotContext?: number
  readonly copilotOutput?: number
  /** The sizes DSH sees; absent when the model would have no context size. */
  readonly effectiveContext?: number
  readonly effectiveOutput?: number
  /** The Long size: present on a two-tier row only. */
  readonly longContext?: number
  /** A stored size that no longer passes; Copilot's values apply. */
  readonly problem?: { readonly check: LimitCheck; readonly limit?: number }
}

/** One price tier as received (models.md A4, B3). Missing prices are absent. */
export interface PriceTier {
  readonly name: string
  readonly maxPromptTokens?: number
  readonly input?: number
  readonly output?: number
  readonly cacheRead?: number
  readonly cacheWrite?: number
  readonly cacheWrite1h?: number
}

/** A row's prices: `undefined` on the row means "Price not reported by Copilot". */
export interface Prices {
  readonly batchSize?: number
  readonly tiers: readonly PriceTier[]
}

/** One model's block on the Card (models.md A4). */
export interface ModelRow {
  /** The row's `id`; the row's index as text for a row without one (`NO_ID`). */
  readonly key: string
  readonly id?: string
  /** `name`, or `id` when the row has no name. */
  readonly name: string
  readonly toggle: ToggleState
  readonly reason?: ReasonCode
  /** `policy.state` as received; the Card shows it only when it is not `enabled` (models.md A4). */
  readonly policy?: string
  /** The row's `info_messages` that carry a text, as received (models.md A4). */
  readonly info?: readonly InfoMessage[]
  readonly wire?: Wire
  /** Absent for a locked row. */
  readonly sizes?: ModelSizes
  readonly prices?: Prices
  /** Stored choices for this id. */
  readonly stored: StoredChoice
  /** The row as received. */
  readonly row: unknown
}

/** One of a row's `info_messages`, as received (models.md B3). */
export interface InfoMessage {
  /** For example `model_pending_deprecation`. */
  readonly code?: string
  readonly message: string
}

/** The info message code of a planned retirement: amber on the Card, "Deprecating" in the picker (models.md A4, A9). */
export const PENDING_DEPRECATION = 'model_pending_deprecation'

/** The stored choices for one id (models.md A5). */
export interface StoredChoice {
  readonly visible?: boolean
  readonly context?: number
  readonly output?: number
}

/** An id with stored choices that the last reply did not return (models.md A4). */
export interface GoneModel {
  readonly id: string
  readonly stored: StoredChoice
}

/** The last `/models` fetch (models.md A3). */
export interface LastFetch {
  /** Milliseconds since the epoch. */
  readonly at: number
  readonly url: string
  readonly status?: number
  readonly requestId?: string
  readonly serviceRequestId?: string
  /** Absent on success. */
  readonly error?: CardError
}

/** Everything the Models section shows (models.md A11). */
export interface ModelsState {
  /** A fetch runs. */
  readonly fetching: boolean
  /** The rows of the last successful reply, in A4 order. Empty while there is none. */
  readonly rows: readonly ModelRow[]
  /** Copilot host and login method of the row list. */
  readonly host?: string
  readonly method?: LoginMethod
  /** Time of the last successful fetch. */
  readonly fetchedAt?: number
  readonly lastFetch?: LastFetch
  readonly gone: readonly GoneModel[]
  /** The stored custom headers (A6). */
  readonly headers: Readonly<Record<string, string>>
  /** Number of models in the picker. */
  readonly published: number
  /** The route could not be registered (A10); no model reaches the picker. */
  readonly routeError?: CardError
  /**
   * Where the adapter's peers resolved in the running Host, by package name
   * (models.md B1). Diagnostic only; the Card does not show it.
   */
  readonly peers?: Readonly<Record<string, string>>
}

/** Body of `setVisibility`. */
export type SetVisibilityRequest =
  | { readonly id: string; readonly on: boolean }
  | { readonly id: string; readonly clear: true }

/**
 * Body of `setLimits`. An omitted size means Copilot's value. The Default
 * preset sends `{ id, clear: true }`, Long sends `{ id, context }` (models.md A11).
 */
export type SetLimitsRequest =
  | { readonly id: string; readonly context?: number; readonly output?: number }
  | { readonly id: string; readonly clear: true }

/** Body of `setHeaders`. */
export interface SetHeadersRequest {
  readonly headers: Readonly<Record<string, string>>
}

/** Reply of the Models `POST` routes. */
export interface ModelsResponse {
  readonly ok: boolean
  readonly error?: CardError
  readonly models: ModelsState
}
