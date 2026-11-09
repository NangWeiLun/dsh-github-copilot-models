/**
 * The Domain field (login.md A1) and the answer to pi-ai's domain prompt
 * (login.md A4 step 3, B2).
 */
import { LoginError } from './errors.ts'

/** The only default value for any host in the plugin (login.md A1). */
export const DEFAULT_DOMAIN = 'github.com'

/**
 * Normalise a Domain field value (login.md A1).
 * @param input - the value as typed or saved.
 * @returns the hostname; `github.com` for an empty value.
 * @throws {LoginError} `INVALID_DOMAIN` when the value does not parse.
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '') return DEFAULT_DOMAIN
  let url: URL
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    throw new LoginError('INVALID_DOMAIN')
  }
  if (url.hostname === '') throw new LoginError('INVALID_DOMAIN')
  return url.hostname
}

/**
 * The answer to pi-ai's "GitHub Enterprise URL/domain" prompt. Never
 * `github.com`: pi-ai treats any non-empty answer as an enterprise domain.
 * @param domain - a normalised domain.
 * @returns an empty string for github.com, otherwise the hostname.
 */
export function domainAnswer(domain: string): string {
  return domain === DEFAULT_DOMAIN ? '' : domain
}

/**
 * The Config value for a normalised domain: empty for github.com, so the
 * default stays the only place that names it.
 * @param domain - a normalised domain.
 * @returns the value to save.
 */
export function configDomain(domain: string): string {
  return domain === DEFAULT_DOMAIN ? '' : domain
}
