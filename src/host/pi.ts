/**
 * The pi-ai side of the Models component (models.md A8): the credential
 * store over the shared record, the pi-ai provider for the route
 * `github-copilot-models`, and the profile `PiAiAdapter` reads.
 *
 * pi-ai is DSH's own copy (a peer, models.md B1). Everything here is built
 * from pi-ai's exported parts; nothing in pi-ai or DSH is patched.
 */
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { createProvider } from '@earendil-works/pi-ai'
import type { Api, AuthContext, Credential, CredentialStore, Model, OAuthAuth, Provider, ProviderHeaders, SimpleStreamOptions, StreamOptions } from '@earendil-works/pi-ai'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { buildCopilotDynamicHeaders, hasCopilotVisionInput } from '@earendil-works/pi-ai/api/github-copilot-headers'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { githubCopilotProvider } from '@earendil-works/pi-ai/providers/github-copilot'
import type { LoginMethod } from '../shared/api.ts'
import { INTEGRATION_ID } from '../shared/api.ts'
import { mergeHeaders } from './models-fetch.ts'
import type { CredentialRecord } from './ports.ts'
import { RECORD_KEY } from './ports.ts'
import { ROUTE_ID } from './rows.ts'
import type { PiModelSpec } from './rows.ts'

/** Shown in DSH's model picker; DSH's built-in route is named "GitHub Copilot" (models.md A8). */
export const DISPLAY_NAME = 'GitHub Copilot (plugin)'

/** The part of `ctx.credentials` the store calls. */
export interface CredentialRecords {
  readRecord(key: string): Promise<CredentialRecord | undefined>
  modifyRecord(key: string, mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>): Promise<CredentialRecord | undefined>
}

/** pi-ai finds no ambient credential: no environment, no files (models.md A8). */
export const NO_AMBIENT_AUTH: AuthContext = {
  env: async () => undefined,
  fileExists: async () => false,
}

/**
 * JSON image of a grant payload: `undefined` members dropped, as DSH's own
 * store does, because the credentials service refuses them and a refreshed
 * github.com credential carries `enterpriseUrl: undefined` (models.md A8).
 */
function jsonImage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => entry === undefined ? null : jsonImage(entry))
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const image: Record<string, unknown> = {}
    for (const [key, member] of Object.entries(value)) if (member !== undefined) image[key] = jsonImage(member)
    return image
  }
  return value
}

/** A stored record as pi-ai's credential (models.md A8). */
export function toPiCredential(record: CredentialRecord | undefined): Credential | undefined {
  if (record === undefined) return undefined
  if (record.kind === 'api-key') {
    return { type: 'api_key', ...record.key === undefined ? {} : { key: record.key } }
  }
  return record.payload as Credential
}

/** A pi-ai credential as the record to store (models.md A8). */
export function toRecord(credential: Credential): CredentialRecord {
  if (credential.type === 'api_key') {
    return { kind: 'api-key', ...credential.key === undefined ? {} : { key: credential.key } }
  }
  return { kind: 'grant', payload: jsonImage(credential) }
}

/**
 * pi-ai's `CredentialStore` over the shared record (models.md A8 step 1).
 * pi-ai asks by provider id; only this route's id maps to the record.
 * @param credentials - resolves `ctx.credentials` per call; undefined while it is not mounted.
 */
export function createCredentialStore(credentials: () => CredentialRecords | undefined): CredentialStore {
  const own = (providerId: string): void => {
    if (providerId !== ROUTE_ID) throw new Error(`github-copilot-models: no credential for provider "${providerId}"`)
  }
  const service = (): CredentialRecords => {
    const found = credentials()
    if (found === undefined) throw new Error('github-copilot-models: the credentials service is not available')
    return found
  }
  return {
    async read(providerId) {
      own(providerId)
      const found = credentials()
      return found === undefined ? undefined : toPiCredential(await found.readRecord(RECORD_KEY))
    },
    async list() {
      const record = await credentials()?.readRecord(RECORD_KEY)
      if (record === undefined) return []
      return [{ providerId: ROUTE_ID, type: record.kind === 'api-key' ? 'api_key' : 'oauth' }]
    },
    async modify(providerId, mutate) {
      own(providerId)
      const written = await service().modifyRecord(RECORD_KEY, async (current) => {
        const next = await mutate(toPiCredential(current))
        return next === undefined ? undefined : toRecord(next)
      })
      return toPiCredential(written)
    },
    async delete(providerId) {
      // Models never deletes the record; sign-out belongs to Login (login.md A6).
      own(providerId)
      throw new Error('github-copilot-models: the plugin card signs out')
    },
  }
}

/** pi-ai's static Copilot header block (models.md A7, B6), read from its bundled catalog. */
export function staticCopilotHeaders(): Record<string, string> {
  const model = githubCopilotProvider().getModels()[0]
  return { ...model?.headers }
}

/**
 * Add the Copilot request headers pi-ai adds only for `github-copilot`, and
 * send the token as `Authorization: Bearer` on the Messages wire (models.md
 * A8 step 3). Caller headers still go last.
 */
function withCopilotHeaders<O extends StreamOptions | SimpleStreamOptions>(
  run: (model: Model<Api>, context: Parameters<Provider['stream']>[1], options?: O) => ReturnType<Provider['stream']>,
): (model: Model<Api>, context: Parameters<Provider['stream']>[1], options?: O) => ReturnType<Provider['stream']> {
  return (model, context, options) => {
    const dynamic = buildCopilotDynamicHeaders({ messages: context.messages, hasImages: hasCopilotVisionInput(context.messages) })
    const auth: ProviderHeaders = model.api === 'anthropic-messages' && options?.apiKey !== undefined
      ? { Authorization: `Bearer ${options.apiKey}`, 'x-api-key': null }
      : {}
    const headers: ProviderHeaders = { ...dynamic, ...auth, ...options?.headers }
    return run(model, context, { ...options, headers } as O)
  }
}

/** The pi models of one model list (models.md A7). */
export function piModelsOf(specs: readonly PiModelSpec[], host: string, staticHeaders: Readonly<Record<string, string>>): Model<Api>[] {
  return specs.map((spec) => ({
    id: spec.id,
    name: spec.name,
    api: spec.api,
    provider: ROUTE_ID,
    baseUrl: host,
    type: 'chat' as const,
    input: [...spec.input],
    reasoning: spec.reasoning,
    ...spec.thinkingLevelMap === undefined ? {} : { thinkingLevelMap: { ...spec.thinkingLevelMap } },
    contextWindow: spec.contextWindow,
    maxTokens: spec.maxTokens,
    headers: { ...staticHeaders },
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: { ...spec.compat },
  }) as Model<Api>)
}

/**
 * The pi-ai provider for the route (models.md A8 step 2–3).
 * @param host - the row list's Copilot host; also the request host for a browser login.
 * @param models - the pi models of the switched-on rows.
 */
export function createPiProvider(host: string, models: readonly Model<Api>[]): Provider {
  const native = githubCopilotProvider()
  const nativeOAuth = native.auth.oauth as OAuthAuth
  const oauth: OAuthAuth = {
    ...nativeOAuth,
    login: async () => {
      throw new Error('Sign in on the plugin card')
    },
    // pi-ai would send requests to the host named in the token (B6).
    toAuth: async (credential) => ({ ...(await nativeOAuth.toAuth(credential)), baseUrl: host }),
  }
  const base = createProvider({
    id: ROUTE_ID,
    name: DISPLAY_NAME,
    baseUrl: host,
    auth: { oauth, ...native.auth.apiKey === undefined ? {} : { apiKey: native.auth.apiKey } },
    models: [...models],
    api: {
      'openai-responses': openAIResponsesApi(),
      'anthropic-messages': anthropicMessagesApi(),
      'openai-completions': openAICompletionsApi(),
    },
  })
  const list = [...models]
  return {
    ...base,
    getModels: () => list,
    getAllModels: () => list,
    stream: withCopilotHeaders<StreamOptions>(base.stream.bind(base)),
    streamSimple: withCopilotHeaders<SimpleStreamOptions>(base.streamSimple.bind(base)),
  }
}

/**
 * The one profile `PiAiAdapter` reads (models.md A8 step 4).
 * @param piProvider - step 3.
 * @param models - its pi models; their `maxTokens` become `configuredMaxTokens`.
 * @param method - the row list's login method, for the integration id.
 * @param customHeaders - the stored custom headers (A6).
 */
export function createProfile(
  piProvider: Provider | undefined,
  models: readonly Model<Api>[],
  method: LoginMethod | undefined,
  customHeaders: Readonly<Record<string, string>>,
): ResolvedPiAiProviderProfile {
  const headers = mergeHeaders(method === undefined ? {} : { 'Copilot-Integration-Id': INTEGRATION_ID[method] }, customHeaders)
  return {
    provider: ROUTE_ID,
    displayName: DISPLAY_NAME,
    ...piProvider === undefined ? {} : { piProvider },
    headers,
    configuredMaxTokens: new Map(models.map((model) => [model.id, model.maxTokens])),
    modelErrors: new Map(),
    retryPolicy: resolveRetryPolicy(undefined, ROUTE_ID),
    streamIdleTimeoutMs: 300_000,
    maxRequestImageBytes: 20 * 1024 * 1024,
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
    maxRequestImages: 50,
    imageOffloadCountQuantum: 10,
  }
}
