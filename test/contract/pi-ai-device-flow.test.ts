/**
 * login.md B2, B3 and B7: pi-ai's GitHub Copilot device-code sign-in, run the
 * way the plugin runs it — `ctx.authorization.begin({ key, method: 'oauth' })`
 * on a real DSH composition (credentials-local, AuthorizationService,
 * LlmRuntime, llm-pi-ai) — with `fetch` replaced by fake GitHub and Copilot
 * endpoints. Each sign-in waits about one polling interval (1 second).
 */
import './helpers/network.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import {
  COPILOT_TOKEN,
  COPILOT_TOKEN_BUSINESS,
  DEVICE_USER_CODE,
  EXPIRES_AT,
  LOGIN_TOKEN,
  copilotRoutes,
} from './helpers/copilot-fakes.ts'
import type { CopilotScript } from './helpers/copilot-fakes.ts'
import { dsh } from './helpers/dsh.ts'
import { KEY, mountHarness, rejection, scriptedInteraction } from './helpers/harness.ts'
import type { Harness } from './helpers/harness.ts'
import { fakeFetch } from './helpers/network.ts'

const INDIVIDUAL = 'https://api.individual.githubcopilot.com'
const DOMAIN_PROMPT = {
  kind: 'text',
  message: 'GitHub Enterprise URL/domain (blank for github.com)',
  placeholder: 'company.ghe.com',
}
const CODE_MESSAGE = 'Enter this code on the verification page to finish signing in.'
/** pi-ai stores the Copilot token's expiry 5 minutes early (B5). */
const STORED_EXPIRES = EXPIRES_AT * 1000 - 5 * 60 * 1000

/** Start one browser sign-in through the real flow, answering the domain prompt with `answer`. */
async function signIn(t: TestContext, answer: string, script: CopilotScript, harness?: Harness) {
  const h = harness ?? (await mountHarness(t, { flows: true }))
  const timeline: string[] = []
  const seen = fakeFetch(t, copilotRoutes(script), timeline)
  const ui = scriptedInteraction(() => answer, timeline)
  const outcome = h.authorization.begin({ key: KEY, method: 'oauth', interaction: ui.interaction })
  return { h, timeline, seen, ui, outcome, requests: () => seen.map((r) => `${r.method} ${r.url}`) }
}

test('B2/B3/B7: empty answer — one text prompt, device code, notice with url+code, polling, token exchange, GET /models on the default API base, policy; the grant is stored', async (t) => {
  const { GITHUB_COPILOT_MODELS } = await dsh.piAiCopilotModels()
  const bundled = Object.keys(GITHUB_COPILOT_MODELS)[0]
  assert.ok(bundled, "pi-ai bundles at least one GitHub Copilot model")
  const rows = [
    { id: bundled, model_picker_enabled: true, policy: { state: 'unconfigured' }, capabilities: { supports: { tool_calls: true } } },
    { id: 'not-bundled-fake', model_picker_enabled: true, policy: { state: 'unconfigured' } },
    { id: 'picker-off-fake', model_picker_enabled: false, policy: { state: 'enabled' } },
    { id: 'no-tools-fake', model_picker_enabled: true, capabilities: { supports: { tool_calls: false } } },
  ]
  const run = await signIn(t, '', { domain: 'github.com', apiBase: INDIVIDUAL, copilotToken: COPILOT_TOKEN, rows, pendingOnce: true })
  assert.deepEqual(await run.outcome, { status: 'authorized' })

  assert.deepEqual(run.timeline, [
    'prompt text',
    'POST https://github.com/login/device/code',
    `notice url=https://github.com/login/device code=${DEVICE_USER_CODE}`,
    'POST https://github.com/login/oauth/access_token', // authorization_pending
    'POST https://github.com/login/oauth/access_token', // the login token
    'GET https://api.github.com/copilot_internal/v2/token',
    `GET ${INDIVIDUAL}/models`,
    'notice', // "Enabling models..."
    `POST ${INDIVIDUAL}/models/${bundled}/policy`, // only the bundled, unconfigured, picker-enabled row
  ])
  assert.deepEqual(run.ui.prompts, [DOMAIN_PROMPT])
  // DSH's relay passes on message, url and code only: no expiry, no interval.
  assert.deepEqual(run.ui.notices, [
    { message: CODE_MESSAGE, url: 'https://github.com/login/device', code: DEVICE_USER_CODE },
    { message: 'Enabling models...' },
  ])

  const exchange = run.seen.find((r) => r.url.endsWith('/copilot_internal/v2/token'))
  assert.equal(exchange?.headers.get('authorization'), `Bearer ${LOGIN_TOKEN}`)
  const models = run.seen.find((r) => r.url === `${INDIVIDUAL}/models`)
  assert.equal(models?.headers.get('authorization'), `Bearer ${COPILOT_TOKEN}`)
  assert.equal(models?.headers.get('x-github-api-version'), '2026-06-01')
  const policy = run.seen.find((r) => r.url.endsWith('/policy'))
  assert.equal(policy?.body, '{"state":"enabled"}')
  assert.equal(policy?.headers.get('authorization'), `Bearer ${COPILOT_TOKEN}`)

  const record = await run.h.credentials.readRecord(KEY)
  assert.deepEqual(record, {
    kind: 'grant',
    payload: {
      type: 'oauth',
      refresh: LOGIN_TOKEN,
      access: COPILOT_TOKEN,
      expires: STORED_EXPIRES,
      availableModelIds: [bundled, 'not-bundled-fake'],
    },
  })
  assert.equal('enterpriseUrl' in record.payload, false, 'no enterpriseUrl for an empty answer')
  assert.deepEqual(run.h.recordEvents, [KEY])
  assert.equal(run.h.authorization.describe(KEY).inFlight, false)
})

test('B2: a failing GET /models fails the sign-in: begin() throws without a code, nothing after /models is sent, the stored record is untouched', async (t) => {
  const h = await mountHarness(t, { flows: true })
  const previous = { kind: 'api-key', key: 'previous-pat-fake' }
  await h.credentials.modifyRecord(KEY, async () => previous)
  const run = await signIn(t, '', {
    domain: 'github.com',
    apiBase: INDIVIDUAL,
    copilotToken: COPILOT_TOKEN,
    modelsReply: () => new Response('models unavailable', { status: 500, statusText: 'Internal Server Error' }),
  }, h)

  const error = await rejection(run.outcome)
  assert.equal(error.code, undefined)
  assert.match(error.message, /^500 Internal Server Error/)
  assert.deepEqual(run.requests(), [
    'POST https://github.com/login/device/code',
    'POST https://github.com/login/oauth/access_token',
    'GET https://api.github.com/copilot_internal/v2/token',
    `GET ${INDIVIDUAL}/models`,
  ])
  assert.deepEqual(await h.credentials.readRecord(KEY), previous)
  assert.deepEqual(h.recordEvents, [KEY], 'only the seeded write')
  assert.equal(h.authorization.describe(KEY).inFlight, false)
})

test('B2: answer "octo.ghe.com" signs in at octo.ghe.com and api.octo.ghe.com, stores enterpriseUrl, and without proxy-ep uses https://copilot-api.octo.ghe.com; the notice url is verification_uri as pi-ai parsed it (new URL().href)', async (t) => {
  const verificationUri = 'https://OCTO.ghe.com/login/device?from=reply'
  const run = await signIn(t, 'octo.ghe.com', {
    domain: 'octo.ghe.com',
    apiBase: 'https://copilot-api.octo.ghe.com',
    copilotToken: COPILOT_TOKEN,
    verificationUri,
  })
  assert.deepEqual(await run.outcome, { status: 'authorized' })
  assert.deepEqual(run.requests(), [
    'POST https://octo.ghe.com/login/device/code',
    'POST https://octo.ghe.com/login/oauth/access_token',
    'GET https://api.octo.ghe.com/copilot_internal/v2/token',
    'GET https://copilot-api.octo.ghe.com/models',
  ])
  assert.deepEqual(run.ui.notices, [{ message: CODE_MESSAGE, url: 'https://octo.ghe.com/login/device?from=reply', code: DEVICE_USER_CODE }])
  assert.deepEqual(await run.h.credentials.readRecord(KEY), {
    kind: 'grant',
    payload: {
      type: 'oauth',
      refresh: LOGIN_TOKEN,
      access: COPILOT_TOKEN,
      expires: STORED_EXPIRES,
      enterpriseUrl: 'octo.ghe.com',
      availableModelIds: [],
    },
  })
})

test('B2: a Copilot token with proxy-ep=proxy.business.githubcopilot.com sends GET /models to https://api.business.githubcopilot.com, whatever the answer', async (t) => {
  for (const [answer, domain] of [['', 'github.com'], ['octo.ghe.com', 'octo.ghe.com']] as const) {
    await t.test(`answer ${JSON.stringify(answer)}`, async (st) => {
      const run = await signIn(st, answer, {
        domain,
        apiBase: 'https://api.business.githubcopilot.com',
        copilotToken: COPILOT_TOKEN_BUSINESS,
      })
      assert.deepEqual(await run.outcome, { status: 'authorized' })
      assert.deepEqual(run.requests(), [
        `POST https://${domain}/login/device/code`,
        `POST https://${domain}/login/oauth/access_token`,
        `GET https://api.${domain}/copilot_internal/v2/token`,
        'GET https://api.business.githubcopilot.com/models',
      ])
      const { payload } = await run.h.credentials.readRecord(KEY)
      assert.equal(payload.access, COPILOT_TOKEN_BUSINESS)
      assert.equal(payload.enterpriseUrl, answer === '' ? undefined : answer)
    })
  }
})

test('B2: the non-empty answer "github.com" counts as an enterprise domain: enterpriseUrl "github.com" is stored and the API base becomes https://copilot-api.github.com', async (t) => {
  const run = await signIn(t, 'github.com', {
    domain: 'github.com',
    apiBase: 'https://copilot-api.github.com',
    copilotToken: COPILOT_TOKEN,
  })
  assert.deepEqual(await run.outcome, { status: 'authorized' })
  assert.deepEqual(run.requests(), [
    'POST https://github.com/login/device/code',
    'POST https://github.com/login/oauth/access_token',
    'GET https://api.github.com/copilot_internal/v2/token',
    'GET https://copilot-api.github.com/models',
  ])
  const { payload } = await run.h.credentials.readRecord(KEY)
  assert.equal(payload.enterpriseUrl, 'github.com')
})
