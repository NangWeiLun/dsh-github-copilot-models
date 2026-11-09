/**
 * Load the plugin's own Host modules with their peer imports resolved from
 * DSH's installation, the way DSH resolves a linked plugin's peers at run
 * time (models.md B1, B9). Without this, `src/host/*.ts` would import the
 * workspace's dev copies of `@deepseek-ai/dsh-llm`, `dsh-llm-pi-ai` and
 * pi-ai, and the contract tests would check those instead of DSH's.
 *
 * Importing this module installs a synchronous resolve hook
 * (`module.registerHooks`) for the process: a bare import of one of the three
 * peers, from a file in this workspace, resolves as if imported from inside
 * DSH's installation.
 */
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DSH_INSTALL_DIR } from './dsh.ts'

/** The peers the adapter imports (package.json `peerDependencies`, models.md B1). */
export const ADAPTER_PEERS = ['@deepseek-ai/dsh-llm-pi-ai', '@deepseek-ai/dsh-llm', '@earendil-works/pi-ai'] as const

const workspace = fileURLToPath(new URL('../../../', import.meta.url))
/** A file inside DSH's installation to resolve from, so Node searches its `node_modules`. */
const anchor = pathToFileURL(join(DSH_INSTALL_DIR, '@deepseek-ai', 'dsh', 'package.json')).href

function isPeer(specifier: string): boolean {
  return ADAPTER_PEERS.some((peer) => specifier === peer || specifier.startsWith(`${peer}/`))
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL === undefined ? undefined : (() => {
      try {
        return fileURLToPath(context.parentURL)
      } catch {
        return undefined
      }
    })()
    if (isPeer(specifier) && parent !== undefined && parent.startsWith(workspace) && !parent.includes(`${'/'}node_modules${'/'}`)) {
      return nextResolve(specifier, { ...context, parentURL: anchor })
    }
    return nextResolve(specifier, context)
  },
})

/** Where one peer resolves for the plugin's own files, after the hook. */
export function resolvedPeer(peer: string): string {
  return fileURLToPath(import.meta.resolve(peer, pathToFileURL(join(workspace, 'src', 'index.ts')).href))
}
