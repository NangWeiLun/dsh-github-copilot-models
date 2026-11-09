/**
 * Host half of dsh-github-copilot-models: the Login component (login.md) and
 * the Models component (models.md).
 *
 * - Card ↔ Host: exact routes on `ctx.connection.fetch.register` (routes.ts).
 * - Sign-in: DSH llm-pi-ai's flow for the record of its built-in route
 *   `github-copilot` (`RECORD_KEY`, ports.ts), driven
 *   through `ctx.authorization.begin()`; the plugin registers no flow of its own.
 * - Models: the live `/models` list, served through the plugin's own route
 *   `github-copilot-models` by a subclass of `PiAiAdapter` (models.md A8, A9).
 * - Config: `domain` (login.md A1) and the stored model choices (models.md
 *   A5), volatile fields written through `ctx.settings.mutate`.
 *
 * Services are optional: each one is looked up per operation with `ctx.get`,
 * so the plugin loads in a composition that lacks one and reports it instead.
 */
import { fileURLToPath } from 'node:url'
import Schema from '@deepseek-ai/schemastery'
import type { HostContext } from './host/context.ts'
import { toCardError } from './host/errors.ts'
import { LoginController } from './host/login.ts'
import type { LoginOutput } from './host/login.ts'
import { DEFAULT_CUSTOM_HEADERS } from './host/models-fetch.ts'
import { ModelsController } from './host/models.ts'
import type { SettingsOp } from './host/models.ts'
import { createCredentialStore } from './host/pi.ts'
import type { CredentialRecords } from './host/pi.ts'
import type { AuthorizationPort, CredentialsPort, FetchLike } from './host/ports.ts'
import { RECORD_KEY } from './host/ports.ts'
import { ModelsRoute } from './host/route.ts'
import type { LlmPort } from './host/route.ts'
import { createRoutes } from './host/routes.ts'
import { ROUTE_ID } from './host/rows.ts'
import type { StoredChoices } from './host/rows.ts'

export const name = 'github-copilot-models'

/** Stored sizes of one model (models.md A5). */
export interface ModelLimits {
  context?: number
  output?: number
}

/** Plugin configuration (login.md A1, models.md A5). */
export interface Config {
  /** GitHub domain; empty means github.com. */
  domain: string
  modelVisibility: Record<string, boolean>
  modelLimits: Record<string, ModelLimits>
  customHeaders: Record<string, string>
}

export const Config = Schema.object({
  domain: Schema.string()
    .default('')
    .description('GitHub domain. Empty means github.com. Editable on the card while signed out.')
    .volatile(),
  modelVisibility: Schema.dict(Schema.boolean())
    .default({})
    .description('Show in picker, per model id. No entry: the default from the model list.')
    .volatile(),
  modelLimits: Schema.dict(Schema.object({
    context: Schema.natural(),
    output: Schema.natural(),
  }))
    .default({})
    .description('Context and output sizes, per model id. Set on the card.')
    .volatile(),
  customHeaders: Schema.dict(Schema.string())
    .default({ ...DEFAULT_CUSTOM_HEADERS })
    .description('Request headers for /models and model requests. Stored as plain configuration: no secrets.')
    .volatile(),
})

/** The Loader hands volatile fields over as live references. */
interface ResolvedConfig {
  readonly domain: { get(): string | undefined }
  readonly modelVisibility: { get(): Record<string, boolean> | undefined }
  readonly modelLimits: { get(): Record<string, ModelLimits> | undefined }
  readonly customHeaders: { get(): Record<string, string> | undefined }
}

/** The parts of `ctx.settings` used to save the plugin's own fields. */
interface SettingsPort {
  mutate(ns: string, ops: readonly SettingsOp[]): Promise<void>
  /** Page policy: this plugin ships its own page, so no generated form (dsh-settings README). */
  configure(presentation: { auto?: boolean }, owner?: unknown): () => void
}

/** The part of `ctx.connection` used to register the Card routes. */
interface ConnectionPort {
  readonly fetch: { register(route: ReturnType<typeof createRoutes>[number]): () => Promise<void> }
}

/** The part of `ctx.fs` the adapter uses for image attachments. */
interface FsPort {
  processPathFromHostPath(hostPath: string): string | undefined
}

/** Login output, for the Models component (login.md A7). */
export type { LoginOutput }

/**
 * Where the adapter's peers resolved (models.md B1): DSH routes a linked
 * plugin's peer imports to its own installation. Read once; the Card shows
 * it under Details, so a live check needs no log access.
 */
function peerLocations(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const peer of ['@deepseek-ai/dsh-llm-pi-ai', '@deepseek-ai/dsh-llm', '@earendil-works/pi-ai']) {
    try {
      result[peer] = fileURLToPath(import.meta.resolve(peer))
    } catch (error) {
      result[peer] = `unresolved (${toCardError(error).code})`
    }
  }
  return result
}

export function apply(ctx: HostContext, config: ResolvedConfig): void {
  const entryId = ctx.fiber.entry?.options.id ?? name
  const fetch: FetchLike = (input, init) => globalThis.fetch(input, init)

  const writeSettings = async (ops: readonly SettingsOp[]): Promise<void> => {
    const settings = ctx.get('settings') as SettingsPort | undefined
    if (settings === undefined) throw new Error('the settings service is not available')
    await settings.mutate(entryId, ops)
  }
  const readChoices = (): StoredChoices => ({
    visibility: config.modelVisibility.get() ?? {},
    limits: config.modelLimits.get() ?? {},
  })

  // The route (models.md A8): its credential store reads the shared record per call.
  const store = createCredentialStore(() => ctx.get('credentials') as CredentialRecords | undefined)
  const route = new ModelsRoute(store)

  const models = new ModelsController({
    fetch,
    logger: ctx.logger,
    token: async (signal) => {
      // Through pi-ai, so an expiring Copilot token is refreshed first (A2).
      const auth = await route.tokenModels().getAuth(ROUTE_ID, { signal })
      const token = auth?.auth.apiKey
      return token === undefined || token === '' ? undefined : { token }
    },
    readChoices,
    readHeaders: () => config.customHeaders.get() ?? {},
    writeSettings,
    publish: (published) => route.publish(published),
    routeError: () => route.error,
    peers: peerLocations(),
  })
  ctx.effect(() => () => models.dispose(), 'github-copilot-models: models controller')

  const login = new LoginController({
    credentials: () => ctx.get('credentials') as CredentialsPort | undefined,
    authorization: () => ctx.get('authorization') as AuthorizationPort | undefined,
    fetch,
    logger: ctx.logger,
    readDomain: () => config.domain.get() ?? '',
    saveDomain: (value) => writeSettings([{ op: 'set', path: ['domain'], value }]),
    onOutputChange: (output) => {
      ctx.logger.info(output === undefined
        ? 'github-copilot-models: signed out or not verified'
        : `github-copilot-models: signed in (${output.method}), Copilot host ${output.host}`)
    },
    models: {
      lookupSucceeded: (output) => models.fetch({ method: output.method, host: output.host }),
      credentialChanged: () => models.credentialChanged(),
      state: () => models.state(),
      fetching: () => models.fetching,
    },
  })
  ctx.effect(() => () => login.dispose(), 'github-copilot-models: login controller')

  // A toggle, size or header change rebuilds the model list; no request (A3, A5).
  ctx.on('loader/volatile-update', () => models.choicesChanged())

  // The Card is this plugin's own Settings page; opt out of a generated form.
  // Reads and writes of the fields are unaffected by this policy.
  ctx.inject(['settings'], (scoped) => {
    scoped.effect(() => (scoped.get('settings') as SettingsPort).configure({ auto: false }, ctx.fiber), 'github-copilot-models: own settings page')
  })

  // The route `github-copilot-models` (models.md A8). `llm` exists in every composition with models.
  ctx.inject(['llm'], (scoped) => {
    scoped.effect(() => {
      const adapter = route.createAdapter({
        attachments: () => scoped.get('attachments'),
        processPath: (hostPath) => (scoped.get('fs') as FsPort | undefined)?.processPathFromHostPath(hostPath),
      })
      try {
        return route.register(scoped.get('llm') as LlmPort, adapter)
      } catch (error) {
        ctx.logger.error(`github-copilot-models: route ${ROUTE_ID} could not be registered (${toCardError(error).code})`)
        ctx.logger.error(error)
        return () => {}
      }
    }, 'github-copilot-models: model route')
  })

  // Card ↔ Host routes. `connection` exists only in the Web composition.
  ctx.inject(['connection'], (scoped) => {
    scoped.effect(() => {
      const connection = scoped.get('connection') as ConnectionPort
      const disposers = createRoutes(login, models).map((entry) => connection.fetch.register(entry))
      return async () => {
        for (const dispose of disposers.reverse()) await dispose()
      }
    }, 'github-copilot-models: Card routes')
  })

  // Start-up lookup (login.md A3), then the `/models` fetch (models.md A3),
  // and changes made outside the plugin (login.md A2).
  // Scoped to `credentials`: before it mounts, a read would see nothing.
  ctx.inject(['credentials'], (scoped) => {
    scoped.on('credentials/record-updated', (key: string) => {
      if (key === RECORD_KEY) void login.recordUpdated()
    })
    scoped.effect(() => {
      void login.start()
      return () => {}
    }, 'github-copilot-models: start-up host lookup')
  })
}
