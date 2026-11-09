/**
 * models.md A8, A12 (contract part) and B9: the plugin's adapter on the real
 * DSH and pi-ai — DSH's `LlmRuntime`, `PiAiAdapter` and pi-ai's three wires
 * and Copilot auth, all from DSH's installation — with `fetch` replaced by a
 * fake Copilot host. Nothing reaches the network (helpers/network.ts).
 */
import './helpers/network.ts'
import './helpers/peers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import { ModelsController } from '../../src/host/models.ts'
import type { PublishedModels, TokenResult } from '../../src/host/models.ts'
import { DEFAULT_CUSTOM_HEADERS } from '../../src/host/models-fetch.ts'
import { createCredentialStore, DISPLAY_NAME, staticCopilotHeaders } from '../../src/host/pi.ts'
import type { CredentialRecords } from '../../src/host/pi.ts'
import { ModelsRoute } from '../../src/host/route.ts'
import type { LlmPort } from '../../src/host/route.ts'
import { ROUTE_ID } from '../../src/host/rows.ts'
import type { StoredChoices } from '../../src/host/rows.ts'
import { dsh, DSH_INSTALL_DIR } from './helpers/dsh.ts'
import { KEY, mountHarness, waitFor } from './helpers/harness.ts'
import { fakeFetch, json } from './helpers/network.ts'
import type { SeenRequest } from './helpers/network.ts'
import { ADAPTER_PEERS, resolvedPeer } from './helpers/peers.ts'

const HOST = 'https://api.business.githubcopilot.com'
/** A Copilot token naming another host: requests must still go to HOST (A8). */
const TOKEN_FAR_FUTURE = 'tid=fake;exp=1900000000;proxy-ep=proxy.individual.githubcopilot.com;sku=fake'

/** Rows covering the three wires (made up; models.md B3 shape). */
const ROWS = [
  {
    id: 'msgs-model', name: 'Messages Model', model_picker_enabled: true, supported_endpoints: ['/v1/messages', '/chat/completions'],
    capabilities: { type: 'chat', limits: { max_context_window_tokens: 400_000, max_prompt_tokens: 300_000, max_output_tokens: 32_000 }, supports: { vision: true, reasoning_effort: ['low', 'medium', 'high'], adaptive_thinking: true } },
    billing: { token_prices: { batch_size: 1_000_000, default: { input_price: 1, output_price: 2, max_prompt_tokens: 200_000 }, long_context: { input_price: 1, output_price: 2, max_prompt_tokens: 300_000 } } },
  },
  {
    id: 'resp-model', name: 'Responses Model', model_picker_enabled: true, supported_endpoints: ['/responses', 'ws:/responses'],
    capabilities: { type: 'chat', limits: { max_context_window_tokens: 400_000, max_prompt_tokens: 272_000, max_output_tokens: 128_000 }, supports: { reasoning_effort: ['none', 'low', 'medium', 'high', 'xhigh'] } },
  },
  {
    id: 'chat-model', name: 'Chat Model', model_picker_enabled: true, supported_endpoints: ['/chat/completions'],
    capabilities: { type: 'chat', limits: { max_context_window_tokens: 128_000, max_prompt_tokens: 100_000, max_output_tokens: 16_000 }, supports: { reasoning_effort: ['low', 'high'] } },
  },
  { id: 'picker-off', name: 'Picker Off', model_picker_enabled: false, supported_endpoints: ['/responses'], capabilities: { type: 'chat', limits: { max_context_window_tokens: 1000, max_output_tokens: 100 }, supports: {} } },
]

/** Minimal streamed replies each wire's SDK accepts. */
function wireReply(request: SeenRequest): Response {
  const sse = (events: string[]) => new Response(events.join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } })
  if (request.url.endsWith('/v1/messages?beta=true') || request.url.endsWith('/v1/messages')) {
    return sse([
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"msgs-model","content":[],"stop_reason":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ])
  }
  if (request.url.endsWith('/responses')) {
    return sse([
      'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1","status":"in_progress","output":[]}}\n\n',
      'event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":0,"item":{"type":"message","id":"msg_1","role":"assistant","status":"in_progress","content":[]}}\n\n',
      'event: response.content_part.added\ndata: {"type":"response.content_part.added","item_id":"msg_1","output_index":0,"content_index":0,"part":{"type":"output_text","text":""}}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":"ok"}\n\n',
      'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":"msg_1","role":"assistant","status":"completed","content":[{"type":"output_text","text":"ok"}]}}\n\n',
      'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_1","status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n\n',
    ])
  }
  if (request.url.endsWith('/chat/completions')) {
    return sse([
      'data: {"id":"c1","object":"chat.completion.chunk","model":"chat-model","choices":[{"index":0,"delta":{"role":"assistant","content":"ok"},"finish_reason":null}]}\n\n',
      'data: {"id":"c1","object":"chat.completion.chunk","model":"chat-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ])
  }
  throw new Error(`unexpected request ${request.method} ${request.url}`)
}

/**
 * The route and controller wired as src/index.ts wires them, on a real DSH
 * composition (credentials-local, AuthorizationService, LlmRuntime, llm-pi-ai).
 */
async function mountRoute(t: TestContext, options: { headers?: Record<string, string>; choices?: StoredChoices } = {}) {
  const h = await mountHarness(t, { flows: true })
  const store = createCredentialStore(() => h.ctx.get('credentials') as CredentialRecords)
  const route = new ModelsRoute(store)
  const llm = h.ctx.get('llm')
  const adapter = route.createAdapter({ attachments: () => undefined, processPath: () => undefined })
  const dispose = route.register(llm as LlmPort, adapter)
  t.after(() => dispose())
  const published: PublishedModels[] = []
  const models = new ModelsController({
    fetch: (url, init) => globalThis.fetch(url, init),
    logger: { info: () => {}, warn: () => {} },
    token: async (signal): Promise<TokenResult> => {
      const auth = await route.tokenModels().getAuth(ROUTE_ID, { signal })
      return auth?.auth.apiKey === undefined ? undefined : { token: auth.auth.apiKey }
    },
    readChoices: () => options.choices ?? { visibility: {}, limits: {} },
    readHeaders: () => options.headers ?? { ...DEFAULT_CUSTOM_HEADERS },
    writeSettings: async () => {},
    publish: (list) => {
      published.push(list)
      route.publish(list)
    },
  })
  return { h, llm, route, models, published }
}

/** Store a browser-login grant whose Copilot token is valid for a long time. */
async function storeGrant(h: { credentials: any }, expires = 1_900_000_000_000): Promise<void> {
  await h.credentials.modifyRecord(KEY, async () => ({ kind: 'grant', payload: { type: 'oauth', refresh: 'login-token-fake', access: TOKEN_FAR_FUTURE, expires, availableModelIds: [] } }))
}

/** Run one model request through DSH's LlmRuntime and collect the chunks. */
async function generate(llm: any, model: string, extra: Record<string, unknown> = {}): Promise<unknown[]> {
  const chunks: unknown[] = []
  for await (const chunk of llm.stream({ provider: ROUTE_ID, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], ...extra })) chunks.push(chunk)
  return chunks
}

test('B9: DSH resolves the three peers to its own installation; the plugin\'s modules share DSH\'s classes', async () => {
  for (const peer of ADAPTER_PEERS) {
    assert.ok(resolvedPeer(peer).startsWith(DSH_INSTALL_DIR), `${peer} → ${resolvedPeer(peer)}`)
  }
  const { PiAiAdapter } = await import('@deepseek-ai/dsh-llm-pi-ai')
  const installed = await dsh.llmPiAi()
  assert.equal(PiAiAdapter, installed.PiAiAdapter, 'the same class object llm-pi-ai exports')
})

test('A8/B9: registered route, empty until the first fetch; then listModels and resolveModel report window, defaultMaxTokens and efforts with no Off', async (t) => {
  const r = await mountRoute(t)
  assert.deepEqual(r.llm.listProviders().find((p: { id: string }) => p.id === ROUTE_ID), { id: ROUTE_ID, name: DISPLAY_NAME })
  assert.deepEqual(await r.llm.listModels(ROUTE_ID), [], 'no models before the first fetch')

  await storeGrant(r.h)
  const seen = fakeFetch(t, (request) => {
    if (request.url === `${HOST}/models`) return json({ object: 'list', data: ROWS })
    throw new Error(`unexpected ${request.url}`)
  })
  await r.models.fetch({ method: 'browser', host: HOST })
  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.headers.get('authorization'), `Bearer ${TOKEN_FAR_FUTURE}`)
  assert.equal(seen[0]?.headers.get('copilot-integration-id'), 'vscode-chat')
  assert.equal(seen[0]?.headers.get('x-github-api-version'), '2026-08-01')

  const listed = await r.llm.listModels(ROUTE_ID)
  assert.deepEqual(listed.map((m: { id: string }) => m.id), ['msgs-model', 'resp-model', 'chat-model'])
  // A9/B8: DSH's model service passes each model's picker label through, the context size in use.
  assert.deepEqual(listed.map((m: { badge?: unknown }) => m.badge), [
    { text: '232K', tone: 'neutral' },
    { text: '400K', tone: 'neutral' },
    { text: '128K', tone: 'neutral' },
  ])
  const msgs = await r.llm.resolveModelInfo(ROUTE_ID, 'msgs-model')
  // Default tier: 200,000 + 32,000.
  assert.equal(msgs.context.contextWindow, 232_000)
  assert.equal(msgs.defaultMaxTokens, 32_000)
  assert.deepEqual(msgs.reasoning.efforts.map((e: { id: string }) => e.id), ['low', 'medium', 'high'], 'no Off')
  assert.deepEqual(msgs.inputModalities, ['text', 'image'])
  const resp = await r.llm.resolveModelInfo(ROUTE_ID, 'resp-model')
  assert.equal(resp.context.contextWindow, 400_000)
  assert.equal(resp.defaultMaxTokens, 128_000)
  assert.deepEqual(resp.reasoning.efforts.map((e: { id: string }) => e.id), ['low', 'medium', 'high', 'xhigh'])
  await assert.rejects(r.llm.resolveModelInfo(ROUTE_ID, 'picker-off'), (error: { code?: string }) => error.code === 'UNKNOWN_MODEL')
})

test('A8 republish: a choice change builds a new profile Map and DSH sees the new list without a restart', async (t) => {
  let choices: StoredChoices = { visibility: {}, limits: {} }
  const r = await mountRoute(t, { choices: { get visibility() { return choices.visibility }, get limits() { return choices.limits } } })
  await storeGrant(r.h)
  fakeFetch(t, () => json({ object: 'list', data: ROWS }))
  await r.models.fetch({ method: 'browser', host: HOST })
  const before = r.route.profiles()
  // The Long preset, stored as its number: 300,000 + 32,000.
  choices = { visibility: { 'chat-model': false, 'picker-off': true }, limits: { 'msgs-model': { context: 332_000 } } }
  r.models.choicesChanged()
  assert.notEqual(r.route.profiles(), before, 'a new Map')
  assert.deepEqual((await r.llm.listModels(ROUTE_ID)).map((m: { id: string }) => m.id), ['msgs-model', 'resp-model', 'picker-off'])
  assert.equal((await r.llm.resolveModelInfo(ROUTE_ID, 'msgs-model')).context.contextWindow, 332_000)
  // The picker label follows the stored size (A9).
  assert.deepEqual((await r.llm.listModels(ROUTE_ID)).find((m: { id: string }) => m.id === 'msgs-model')?.badge, { text: '332K', tone: 'neutral' })
  // Unchanged choices: the same Map.
  const same = r.route.profiles()
  r.models.choicesChanged()
  assert.equal(r.route.profiles(), same)
})

test('A2/B9: an expiring Copilot token is refreshed through the custom store before /models, and the record is rewritten without undefined members', async (t) => {
  const r = await mountRoute(t)
  // Expires within 5 minutes: pi-ai refreshes it first.
  await storeGrant(r.h, Date.now() + 60_000)
  const fresh = 'tid=fresh;exp=1900000000;proxy-ep=proxy.business.githubcopilot.com'
  const seen = fakeFetch(t, (request) => {
    if (request.url === 'https://api.github.com/copilot_internal/v2/token') return json({ token: fresh, expires_at: 1_900_000_000, refresh_in: 1500 })
    // pi-ai's own /models call during the refresh (B7), on the token's host.
    if (request.url === 'https://api.business.githubcopilot.com/models' && request.headers.get('authorization') === `Bearer ${fresh}` && request.headers.get('x-github-api-version') === '2026-06-01') {
      return json({ data: [] })
    }
    if (request.url === `${HOST}/models`) return json({ object: 'list', data: ROWS })
    throw new Error(`unexpected ${request.url}`)
  })
  await r.models.fetch({ method: 'browser', host: HOST })
  assert.deepEqual(seen.map((s) => s.url), [
    'https://api.github.com/copilot_internal/v2/token',
    'https://api.business.githubcopilot.com/models',
    `${HOST}/models`,
  ])
  assert.equal(seen[2]?.headers.get('authorization'), `Bearer ${fresh}`)
  const record = await r.h.credentials.readRecord(KEY)
  assert.equal(record.payload.access, fresh)
  assert.equal(record.payload.refresh, 'login-token-fake')
  assert.equal('enterpriseUrl' in record.payload, false, 'no undefined member was stored')
})

test('A2/B9: a PAT record yields the PAT with copilot-developer-cli; no record sends nothing', async (t) => {
  const r = await mountRoute(t)
  const seen = fakeFetch(t, () => json({ object: 'list', data: ROWS }))
  await r.models.fetch({ method: 'pat', host: HOST })
  assert.equal(seen.length, 0, 'no record: no request')
  assert.deepEqual(r.models.state().lastFetch?.error, { code: 'NOT_SIGNED_IN' })

  await r.h.credentials.modifyRecord(KEY, async () => ({ kind: 'api-key', key: 'github_pat_FAKE' }))
  await r.models.fetch({ method: 'pat', host: HOST })
  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.headers.get('authorization'), 'Bearer github_pat_FAKE')
  assert.equal(seen[0]?.headers.get('copilot-integration-id'), 'copilot-developer-cli')
})

test('A8/B9 model requests on all three wires: Bearer and no x-api-key, static block, X-Initiator and Openai-Intent, integration id and custom headers last, the row list\'s host, no reasoning without an effort', async (t) => {
  const r = await mountRoute(t, { headers: { 'X-GitHub-Api-Version': '2026-08-01', 'Editor-Version': 'custom/1.0' } })
  await storeGrant(r.h)
  const seen = fakeFetch(t, (request) => request.url === `${HOST}/models` ? json({ object: 'list', data: ROWS }) : wireReply(request))
  await r.models.fetch({ method: 'browser', host: HOST })
  const statics = staticCopilotHeaders()
  for (const [model, path] of [['msgs-model', '/v1/messages'], ['resp-model', '/responses'], ['chat-model', '/chat/completions']] as const) {
    await t.test(model, async () => {
      const from = seen.length
      const chunks = await generate(r.llm, model)
      const request = seen.slice(from).find((s) => s.method === 'POST')
      assert.ok(request !== undefined, `a request for ${model}`)
      assert.ok(request.url.startsWith(`${HOST}${path}`), request.url)
      const headers = request.headers
      assert.equal(headers.get('authorization'), `Bearer ${TOKEN_FAR_FUTURE}`)
      assert.equal(headers.get('x-api-key'), null)
      assert.equal(headers.get('copilot-integration-id'), 'vscode-chat')
      assert.equal(headers.get('x-github-api-version'), '2026-08-01')
      assert.equal(headers.get('editor-version'), 'custom/1.0', 'custom headers override the static block')
      assert.equal(headers.get('editor-plugin-version'), statics['Editor-Plugin-Version'])
      assert.equal(headers.get('x-initiator'), 'user')
      assert.equal(headers.get('openai-intent'), 'conversation-edits')
      assert.match(headers.get('user-agent') ?? '', /^deepseek-harness\//, 'DSH replaces User-Agent')
      const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
      assert.equal(body.model, model)
      assert.equal(body.reasoning, undefined, 'no reasoning field without an effort')
      assert.equal(body.reasoning_effort, undefined)
      assert.ok(body.thinking === undefined || (body.thinking as { type?: string }).type !== 'disabled', 'thinking not disabled')
      assert.ok(chunks.some((chunk) => (chunk as { type?: string }).type === 'finish'), 'the stream finishes')
    })
  }
})

test('A7/B6: an effort is sent as Copilot expects on each wire', async (t) => {
  const r = await mountRoute(t)
  await storeGrant(r.h)
  const seen = fakeFetch(t, (request) => request.url === `${HOST}/models` ? json({ object: 'list', data: ROWS }) : wireReply(request))
  await r.models.fetch({ method: 'browser', host: HOST })
  const body = async (model: string): Promise<Record<string, any>> => {
    const from = seen.length
    await generate(r.llm, model, { reasoningEffort: 'high' })
    return JSON.parse(seen.slice(from).find((s) => s.method === 'POST')?.body ?? '{}')
  }
  assert.deepEqual((await body('resp-model')).reasoning, { effort: 'high', summary: 'auto' })
  const msgs = await body('msgs-model')
  assert.equal(msgs.thinking?.type, 'adaptive')
  assert.deepEqual(msgs.output_config, { effort: 'high' })
  assert.equal((await body('chat-model')).reasoning_effort, 'high')
  // Off is not offered, so DSH refuses it before any request: in the call
  // config, and as the stream's finish error.
  const from = seen.length
  await assert.rejects(r.llm.resolveCallConfig({ provider: ROUTE_ID, model: 'resp-model', reasoningEffort: 'off' }), (error: { code?: string }) => error.code === 'UNSUPPORTED_REASONING_EFFORT')
  const chunks = await generate(r.llm, 'resp-model', { reasoningEffort: 'off' }) as { type: string; reason?: { kind: string; failure?: { code?: string } } }[]
  assert.equal(chunks.at(-1)?.reason?.failure?.code, 'UNSUPPORTED_REASONING_EFFORT')
  assert.equal(seen.length, from, 'nothing sent')
})

test('A3: sign-out empties the route; DSH lists no models and a request fails with UNKNOWN_MODEL', async (t) => {
  const r = await mountRoute(t)
  await storeGrant(r.h)
  fakeFetch(t, () => json({ object: 'list', data: ROWS }))
  await r.models.fetch({ method: 'browser', host: HOST })
  assert.equal((await r.llm.listModels(ROUTE_ID)).length, 3)
  r.models.credentialChanged()
  assert.deepEqual(await r.llm.listModels(ROUTE_ID), [])
  await assert.rejects(r.llm.resolveModelInfo(ROUTE_ID, 'resp-model'), (error: { code?: string }) => error.code === 'UNKNOWN_MODEL')
  await waitFor(() => r.published.length === 2, 'the empty republish')
})

test('A10/B6: a second registration of the route fails with DUPLICATE_ADAPTER and is reported as ROUTE_IN_USE', async (t) => {
  const r = await mountRoute(t)
  const other = new ModelsRoute(createCredentialStore(() => undefined))
  const adapter = other.createAdapter({ attachments: () => undefined, processPath: () => undefined })
  assert.throws(() => other.register(r.llm as LlmPort, adapter), (error: { code?: string }) => error.code === 'DUPLICATE_ADAPTER')
  assert.deepEqual(other.error, { code: 'ROUTE_IN_USE', params: { route: ROUTE_ID } })
})
