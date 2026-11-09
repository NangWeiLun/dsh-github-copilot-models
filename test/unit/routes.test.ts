/** The Card ↔ Host routes (login.md A10, models.md A11): paths, methods, bodies, no tokens. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { LoginController } from '../../src/host/login.ts'
import { ModelsController } from '../../src/host/models.ts'
import { createRoutes, routePath } from '../../src/host/routes.ts'
import type { FetchRoute } from '../../src/host/routes.ts'
import { FakeAuthorization, FakeCredentials, FakeFetch, KEY, patFlow, userReply } from './fakes.ts'

function setup() {
  const credentials = new FakeCredentials()
  const authorization = new FakeAuthorization(credentials)
  authorization.flows = { 'api-key': patFlow }
  const http = new FakeFetch()
  const models = new ModelsController({
    fetch: http.fetch,
    logger: { info: () => {}, warn: () => {} },
    // No token: the fetch after a sign-in sends nothing in these tests.
    token: async () => undefined,
    readChoices: () => ({ visibility: {}, limits: {} }),
    readHeaders: () => ({}),
    writeSettings: async () => {},
    publish: () => {},
  })
  const login = new LoginController({
    credentials: () => credentials,
    authorization: () => authorization,
    fetch: http.fetch,
    logger: { info: () => {}, warn: () => {} },
    readDomain: () => '',
    saveDomain: async () => {},
    models: {
      lookupSucceeded: (output) => models.fetch({ method: output.method, host: output.host }),
      credentialChanged: () => models.credentialChanged(),
      state: () => models.state(),
      fetching: () => models.fetching,
    },
  })
  const routes = new Map<string, FetchRoute>(createRoutes(login, models).map((route) => [route.path, route]))
  const call = async (path: string, init: RequestInit = {}) => {
    const route = routes.get(new URL(path, 'http://dsh.internal').pathname)
    assert.ok(route !== undefined, `route ${path}`)
    const response = await route.fetch(new Request(new URL(path, 'http://dsh.internal'), init))
    return { status: response.status, headers: response.headers, body: await response.json() as Record<string, unknown>, text: '' }
  }
  const post = (path: string, body: unknown) => call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
  return { routes, call, post, credentials, http }
}

test('eleven exact routes under /api/github-copilot-models with the right methods', () => {
  const { routes } = setup()
  const table = [...routes.values()].map((route) => [route.path, route.methods.join(','), route.requestBody])
  assert.deepEqual(table, [
    ['/api/github-copilot-models/state', 'GET', 'buffered'],
    ['/api/github-copilot-models/notices', 'GET', 'buffered'],
    ['/api/github-copilot-models/browserBegin', 'POST', 'buffered'],
    ['/api/github-copilot-models/browserCancel', 'POST', 'buffered'],
    ['/api/github-copilot-models/patSave', 'POST', 'buffered'],
    ['/api/github-copilot-models/signOut', 'POST', 'buffered'],
    ['/api/github-copilot-models/refresh', 'POST', 'buffered'],
    ['/api/github-copilot-models/models', 'GET', 'buffered'],
    ['/api/github-copilot-models/setVisibility', 'POST', 'buffered'],
    ['/api/github-copilot-models/setLimits', 'POST', 'buffered'],
    ['/api/github-copilot-models/setHeaders', 'POST', 'buffered'],
  ])
  assert.equal(routePath('state'), '/api/github-copilot-models/state')
})

test('state is local JSON with no-store; notices filter by "after"', async () => {
  const t = setup()
  const state = await t.call('/api/github-copilot-models/state')
  assert.equal(state.status, 200)
  assert.equal(state.headers.get('cache-control'), 'no-store')
  assert.equal(state.body.status, 'signed-out')
  assert.equal(state.body.flowAvailable, true)
  const notices = await t.call('/api/github-copilot-models/notices?after=0')
  assert.deepEqual(notices.body, { notices: [] })
  const bad = await t.call('/api/github-copilot-models/notices?after=-1')
  assert.equal(bad.status, 400)
  assert.equal(t.http.requests.length, 0)
})

test('patSave stores the PAT and never echoes it; malformed bodies answer 400', async () => {
  const t = setup()
  t.http.replies.push(userReply())
  const saved = await t.post('/api/github-copilot-models/patSave', { domain: '', pat: 'github_pat_ROUTECHECK' })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.ok, true)
  assert.ok(!JSON.stringify(saved.body).includes('ROUTECHECK'))
  assert.deepEqual(t.credentials.records.get(KEY), { kind: 'api-key', key: 'github_pat_ROUTECHECK' })

  for (const body of ['not json', '[1]', JSON.stringify({ domain: 3, pat: 'x' })]) {
    const response = await t.post('/api/github-copilot-models/patSave', body)
    assert.equal(response.status, 400, body)
    assert.equal((response.body.error as { code: string }).code, 'BAD_REQUEST', body)
  }
})

test('signOut reports envTokenSet; refresh without a record answers NOT_SIGNED_IN', async () => {
  const t = setup()
  t.credentials.envConfigured = true
  const out = await t.post('/api/github-copilot-models/signOut', {})
  assert.equal(out.body.ok, true)
  assert.equal(out.body.envTokenSet, true)
  const refresh = await t.post('/api/github-copilot-models/refresh', {})
  assert.deepEqual(refresh.body.error, { code: 'NOT_SIGNED_IN' })
})
