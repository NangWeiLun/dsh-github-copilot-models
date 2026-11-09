/**
 * models.md A1, A3: the Login ↔ Models link over the real login and models
 * controllers with fakes. The `/models` fetch runs only after a successful
 * host lookup; a removed or replaced credential clears the lists; a failed
 * lookup keeps them.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { LoginController } from '../../src/host/login.ts'
import { DEFAULT_CUSTOM_HEADERS } from '../../src/host/models-fetch.ts'
import { ModelsController } from '../../src/host/models.ts'
import type { TokenResult } from '../../src/host/models.ts'
import { createRoutes } from '../../src/host/routes.ts'
import { browserFlow, FakeAuthorization, FakeCredentials, FakeFetch, KEY, patFlow, tick, userReply } from './fakes.ts'
import { CHAT_NO_BILLING, modelsResponse, ONE_TIER_RESPONSES, reply } from './model-fixtures.ts'

const BUSINESS = { login: 'octocat', endpoints: { api: 'https://api.business.githubcopilot.com' } }
const INDIVIDUAL = { login: 'hubot', endpoints: { api: 'https://api.individual.githubcopilot.com' } }

/** Login and Models wired as in src/index.ts, over one fake fetch for GitHub and Copilot. */
function setup() {
  const credentials = new FakeCredentials()
  const authorization = new FakeAuthorization(credentials)
  authorization.flows = { 'api-key': patFlow, oauth: browserFlow({}) }
  const http = new FakeFetch()
  const published: number[] = []
  // The token as pi-ai would resolve it: the PAT, or the grant's Copilot token.
  const token = async (): Promise<TokenResult> => {
    const record = credentials.records.get(KEY)
    if (record === undefined) return undefined
    if (record.kind === 'api-key') return record.key === undefined ? undefined : { token: record.key }
    return { token: String((record.payload as { access: string }).access) }
  }
  const models = new ModelsController({
    fetch: http.fetch,
    logger: { info: () => {}, warn: () => {} },
    token,
    readChoices: () => ({ visibility: {}, limits: {} }),
    readHeaders: () => ({ ...DEFAULT_CUSTOM_HEADERS }),
    writeSettings: async () => {},
    publish: (list) => published.push(list.specs.length),
  })
  let domain = ''
  const login = new LoginController({
    credentials: () => credentials,
    authorization: () => authorization,
    fetch: http.fetch,
    logger: { info: () => {}, warn: () => {} },
    readDomain: () => domain,
    saveDomain: async (value) => { domain = value },
    models: {
      lookupSucceeded: (output) => models.fetch({ method: output.method, host: output.host }),
      credentialChanged: () => models.credentialChanged(),
      state: () => models.state(),
      fetching: () => models.fetching,
    },
  })
  credentials.listeners.push((key) => {
    if (key === KEY) void login.recordUpdated()
  })
  const urls = () => http.requests.map((request) => request.url)
  return { login, models, credentials, authorization, http, published, urls }
}

test('A3 PAT sign-in: lookup, then /models on the looked-up host with the PAT; the reply carries the models', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING)))
  const response = await t.login.patSignIn('', 'github_pat_X')
  assert.equal(response.ok, true)
  assert.deepEqual(t.urls(), ['https://api.github.com/copilot_internal/user', 'https://api.business.githubcopilot.com/models'])
  assert.equal((t.http.requests[1]?.init.headers as Record<string, string>).Authorization, 'Bearer github_pat_X')
  assert.equal((t.http.requests[1]?.init.headers as Record<string, string>)['Copilot-Integration-Id'], 'copilot-developer-cli')
  assert.equal(response.models.rows.length, 1)
  assert.equal(response.models.method, 'pat')
  assert.equal(response.state.modelsFetching, false)
})

test('A3 browser sign-in: /models with the Copilot token and vscode-chat after the lookup', async () => {
  const t = setup()
  t.http.replies.push(userReply(INDIVIDUAL), modelsResponse(reply(ONE_TIER_RESPONSES)))
  const response = await t.login.browserSignIn('')
  assert.equal(response.ok, true)
  assert.deepEqual(t.urls(), ['https://api.github.com/copilot_internal/user', 'https://api.individual.githubcopilot.com/models'])
  const headers = t.http.requests[1]?.init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer tid=1;exp=2')
  assert.equal(headers['Copilot-Integration-Id'], 'vscode-chat')
  assert.equal(response.models.method, 'browser')
})

test('A3 start-up: /models after the start-up lookup; none without a record or after a failed lookup', async () => {
  const empty = setup()
  await empty.login.start()
  assert.equal(empty.http.requests.length, 0)

  const ok = setup()
  ok.credentials.records.set(KEY, { kind: 'api-key', key: 'github_pat_X' })
  ok.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING)))
  await ok.login.start()
  assert.equal(ok.http.requests.length, 2)
  assert.equal(ok.models.state().rows.length, 1)

  const failed = setup()
  failed.credentials.records.set(KEY, { kind: 'api-key', key: 'github_pat_X' })
  failed.http.replies.push(userReply({}, { status: 401 }))
  await failed.login.start()
  assert.equal(failed.http.requests.length, 1, 'no /models after a failed lookup')
})

test('A3 Refresh: lookup then fetch; a failed lookup skips the fetch and keeps the lists and the picker', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING)))
  await t.login.patSignIn('', 'github_pat_X')
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING, ONE_TIER_RESPONSES)))
  const refreshed = await t.login.refresh()
  assert.equal(refreshed.ok, true)
  assert.equal(refreshed.models.rows.length, 2)
  const published = t.published.length

  t.http.replies.push(userReply({ message: 'Bad credentials' }, { status: 401 }))
  const failed = await t.login.refresh()
  assert.equal(failed.ok, false)
  assert.equal(failed.error?.code, 'LOOKUP_FAILED')
  assert.equal(failed.state.status, 'unverified')
  assert.equal(failed.models.rows.length, 2, 'lists unchanged')
  assert.equal(failed.models.published, 2, 'picker unchanged')
  assert.equal(t.published.length, published, 'nothing republished')
  assert.equal(t.http.requests.length, 5, 'no /models after the failed lookup')
})

test('A3 sign-out clears the lists and sends no request', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING)))
  await t.login.patSignIn('', 'github_pat_X')
  const requests = t.http.requests.length
  const out = await t.login.signOut()
  assert.equal(out.models.rows.length, 0)
  assert.equal(out.models.published, 0)
  assert.equal(t.published.at(-1), 0)
  assert.equal(t.http.requests.length, requests)
})

test('A3 a sign-in by the other method replaces the models; a failed sign-in keeps them', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING)))
  await t.login.patSignIn('', 'github_pat_X')
  // A failed PAT sign-in (bad lookup) leaves the record, and the models, as they are.
  t.http.replies.push(userReply({}, { status: 401 }))
  const failed = await t.login.patSignIn('', 'github_pat_BAD')
  assert.equal(failed.ok, false)
  assert.equal(failed.models.rows.length, 1)
  // A browser sign-in replaces the record: cleared, then refetched for the new login.
  t.http.replies.push(userReply(INDIVIDUAL), modelsResponse(reply(ONE_TIER_RESPONSES)))
  const browser = await t.login.browserSignIn('')
  assert.equal(browser.ok, true)
  assert.deepEqual(browser.models.rows.map((row) => row.key), ['codex-one-tier'])
  assert.equal(browser.models.host, 'https://api.individual.githubcopilot.com')
  // A browser sign-in whose /models fails leaves the lists empty.
  t.http.replies.push(userReply(INDIVIDUAL), modelsResponse({}, { status: 500 }))
  const again = await t.login.browserSignIn('')
  assert.equal(again.models.rows.length, 0)
  assert.equal(again.models.lastFetch?.error?.code, 'MODELS_FAILED')
})

test('A3 record removed or replaced outside the plugin clears the lists; a token refresh does not; no request', async () => {
  const t = setup()
  t.http.replies.push(userReply(INDIVIDUAL), modelsResponse(reply(CHAT_NO_BILLING)))
  await t.login.browserSignIn('')
  const requests = t.http.requests.length
  // pi-ai's token refresh rewrites the record with the same login token.
  t.credentials.write(KEY, { kind: 'grant', payload: { type: 'oauth', refresh: 'gho_login_token', access: 'new', expires: 1 } })
  await tick()
  assert.equal(t.models.state().rows.length, 1)
  // Another credential stored outside the plugin.
  t.credentials.write(KEY, { kind: 'api-key', key: 'github_pat_OTHER' })
  await tick()
  assert.equal(t.models.state().rows.length, 0)
  assert.equal(t.login.state().changedOutside, true)
  // Refetched only on Refresh.
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(ONE_TIER_RESPONSES)))
  await t.login.refresh()
  assert.equal(t.models.state().rows.length, 1)
  // The record removed in DSH Settings.
  await t.credentials.deleteRecord(KEY)
  await tick()
  assert.equal(t.models.state().rows.length, 0)
  assert.equal(t.http.requests.length, requests + 2, 'only the Refresh sent requests')
})

test('A11 routes: models, setVisibility, setLimits and setHeaders; malformed bodies answer 400; GET models sends nothing', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS), modelsResponse(reply(CHAT_NO_BILLING)))
  await t.login.patSignIn('', 'github_pat_X')
  const requests = t.http.requests.length
  const routes = new Map(createRoutes(t.login, t.models).map((route) => [route.path, route]))
  const call = async (path: string, body?: unknown) => {
    const route = routes.get(`/api/github-copilot-models/${path}`)
    assert.ok(route !== undefined, path)
    const init: RequestInit = body === undefined
      ? {}
      : { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }
    const response = await route.fetch(new Request(`http://dsh.internal/api/github-copilot-models/${path}`, init))
    return { status: response.status, body: await response.json() as Record<string, unknown> }
  }
  const state = await call('models')
  assert.equal(state.status, 200)
  assert.equal((state.body.rows as unknown[]).length, 1)
  assert.equal((await call('setVisibility', { id: 'haiku-chat', on: false })).body.ok, true)
  assert.equal((await call('setLimits', { id: 'haiku-chat', context: 100_000 })).body.ok, true)
  assert.equal((await call('setHeaders', { headers: { 'X-GitHub-Api-Version': '2026-08-01' } })).body.ok, true)
  for (const [path, body] of [
    ['setVisibility', { id: '' }],
    ['setVisibility', { id: 'haiku-chat' }],
    ['setLimits', { context: 100_000 }],
    ['setLimits', { id: 'haiku-chat', context: '100' }],
    ['setHeaders', { headers: { 'X-A': 1 } }],
    ['setHeaders', { headers: [] }],
    ['setHeaders', 'not json'],
  ] as const) {
    const response = await call(path, body)
    assert.equal(response.status, 400, `${path} ${JSON.stringify(body)}`)
  }
  assert.equal(t.http.requests.length, requests, 'no Models route sends a request')
})
