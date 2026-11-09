/**
 * login.md B2, B3 and B4: the `ctx.authorization` seam around DSH's llm-pi-ai
 * flow for the shared record (`KEY`, named by DSH's `recordKeyFor`), on a real
 * DSH composition (credentials-local, AuthorizationService, LlmRuntime, llm-pi-ai).
 * login.md B3, B6 and B7 (at the end): the shared record and `COPILOT_GITHUB_TOKEN`
 * in the real DSH credentials service (`@deepseek-ai/dsh-credentials-local`, temp folder).
 * Every test is offline: a prompt held open keeps an attempt running.
 */
import './helpers/network.ts'
import './helpers/peers.ts'
import assert from 'node:assert/strict'
import { rm, stat, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import { RECORD_KEY } from '../../src/host/ports.ts'
import { COPILOT_TOKEN, copilotRoutes } from './helpers/copilot-fakes.ts'
import type { CopilotScript } from './helpers/copilot-fakes.ts'
import { DSH_INSTALL_DIR, dsh, installedVersion } from './helpers/dsh.ts'
import { KEY, mountHarness, rejection, scriptedInteraction, waitFor } from './helpers/harness.ts'
import type { EnvLayer } from './helpers/harness.ts'
import { fakeFetch, json } from './helpers/network.ts'

const GITHUB: CopilotScript = { domain: 'github.com', apiBase: 'https://api.individual.githubcopilot.com', copilotToken: COPILOT_TOKEN }
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A prompt answer the test hands over later, keeping the attempt running until then. */
function heldAnswer() {
  let release!: (answer: string) => void
  const answer = new Promise<string>((resolve) => (release = resolve))
  return { answer, release }
}

test('B3: the plugin names the shared record as the installed DSH names the record of its built-in route github-copilot', () => {
  // RECORD_KEY comes from the plugin's own module, KEY from DSH's install: one name, so one login.
  assert.equal(RECORD_KEY, KEY)
})

test('B4: llm-pi-ai registers the shared record with the methods oauth, then api-key; begin() without a method runs oauth', async (t) => {
  t.diagnostic(`DSH ${installedVersion('@deepseek-ai/dsh')}, pi-ai ${installedVersion('@earendil-works/pi-ai')}, cordis ${installedVersion('@deepseek-ai/cordis')} from ${DSH_INSTALL_DIR}`)
  const h = await mountHarness(t, { flows: true })
  assert.deepEqual(h.authorization.describe(KEY), {
    key: KEY,
    label: 'GitHub Copilot',
    methods: [{ id: 'oauth', label: 'GitHub Copilot' }, { id: 'api-key', label: 'GitHub Copilot token' }],
    inFlight: false,
  })
  // B3: the flow exists without settings, but the github-copilot route is inactive until providers.github-copilot is set.
  const llm = h.ctx.get('llm')
  assert.deepEqual(llm.listProviders(), [])
  assert.ok(llm.listConfigurableProviders().some((entry: { provider: string }) => entry.provider === 'github-copilot'))
  const held = heldAnswer()
  const ui = scriptedInteraction(() => held.answer)
  const outcome = h.authorization.begin({ key: KEY, interaction: ui.interaction })
  await waitFor(() => ui.prompts.length === 1, 'the first prompt')
  assert.equal(ui.prompts[0]?.kind, 'text')
  h.authorization.cancel(KEY)
  assert.deepEqual(await outcome, { status: 'cancelled' })
  held.release('')
})

test('B2/B3: api-key — one secret prompt "Enter GitHub Copilot token"; it stores { kind: "api-key", key } under the shared record, replacing a browser login; no network request', async (t) => {
  const h = await mountHarness(t, { flows: true })
  const seen = fakeFetch(t, () => {
    throw new Error('the api-key method must not send any request')
  })
  await h.credentials.modifyRecord(KEY, async () => ({ kind: 'grant', payload: { type: 'oauth', refresh: 'old', access: 'old', expires: 1 } }))
  const ui = scriptedInteraction(() => 'pat-fake-value')
  assert.deepEqual(await h.authorization.begin({ key: KEY, method: 'api-key', interaction: ui.interaction }), { status: 'authorized' })
  assert.deepEqual(ui.prompts, [{ kind: 'secret', message: 'Enter GitHub Copilot token' }])
  assert.deepEqual(ui.notices, [])
  assert.deepEqual(await h.credentials.readRecord(KEY), { kind: 'api-key', key: 'pat-fake-value' })
  assert.deepEqual(h.recordEvents, [KEY, KEY], 'the seeded grant, then the PAT')
  // The answer is stored verbatim: neither pi-ai nor DSH trims it.
  const spaced = scriptedInteraction(() => '  pat-fake-spaced \n')
  assert.deepEqual(await h.authorization.begin({ key: KEY, method: 'api-key', interaction: spaced.interaction }), { status: 'authorized' })
  assert.deepEqual(await h.credentials.readRecord(KEY), { kind: 'api-key', key: '  pat-fake-spaced \n' })
  assert.deepEqual(seen, [])
})

test('B4: while an attempt runs, describe().inFlight is true and a second begin() for either method throws ALREADY_IN_FLIGHT; cancel(key) resolves the running begin() as cancelled and nothing is stored', async (t) => {
  for (const [running, other] of [['oauth', 'api-key'], ['api-key', 'oauth']] as const) {
    await t.test(`${running} running`, async (st) => {
      const h = await mountHarness(st, { flows: true })
      const held = heldAnswer()
      const ui = scriptedInteraction(() => held.answer)
      const outcome = h.authorization.begin({ key: KEY, method: running, interaction: ui.interaction })
      await waitFor(() => ui.prompts.length === 1, 'the prompt')
      assert.equal(h.authorization.describe(KEY).inFlight, true)
      for (const method of [other, running, undefined]) {
        const second = scriptedInteraction(() => '')
        const error = await rejection(h.authorization.begin({ key: KEY, method, interaction: second.interaction }))
        assert.equal(error.code, 'ALREADY_IN_FLIGHT')
        assert.equal(second.prompts.length, 0)
      }
      h.authorization.cancel(KEY)
      assert.deepEqual(await outcome, { status: 'cancelled' })
      assert.equal(h.authorization.describe(KEY).inFlight, false)
      held.release(running === 'oauth' ? '' : 'pat-fake-late') // the withdrawn flow must not use it
      await sleep(50)
      assert.equal(await h.credentials.readRecord(KEY), undefined)
      assert.deepEqual(h.recordEvents, [])
    })
  }
})

test('B4: aborting the request signal resolves begin() as cancelled — while the code is shown, pi-ai stops polling; an already-aborted signal never starts the flow', async (t) => {
  const h = await mountHarness(t, { flows: true })
  const seen = fakeFetch(t, copilotRoutes(GITHUB))
  const aborted = AbortSignal.abort()
  const idle = scriptedInteraction(() => '')
  assert.deepEqual(await h.authorization.begin({ key: KEY, method: 'oauth', interaction: idle.interaction, signal: aborted }), { status: 'cancelled' })
  assert.equal(idle.prompts.length, 0)

  const controller = new AbortController()
  const ui = scriptedInteraction(() => '')
  const outcome = h.authorization.begin({ key: KEY, method: 'oauth', interaction: ui.interaction, signal: controller.signal })
  await waitFor(() => ui.notices.length === 1, 'the device code notice')
  controller.abort()
  assert.deepEqual(await outcome, { status: 'cancelled' })
  assert.equal(h.authorization.describe(KEY).inFlight, false)
  await sleep(1200) // longer than the polling interval
  assert.deepEqual(seen.map((r) => r.url), ['https://github.com/login/device/code'])
  assert.equal(await h.credentials.readRecord(KEY), undefined)
})

test('B4/A8: an unknown key throws NO_FLOW, an unknown method throws UNKNOWN_METHOD; turning llm-pi-ai off resolves a running begin() as cancelled and later begin() calls throw NO_FLOW', async (t) => {
  const h = await mountHarness(t, { flows: true })
  const idle = scriptedInteraction(() => '')
  assert.equal((await rejection(h.authorization.begin({ key: KEY, method: 'device-code', interaction: idle.interaction }))).code, 'UNKNOWN_METHOD')
  assert.equal((await rejection(h.authorization.begin({ key: 'some-plugin/github-copilot', method: 'oauth', interaction: idle.interaction }))).code, 'NO_FLOW')

  const held = heldAnswer()
  const ui = scriptedInteraction(() => held.answer)
  const outcome = h.authorization.begin({ key: KEY, method: 'oauth', interaction: ui.interaction })
  await waitFor(() => ui.prompts.length === 1, 'the prompt')
  await h.disposePiAi()
  assert.deepEqual(await outcome, { status: 'cancelled' })
  held.release('')
  assert.equal(h.authorization.describe(KEY), undefined)
  assert.equal((await rejection(h.authorization.begin({ key: KEY, method: 'oauth', interaction: idle.interaction }))).code, 'NO_FLOW')
  assert.equal(idle.prompts.length, 0)
})

test('B4/A8: a prompt rejected with a plain Error makes begin() throw that same error (not cancelled), for both methods; only AuthorizationDeclinedError means cancelled', async (t) => {
  const h = await mountHarness(t, { flows: true })
  for (const method of ['oauth', 'api-key']) {
    const thrown = new Error('Unexpected sign-in step')
    const ui = scriptedInteraction(() => {
      throw thrown
    })
    const error = await rejection(h.authorization.begin({ key: KEY, method, interaction: ui.interaction }))
    assert.equal(error, thrown, `${method}: the very Error the interaction threw`)
    assert.equal('code' in thrown, false)
    assert.equal(h.authorization.describe(KEY).inFlight, false)
  }
  const { AuthorizationDeclinedError } = await dsh.authorization()
  const declined = scriptedInteraction(() => {
    throw new AuthorizationDeclinedError()
  })
  assert.deepEqual(await h.authorization.begin({ key: KEY, method: 'oauth', interaction: declined.interaction }), { status: 'cancelled' })
  assert.equal(await h.credentials.readRecord(KEY), undefined)
})

test('B2/A8: a failure inside pi-ai\'s sign-in makes begin() throw an error whose code is undefined', async (t) => {
  const h = await mountHarness(t, { flows: true })
  const failures: [string, Partial<CopilotScript>, RegExp][] = [
    ['device code endpoint 500', { deviceCodeReply: () => new Response('down', { status: 500, statusText: 'Internal Server Error' }) }, /^500 /],
    ['access denied', { pollReply: () => json({ error: 'access_denied', error_description: 'denied' }) }, /access_denied/],
    ['code expired', { pollReply: () => json({ error: 'expired_token' }) }, /expired_token/],
    ['login token exchange 401', { exchangeReply: () => new Response('no', { status: 401, statusText: 'Unauthorized' }) }, /^401 /],
    ['exchange reply without expires_at', { exchangeReply: () => json({ token: COPILOT_TOKEN }) }, /^Invalid Copilot token response fields$/],
    ['device flow timeout', {
      deviceCodeReply: () => json({ device_code: 'd', user_code: 'U', verification_uri: 'https://github.com/login/device', expires_in: 1, interval: 1 }),
      pollReply: () => json({ error: 'authorization_pending' }),
    }, /timed out/],
  ]
  for (const [name, script, message] of failures) {
    await t.test(name, async (st) => {
      fakeFetch(st, copilotRoutes({ ...GITHUB, ...script }))
      const ui = scriptedInteraction(() => '')
      const error = await rejection(h.authorization.begin({ key: KEY, method: 'oauth', interaction: ui.interaction }))
      assert.equal(error.code, undefined)
      assert.match(error.message, message)
      assert.equal(h.authorization.describe(KEY).inFlight, false)
      assert.equal(await h.credentials.readRecord(KEY), undefined)
    })
  }
})

test('B2/A8: when pi-ai cannot write the record, begin() throws pi-ai\'s ModelsError, which carries its own code "auth"', async (t) => {
  const h = await mountHarness(t, { flows: true })
  // credentials-local refuses an empty api-key, so pi-ai's record write fails.
  const ui = scriptedInteraction(() => '')
  const error = await rejection(h.authorization.begin({ key: KEY, method: 'api-key', interaction: ui.interaction }))
  assert.equal(error.name, 'ModelsError')
  assert.equal(error.code, 'auth')
  assert.match(error.message, /^Credential store modify failed for github-copilot/)
  assert.equal(await h.credentials.readRecord(KEY), undefined)
})

test('B4: cancel() after pi-ai has queued its record write still resolves cancelled, but the record is written afterwards and credentials/record-updated fires', async (t) => {
  const h = await mountHarness(t, { flows: true })
  // Hold the credentials document's writer lock, as a concurrent writer (e.g. a token refresh) would.
  const lock = `${h.file}.lock`
  await writeFile(lock, `${process.pid}\n`, { mode: 0o600, flag: 'wx' })
  t.after(() => rm(lock, { force: true }))
  // Observe the moment pi-ai's write reaches ctx.credentials (llm-pi-ai passes no abort signal to it).
  const { LocalCredentialProvider } = await dsh.credentialsLocal()
  const modifyRecord = LocalCredentialProvider.prototype.modifyRecord
  let queued = 0
  t.mock.method(LocalCredentialProvider.prototype, 'modifyRecord', function (this: unknown, ...args: unknown[]) {
    queued += 1
    return modifyRecord.apply(this, args)
  })
  const ui = scriptedInteraction(() => 'pat-fake-value')
  const outcome = h.authorization.begin({ key: KEY, method: 'api-key', interaction: ui.interaction })
  await waitFor(() => queued === 1, "pi-ai's record write")
  h.authorization.cancel(KEY)
  assert.deepEqual(await outcome, { status: 'cancelled' })
  assert.equal(await h.credentials.readRecord(KEY), undefined)
  assert.deepEqual(h.recordEvents, [])

  await rm(lock)
  await waitFor(() => h.recordEvents.length === 1, 'the late record write')
  assert.deepEqual(await h.credentials.readRecord(KEY), { kind: 'api-key', key: 'pat-fake-value' })
  assert.equal(h.authorization.describe(KEY).inFlight, false)
})

// ── The credentials service: the shared record (B3, B7) ──────────────────────

const GRANT = {
  kind: 'grant',
  payload: {
    type: 'oauth',
    refresh: 'login-token-fake',
    access: 'copilot-token-fake',
    expires: 1_900_000_000_000,
    availableModelIds: ['model-a'],
  },
}
const PAT = { kind: 'api-key', key: 'pat-fake' }

test('B3/B7: write, read, describe and delete the record; credentials/record-updated fires with the key for each write and delete', async (t) => {
  const h = await mountHarness(t)
  const { credentials } = h
  assert.equal(await credentials.readRecord(KEY), undefined)
  assert.deepEqual(await credentials.describeRecord(KEY), { configured: false, writable: true })

  // A browser sign-in commits a grant.
  const written = await credentials.modifyRecord(KEY, async (current: unknown) => {
    assert.equal(current, undefined)
    return GRANT
  })
  assert.deepEqual(written, GRANT)
  assert.deepEqual(h.recordEvents, [KEY])
  assert.deepEqual(await credentials.readRecord(KEY), GRANT)
  assert.deepEqual(await credentials.describeRecord(KEY), { configured: true, kind: 'grant', writable: true })
  assert.deepEqual(await credentials.listRecords(), [{ key: KEY, kind: 'grant' }])
  assert.equal((await stat(h.file)).mode & 0o777, 0o600, 'the credentials file is owner-only')

  // A rewrite with the same content (a token refresh can do this) still fires.
  await credentials.modifyRecord(KEY, async () => GRANT)
  assert.deepEqual(h.recordEvents, [KEY, KEY])

  // A PAT replaces the browser login: one record, one key.
  await credentials.modifyRecord(KEY, async (current: unknown) => {
    assert.deepEqual(current, GRANT)
    return PAT
  })
  assert.deepEqual(await credentials.readRecord(KEY), PAT)
  assert.deepEqual(await credentials.describeRecord(KEY), { configured: true, kind: 'api-key', writable: true })
  assert.deepEqual(h.recordEvents, [KEY, KEY, KEY])

  // A mutation that returns undefined writes nothing and fires nothing.
  assert.deepEqual(await credentials.modifyRecord(KEY, async () => undefined), PAT)
  assert.equal(h.recordEvents.length, 3)

  // The record is in the file: a fresh service on the same file (a DSH restart) reads it.
  const restarted = await mountHarness(t, { file: h.file })
  assert.deepEqual(await restarted.credentials.readRecord(KEY), PAT)

  // Sign-out deletes the record.
  await credentials.deleteRecord(KEY)
  assert.equal(await credentials.readRecord(KEY), undefined)
  assert.deepEqual(await credentials.describeRecord(KEY), { configured: false, writable: true })
  assert.deepEqual(h.recordEvents, [KEY, KEY, KEY, KEY])

  // Deleting a record that does not exist fires nothing.
  await credentials.deleteRecord(KEY)
  assert.equal(h.recordEvents.length, 4)
})

// ── The credentials service: COPILOT_GITHUB_TOKEN (B6, login.md A6) ──────────
// The variable only ever holds the dummy value below, and the real one, if any, is restored untouched.

const NAME = 'COPILOT_GITHUB_TOKEN'
const DUMMY = 'dummy'

/** Remove the variable from `process.env` for this test and restore the original afterwards. */
function isolateProcessEnv(t: TestContext): void {
  const original = process.env[NAME]
  delete process.env[NAME]
  t.after(() => {
    if (original === undefined) delete process.env[NAME]
    else process.env[NAME] = original
  })
}

test('B6: describe() reports COPILOT_GITHUB_TOKEN as configured when only the process environment has it, and never returns the value', async (t) => {
  isolateProcessEnv(t)
  const { credentialRef } = await dsh.credentials()
  const ref = credentialRef(NAME)
  // No launchEnvironment provided: DSH's fallback is the live process environment.
  const { credentials } = await mountHarness(t)
  assert.deepEqual(await credentials.describe(ref), { configured: false, writable: true })

  process.env[NAME] = DUMMY
  const described = await credentials.describe(ref)
  assert.deepEqual(described, { configured: true, source: 'env', writable: true })
  assert.equal(JSON.stringify(described).includes(DUMMY), false, 'describe() never carries the value')

  delete process.env[NAME]
  assert.deepEqual(await credentials.describe(ref), { configured: false, writable: true })
})

test('B6: with the launcher\'s environment snapshot, describe() looks in the credentials file, then the launch-time process environment, then <launch dir>/.env, then $DSH_HOME/.env — and not at process.env changed after launch', async (t) => {
  isolateProcessEnv(t)
  const { credentialRef } = await dsh.credentials()
  const ref = credentialRef(NAME)
  const layered = async (layers: EnvLayer[]) => (await mountHarness(t, { launchEnvironment: layers })).credentials

  const userEnv = await layered([{ source: 'user-env', path: '/dsh-home/.env', values: { [NAME]: DUMMY } }])
  assert.deepEqual(await userEnv.describe(ref), { configured: true, source: 'user-env', writable: true })

  const projectEnv = await layered([
    { source: 'project-env', path: '/launch-dir/.env', values: { [NAME]: DUMMY } },
    { source: 'user-env', path: '/dsh-home/.env', values: { [NAME]: DUMMY } },
  ])
  assert.deepEqual(await projectEnv.describe(ref), { configured: true, source: 'project-env', writable: true })

  const processEnv = await layered([
    { source: 'process', values: { [NAME]: DUMMY } },
    { source: 'project-env', path: '/launch-dir/.env', values: { [NAME]: DUMMY } },
  ])
  assert.deepEqual(await processEnv.describe(ref), { configured: true, source: 'env', writable: true })

  // The launcher snapshots the environment at start-up: a later export is not seen.
  const launchedWithout = await layered([{ source: 'process', values: {} }])
  process.env[NAME] = DUMMY
  assert.deepEqual(await launchedWithout.describe(ref), { configured: false, writable: true })
  delete process.env[NAME]

  // A value stored in DSH's credentials file wins, and an empty one counts as not set.
  await processEnv.set(ref, DUMMY)
  assert.deepEqual(await processEnv.describe(ref), { configured: true, source: 'file', writable: true })
  await processEnv.unset(ref)
  assert.deepEqual(await processEnv.describe(ref), { configured: true, source: 'env', writable: true })
  const emptyEverywhere = await layered([{ source: 'process', values: { [NAME]: '' } }])
  assert.deepEqual(await emptyEverywhere.describe(ref), { configured: false, writable: true })
})
