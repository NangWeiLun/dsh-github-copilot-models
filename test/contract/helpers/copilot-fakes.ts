/**
 * Fake GitHub and Copilot endpoints for pi-ai's device-code sign-in (login.md B2).
 * Replies are minimal and made up; nothing here came from a real account.
 */
import { json } from './network.ts'
import type { Route } from './network.ts'

export const DEVICE_USER_CODE = 'ABCD-1234'
export const LOGIN_TOKEN = 'login-token-fake'
/** Seconds since the epoch, far in the future. */
export const EXPIRES_AT = 1_900_000_000
/** A Copilot token without `proxy-ep`. */
export const COPILOT_TOKEN = `tid=fake;exp=${EXPIRES_AT};sku=fake`
/** A Copilot token naming the Business proxy. */
export const COPILOT_TOKEN_BUSINESS = `tid=fake;exp=${EXPIRES_AT};proxy-ep=proxy.business.githubcopilot.com;sku=fake`

export interface CopilotScript {
  /** The sign-in domain the requests must use, e.g. `github.com`. */
  domain: string
  /** The API base pi-ai must use for `/models` and policy calls. */
  apiBase: string
  /** The token returned by the login token exchange. */
  copilotToken: string
  /** Rows of the `GET /models` reply. */
  rows?: unknown[]
  /** Answer the first poll with `authorization_pending`. */
  pendingOnce?: boolean
  /** Replace the `GET /models` reply. */
  modelsReply?: () => Response
  /** Replace the device code reply. */
  deviceCodeReply?: () => Response
  /** Replace the reply to poll number `poll` (1-based). */
  pollReply?: (poll: number) => Response
  /** Replace the login token exchange reply. */
  exchangeReply?: () => Response
  /** `verification_uri` of the device code reply; default `https://<domain>/login/device`. */
  verificationUri?: string
}

/** A fetch route that plays GitHub and Copilot for one sign-in; any other request fails the sign-in. */
export function copilotRoutes(script: CopilotScript): Route {
  let polls = 0
  return (request) => {
    const at = `${request.method} ${request.url}`
    if (at === `POST https://${script.domain}/login/device/code`) {
      return script.deviceCodeReply?.() ?? json({
        device_code: 'device-code-fake',
        user_code: DEVICE_USER_CODE,
        verification_uri: script.verificationUri ?? `https://${script.domain}/login/device`,
        expires_in: 900,
        interval: 1,
      })
    }
    if (at === `POST https://${script.domain}/login/oauth/access_token`) {
      polls += 1
      if (script.pollReply !== undefined) return script.pollReply(polls)
      if (polls === 1 && script.pendingOnce === true) return json({ error: 'authorization_pending' })
      return json({ access_token: LOGIN_TOKEN, token_type: 'bearer', scope: 'read:user' })
    }
    if (at === `GET https://api.${script.domain}/copilot_internal/v2/token`) {
      return script.exchangeReply?.() ?? json({ token: script.copilotToken, expires_at: EXPIRES_AT, refresh_in: 1500 })
    }
    if (at === `GET ${script.apiBase}/models`) {
      return script.modelsReply?.() ?? json({ object: 'list', data: script.rows ?? [] })
    }
    if (request.method === 'POST' && request.url.startsWith(`${script.apiBase}/models/`) && request.url.endsWith('/policy')) {
      return json({ state: 'enabled' })
    }
    throw new Error(`unexpected request ${at}`)
  }
}
