/** models.md A4, A7, A10: rows → table and pi models, over hand-written rows. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyseRows, buildModels, checkSizes, compatFor, copilotContextOf, pickerBadgeOf, resolveSizes, thinkingLevelMapFor, wireFor } from '../../src/host/rows.ts'
import type { StoredChoices } from '../../src/host/rows.ts'
import { CHAT_NO_BILLING, EMBEDDINGS, NO_ENDPOINTS, ONE_TIER_RESPONSES, PICKER_OFF_FREE, TWO_TIER_MESSAGES } from './model-fixtures.ts'

const NONE: StoredChoices = { visibility: {}, limits: {} }

function only(row: unknown) {
  const [analysed] = analyseRows([row])
  assert.ok(analysed !== undefined)
  return analysed
}

test('A7 wire: first match of /responses, /v1/messages, /chat/completions; ws:/responses and others ignored', () => {
  assert.equal(wireFor(['/chat/completions', '/v1/messages', '/responses']), 'openai-responses')
  assert.equal(wireFor(['/chat/completions', '/v1/messages']), 'anthropic-messages')
  assert.equal(wireFor(['/chat/completions']), 'openai-completions')
  assert.equal(wireFor(['ws:/responses']), undefined)
  assert.equal(wireFor(['/embeddings', 'ws:/responses']), undefined)
  assert.equal(wireFor(undefined), undefined)
  assert.equal(wireFor('/responses'), undefined)
})

test('A10 reason codes, the first that applies, in order', () => {
  const rows = analyseRows([
    { name: 'no id', capabilities: { type: 'chat' } },
    EMBEDDINGS,
    NO_ENDPOINTS,
    { ...CHAT_NO_BILLING, id: 'no-output', capabilities: { type: 'chat', limits: { max_output_tokens: 0 }, supports: {} } },
    CHAT_NO_BILLING,
    { ...CHAT_NO_BILLING, name: 'Duplicate' },
    { id: 'chat-missing-type', supported_endpoints: ['/responses'], capabilities: { limits: { max_output_tokens: 10 } } },
  ])
  assert.deepEqual(rows.map((row) => row.reason), ['NO_ID', 'NOT_CHAT', 'NO_ENDPOINT', 'NO_LIMITS', undefined, 'DUPLICATE_ID', 'NOT_CHAT'])
  assert.equal(rows[0]?.name, 'no id')
  assert.equal(analyseRows([{ capabilities: {} }])[0]?.name, '#1', 'neither id nor name')
})

test('A4 name: `name`, or `id` when the row has no name', () => {
  assert.equal(only({ ...CHAT_NO_BILLING, name: undefined }).name, 'haiku-chat')
  assert.equal(only({ ...CHAT_NO_BILLING, name: '' }).name, 'haiku-chat')
})

test('A4 head: policy.state and info_messages reach the table as received; an info message needs a text', () => {
  const deprecation = { code: 'model_pending_deprecation', message: 'Haiku Chat has a planned deprecation date of 2026-11-16.' }
  const [row] = buildModels(analyseRows([{
    ...CHAT_NO_BILLING,
    policy: { state: 'unconfigured', terms: 'Enable access…' },
    info_messages: [deprecation, { code: 'no_text' }, { message: '  ' }, 'text', { message: 'No code.' }],
  }]), NONE).rows
  assert.equal(row?.policy, 'unconfigured')
  assert.deepEqual(row?.info, [deprecation, { message: 'No code.' }])
  const [plain] = buildModels(analyseRows([{ ...CHAT_NO_BILLING, policy: { state: 'enabled' }, info_messages: [] }]), NONE).rows
  assert.equal(plain?.policy, 'enabled', 'the Host passes every state; the Card leaves out enabled')
  assert.equal(plain?.info, undefined)
  assert.equal(only({ ...CHAT_NO_BILLING, info_messages: 'not a list' }).info, undefined)
})

test('A4 two-tier row: Copilot\'s context is the Default preset; each preset is a tier prompt + output, capped at the window', () => {
  const row = only(TWO_TIER_MESSAGES)
  const sizes = resolveSizes(row, undefined)
  assert.deepEqual(sizes.view, {
    copilotContext: 328_000,
    copilotOutput: 128_000,
    effectiveContext: 328_000,
    effectiveOutput: 128_000,
    longContext: 1_000_000,
  })
  assert.equal(sizes.context, 328_000)
  assert.equal(sizes.output, 128_000)
  // 936,000 + 128,000 = 1,064,000 is above the window: capped. Long is stored as its number.
  const long = resolveSizes(row, { context: 1_000_000 })
  assert.equal(long.context, 1_000_000)
  assert.equal(long.output, 128_000)
  assert.equal(long.view.longContext, 1_000_000)
  // A row without a window keeps the sum.
  const noWindow = only({ ...TWO_TIER_MESSAGES, capabilities: { ...TWO_TIER_MESSAGES.capabilities, limits: { max_output_tokens: 128_000 } } })
  assert.equal(resolveSizes(noWindow, undefined).view.longContext, 1_064_000)
})

test('A4 two-tier row: any size up to Long; Long with less output fails', () => {
  const row = only(TWO_TIER_MESSAGES)
  const between = resolveSizes(row, { context: 600_000 })
  assert.equal(between.context, 600_000)
  // 900,000 − 64,000 = 836,000, within the long tier's 936,000.
  const lessOutput = resolveSizes(row, { context: 900_000, output: 64_000 })
  assert.equal(lessOutput.context, 900_000)
  assert.equal(lessOutput.output, 64_000)
  // 1,000,000 − 32,000 = 968,000 is above 936,000: Copilot's values apply, which are the Default size.
  const tooLong = resolveSizes(row, { context: 1_000_000, output: 32_000 })
  assert.deepEqual(tooLong.view.problem, { check: 'prompt-above-tier', limit: 936_000 })
  assert.equal(tooLong.context, 328_000)
  assert.equal(tooLong.output, 128_000)
})

test('A4 the Long size needs max_prompt_tokens in both tiers; Copilot\'s context is the default tier\'s size when that tier gives one', () => {
  const noCaps = only({ ...TWO_TIER_MESSAGES, billing: { token_prices: { batch_size: 1, default: { input_price: 1 }, long_context: { input_price: 2 } } } })
  assert.equal(resolveSizes(noCaps, undefined).view.longContext, undefined)
  assert.equal(copilotContextOf(noCaps), 1_000_000, 'the window, without a default-tier limit')
  const oneTier = only(ONE_TIER_RESPONSES)
  assert.equal(oneTier.defaultTierPrompt, 272_000)
  assert.equal(resolveSizes(oneTier, undefined).view.longContext, undefined)
  assert.equal(copilotContextOf(oneTier), 400_000, '272,000 + 128,000 equals the window')
  // A default-tier limit below the window: 100,000 + 128,000.
  const narrow = only({ ...ONE_TIER_RESPONSES, billing: { token_prices: { batch_size: 1, default: { input_price: 1, max_prompt_tokens: 100_000 } } } })
  assert.equal(copilotContextOf(narrow), 228_000)
  assert.equal(resolveSizes(narrow, undefined).context, 228_000)
})

test('A4 sizes: empty means Copilot\'s values; a stored pair that passes is used', () => {
  const row = only(ONE_TIER_RESPONSES)
  const empty = resolveSizes(row, undefined)
  assert.deepEqual(empty.view, { copilotContext: 400_000, copilotOutput: 128_000, effectiveContext: 400_000, effectiveOutput: 128_000 })
  const stored = resolveSizes(row, { context: 300_000, output: 64_000 })
  assert.equal(stored.context, 300_000)
  assert.equal(stored.output, 64_000)
  // Output only: context stays Copilot's. Here 400,000 − 100,000 is above the
  // row's prompt limit of 272,000, so the pair fails and Copilot's values apply.
  const outputOnly = resolveSizes(row, { output: 100_000 })
  assert.equal(outputOnly.output, 128_000)
  assert.equal(outputOnly.view.problem?.check, 'prompt-above-tier')
  // Without a tier limit, output alone is used.
  const chat = resolveSizes(only(CHAT_NO_BILLING), { output: 50_000 })
  assert.equal(chat.context, 200_000)
  assert.equal(chat.output, 50_000)
  // A key of an earlier design is ignored.
  assert.equal(resolveSizes(only(TWO_TIER_MESSAGES), { tier: 'long' } as never).context, 328_000)
})

test('A4 each check refuses on its own; the prompt limit is the long tier\'s when present; a value the reply does not give is not checked', () => {
  const row = only(ONE_TIER_RESPONSES) // window 400,000, output 128,000, default tier prompt 272,000
  assert.equal(checkSizes(row, 0, undefined)?.check, 'not-positive')
  assert.equal(checkSizes(row, 1.5, undefined)?.check, 'not-positive')
  assert.equal(checkSizes(row, undefined, -1)?.check, 'not-positive')
  assert.deepEqual(checkSizes(row, 400_001, undefined), { check: 'context-above-window', limit: 400_000 })
  assert.deepEqual(checkSizes(row, undefined, 128_001), { check: 'output-above-max', limit: 128_000 })
  assert.deepEqual(checkSizes(row, 100_000, 100_000), { check: 'output-not-below-context', limit: 100_000 })
  // 400,000 − 100,000 = 300,000 > 272,000.
  assert.deepEqual(checkSizes(row, 400_000, 100_000), { check: 'prompt-above-tier', limit: 272_000 })
  assert.equal(checkSizes(row, 400_000, 128_000), undefined, 'Copilot\'s own pair passes: 272,000')
  assert.equal(checkSizes(row, 200_000, 50_000), undefined)
  // Two tiers: the long tier's 936,000 applies.
  const two = only(TWO_TIER_MESSAGES)
  assert.equal(checkSizes(two, 1_000_000, undefined), undefined, '1,000,000 − 128,000 = 872,000')
  assert.deepEqual(checkSizes(two, 1_000_000, 32_000), { check: 'prompt-above-tier', limit: 936_000 })
  assert.equal(checkSizes(two, undefined, 64_000), undefined, 'Copilot\'s context with less output: 264,000')
  // No billing: no prompt check; no window: no context check.
  const noBilling = only(CHAT_NO_BILLING)
  assert.equal(checkSizes(noBilling, 200_000, 1000), undefined)
  const bare = only({ id: 'bare', supported_endpoints: ['/responses'], capabilities: { type: 'chat', limits: { max_output_tokens: 1000 } } })
  assert.equal(checkSizes(bare, 9_999_999, 999), undefined)
})

test('A4 a stored size that no longer passes is not used; Copilot\'s values apply and the check is reported', () => {
  const row = only(ONE_TIER_RESPONSES)
  const stale = resolveSizes(row, { context: 500_000 })
  assert.equal(stale.context, 400_000)
  assert.equal(stale.output, 128_000)
  assert.deepEqual(stale.view.problem, { check: 'context-above-window', limit: 400_000 })
  assert.equal(stale.view.storedContext, 500_000, 'the stored value is kept and shown')
})

test('A4 toggle: locked by reason, off without a context size, then the stored choice, then model_picker_enabled', () => {
  const noWindow = { id: 'no-window', supported_endpoints: ['/responses'], model_picker_enabled: true, capabilities: { type: 'chat', limits: { max_output_tokens: 1000 } } }
  const choices: StoredChoices = { visibility: { 'no-window': true, 'nano-free': true, 'haiku-chat': false }, limits: {} }
  const built = buildModels(analyseRows([EMBEDDINGS, noWindow, PICKER_OFF_FREE, CHAT_NO_BILLING, ONE_TIER_RESPONSES]), choices)
  const toggles = Object.fromEntries(built.rows.map((row) => [row.key, row.toggle]))
  assert.deepEqual(toggles, { 'embed-small': 'locked', 'no-window': 'off', 'nano-free': 'on', 'haiku-chat': 'off', 'codex-one-tier': 'on' })
  // Entering a context size lets the stored choice apply.
  const sized = buildModels(analyseRows([noWindow]), { visibility: { 'no-window': true }, limits: { 'no-window': { context: 5000 } } })
  assert.equal(sized.rows[0]?.toggle, 'on')
  assert.equal(sized.specs[0]?.contextWindow, 5000)
})

test('A4 order: serviceable rows first, then locked rows, each in reply order', () => {
  const built = buildModels(analyseRows([EMBEDDINGS, CHAT_NO_BILLING, NO_ENDPOINTS, ONE_TIER_RESPONSES]), NONE)
  assert.deepEqual(built.rows.map((row) => row.key), ['haiku-chat', 'codex-one-tier', 'embed-small', 'legacy-chat'])
})

test('A4 prices as received per tier, default first; "not reported" without billing; zeros kept', () => {
  const [two, chat, free] = buildModels(analyseRows([TWO_TIER_MESSAGES, CHAT_NO_BILLING, PICKER_OFF_FREE]), NONE).rows
  assert.deepEqual(two?.prices, {
    batchSize: 1_000_000,
    tiers: [
      { name: 'default', maxPromptTokens: 200_000, input: 200, output: 1000, cacheRead: 20, cacheWrite: 250 },
      { name: 'long_context', maxPromptTokens: 936_000, input: 200, output: 1000, cacheRead: 20, cacheWrite: 250 },
    ],
  })
  assert.equal(chat?.prices, undefined)
  assert.deepEqual(free?.prices, { batchSize: 0, tiers: [{ name: 'default', input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }] })
})

test('A7 efforts and thinkingLevelMap: off always null, none ignored, every level explicit', () => {
  assert.deepEqual(thinkingLevelMapFor(['low', 'medium', 'high', 'xhigh']), {
    off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: null,
  })
  const responses = only(ONE_TIER_RESPONSES)
  assert.deepEqual(responses.efforts, ['low', 'medium', 'high', 'xhigh'], 'Copilot\'s none is not a pi-ai level')
  const [spec] = buildModels([responses], NONE).specs
  assert.equal(spec?.reasoning, true)
  assert.equal(spec?.thinkingLevelMap?.off, null)
  // No reasoning: no map.
  const [chat] = buildModels([only(CHAT_NO_BILLING)], NONE).specs
  assert.equal(chat?.reasoning, false)
  assert.equal(chat !== undefined && 'thinkingLevelMap' in chat, false)
})

test('A7 on the Messages wire, efforts need adaptive_thinking', () => {
  assert.equal(only(TWO_TIER_MESSAGES).efforts.length, 5)
  const plain = only({ ...TWO_TIER_MESSAGES, capabilities: { ...TWO_TIER_MESSAGES.capabilities, supports: { reasoning_effort: ['low', 'high'] } } })
  assert.deepEqual(plain.efforts, [])
  const [spec] = buildModels([plain], NONE).specs
  assert.equal(spec?.reasoning, false)
  assert.deepEqual(spec?.compat, { forceAdaptiveThinking: false, supportsEagerToolInputStreaming: false })
})

test('A7 compat per wire', () => {
  const messages = only(TWO_TIER_MESSAGES)
  assert.deepEqual(compatFor('anthropic-messages', messages), { forceAdaptiveThinking: true, supportsEagerToolInputStreaming: false })
  assert.deepEqual(compatFor('openai-responses', only(ONE_TIER_RESPONSES)), { supportsStrictMode: false })
  const chat = only(CHAT_NO_BILLING)
  assert.deepEqual(compatFor('openai-completions', chat), {
    supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: false, supportsReasoningEffort: false, thinkingFormat: 'openai',
  })
  const chatEfforts = only({ ...CHAT_NO_BILLING, capabilities: { ...CHAT_NO_BILLING.capabilities, supports: { reasoning_effort: ['low'] } } })
  assert.equal(compatFor('openai-completions', chatEfforts).supportsReasoningEffort, true)
})

test('A7 every pi model field from the row: id, name, wire, input, limits; only switched-on rows', () => {
  const built = buildModels(analyseRows([TWO_TIER_MESSAGES, ONE_TIER_RESPONSES, CHAT_NO_BILLING, PICKER_OFF_FREE, EMBEDDINGS]), { visibility: { 'codex-one-tier': false }, limits: { 'fable-two-tier': { context: 1_000_000 } } })
  assert.deepEqual(built.specs.map((spec) => spec.id), ['fable-two-tier', 'haiku-chat'])
  assert.deepEqual(built.specs[0], {
    id: 'fable-two-tier',
    name: 'Fable Two Tier',
    api: 'anthropic-messages',
    input: ['text', 'image'],
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    compat: { forceAdaptiveThinking: true, supportsEagerToolInputStreaming: false },
    badge: { text: '1M', tone: 'neutral' },
  })
  assert.deepEqual(built.specs[1], {
    id: 'haiku-chat',
    name: 'Haiku Chat',
    api: 'openai-completions',
    input: ['text'],
    reasoning: false,
    contextWindow: 200_000,
    maxTokens: 64_000,
    compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: false, supportsReasoningEffort: false, thinkingFormat: 'openai' },
    badge: { text: '200K', tone: 'neutral' },
  })
})

test('A9 picker label: the context size DSH uses, compact; "Deprecating" while Copilot announces a planned retirement', () => {
  const row = only(CHAT_NO_BILLING)
  const text = (window: number): unknown => pickerBadgeOf(row, window).text
  assert.equal(text(328_000), '328K')
  assert.equal(text(1_000_000), '1M')
  assert.equal(text(1_050_000), '1.05M')
  assert.equal(text(922_000), '922K')
  assert.equal(text(150_500), '150.5K')
  assert.equal(text(129), '129')
  assert.equal(pickerBadgeOf(row, 328_000).tone, 'neutral')
  const retiringRow = { ...CHAT_NO_BILLING, info_messages: [{ code: 'model_pending_deprecation', message: 'Haiku Chat has a planned deprecation date of 2026-11-16.' }] }
  const retiring = only(retiringRow)
  const warning = pickerBadgeOf(retiring, 200_000)
  assert.equal(warning.tone, 'warning')
  // One text per DSH language; locales.test.ts checks that all eight are there.
  assert.equal((warning.text as Readonly<Record<string, string>>).en, 'Deprecating')
  assert.equal((warning.text as Readonly<Record<string, string>>).zh, '即将弃用')
  // Another code keeps the size.
  const noted = only({ ...CHAT_NO_BILLING, info_messages: [{ code: 'something_else', message: 'Note.' }] })
  assert.equal(pickerBadgeOf(noted, 200_000).text, '200K')
  // The spec carries the label: the warning for the retiring row (a stored size's label: the spec test above).
  const [spec] = buildModels(analyseRows([retiringRow]), NONE).specs
  assert.equal(spec?.badge.tone, 'warning')
})

test('A4 "no longer returned": stored ids absent from the reply, with their choices; none while the list is empty', () => {
  const choices: StoredChoices = { visibility: { 'gone-a': true, 'haiku-chat': false }, limits: { 'gone-b': { context: 1000 }, 'gone-a': { output: 2000 } } }
  const built = buildModels(analyseRows([CHAT_NO_BILLING]), choices)
  assert.deepEqual(built.gone, [
    { id: 'gone-a', stored: { visible: true, output: 2000 } },
    { id: 'gone-b', stored: { context: 1000 } },
  ])
  assert.deepEqual(buildModels([], choices).gone, [])
  assert.deepEqual(buildModels([], choices).rows, [])
})
