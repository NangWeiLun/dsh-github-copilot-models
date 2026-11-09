/** login.md A2, A4–A9: the login controller over fakes. */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoginOutput } from '../../src/host/login.ts'
import { LoginController } from '../../src/host/login.ts'
import { browserFlow, FakeAuthorization, FakeCredentials, FakeFetch, KEY, patFlow, PiAiError, tick, userReply } from './fakes.ts'

/** A controller over fresh fakes, with every log line and output captured. */
function setup(options: { domain?: string } = {}) {
  const credentials = new FakeCredentials()
  const authorization = new FakeAuthorization(credentials)
  authorization.flows = { 'api-key': patFlow, oauth: browserFlow({}) }
  const http = new FakeFetch()
  const logs: string[] = []
  const outputs: (LoginOutput | undefined)[] = []
  const saved: string[] = []
  let domain = options.domain ?? ''
  const login = new LoginController({
    credentials: () => credentials,
    authorization: () => authorization,
    fetch: http.fetch,
    logger: {
      info: (...args) => logs.push(args.map(String).join(' ')),
      warn: (...args) => logs.push(args.map(String).join(' ')),
    },
    readDomain: () => domain,
    saveDomain: async (value) => {
      saved.push(value)
      domain = value
    },
    onOutputChange: (output) => outputs.push(output),
  })
  credentials.listeners.push((key) => {
    if (key === KEY) void login.recordUpdated()
  })
  return { login, credentials, authorization, http, logs, outputs, saved, domain: () => domain }
}

const BUSINESS = { login: 'octocat', endpoints: { api: 'https://api.business.githubcopilot.com' } }
const INDIVIDUAL = { login: 'hubot', endpoints: { api: 'https://api.individual.githubcopilot.com' } }

test('A5 PAT: lookup first, then stored through begin({ method: "api-key" }) answering the secret prompt', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  const response = await t.login.patSignIn('', ' github_pat_SECRET ')
  assert.equal(response.ok, true)
  assert.equal(t.http.requests.length, 1)
  assert.deepEqual(t.http.requests[0]?.init.headers, { Accept: 'application/json', Authorization: 'token github_pat_SECRET' })
  assert.deepEqual(t.authorization.begins, [{ key: KEY, method: 'api-key' }])
  assert.deepEqual(t.credentials.records.get(KEY), { kind: 'api-key', key: 'github_pat_SECRET' })
  assert.equal(response.state.status, 'signed-in')
  assert.equal(response.state.method, 'pat')
  assert.equal(response.state.account, 'octocat')
  assert.equal(response.state.copilotHost, 'https://api.business.githubcopilot.com')
  assert.equal(response.state.inFlight, false, 'the reply reflects the finished sign-in')
  assert.equal(response.state.signIn, undefined)
  assert.deepEqual(t.outputs.at(-1), { method: 'pat', host: 'https://api.business.githubcopilot.com', account: 'octocat' })
})

test('A5 PAT: nothing stored when the lookup fails; previous login kept', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  await t.login.patSignIn('', 'github_pat_OLD')
  t.http.replies.push(userReply({ message: 'Bad credentials' }, { status: 401, requestId: 'X:1' }))
  const response = await t.login.patSignIn('', 'github_pat_NEW')
  assert.equal(response.ok, false)
  assert.equal(response.error?.code, 'LOOKUP_FAILED')
  assert.equal(response.error?.params?.status, 401)
  assert.equal(response.error?.params?.requestId, 'X:1')
  assert.deepEqual(t.credentials.records.get(KEY), { kind: 'api-key', key: 'github_pat_OLD' })
  assert.equal(t.authorization.begins.length, 1)
  assert.equal(response.state.status, 'signed-in')
  assert.equal(response.state.account, 'octocat')
})

test('A5 PAT: any prompt other than the secret one is rejected', async () => {
  const t = setup()
  t.authorization.flows['api-key'] = async (session) => {
    await session.prompt({ kind: 'text', message: 'Something else' })
  }
  t.http.replies.push(userReply(BUSINESS))
  const response = await t.login.patSignIn('', 'github_pat_X')
  assert.equal(response.error?.code, 'UNEXPECTED_PROMPT')
  assert.equal(t.credentials.records.has(KEY), false)
})

test('A4 browser: first text prompt answered, notices buffered, payload.refresh used for the lookup', async () => {
  const t = setup()
  const answers: string[] = []
  t.authorization.flows.oauth = browserFlow({ refresh: 'gho_LOGIN', onAnswer: (answer) => answers.push(answer) })
  t.http.replies.push(userReply(INDIVIDUAL))
  const response = await t.login.browserSignIn('')
  assert.equal(response.ok, true)
  assert.deepEqual(answers, [''])
  assert.deepEqual(t.authorization.begins, [{ key: KEY, method: 'oauth' }])
  assert.equal(t.http.requests[0]?.url, 'https://api.github.com/copilot_internal/user')
  assert.deepEqual(t.http.requests[0]?.init.headers, { Accept: 'application/json', Authorization: 'token gho_LOGIN' })
  const notices = t.login.notices(0)
  assert.equal(notices.length, 1)
  assert.deepEqual(notices[0], { seq: 1, message: 'Enter this code on the verification page to finish signing in.', url: 'https://github.com/login/device', code: 'ABCD-1234' })
  assert.deepEqual(t.login.notices(1), [])
  assert.equal(response.state.method, 'browser')
  assert.equal(response.state.account, 'hubot')
})

test('A4 prompt rule: "github.com" is answered with an empty string; an enterprise host as is', async () => {
  for (const [field, expected] of [['github.com', ''], ['https://github.com/', ''], ['octo.ghe.com', 'octo.ghe.com']] as const) {
    const t = setup()
    const answers: string[] = []
    t.authorization.flows.oauth = browserFlow({ onAnswer: (answer) => answers.push(answer) })
    t.http.replies.push(userReply(BUSINESS))
    await t.login.browserSignIn(field)
    assert.deepEqual(answers, [expected], field)
    const host = expected === '' ? 'github.com' : expected
    assert.equal(t.http.requests[0]?.url, `https://api.${host}/copilot_internal/user`, field)
  }
})

test('A4 a second prompt fails the login with "Unexpected sign-in step"', async () => {
  const t = setup()
  t.authorization.flows.oauth = browserFlow({ extraPrompt: { kind: 'text', message: 'Another question' } })
  const response = await t.login.browserSignIn('')
  assert.equal(response.ok, false)
  assert.equal(response.error?.code, 'UNEXPECTED_PROMPT')
  assert.equal(t.http.requests.length, 0)
})

test('A1 invalid domain: no sign-in starts and nothing is sent', async () => {
  const t = setup()
  const response = await t.login.browserSignIn('exa mple.com')
  assert.equal(response.error?.code, 'INVALID_DOMAIN')
  const pat = await t.login.patSignIn('exa mple.com', 'github_pat_X')
  assert.equal(pat.error?.code, 'INVALID_DOMAIN')
  assert.equal(t.authorization.begins.length, 0)
  assert.equal(t.http.requests.length, 0)
})

test('A1 domain: saved after a successful sign-in only; editable state follows the record', async () => {
  const t = setup()
  t.http.replies.push(userReply({}, { status: 404 }))
  await t.login.patSignIn('octo.ghe.com', 'github_pat_X')
  assert.deepEqual(t.saved, [])
  t.http.replies.push(userReply(BUSINESS))
  const response = await t.login.patSignIn('octo.ghe.com', 'github_pat_X')
  assert.equal(response.ok, true)
  assert.deepEqual(t.saved, ['octo.ghe.com'])
  assert.equal(response.state.domain, 'octo.ghe.com')
  assert.equal(response.state.status, 'signed-in')
  const out = await t.login.signOut()
  assert.equal(out.state.status, 'signed-out')
  assert.equal(out.state.domain, 'octo.ghe.com', 'sign-out leaves domain unchanged')
})

test('A2 one record: a PAT replaces a browser login and a browser login replaces a PAT', async () => {
  const t = setup()
  t.http.replies.push(userReply(INDIVIDUAL))
  await t.login.browserSignIn('')
  assert.equal(t.credentials.records.get(KEY)?.kind, 'grant')
  t.http.replies.push(userReply(BUSINESS))
  const pat = await t.login.patSignIn('', 'github_pat_X')
  assert.equal(pat.state.method, 'pat')
  assert.equal(t.credentials.records.get(KEY)?.kind, 'api-key')
  t.http.replies.push(userReply(INDIVIDUAL))
  const browser = await t.login.browserSignIn('')
  assert.equal(browser.state.method, 'browser')
  assert.equal(t.credentials.records.get(KEY)?.kind, 'grant')
  assert.deepEqual(t.outputs.map((output) => output?.method), ['browser', 'pat', undefined, 'browser'])
})

test('A4 cancel keeps the previous login; aborting the Card request cancels too', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  await t.login.patSignIn('', 'github_pat_X')

  let approve: () => void = () => {}
  t.authorization.flows.oauth = browserFlow({ approve: new Promise<void>((resolve) => { approve = resolve }) })
  const pending = t.login.browserSignIn('')
  await tick()
  assert.equal(t.login.state().inFlight, true)
  assert.equal(t.login.state().signIn?.method, 'browser')
  t.login.cancel()
  const response = await pending
  approve()
  assert.equal(response.cancelled, true)
  assert.equal(response.state.status, 'signed-in')
  assert.equal(response.state.method, 'pat')
  assert.deepEqual(t.credentials.records.get(KEY), { kind: 'api-key', key: 'github_pat_X' })

  const controller = new AbortController()
  t.authorization.flows.oauth = browserFlow({ approve: new Promise<void>(() => {}) })
  const second = t.login.browserSignIn('', controller.signal)
  await tick()
  controller.abort()
  assert.equal((await second).cancelled, true)
  assert.equal(t.login.state().status, 'signed-in')
})

test('A4 a failed sign-in keeps the previous record, host, account and output', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  await t.login.patSignIn('', 'github_pat_X')
  t.authorization.flows.oauth = browserFlow({ failWith: new Error('Device flow failed: access_denied') })
  const response = await t.login.browserSignIn('')
  assert.equal(response.error?.code, 'SIGN_IN_FAILED')
  assert.equal(response.error?.params?.message, 'Device flow failed: access_denied')
  assert.equal(response.state.account, 'octocat')
  assert.deepEqual(t.outputs.at(-1), { method: 'pat', host: 'https://api.business.githubcopilot.com', account: 'octocat' })
})

test('B4 one attempt at a time: ALREADY_IN_FLIGHT for either method; inFlight reported', async () => {
  const t = setup()
  t.authorization.flows.oauth = browserFlow({ approve: new Promise<void>(() => {}) })
  const pending = t.login.browserSignIn('')
  await tick()
  assert.equal(t.login.state().inFlight, true)
  assert.equal((await t.login.patSignIn('', 'github_pat_X')).error?.code, 'ALREADY_IN_FLIGHT')
  assert.equal((await t.login.browserSignIn('')).error?.code, 'ALREADY_IN_FLIGHT')
  assert.equal(t.http.requests.length, 0, 'a refused PAT sends no lookup')
  t.login.cancel()
  await pending
  assert.equal(t.login.state().inFlight, false)
})

test('A8 DSH codes are recognised by code, never by message', async () => {
  const t = setup()
  t.authorization.registered = false
  assert.equal((await t.login.browserSignIn('')).error?.code, 'NO_FLOW')
  assert.equal((await t.login.patSignIn('', 'github_pat_X')).error?.code, 'NO_FLOW')
  assert.equal(t.http.requests.length, 0)
  t.authorization.registered = true
  t.authorization.flows = {}
  const unknown = await t.login.browserSignIn('')
  assert.deepEqual(unknown.error, { code: 'DSH_ERROR', params: { code: 'UNKNOWN_METHOD' } })
  t.authorization.flows.oauth = async () => {}
  assert.deepEqual((await t.login.browserSignIn('')).error, { code: 'DSH_ERROR', params: { code: 'NOT_COMMITTED' } })
  t.authorization.flows.oauth = async () => {
    throw new Error('ALREADY_IN_FLIGHT appears only in this message')
  }
  assert.equal((await t.login.browserSignIn('')).error?.code, 'SIGN_IN_FAILED')
  // pi-ai's own errors carry a code too (a failed record write: ModelsError 'auth'); not a DSH code.
  t.authorization.flows.oauth = async () => {
    throw new PiAiError('Credential store modify failed for github-copilot: disk full', 'auth')
  }
  assert.deepEqual((await t.login.browserSignIn('')).error, {
    code: 'SIGN_IN_FAILED',
    params: { message: 'Credential store modify failed for github-copilot: disk full' },
  })
})

test('A2/B4 a record write that lands after Cancel is noticed once the sign-in ends', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  await t.login.patSignIn('', 'github_pat_X')
  // The orphaned run commits after begin() already resolved cancelled (contract test D5).
  t.authorization.flows.oauth = async (session) => {
    await new Promise((resolve) => setTimeout(resolve, 5))
    session.commit({ kind: 'grant', payload: { type: 'oauth', refresh: 'gho_LATE', access: 'a', expires: 1 } })
    await new Promise<void>(() => {})
  }
  const pending = t.login.browserSignIn('')
  await new Promise((resolve) => setTimeout(resolve, 20))
  t.login.cancel()
  assert.equal((await pending).cancelled, true)
  await tick()
  await tick()
  const state = t.login.state()
  assert.equal(state.changedOutside, true, 'the Card asks for Refresh')
  assert.equal(state.status, 'unverified')
  assert.equal(state.method, 'browser')
  assert.equal(t.outputs.at(-1), undefined, 'the old PAT output is withdrawn')
})

test('A6 sign-out: cancels, deletes the record, clears state, checks the env token by describe only', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  await t.login.patSignIn('', 'github_pat_X')
  t.credentials.envConfigured = true
  const response = await t.login.signOut()
  assert.equal(response.ok, true)
  assert.equal(response.envTokenSet, true)
  assert.deepEqual(t.authorization.cancels, [KEY])
  assert.equal(t.credentials.records.has(KEY), false)
  assert.deepEqual(t.credentials.describeCalls, ['COPILOT_GITHUB_TOKEN'])
  assert.equal(response.state.status, 'signed-out')
  assert.equal(response.state.account, undefined)
  assert.equal(response.state.copilotHost, undefined)
  assert.equal(t.outputs.at(-1), undefined)
})

test('A6 sign-out during a browser sign-in cancels it', async () => {
  const t = setup()
  t.authorization.flows.oauth = browserFlow({ approve: new Promise<void>(() => {}) })
  const pending = t.login.browserSignIn('')
  await tick()
  await t.login.signOut()
  assert.equal((await pending).cancelled, true)
  assert.equal(t.credentials.records.has(KEY), false)
})

test('A6 sign-out while a PAT lookup runs: the PAT is never stored', async () => {
  const t = setup()
  t.http.replies.push(({ init }) => new Promise<Response>((resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    setTimeout(() => resolve(userReply()), 50)
  }))
  const pending = t.login.patSignIn('', 'github_pat_X')
  await tick()
  assert.equal(t.login.state().inFlight, true, 'other tabs see the PAT sign-in as running')
  await t.login.signOut()
  assert.equal((await pending).cancelled, true)
  assert.equal(t.authorization.begins.length, 0)
  assert.equal(t.credentials.records.has(KEY), false)
})

test('A2 record-updated: deleted clears; same credential no-op; different credential flags Refresh; no request', async () => {
  const t = setup()
  t.http.replies.push(userReply(INDIVIDUAL))
  await t.login.browserSignIn('')
  const requests = t.http.requests.length
  const before = t.outputs.length

  // A Copilot token refresh rewrites the record with the same login token.
  t.credentials.write(KEY, { kind: 'grant', payload: { type: 'oauth', refresh: 'gho_login_token', access: 'new', expires: 1 } })
  await tick()
  assert.equal(t.login.state().status, 'signed-in')
  assert.equal(t.outputs.length, before)

  // Another plugin stores a different credential.
  t.credentials.write(KEY, { kind: 'api-key', key: 'github_pat_OTHER' })
  await tick()
  const changed = t.login.state()
  assert.equal(changed.status, 'unverified')
  assert.equal(changed.changedOutside, true)
  assert.equal(changed.method, 'pat')
  assert.equal(changed.account, undefined)
  assert.equal(t.outputs.at(-1), undefined)

  // The record is removed in DSH Settings.
  await t.credentials.deleteRecord(KEY)
  await tick()
  assert.equal(t.login.state().status, 'signed-out')
  assert.equal(t.login.state().changedOutside, false)
  assert.equal(t.http.requests.length, requests, 'no request on any record event')
})

test('A2 record-updated during our own sign-in or sign-out is ignored', async () => {
  const t = setup()
  t.http.replies.push(userReply(BUSINESS))
  await t.login.patSignIn('', 'github_pat_X')
  assert.equal(t.login.state().changedOutside, false)
  await t.login.signOut()
  await tick()
  assert.equal(t.login.state().changedOutside, false)
  assert.equal(t.login.state().status, 'signed-out')
})

test('A3 lookup times: once at start-up when a record exists, again on Refresh, never on record events', async () => {
  const t = setup()
  await t.login.start()
  assert.equal(t.http.requests.length, 0, 'no record: no lookup')

  t.credentials.records.set(KEY, { kind: 'api-key', key: 'github_pat_X' })
  t.http.replies.push(userReply(BUSINESS))
  await t.login.start()
  assert.equal(t.http.requests.length, 1)
  assert.equal(t.login.state().status, 'signed-in')

  t.http.replies.push(userReply(INDIVIDUAL))
  const refreshed = await t.login.refresh()
  assert.equal(refreshed.ok, true)
  assert.equal(refreshed.state.account, 'hubot')
  assert.equal(t.http.requests.length, 2)
})

test('Q4 start-up lookup failure keeps the record and shows the error until Refresh', async () => {
  const t = setup()
  t.credentials.records.set(KEY, { kind: 'api-key', key: 'github_pat_EXPIRED' })
  t.http.replies.push(userReply({ message: 'Bad credentials' }, { status: 401 }))
  await t.login.start()
  const state = t.login.state()
  assert.equal(state.status, 'unverified')
  assert.equal(state.method, 'pat')
  assert.equal(state.error?.code, 'LOOKUP_FAILED')
  assert.equal(t.credentials.records.has(KEY), true)
  assert.equal(t.outputs.length, 0)

  t.http.replies.push(userReply(BUSINESS))
  const response = await t.login.refresh()
  assert.equal(response.ok, true)
  assert.equal(response.state.error, undefined)
  assert.equal(response.state.status, 'signed-in')
})

test('A3 browser record at start-up: looked up on pi-ai\'s stored domain with payload.refresh', async () => {
  const t = setup({ domain: '' })
  t.credentials.records.set(KEY, { kind: 'grant', payload: { type: 'oauth', refresh: 'ghu_ENT', access: 'a', expires: 1, enterpriseUrl: 'octo.ghe.com' } })
  t.http.replies.push(userReply(BUSINESS))
  await t.login.start()
  assert.equal(t.http.requests[0]?.url, 'https://api.octo.ghe.com/copilot_internal/user')
  assert.deepEqual(t.http.requests[0]?.init.headers, { Accept: 'application/json', Authorization: 'token ghu_ENT' })
  assert.deepEqual(t.saved, ['octo.ghe.com'], 'the saved domain follows the stored credential')
})

test('Refresh without a record: NOT_SIGNED_IN and no request', async () => {
  const t = setup()
  const response = await t.login.refresh()
  assert.equal(response.error?.code, 'NOT_SIGNED_IN')
  assert.equal(t.http.requests.length, 0)
})

test('A9 no token in state, responses, outputs or log lines', async () => {
  const t = setup()
  t.http.replies.push(userReply({}, { status: 500 }))
  const failed = await t.login.patSignIn('', 'github_pat_LEAKCHECK')
  t.http.replies.push(userReply(BUSINESS))
  const ok = await t.login.patSignIn('', 'github_pat_LEAKCHECK')
  t.credentials.records.set(KEY, { kind: 'grant', payload: { type: 'oauth', refresh: 'gho_LEAKCHECK', access: 'tid=LEAKCHECK', expires: 1 } })
  t.http.replies.push(new TypeError('fetch failed'))
  const refreshed = await t.login.refresh()
  const everything = JSON.stringify([failed, ok, refreshed, t.login.state(), t.login.notices(0), t.outputs, t.logs])
  assert.ok(!everything.includes('LEAKCHECK'), 'no token anywhere the Card, Models or logs can see')
})
