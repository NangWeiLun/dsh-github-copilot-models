/**
 * Where the installed DeepSeek Harness lives, and how the contract tests load it.
 *
 * DSH and pi-ai are not in this workspace's node_modules: the tests load DSH's
 * own install, so they check the versions the plugin really runs against.
 * By default that is the install `npx @deepseek-ai/dsh` uses. `DSH_INSTALL_DIR`
 * overrides the folder. It may name the `node_modules` folder that holds
 * `@deepseek-ai/` and `@earendil-works/`, or its parent.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The folder `npx @deepseek-ai/dsh` installs DSH into:
 * `<npm cache>/_npx/<first 16 hex digits of sha512("@deepseek-ai/dsh")>/node_modules`.
 */
function npxInstallDir(): string {
  const defaultCache = process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA ?? homedir(), 'npm-cache')
    : join(homedir(), '.npm')
  const cache = process.env.npm_config_cache || defaultCache
  const hash = createHash('sha512').update('@deepseek-ai/dsh').digest('hex').slice(0, 16)
  return join(cache, '_npx', hash, 'node_modules')
}

function resolveInstallDir(dir: string): string {
  for (const candidate of [dir, join(dir, 'node_modules')]) {
    if (existsSync(join(candidate, '@deepseek-ai', 'dsh', 'package.json'))) return candidate
  }
  throw new Error(`DeepSeek Harness is not installed at ${dir}. Run \`npx @deepseek-ai/dsh --version\` once, or set DSH_INSTALL_DIR.`)
}

export const DSH_INSTALL_DIR = resolveInstallDir(process.env.DSH_INSTALL_DIR || npxInstallDir())

/** Import one file of an installed package, e.g. `@deepseek-ai/cordis/lib/index.js`. */
export function importInstalled(file: string): Promise<any> {
  return import(pathToFileURL(join(DSH_INSTALL_DIR, file)).href)
}

/** The installed version of one package, e.g. `@earendil-works/pi-ai`. */
export function installedVersion(pkg: string): string {
  const manifest = JSON.parse(readFileSync(join(DSH_INSTALL_DIR, pkg, 'package.json'), 'utf8')) as { version: string }
  return manifest.version
}

/** The installed modules the contract tests use. */
export const dsh = {
  cordis: () => importInstalled('@deepseek-ai/cordis/lib/index.js'),
  credentials: () => importInstalled('@deepseek-ai/dsh-credentials/lib/index.js'),
  credentialsLocal: () => importInstalled('@deepseek-ai/dsh-credentials-local/lib/index.js'),
  authorization: () => importInstalled('@deepseek-ai/dsh-authorization/lib/index.js'),
  llm: () => importInstalled('@deepseek-ai/dsh-llm/lib/index.js'),
  llmPiAi: () => importInstalled('@deepseek-ai/dsh-llm-pi-ai/lib/index.js'),
  launchEnvironment: () => importInstalled('@deepseek-ai/dsh-launch-environment/lib/index.js'),
  piAiCopilotModels: () => importInstalled('@earendil-works/pi-ai/dist/providers/github-copilot.models.js'),
}
