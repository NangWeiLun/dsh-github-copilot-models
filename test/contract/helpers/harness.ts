/**
 * A real DSH composition for one test, built from the installed packages.
 *
 * Root cordis Context, then, in mount order:
 * - `@deepseek-ai/dsh-credentials-local` writing `.credentials.yaml` in a fresh
 *   `gcm-` temp folder (`watch: false`, so no file watcher runs);
 * - with `flows: true`, the real `AuthorizationService`, dsh-llm's
 *   `LlmRuntime` (the `llm` service llm-pi-ai injects) and DSH's
 *   `@deepseek-ai/dsh-llm-pi-ai` plugin with an empty `providers` dict. Its
 *   `apply()` registers pi-ai's sign-in flows with `ctx.authorization` exactly
 *   as in DSH, among them the one for {@link KEY}.
 *
 * Everything is disposed and the folder removed when the test ends. Nothing
 * reads or writes `~/.dsh`.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestContext } from 'node:test'
import { dsh, importInstalled } from './dsh.ts'

/**
 * The shared credential record (login.md B3), named by the installed DSH's own
 * `recordKeyFor`, as DSH names the record of its built-in route `github-copilot`.
 */
export const KEY: string = (await importInstalled('@deepseek-ai/dsh-llm-pi-ai/lib/index.js')).recordKeyFor('github-copilot')

/** One layer of DSH's launch environment snapshot. */
export interface EnvLayer {
  source: 'process' | 'project-env' | 'user-env'
  path?: string
  values: Record<string, string>
}

export interface HarnessOptions {
  /** Also mount AuthorizationService, LlmRuntime and llm-pi-ai. */
  flows?: boolean
  /** Provide `launchEnvironment` as DSH's launcher does; omitted → DSH's fallback, the live `process.env`. */
  launchEnvironment?: EnvLayer[]
  /** Reuse an existing credentials file (a "restart") instead of a fresh temp folder. */
  file?: string
}

export interface Harness {
  ctx: any
  credentials: any
  /** `ctx.authorization`, when mounted with `flows: true`. */
  authorization: any
  /** The credentials file. */
  file: string
  /** Every `credentials/record-updated` key, in order. */
  recordEvents: string[]
  /** Dispose the llm-pi-ai plugin only (DSH's "llm-pi-ai is off"). */
  disposePiAi(): Promise<void>
}

/** Poll until `check` holds, failing after `ms`. */
export async function waitFor(check: () => unknown, what: string, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

export async function mountHarness(t: TestContext, options: HarnessOptions = {}): Promise<Harness> {
  const { Context } = await dsh.cordis()
  const { LocalCredentialProvider } = await dsh.credentialsLocal()
  const dir = options.file === undefined ? await mkdtemp(join(tmpdir(), 'gcm-')) : undefined
  const file = options.file ?? join(dir!, '.credentials.yaml')
  const ctx = new Context()
  const disposers: (() => unknown)[] = []
  t.after(async () => {
    try {
      for (const dispose of disposers.reverse()) await dispose()
    } finally {
      if (dir !== undefined) await rm(dir, { recursive: true, force: true })
    }
  })
  const mount = async (plugin: unknown, config?: unknown) => {
    const fiber = ctx.plugin(plugin, config)
    disposers.push(() => fiber.dispose())
    await fiber
    return fiber
  }

  if (options.launchEnvironment !== undefined) {
    const { createLaunchEnvironmentSnapshot } = await dsh.launchEnvironment()
    disposers.push(ctx.provide('launchEnvironment', createLaunchEnvironmentSnapshot(options.launchEnvironment)))
  }
  const recordEvents: string[] = []
  disposers.push(ctx.on('credentials/record-updated', (key: string) => void recordEvents.push(key)))

  await mount(LocalCredentialProvider, { path: file, watch: false })
  let piAi: any
  if (options.flows === true) {
    const { AuthorizationService } = await dsh.authorization()
    const { LlmRuntime } = await dsh.llm()
    await mount(AuthorizationService)
    await mount(LlmRuntime)
    piAi = await mount(await dsh.llmPiAi(), { providers: {} })
    // llm-pi-ai registers its flows in a nested ctx.inject(['authorization']) fiber.
    await waitFor(() => ctx.get('authorization')?.describe(KEY), `the ${KEY} flow`)
  }
  return {
    ctx,
    credentials: ctx.get('credentials'),
    authorization: ctx.get('authorization'),
    file,
    recordEvents,
    async disposePiAi() {
      await piAi?.dispose()
    },
  }
}

/** A prompt as `ctx.authorization` hands it to the interaction (dsh-authorization types). */
export interface Prompt {
  kind: 'text' | 'secret' | 'select'
  message: string
  placeholder?: string
  signal?: AbortSignal
}

/** A notice as `ctx.authorization` hands it to the interaction. */
export interface Notice {
  message: string
  url?: string
  code?: string
}

/**
 * The `interaction` a caller passes to `begin()`. It records prompts and
 * notices, appends `prompt <kind>` and `notice[ url=<url>][ code=<code>]` to
 * `timeline`, and answers each prompt with `answer`.
 */
export function scriptedInteraction(
  answer: (prompt: Prompt, index: number) => string | Promise<string>,
  timeline: string[] = [],
) {
  const prompts: Prompt[] = []
  const notices: Notice[] = []
  return {
    prompts,
    notices,
    timeline,
    interaction: {
      prompt: async (prompt: Prompt) => {
        prompts.push(prompt)
        timeline.push(`prompt ${prompt.kind}`)
        return answer(prompt, prompts.length - 1)
      },
      notify: (notice: Notice) => {
        notices.push(notice)
        timeline.push(['notice', notice.url && `url=${notice.url}`, notice.code && `code=${notice.code}`].filter(Boolean).join(' '))
      },
    },
  }
}

/** Run `promise` and return what it threw; fails if it resolved. */
export async function rejection(promise: Promise<unknown>): Promise<any> {
  let value: unknown
  try {
    value = await promise
  } catch (error) {
    return error
  }
  throw new Error(`expected a rejection, got ${JSON.stringify(value)}`)
}
