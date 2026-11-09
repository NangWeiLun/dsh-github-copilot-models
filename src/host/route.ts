/**
 * The route `github-copilot-models` (models.md A8 step 5): one `PiAiAdapter`
 * over the plugin's own credential store and profile, registered with
 * `ctx.llm.registerAdapter`. A changed model list builds a new profile `Map`
 * and calls `registration.replace()`, so DSH picks it up without a restart.
 */
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { PiAiAdapterOptions, ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { LlmModelBadge, LlmModelInfo } from '@deepseek-ai/dsh-llm'
import { createModels } from '@earendil-works/pi-ai'
import type { CredentialStore } from '@earendil-works/pi-ai'
import type { CardError } from '../shared/api.ts'
import { messageOf } from './errors.ts'
import type { PublishedModels } from './models.ts'
import { createPiProvider, createProfile, NO_AMBIENT_AUTH, piModelsOf, staticCopilotHeaders } from './pi.ts'
import { ROUTE_ID } from './rows.ts'

/** The part of `ctx.llm` the route uses. */
export interface LlmPort {
  registerAdapter(routes: readonly string[], adapter: PiAiAdapter): RouteRegistration
}

/** What `registerAdapter` returns. */
export interface RouteRegistration {
  (): void
  replace(routes: readonly string[]): void
}

/** Optional services the adapter reaches per request (attachments, workspace paths). */
export interface AdapterServices {
  readonly attachments: () => unknown
  readonly processPath: (hostPath: string) => string | undefined
}

/** The profiles map `PiAiAdapter` reads; a new object for every change (B6). */
type Profiles = ReadonlyMap<string, ResolvedPiAiProviderProfile>

/**
 * DSH's `PiAiAdapter` with a label per model in DSH's model picker (models.md
 * A9, B8): since DSH 0.2.2-rc.1 the picker draws an adapter's `badge` beside
 * the model name, and `PiAiAdapter` lists none.
 */
export class LabelledPiAiAdapter extends PiAiAdapter {
  readonly #badges: () => ReadonlyMap<string, LlmModelBadge>

  constructor(options: PiAiAdapterOptions, badges: () => ReadonlyMap<string, LlmModelBadge>) {
    super(options)
    this.#badges = badges
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await super.listModels(provider)
    const badges = this.#badges()
    return models.map((model) => {
      const badge = badges.get(model.id)
      return badge === undefined ? model : { ...model, badge }
    })
  }
}

/** The route: its adapter, its profiles, and its registration. */
export class ModelsRoute {
  readonly #store: CredentialStore
  readonly #headers = staticCopilotHeaders()
  #profiles: Profiles
  /** The picker label of each served model id (A9), replaced together with the profiles. */
  #badges: ReadonlyMap<string, LlmModelBadge> = new Map()
  #registration: RouteRegistration | undefined
  #error: CardError | undefined

  constructor(store: CredentialStore) {
    this.#store = store
    this.#profiles = new Map([[ROUTE_ID, createProfile(undefined, [], undefined, {})]])
  }

  /** Why the route is not registered, if it is not (A10). */
  get error(): CardError | undefined {
    return this.#error
  }

  /** The profiles `PiAiAdapter` reads, once per operation. */
  profiles(): Profiles {
    return this.#profiles
  }

  /**
   * A pi-ai collection holding this route's provider, for reading the token
   * of the `/models` request (A2). Built per call: it is cheap, and it always
   * holds the current provider.
   */
  tokenModels(): ReturnType<typeof createModels> {
    const models = createModels({ credentials: this.#store, authContext: NO_AMBIENT_AUTH })
    const provider = this.#profiles.get(ROUTE_ID)?.piProvider
    // Before the first fetch there is no host yet; any https origin serves for auth only.
    models.setProvider(provider ?? createPiProvider('https://api.githubcopilot.com', []))
    return models
  }

  /** Build the adapter (A8 step 5), with the picker labels (A9). */
  createAdapter(services: AdapterServices): PiAiAdapter {
    return new LabelledPiAiAdapter({
      profiles: () => this.#profiles,
      // Authentication comes from the credential store, not a reference.
      resolveApiKey: async () => undefined,
      auth: { credentials: this.#store, authContext: NO_AMBIENT_AUTH },
      resolveAttachments: () => services.attachments() as never,
      resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, services.processPath, ref),
    }, () => this.#badges)
  }

  /**
   * Register the route. A route id another plugin holds is reported, not thrown.
   * @returns the disposer.
   */
  register(llm: LlmPort, adapter: PiAiAdapter): () => void {
    try {
      this.#registration = llm.registerAdapter([ROUTE_ID], adapter)
      this.#error = undefined
    } catch (error) {
      const code = (error as { code?: unknown }).code
      this.#error = code === 'DUPLICATE_ADAPTER'
        ? { code: 'ROUTE_IN_USE', params: { route: ROUTE_ID } }
        : { code: 'INTERNAL', params: { message: messageOf(error) } }
      throw error
    }
    return () => {
      this.#registration?.()
      this.#registration = undefined
    }
  }

  /** A changed model list (A8 Republish): a new profile `Map` and labels, then `replace()`. */
  publish(models: PublishedModels): void {
    const piModels = models.host === undefined ? [] : piModelsOf(models.specs, models.host, this.#headers)
    const provider = models.host === undefined ? undefined : createPiProvider(models.host, piModels)
    this.#profiles = new Map([[ROUTE_ID, createProfile(provider, piModels, models.method, models.customHeaders)]])
    this.#badges = new Map(models.specs.map((spec) => [spec.id, spec.badge]))
    this.#registration?.replace([ROUTE_ID])
  }
}
