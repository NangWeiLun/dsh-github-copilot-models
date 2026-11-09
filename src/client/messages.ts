/**
 * Card errors and call problems → localized text (login.md A8).
 *
 * Errors are recognised by their code and params only, never by message text.
 * Texts are built at render time from the active locale, so a message on
 * screen follows a language switch.
 */
import type { CardError, Prices } from '../shared/api.ts'
import type { Problem } from './host-api.ts'
import type { Key, Translate } from './locales.ts'

/** One line the Card shows: a dictionary text, or a problem to describe. */
export type Message =
  | { readonly kind: 'text'; readonly key: Key }
  | { readonly kind: 'problem'; readonly problem: Problem }

/** How a line is coloured. `info` is neutral. */
export type Tone = 'success' | 'error' | 'warn' | 'info'

/** One result line. */
export interface Line {
  readonly tone: Tone
  readonly message: Message
}

/** A dictionary text as a {@link Message}. */
export function text(key: Key): Message {
  return { kind: 'text', key }
}

/** A Host error as a {@link Message}. */
export function cardError(error: CardError): Message {
  return { kind: 'problem', problem: { kind: 'card', error } }
}

/** The text of one message. */
export function messageText(t: Translate, message: Message): string {
  return message.kind === 'text' ? t(message.key) : problemText(t, message.problem)
}

/** The text of a call problem. */
export function problemText(t: Translate, problem: Problem): string {
  switch (problem.kind) {
    case 'card':
      return errorText(t, problem.error)
    case 'http':
      return t('errHostHttp', { status: problem.status })
    case 'network':
      return t('errHostNetwork')
    case 'reply':
      return t('errUnexpectedReply')
    case 'interrupted':
      return t('errInterrupted')
  }
}

/** The text of a Host error (login.md A8). */
export function errorText(t: Translate, error: CardError): string {
  switch (error.code) {
    case 'INVALID_DOMAIN':
      return t('errInvalidDomain')
    case 'NO_FLOW':
      return t('errNoFlow')
    case 'ALREADY_IN_FLIGHT':
      return t('errAlreadyInFlight')
    case 'DSH_ERROR':
      return t('errDsh', { code: param(error, 'code') ?? '?' })
    case 'UNEXPECTED_PROMPT':
      return t('errUnexpectedPrompt')
    case 'SIGN_IN_FAILED':
      return t('errSignInFailed', { message: param(error, 'message') ?? '' })
    case 'LOOKUP_FAILED':
      return lookupFailedText(t, error)
    case 'INVALID_API_ADDRESS':
      return t('errInvalidApiAddress')
    case 'UNREADABLE_RECORD':
      return t('errUnreadableRecord')
    case 'NOT_SIGNED_IN':
      return t('errNotSignedIn')
    case 'BAD_REQUEST':
    case 'INTERNAL':
      return t('errMessage', { message: param(error, 'message') ?? error.code })
    case 'MODELS_FAILED':
      return modelsFailedText(t, error)
    case 'LIMIT_REFUSED':
      return t('errLimitRefused', { problem: checkText(t, param(error, 'check'), param(error, 'limit')) })
    case 'HEADER_REFUSED': {
      const name = param(error, 'name') ?? ''
      const reason = param(error, 'reason')
      if (reason === 'duplicate') return t('errHeaderDuplicate', { name })
      if (reason === 'empty') return t('errHeaderEmpty')
      return t('errHeaderInvalid', { name, message: param(error, 'message') ?? '' })
    }
    case 'UNKNOWN_MODEL':
      return t('errUnknownModel', { id: param(error, 'id') ?? '' })
    case 'SAVE_FAILED':
      return t('errSaveFailed', { message: param(error, 'message') ?? '' })
    case 'ROUTE_IN_USE':
      return t('errRouteInUse', { route: param(error, 'route') ?? 'github-copilot-models' })
  }
}

/**
 * A number as the Card writes it, the same in every language (ui.md U4):
 * digits without separators, a dot for decimals, never an exponent. `,` and
 * `.` swap meaning between languages, and a count then reads the way the size
 * fields take it.
 */
function plainNumber(value: number): string {
  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
}

/** A token count for display: plain digits, for example 272000. */
export function formatCount(value: number | string): string {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? plainNumber(number) : String(value)
}

/** A price for display: the value as received, as a plain number, for example 0.25 or 2000. */
export function formatPrice(value: number): string {
  return plainNumber(value)
}

/**
 * A moment for display (ui.md U4): local time as 24-hour HH:MM, for example
 * 15:58, the same in every language and whatever the browser's language.
 * Empty for an invalid moment.
 */
export function formatTime(at: number): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * A size as its field shows it: digits only, the form the field accepts
 * (models.md A4). Empty for no value.
 */
export function sizeFieldText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

/**
 * A size field's text, read strictly (models.md A4): empty means Copilot's
 * value (`undefined`); otherwise digits 0–9 only, without separators, signs or
 * exponents, since `,` and `.` mean thousands in some languages and decimals in
 * others ("128.000" is 128 thousand in German). Anything else is `null`.
 * Spaces around the digits are ignored, and full-width digits (０–９, as
 * Chinese and Japanese input methods type them) count as digits.
 */
export function parseSizeField(text: string): number | undefined | null {
  const plain = text.trim().replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
  if (plain === '') return undefined
  return /^[0-9]+$/.test(plain) ? Number(plain) : null
}

/**
 * A size field's text once you leave it (models.md A4): a value the field
 * takes, in the form it is saved, so full-width digits show as 0–9 (and spaces
 * or leading zeros go); anything else stays as typed, beside its refusal.
 */
export function normalizeSizeField(text: string): string {
  const value = parseSizeField(text)
  return value === null ? text : sizeFieldText(value)
}

/**
 * How a row's prices are shown (models.md A4): `none` without `billing` or
 * without any price in it, `zero` when every price is `0`, else `priced`.
 */
export function pricesKind(prices: Prices | undefined): 'none' | 'zero' | 'priced' {
  const values = (prices?.tiers ?? [])
    .flatMap((tier) => [tier.input, tier.output, tier.cacheRead, tier.cacheWrite, tier.cacheWrite1h])
    .filter((value): value is number => value !== undefined)
  if (values.length === 0) return 'none'
  return values.every((value) => value === 0) ? 'zero' : 'priced'
}

/** A column of the price table (models.md A4): the prompt limit, then the prices. */
export type PriceColumn = 'maxPromptTokens' | 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'cacheWrite1h'

/** Every price-table column, in order, with its header. */
export const PRICE_COLUMNS: readonly (readonly [PriceColumn, Key])[] = [
  ['maxPromptTokens', 'priceColPrompt'],
  ['input', 'priceColInput'],
  ['output', 'priceColOutput'],
  ['cacheRead', 'priceColCacheRead'],
  ['cacheWrite', 'priceColCacheWrite'],
  ['cacheWrite1h', 'priceColCacheWrite1h'],
]

/** The price table's columns: each one that at least one tier gives, in table order (models.md A4). */
export function priceColumns(prices: Prices): (readonly [PriceColumn, Key])[] {
  return PRICE_COLUMNS.filter(([column]) => prices.tiers.some((tier) => tier[column] !== undefined))
}

/** A tier's row name: Default and Long, as on the size buttons, or the name as received (models.md A4). */
export function tierLabel(t: Translate, name: string): string {
  if (name === 'default') return t('tierDefault')
  if (name === 'long_context') return t('tierLong')
  return name
}

/** The text of a size check (models.md A4). */
export function checkText(t: Translate, check: string | undefined, limit: string | number | undefined): string {
  const params = { limit: limit === undefined ? '?' : formatCount(limit) }
  switch (check) {
    case 'not-digits':
      return t('checkNotDigits')
    case 'not-positive':
      return t('checkNotPositive')
    case 'context-above-window':
      return t('checkContextAboveWindow', params)
    case 'output-above-max':
      return t('checkOutputAboveMax', params)
    case 'output-not-below-context':
      return t('checkOutputNotBelowContext', params)
    case 'prompt-above-tier':
      return t('checkPromptAboveTier', params)
    default:
      return t('checkUnknown')
  }
}

/**
 * "Could not refresh models: <url>, HTTP <status>, request id <id>, service
 * request id <id>", then the reason, the 401/403/421 hint, a 429's
 * Retry-After, and Copilot's own message when it sent one (models.md A10).
 */
function modelsFailedText(t: Translate, error: CardError): string {
  const reason = param(error, 'reason')
  const message = param(error, 'message')
  if (reason === 'token-refresh') return t('errModelsRefresh', { message: message ?? '' })
  const status = param(error, 'status')
  const requestId = param(error, 'requestId')
  const serviceRequestId = param(error, 'serviceRequestId')
  const retryAfter = param(error, 'retryAfter')
  let result = t('errModelsFailed', { url: param(error, 'url') ?? '' })
  if (status !== undefined) result += t('modelsStatus', { status })
  if (requestId !== undefined) result += t('modelsRequestId', { id: requestId })
  if (serviceRequestId !== undefined) result += t('modelsServiceRequestId', { id: serviceRequestId })
  const reasonKey = modelsReasonKey(reason)
  if (reasonKey !== undefined) result += t(reasonKey)
  if (status === '401' || status === '403' || status === '421') result += t('modelsAuth')
  if (status === '429') {
    result += t('modelsRateLimited')
    if (retryAfter !== undefined) result += t('modelsRetryAfter', { value: retryAfter })
  }
  if (message !== undefined) result += t('modelsMessage', { message })
  return result
}

function modelsReasonKey(reason: string | undefined): Key | undefined {
  switch (reason) {
    case 'timeout':
      return 'modelsTimeout'
    case 'network':
      return 'modelsNetwork'
    case 'not-json':
      return 'modelsNotJson'
    case 'no-rows':
      return 'modelsNoRows'
    default:
      return undefined
  }
}

/**
 * "Could not get the Copilot API address: <url>, status <status>, request id
 * <id>", leaving out the parts whose params are absent, followed by the
 * reason unless it is `http` (the status already says it).
 */
function lookupFailedText(t: Translate, error: CardError): string {
  const url = param(error, 'url')
  const status = param(error, 'status')
  const requestId = param(error, 'requestId')
  const reason = reasonKey(param(error, 'reason'))
  let result = url === undefined ? t('errLookupFailedNoUrl') : t('errLookupFailed', { url })
  if (status !== undefined) result += t('lookupStatus', { status })
  if (requestId !== undefined) result += t('lookupRequestId', { requestId })
  if (reason !== undefined) result += t(reason)
  return result
}

/** The text fragment of a `LookupFailureReason`; none for `http` or an unknown one. */
function reasonKey(reason: string | undefined): Key | undefined {
  switch (reason) {
    case 'timeout':
      return 'lookupTimeout'
    case 'network':
      return 'lookupNetwork'
    case 'not-json':
      return 'lookupNotJson'
    case 'missing-api':
      return 'lookupMissingApi'
    default:
      return undefined
  }
}

/** One param as text; undefined when absent or empty. */
function param(error: CardError, name: string): string | undefined {
  const value = error.params?.[name]
  return value === undefined || value === '' ? undefined : String(value)
}

/** Whether two errors have the same code and params. */
export function sameError(a: CardError | undefined, b: CardError | undefined): boolean {
  if (a === undefined || b === undefined) return false
  return a.code === b.code && paramsKey(a) === paramsKey(b)
}

function paramsKey(error: CardError): string {
  const params = error.params ?? {}
  return JSON.stringify(Object.keys(params).sort().map((name) => [name, params[name]]))
}

/** Whether a line shows this Host error. */
export function showsError(lines: readonly Line[], error: CardError): boolean {
  return lines.some((line) => line.message.kind === 'problem'
    && line.message.problem.kind === 'card'
    && sameError(line.message.problem.error, error))
}
