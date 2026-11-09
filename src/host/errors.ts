/**
 * Errors of the login component and their mapping to Card errors
 * (login.md A8). Errors are recognised by their source — a DSH `code`, the
 * Host's own checks — never by matching message text.
 */
import type { CardError, ErrorCode } from '../shared/api.ts'

type Params = Readonly<Record<string, string | number>>

/** A failure the Host recognised itself; carries the Card error it maps to. */
export class LoginError extends Error {
  readonly code: ErrorCode
  readonly params: Params | undefined

  constructor(code: ErrorCode, params?: Params, options?: ErrorOptions) {
    super(params === undefined ? code : `${code} ${JSON.stringify(params)}`, options)
    this.name = 'LoginError'
    this.code = code
    this.params = params
  }

  toCard(): CardError {
    return this.params === undefined ? { code: this.code } : { code: this.code, params: this.params }
  }
}

/** A host lookup ended because its caller withdrew it (sign-out, closed page). */
export class LookupCancelled extends Error {
  constructor() {
    super('host lookup cancelled')
    this.name = 'LookupCancelled'
  }
}

/** Codes `ctx.authorization.begin()` throws (login.md B4). */
const DSH_OTHER_CODES = new Set(['UNKNOWN_METHOD', 'NOT_COMMITTED'])

/** Message of any thrown value, for display as received. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The DSH authorization code of a thrown value. Only `AuthorizationError`
 * carries one: pi-ai's own errors also have a `code` (a `ModelsError` from a
 * failed record write has `code: 'auth'`), and those are failures inside the
 * pi-ai flow, not DSH codes (contract test, login.md A8).
 */
function dshCodeOf(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== 'AuthorizationError' || !('code' in error)) return undefined
  const code = (error as { code: unknown }).code
  return typeof code === 'string' ? code : undefined
}

/**
 * Map an error thrown by `ctx.authorization.begin()` (login.md A8).
 * @param error - what `begin()` threw.
 * @param unexpectedPrompt - the Host rejected a prompt during this attempt.
 * @returns the Card error.
 */
export function mapBeginError(error: unknown, unexpectedPrompt: boolean): CardError {
  if (unexpectedPrompt) return { code: 'UNEXPECTED_PROMPT' }
  const code = dshCodeOf(error)
  if (code === 'NO_FLOW') return { code: 'NO_FLOW' }
  if (code === 'ALREADY_IN_FLIGHT') return { code: 'ALREADY_IN_FLIGHT' }
  if (code !== undefined && DSH_OTHER_CODES.has(code)) return { code: 'DSH_ERROR', params: { code } }
  return { code: 'SIGN_IN_FAILED', params: { message: messageOf(error) } }
}

/** Map any other failure: the Host's own errors keep their code. */
export function toCardError(error: unknown): CardError {
  if (error instanceof LoginError) return error.toCard()
  return { code: 'INTERNAL', params: { message: messageOf(error) } }
}
