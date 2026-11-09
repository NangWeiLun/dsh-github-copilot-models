/** models.md A2, A3, A5, A6, A10: the Models controller and the `/models` request, over fakes. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_CUSTOM_HEADERS, fetchModels, mergeHeaders } from '../../src/host/models-fetch.ts'
import { ModelsController } from '../../src/host/models.ts'
import type { PublishedModels, SettingsOp, TokenResult } from '../../src/host/models.ts'
import type { StoredChoices } from '../../src/host/rows.ts'
import { FakeFetch, tick } from './fakes.ts'
import { CHAT_NO_BILLING, modelsResponse, ONE_TIER_RESPONSES, reply, TWO_TIER_MESSAGES } from './model-fixtures.ts'

const BUSINESS = 'https://api.business.githubcopilot.com'
const PAT_TARGET = { method: 'pat', host: BUSINESS } as const
const BROWSER_TARGET = { method: 'browser', host: BUSINESS } as const

/**
 * A controller over fakes: a scripted fetch, a token source, in-memory
 * settings that apply `settings.mutate` ops like DSH does, and every publish.
 */
function setup(options: { token?: () => Promise<TokenResult>; headers?: Record<string, string> } = {}) {
  const http = new FakeFetch()
  const writes: (readonly SettingsOp[])[] = []
  const published: PublishedModels[] = []
  const logs: string[] = []
  const settings: { visibility: Record<string, boolean>; limits: StoredChoices['limits']; headers: Record<string, string> } = {
    visibility: {},
    limits: {},
    headers: options.headers ?? { ...DEFAULT_CUSTOM_HEADERS },
  }
  let tokenReads = 0
  const models = new ModelsController({
    fetch: http.fetch,
    logger: {
      info: (...args) => logs.push(args.map(String).join(' ')),
      warn: (...args) => logs.push(args.map(String).join(' ')),
    },
    token: async () => {
      tokenReads += 1
      return options.token === undefined ? { token: 'ghu_TOKEN' } : options.token()
    },
    readChoices: () => ({ visibility: { ...settings.visibility }, limits: { ...settings.limits } }),
    readHeaders: () => ({ ...settings.headers }),
    writeSettings: async (ops) => {
      writes.push(ops)
      for (const op of ops) {
        const [field, id] = op.path
        if (field === 'customHeaders') settings.headers = op.op === 'set' ? { ...op.value as Record<string, string> } : { ...DEFAULT_CUSTOM_HEADERS }
        if (field === 'modelVisibility' && id !== undefined) {
          if (op.op === 'set') settings.visibility[id] = op.value as boolean
          else delete settings.visibility[id]
        }
        if (field === 'modelLimits' && id !== undefined) {
          const limits = { ...settings.limits } as Record<string, unknown>
          if (op.op === 'set') limits[id] = op.value
          else delete limits[id]
          settings.limits = limits as StoredChoices['limits']
        }
      }
    },
    publish: (models) => published.push(models),
    now: () => 1_700_000_000_000,
  })
  return { models, http, writes, published, logs, settings, tokenReads: () => tokenReads }
}

test('A2 request: URL, headers in order, version header from the default custom headers, redirect error, no retry', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  assert.equal(t.http.requests.length, 1)
  const [request] = t.http.requests
  assert.equal(request?.url, `${BUSINESS}/models`)
  assert.equal(request?.init.method, 'GET')
  assert.equal(request?.init.redirect, 'error')
  assert.ok(request?.init.signal instanceof AbortSignal)
  assert.deepEqual(Object.entries(request?.init.headers as Record<string, string>), [
    ['Accept', 'application/json'],
    ['Authorization', 'Bearer ghu_TOKEN'],
    ['Copilot-Integration-Id', 'copilot-developer-cli'],
    ['X-GitHub-Api-Version', '2026-08-01'],
  ])
})

test('A1/A2 integration id per method; custom headers last, compared without case; a removed version header is not sent', async () => {
  const t = setup({ headers: { 'copilot-integration-id': 'custom-id', 'X-Extra': '1' } })
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(BROWSER_TARGET)
  const headers = t.http.requests[0]?.init.headers as Record<string, string>
  assert.deepEqual(headers, { Accept: 'application/json', Authorization: 'Bearer ghu_TOKEN', 'copilot-integration-id': 'custom-id', 'X-Extra': '1' })
  assert.ok(!Object.keys(headers).some((name) => name.toLowerCase() === 'x-github-api-version'))
  assert.deepEqual(mergeHeaders({ Authorization: 'a' }, { authorization: 'b' }), { authorization: 'b' })
})

test('A2 10-second timeout and failure reasons; the token is never in an error', async () => {
  const cases: [Response | Error, Record<string, unknown>][] = [
    [modelsResponse('not json'), { reason: 'not-json', status: 200 }],
    [modelsResponse({ object: 'list' }), { reason: 'no-rows' }],
    [modelsResponse(reply()), { reason: 'no-rows' }],
    [modelsResponse({ message: 'Personal Access Tokens are not supported for this endpoint' }, { status: 400 }), { reason: 'http', status: 400, message: 'Personal Access Tokens are not supported for this endpoint' }],
    [modelsResponse({ message: 'slow down' }, { status: 429, headers: { 'retry-after': '30' } }), { reason: 'http', status: 429, retryAfter: '30' }],
    [modelsResponse('<html>unauthorized</html>', { status: 401 }), { reason: 'http', status: 401, requestId: 'GH:1', serviceRequestId: 'CP:1' }],
    [new TypeError('fetch failed'), { reason: 'network' }],
  ]
  for (const [answer, expected] of cases) {
    const http = new FakeFetch()
    http.replies.push(answer)
    const error = await fetchModels({ fetch: http.fetch, host: BUSINESS, token: 'ghu_SECRET', integrationId: 'vscode-chat', customHeaders: {} })
      .then(() => undefined, (error: unknown) => error as { code: string; params: Record<string, unknown> })
    assert.equal(error?.code, 'MODELS_FAILED', JSON.stringify(expected))
    for (const [key, value] of Object.entries(expected)) assert.equal(error?.params[key], value, `${key} in ${JSON.stringify(expected)}`)
    assert.ok(!JSON.stringify(error?.params).includes('SECRET'))
  }
  // A reply slower than the timeout.
  const slow = new FakeFetch()
  slow.replies.push(({ init }) => new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  }))
  const timedOut = await fetchModels({ fetch: slow.fetch, host: BUSINESS, token: 't', integrationId: 'x', customHeaders: {}, timeoutMs: 20 })
    .then(() => undefined, (error: unknown) => error as { params: Record<string, unknown> })
  assert.equal(timedOut?.params.reason, 'timeout')
})

test('A3 a successful fetch fills the row list and publishes the switched-on models with host and method', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(TWO_TIER_MESSAGES, ONE_TIER_RESPONSES)))
  await t.models.fetch(BROWSER_TARGET)
  const state = t.models.state()
  assert.equal(state.rows.length, 2)
  assert.equal(state.host, BUSINESS)
  assert.equal(state.method, 'browser')
  assert.equal(state.published, 2)
  assert.deepEqual(state.lastFetch, { at: 1_700_000_000_000, url: `${BUSINESS}/models`, status: 200, requestId: 'GH:1', serviceRequestId: 'CP:1' })
  assert.equal(t.published.length, 1)
  assert.equal(t.published[0]?.host, BUSINESS)
  assert.equal(t.published[0]?.method, 'browser')
  assert.deepEqual(t.published[0]?.specs.map((spec) => spec.id), ['fable-two-tier', 'codex-one-tier'])
})

test('A3 a failed fetch keeps the lists and shows the error (fail open)', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  t.http.replies.push(modelsResponse({ message: 'boom' }, { status: 500 }))
  await t.models.fetch(PAT_TARGET)
  const state = t.models.state()
  assert.equal(state.rows.length, 1, 'rows kept')
  assert.equal(state.published, 1)
  assert.equal(state.lastFetch?.error?.code, 'MODELS_FAILED')
  assert.equal(state.lastFetch?.status, 500)
  assert.equal(t.published.length, 1, 'nothing republished')
})

test('A3 no credential: no request, the lists are cleared', async () => {
  let token: TokenResult = { token: 'ghu_TOKEN' }
  const t = setup({ token: async () => token })
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  token = undefined
  await t.models.fetch(PAT_TARGET)
  assert.equal(t.http.requests.length, 1)
  assert.equal(t.models.state().rows.length, 0)
  assert.deepEqual(t.models.state().lastFetch?.error, { code: 'NOT_SIGNED_IN' })
  assert.deepEqual(t.published.at(-1), { specs: [], customHeaders: { ...DEFAULT_CUSTOM_HEADERS } })
})

test('A10 a failed token refresh: "Sign in again" with pi-ai\'s message; no request', async () => {
  const refreshError = Object.assign(new Error('OAuth refresh failed for github-copilot-models: 401'), { name: 'ModelsError', code: 'oauth' })
  const t = setup({ token: async () => { throw refreshError } })
  await t.models.fetch(BROWSER_TARGET)
  assert.equal(t.http.requests.length, 0)
  assert.deepEqual(t.models.state().lastFetch?.error, {
    code: 'MODELS_FAILED',
    params: { url: `${BUSINESS}/models`, reason: 'token-refresh', message: 'OAuth refresh failed for github-copilot-models: 401' },
  })
})

test('A3 credential removed or replaced: lists cleared, a running fetch dropped, nothing sent', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  t.models.credentialChanged()
  assert.equal(t.models.state().rows.length, 0)
  assert.equal(t.models.state().lastFetch, undefined)
  assert.equal(t.published.at(-1)?.specs.length, 0)

  // A fetch for the old credential that ends after the change is dropped.
  let resolveReply: (response: Response) => void = () => {}
  t.http.replies.push(() => new Promise<Response>((resolve) => { resolveReply = resolve }))
  const pending = t.models.fetch(PAT_TARGET)
  await tick()
  t.models.credentialChanged()
  resolveReply(modelsResponse(reply(ONE_TIER_RESPONSES)))
  await pending
  assert.equal(t.models.state().rows.length, 0)
  assert.equal(t.http.requests.length, 2)
})

test('A3 one fetch at a time: a trigger during a fetch runs one more after it; later triggers share it; the newer result wins', async () => {
  const t = setup()
  let first: (response: Response) => void = () => {}
  t.http.replies.push(() => new Promise<Response>((resolve) => { first = resolve }))
  t.http.replies.push(modelsResponse(reply(ONE_TIER_RESPONSES)))
  const a = t.models.fetch(PAT_TARGET)
  await tick()
  assert.equal(t.models.fetching, true)
  const b = t.models.fetch(PAT_TARGET)
  const c = t.models.fetch(PAT_TARGET)
  assert.equal(t.http.requests.length, 1, 'only one request runs')
  first(modelsResponse(reply(CHAT_NO_BILLING)))
  await Promise.all([a, b, c])
  assert.equal(t.http.requests.length, 2, 'b and c share one fetch')
  assert.deepEqual(t.models.state().rows.map((row) => row.key), ['codex-one-tier'])
  assert.equal(t.models.fetching, false)
})

test('A3/A5 toggle, size and header changes send no request; each rebuilds and republishes', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(TWO_TIER_MESSAGES, ONE_TIER_RESPONSES, CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  const requests = t.http.requests.length
  const before = t.published.length

  const off = await t.models.setVisibility({ id: 'haiku-chat', on: false })
  assert.equal(off.ok, true)
  assert.deepEqual(t.writes.at(-1), [{ op: 'set', path: ['modelVisibility', 'haiku-chat'], value: false }])
  assert.equal(off.models.published, 2)

  const long = await t.models.setLimits({ id: 'fable-two-tier', context: 1_000_000 })
  assert.equal(long.ok, true)
  assert.deepEqual(t.writes.at(-1), [{ op: 'set', path: ['modelLimits', 'fable-two-tier'], value: { context: 1_000_000 } }])
  assert.equal(t.published.at(-1)?.specs.find((spec) => spec.id === 'fable-two-tier')?.contextWindow, 1_000_000)
  assert.equal(long.models.rows.find((row) => row.id === 'fable-two-tier')?.sizes?.effectiveContext, 1_000_000)

  const typed = await t.models.setLimits({ id: 'codex-one-tier', context: 300_000, output: 64_000 })
  assert.equal(typed.ok, true)
  assert.deepEqual(t.writes.at(-1), [{ op: 'set', path: ['modelLimits', 'codex-one-tier'], value: { context: 300_000, output: 64_000 } }])

  const headers = await t.models.setHeaders({ 'X-GitHub-Api-Version': '2026-06-01' })
  assert.equal(headers.ok, true)
  assert.deepEqual(t.writes.at(-1), [{ op: 'set', path: ['customHeaders'], value: { 'X-GitHub-Api-Version': '2026-06-01' } }])
  assert.deepEqual(t.published.at(-1)?.customHeaders, { 'X-GitHub-Api-Version': '2026-06-01' })

  assert.equal(t.http.requests.length, requests, 'no request')
  assert.equal(t.published.length, before + 4, 'one republish per change')
  // One model entry per settings.mutate call (A5).
  for (const ops of t.writes) assert.equal(ops.length, 1)
})

test('A5 clearing: unset of one entry; the entry is replaced as a whole, so a preset drops a stored output and old keys; an empty entry is unset', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(TWO_TIER_MESSAGES, ONE_TIER_RESPONSES)))
  await t.models.fetch(PAT_TARGET)
  await t.models.setVisibility({ id: 'codex-one-tier', clear: true })
  assert.deepEqual(t.writes.at(-1), [{ op: 'unset', path: ['modelVisibility', 'codex-one-tier'] }])
  // A key of an earlier design stays in Config until the entry is next written.
  t.settings.limits = { 'fable-two-tier': { tier: 'long', output: 64_000 } } as unknown as StoredChoices['limits']
  await t.models.setLimits({ id: 'fable-two-tier', context: 1_000_000 })
  assert.deepEqual(t.writes.at(-1), [{ op: 'set', path: ['modelLimits', 'fable-two-tier'], value: { context: 1_000_000 } }], 'Long: the context only')
  await t.models.setLimits({ id: 'fable-two-tier', clear: true })
  assert.deepEqual(t.writes.at(-1), [{ op: 'unset', path: ['modelLimits', 'fable-two-tier'] }], 'Default')
  await t.models.setLimits({ id: 'codex-one-tier', context: 300_000 })
  await t.models.setLimits({ id: 'codex-one-tier', clear: true })
  assert.deepEqual(t.writes.at(-1), [{ op: 'unset', path: ['modelLimits', 'codex-one-tier'] }])
  // Sizes without values: an empty entry is unset too.
  await t.models.setLimits({ id: 'codex-one-tier' })
  assert.deepEqual(t.writes.at(-1), [{ op: 'unset', path: ['modelLimits', 'codex-one-tier'] }])
})

test('A4/A10 refused sizes are not written: each check, zero, the long tier\'s prompt limit, an unknown id', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(TWO_TIER_MESSAGES, ONE_TIER_RESPONSES)))
  await t.models.fetch(PAT_TARGET)
  const cases: [Parameters<typeof t.models.setLimits>[0], Record<string, unknown>][] = [
    [{ id: 'codex-one-tier', context: 0 }, { code: 'LIMIT_REFUSED', params: { check: 'not-positive' } }],
    [{ id: 'codex-one-tier', context: 1.5 }, { code: 'LIMIT_REFUSED', params: { check: 'not-positive' } }],
    [{ id: 'codex-one-tier', context: 400_001 }, { code: 'LIMIT_REFUSED', params: { check: 'context-above-window', limit: 400_000 } }],
    [{ id: 'codex-one-tier', output: 128_001 }, { code: 'LIMIT_REFUSED', params: { check: 'output-above-max', limit: 128_000 } }],
    [{ id: 'codex-one-tier', context: 64_000, output: 64_000 }, { code: 'LIMIT_REFUSED', params: { check: 'output-not-below-context', limit: 64_000 } }],
    [{ id: 'codex-one-tier', context: 400_000, output: 100_000 }, { code: 'LIMIT_REFUSED', params: { check: 'prompt-above-tier', limit: 272_000 } }],
    [{ id: 'fable-two-tier', context: 1_000_001 }, { code: 'LIMIT_REFUSED', params: { check: 'context-above-window', limit: 1_000_000 } }],
    [{ id: 'fable-two-tier', context: 1_000_000, output: 32_000 }, { code: 'LIMIT_REFUSED', params: { check: 'prompt-above-tier', limit: 936_000 } }],
    [{ id: 'no-such-model', context: 100_000 }, { code: 'UNKNOWN_MODEL', params: { id: 'no-such-model' } }],
  ]
  for (const [request, error] of cases) {
    const response = await t.models.setLimits(request)
    assert.equal(response.ok, false, JSON.stringify(request))
    assert.deepEqual(response.error, error, JSON.stringify(request))
  }
  assert.equal(t.writes.length, 0, 'nothing written')
  assert.deepEqual((await t.models.setVisibility({ id: 'no-such-model', on: true })).error, { code: 'UNKNOWN_MODEL', params: { id: 'no-such-model' } })
})

test('A6 headers: refused pairs, a name given twice (any case), an empty name; nothing saved', async () => {
  const t = setup()
  const cases: [Record<string, string>, Record<string, unknown>][] = [
    [{ 'Bad Name': 'x' }, { name: 'Bad Name', reason: 'invalid' }],
    [{ 'X-Ok': 'line\nbreak' }, { name: 'X-Ok', reason: 'invalid' }],
    [{ 'X-A': '1', 'x-a': '2' }, { name: 'x-a', reason: 'duplicate' }],
    [{ ' ': '1' }, { name: ' ', reason: 'empty' }],
  ]
  for (const [headers, params] of cases) {
    const response = await t.models.setHeaders(headers)
    assert.equal(response.error?.code, 'HEADER_REFUSED', JSON.stringify(headers))
    for (const [key, value] of Object.entries(params)) assert.equal(response.error?.params?.[key], value, JSON.stringify(headers))
  }
  assert.equal(t.writes.length, 0)
  // An empty list is saved and stays empty: the version header is not sent again.
  assert.equal((await t.models.setHeaders({})).ok, true)
  assert.deepEqual(t.settings.headers, {})
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  assert.deepEqual(Object.keys(t.http.requests[0]?.init.headers as object), ['Accept', 'Authorization', 'Copilot-Integration-Id'])
})

test('A4 "no longer returned" ids keep their stored choice and can be cleared', async () => {
  const t = setup()
  t.settings.visibility['gone-model'] = true
  t.settings.limits = { 'gone-model': { context: 1000 } }
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  assert.deepEqual(t.models.state().gone, [{ id: 'gone-model', stored: { visible: true, context: 1000 } }])
  assert.equal((await t.models.setVisibility({ id: 'gone-model', clear: true })).ok, true)
  assert.equal((await t.models.setLimits({ id: 'gone-model', clear: true })).ok, true)
  assert.deepEqual(t.models.state().gone, [])
})

test('A5 a stored choice that fails to save is reported; nothing republished', async () => {
  const t = setup()
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  const published = t.published.length
  const failing = new ModelsController({
    fetch: t.http.fetch,
    logger: { info: () => {}, warn: () => {} },
    token: async () => ({ token: 't' }),
    readChoices: () => ({ visibility: { x: true }, limits: {} }),
    readHeaders: () => ({}),
    writeSettings: async () => { throw new Error('profile is read-only') },
    publish: () => {},
  })
  const response = await failing.setVisibility({ id: 'x', on: false })
  assert.deepEqual(response.error, { code: 'SAVE_FAILED', params: { message: 'profile is read-only' } })
  assert.equal(t.published.length, published)
})

test('A2 no token in the state, the published models or the logs', async () => {
  const t = setup({ token: async () => ({ token: 'ghu_LEAKCHECK' }) })
  t.http.replies.push(modelsResponse(reply(CHAT_NO_BILLING)))
  await t.models.fetch(PAT_TARGET)
  t.http.replies.push(modelsResponse({ message: 'nope' }, { status: 401 }))
  await t.models.fetch(PAT_TARGET)
  const everything = JSON.stringify([t.models.state(), t.published, t.logs])
  assert.ok(!everything.includes('LEAKCHECK'))
})
