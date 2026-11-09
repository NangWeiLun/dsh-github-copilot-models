/**
 * Host-side ports: the minimal shapes of the DSH services and globals the
 * login component uses (login.md B1). The plugin entry adapts the real
 * services to them; tests supply fakes. Branded DSH key types are plain
 * strings at runtime, so they are plain strings here.
 */
import { recordKeyFor } from '@deepseek-ai/dsh-llm-pi-ai'

/**
 * The credential record shared with DSH's built-in route `github-copilot`
 * (login.md B3), named by DSH itself, so the two keep sharing one login if
 * DSH ever names its records differently (models.md A1).
 */
export const RECORD_KEY: string = recordKeyFor('github-copilot')

/** The environment reference pi-ai falls back to when no record exists (login.md B6). */
export const ENV_TOKEN_REF = 'COPILOT_GITHUB_TOKEN'

/** One stored credential record (`@deepseek-ai/dsh-credentials`). */
export type CredentialRecord =
  | { readonly kind: 'api-key'; readonly key?: string; readonly env?: Readonly<Record<string, string>> }
  | { readonly kind: 'grant'; readonly payload: unknown }

/** The part of `ctx.credentials` the login component calls. */
export interface CredentialsPort {
  readRecord(key: string): Promise<CredentialRecord | undefined>
  deleteRecord(key: string): Promise<void>
  /** Presence of an environment reference; never its value. */
  describe(ref: string): Promise<{ readonly configured: boolean }>
}

/** A question from the running flow (`@deepseek-ai/dsh-authorization`). */
export interface AuthorizationPrompt {
  readonly kind: 'text' | 'secret' | 'select'
  readonly message: string
  readonly signal?: AbortSignal
}

/** A one-way report from the running flow. Never carries a secret. */
export interface AuthorizationNotice {
  readonly message: string
  readonly url?: string
  readonly code?: string
}

/** The surface half of one attempt. */
export interface AuthorizationInteraction {
  notify(notice: AuthorizationNotice): void
  prompt(prompt: AuthorizationPrompt): Promise<string>
}

/** The part of `ctx.authorization` the login component calls (login.md B4). */
export interface AuthorizationPort {
  begin(request: {
    key: string
    method?: string
    interaction: AuthorizationInteraction
    signal?: AbortSignal
  }): Promise<{ readonly status: 'authorized' | 'cancelled' }>
  cancel(key: string): void
  describe(key: string): { readonly inFlight: boolean } | undefined
}

/** `fetch` as the host lookup calls it. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/** The part of `ctx.logger` the login component calls. Never given a token. */
export interface LoggerPort {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
}
