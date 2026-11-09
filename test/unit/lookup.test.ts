/** login.md A1 (Domain field) and A3 (host lookup, validation). */
import assert from 'node:assert/strict'
import test from 'node:test'
import { configDomain, domainAnswer, normalizeDomain } from '../../src/host/domain.ts'
import { LoginError } from '../../src/host/errors.ts'
import { lookupCopilotHost, lookupUrl, validateApiAddress } from '../../src/host/lookup.ts'
import { FakeFetch, userReply } from './fakes.ts'

test('A1 domain normalising: empty, plain host, URL with path, spaces, invalid', () => {
  assert.equal(normalizeDomain(''), 'github.com')
  assert.equal(normalizeDomain('   '), 'github.com')
  assert.equal(normalizeDomain('octo.ghe.com'), 'octo.ghe.com')
  assert.equal(normalizeDomain('  octo.ghe.com  '), 'octo.ghe.com')
  assert.equal(normalizeDomain('https://octo.ghe.com/some/path?x=1'), 'octo.ghe.com')
  assert.equal(normalizeDomain('OCTO.GHE.COM'), 'octo.ghe.com')
  for (const bad of ['http://', 'exa mple.com', 'https://[bad', 'a b']) {
    assert.throws(() => normalizeDomain(bad), (error: unknown) => error instanceof LoginError && error.code === 'INVALID_DOMAIN', bad)
  }
})

test('A4 prompt answer: empty for github.com, never "github.com"; hostname otherwise', () => {
  assert.equal(domainAnswer(normalizeDomain('')), '')
  assert.equal(domainAnswer(normalizeDomain('github.com')), '')
  assert.equal(domainAnswer(normalizeDomain('https://github.com/')), '')
  assert.equal(domainAnswer(normalizeDomain('octo.ghe.com')), 'octo.ghe.com')
  assert.equal(configDomain('github.com'), '')
  assert.equal(configDomain('octo.ghe.com'), 'octo.ghe.com')
})

test('A3 lookup: exact URL, only the two headers, redirect refused, 10 s timeout', async () => {
  const fake = new FakeFetch()
  fake.replies.push(userReply())
  const result = await lookupCopilotHost({ fetch: fake.fetch, domain: 'github.com', credential: 'secret-token' })
  assert.deepEqual(result, { host: 'https://api.business.githubcopilot.com', account: 'octocat' })
  assert.equal(fake.requests.length, 1)
  const [request] = fake.requests
  assert.equal(request?.url, 'https://api.github.com/copilot_internal/user')
  assert.equal(lookupUrl('octo.ghe.com'), 'https://api.octo.ghe.com/copilot_internal/user')
  assert.equal(request?.init.method, 'GET')
  assert.deepEqual(request?.init.headers, { Accept: 'application/json', Authorization: 'token secret-token' })
  assert.equal(request?.init.redirect, 'error')
  assert.ok(request?.init.signal instanceof AbortSignal)
})

test('A3 lookup times out after the configured time and names the reason', async () => {
  const fake = new FakeFetch()
  fake.replies.push(({ init }) => new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  }))
  await assert.rejects(
    lookupCopilotHost({ fetch: fake.fetch, domain: 'github.com', credential: 't', timeoutMs: 20 }),
    (error: unknown) => error instanceof LoginError && error.code === 'LOOKUP_FAILED' && error.params?.reason === 'timeout',
  )
})

test('A3 each failure raises the error, names URL/status/request id, and sends nothing more', async () => {
  const url = 'https://api.github.com/copilot_internal/user'
  const cases: [string, Response | Error, Record<string, unknown>][] = [
    ['network', new TypeError('fetch failed'), { code: 'LOOKUP_FAILED', reason: 'network' }],
    ['non-2xx', userReply({ message: 'Not Found' }, { status: 404, requestId: 'ABCD:1234' }), { code: 'LOOKUP_FAILED', reason: 'http', status: 404, requestId: 'ABCD:1234' }],
    ['not JSON', userReply('<html>', { requestId: 'R1' }), { code: 'LOOKUP_FAILED', reason: 'not-json', status: 200, requestId: 'R1' }],
    ['no endpoints.api', userReply({ login: 'octocat' }), { code: 'LOOKUP_FAILED', reason: 'missing-api', status: 200 }],
    ['invalid endpoints.api', userReply({ endpoints: { api: 'http://api.example.com' } }), { code: 'INVALID_API_ADDRESS', status: 200 }],
  ]
  for (const [label, reply, expected] of cases) {
    const fake = new FakeFetch()
    fake.replies.push(reply)
    await assert.rejects(lookupCopilotHost({ fetch: fake.fetch, domain: 'github.com', credential: 'secret-token' }), (error: unknown) => {
      assert.ok(error instanceof LoginError, label)
      assert.equal(error.code, expected.code, label)
      assert.equal(error.params?.url, url, label)
      for (const field of ['reason', 'status', 'requestId'] as const) {
        if (field in expected) assert.equal(error.params?.[field], expected[field], `${label}: ${field}`)
      }
      assert.ok(!error.message.includes('secret-token'), `${label}: no token in the message`)
      return true
    })
    assert.equal(fake.requests.length, 1, `${label}: one request only`)
  }
})

test('A3 endpoints.api validation', () => {
  assert.equal(validateApiAddress('https://api.business.githubcopilot.com'), 'https://api.business.githubcopilot.com')
  assert.equal(validateApiAddress('https://api.githubcopilot.com/'), 'https://api.githubcopilot.com')
  assert.equal(validateApiAddress('https://api.githubcopilot.com:443'), 'https://api.githubcopilot.com')
  for (const bad of [
    'http://api.githubcopilot.com',
    'https://user:pass@api.githubcopilot.com',
    'https://user@api.githubcopilot.com',
    'https://api.githubcopilot.com:8443',
    'https://api.githubcopilot.com/v1',
    'https://api.githubcopilot.com/?x=1',
    'https://api.githubcopilot.com/?',
    'https://api.githubcopilot.com/#frag',
    'not a url',
    42,
    null,
    { api: 'https://x' },
  ]) {
    assert.equal(validateApiAddress(bad), undefined, String(bad))
  }
})
