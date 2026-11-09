/**
 * Hand-written `/models` rows for the Models tests, shaped like the schema in
 * models.md B3. Made up: no value here came from a real reply or account.
 */

/** A two-tier Messages row with adaptive thinking (like the Claude rows of B4). */
export const TWO_TIER_MESSAGES = {
  id: 'fable-two-tier',
  name: 'Fable Two Tier',
  object: 'model',
  vendor: 'Example',
  version: '1',
  preview: false,
  model_picker_enabled: true,
  policy: { state: 'enabled', terms: 'Example terms' },
  supported_endpoints: ['/v1/messages', '/chat/completions'],
  capabilities: {
    type: 'chat',
    family: 'fable',
    tokenizer: 'o200k_base',
    object: 'model_capabilities',
    limits: { max_context_window_tokens: 1_000_000, max_prompt_tokens: 936_000, max_output_tokens: 128_000 },
    supports: { streaming: true, tool_calls: true, vision: true, reasoning_effort: ['low', 'medium', 'high', 'xhigh', 'max'], adaptive_thinking: true },
  },
  billing: {
    token_prices: {
      batch_size: 1_000_000,
      default: { input_price: 200, output_price: 1000, cache_read_price: 20, cache_write_price: 250, max_prompt_tokens: 200_000 },
      long_context: { input_price: 200, output_price: 1000, cache_read_price: 20, cache_write_price: 250, max_prompt_tokens: 936_000 },
    },
  },
}

/** A one-tier Responses row with `none` among its efforts (like gpt-5.3-codex). */
export const ONE_TIER_RESPONSES = {
  id: 'codex-one-tier',
  name: 'Codex One Tier',
  model_picker_enabled: true,
  supported_endpoints: ['/responses', 'ws:/responses'],
  capabilities: {
    type: 'chat',
    limits: { max_context_window_tokens: 400_000, max_prompt_tokens: 272_000, max_output_tokens: 128_000 },
    supports: { vision: true, reasoning_effort: ['none', 'low', 'medium', 'high', 'xhigh'] },
  },
  billing: { token_prices: { batch_size: 1_000_000, default: { input_price: 175, output_price: 1400, cache_read_price: 17.5, cache_write_price: 0, max_prompt_tokens: 272_000 } } },
}

/** A Chat Completions row without reasoning and without billing (default view). */
export const CHAT_NO_BILLING = {
  id: 'haiku-chat',
  name: 'Haiku Chat',
  model_picker_enabled: true,
  supported_endpoints: ['/chat/completions'],
  capabilities: {
    type: 'chat',
    limits: { max_context_window_tokens: 200_000, max_prompt_tokens: 136_000, max_output_tokens: 64_000 },
    supports: { vision: false },
  },
}

/** A picker-disabled row whose prices are all `0`. */
export const PICKER_OFF_FREE = {
  id: 'nano-free',
  name: 'Nano Free',
  model_picker_enabled: false,
  supported_endpoints: ['/responses'],
  capabilities: {
    type: 'chat',
    limits: { max_context_window_tokens: 400_000, max_prompt_tokens: 272_000, max_output_tokens: 128_000 },
    supports: { reasoning_effort: ['none', 'low', 'medium', 'high'] },
  },
  billing: { token_prices: { batch_size: 0, default: { input_price: 0, output_price: 0, cache_read_price: 0, cache_write_price: 0 } } },
}

/** An embeddings row: locked `NOT_CHAT`. */
export const EMBEDDINGS = {
  id: 'embed-small',
  name: 'Embed Small',
  model_picker_enabled: false,
  capabilities: { type: 'embeddings', limits: { max_inputs: 512 }, supports: { dimensions: true } },
}

/** An older chat row with no `supported_endpoints`: locked `NO_ENDPOINT`. */
export const NO_ENDPOINTS = {
  id: 'legacy-chat',
  name: 'Legacy Chat',
  model_picker_enabled: false,
  capabilities: { type: 'chat', limits: { max_context_window_tokens: 128_000, max_prompt_tokens: 64_000, max_output_tokens: 4096 }, supports: {} },
}

/** A reply as `/models` returns it. */
export function reply(...rows: unknown[]): { object: string; data: unknown[] } {
  return { object: 'list', data: rows }
}

/** A JSON `Response` like Copilot's. */
export function modelsResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', 'x-github-request-id': 'GH:1', 'x-copilot-service-request-id': 'CP:1', ...init.headers },
  })
}
