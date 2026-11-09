/**
 * Build both halves with esbuild:
 *
 * - `lib/index.js`: the Host plugin, ESM for Node. Every peer stays external
 *   and resolves from the DSH installation: `@deepseek-ai/schemastery`, and
 *   the Models adapter's `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-llm-pi-ai`
 *   and `@earendil-works/pi-ai` (with their subpaths). DSH routes a linked
 *   plugin's import of a name its manifest lists as a peer to its own copy
 *   (models.md B1), so the plugin shares DSH's classes and pi-ai's wires.
 * - `lib/client.js`: the browser half, CommonJS wrapped in
 *   `window.__ModuleLoader__.load({ id, factory })`. `react` stays external and
 *   comes from the page's module table; everything else is inlined.
 *
 * A purity check fails the build when either bundle imports anything else.
 */
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const peers = Object.keys(pkg.peerDependencies ?? {})

/** A peer, or a subpath of one (`@earendil-works/pi-ai/api/…`). */
const isPeer = (specifier) => peers.some((peer) => specifier === peer || specifier.startsWith(`${peer}/`))

/**
 * DSH's scopes stay external whether or not a name is a peer: dev copies of
 * DSH packages are installed for the type checker, and esbuild would inline
 * one silently. Kept external, a non-peer import reaches the check below.
 */
const DSH_SCOPES = ['@deepseek-ai/*', '@earendil-works/*']

await build({
  absWorkingDir: root.pathname,
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: [...DSH_SCOPES, ...peers.flatMap((peer) => [peer, `${peer}/*`])],
  legalComments: 'none',
  logLevel: 'warning',
})

await build({
  absWorkingDir: root.pathname,
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  external: ['react'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {\n`
      + 'var module = { exports: {} }; var exports = module.exports;',
  },
  footer: { js: 'return module.exports;\n} });' },
  legalComments: 'none',
  logLevel: 'warning',
})

/** Fail when a bundle imports a module outside its allow-list. */
async function checkImports(file, pattern, allowed) {
  const text = await readFile(new URL(file, root), 'utf8')
  const found = new Set([...text.matchAll(pattern)].map((match) => match.slice(1).find((group) => group !== undefined)))
  const extra = [...found].filter((specifier) => specifier === undefined || !allowed(specifier))
  if (extra.length > 0) throw new Error(`${file} imports ${extra.join(', ')}; allowed: Node built-ins, ${peers.join(', ') || 'none'}`)
}

await checkImports(
  'lib/index.js',
  /(?:^|\n)\s*import\s[^'"]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g,
  (specifier) => specifier.startsWith('node:') || isPeer(specifier),
)
await checkImports('lib/client.js', /\brequire\(\s*["']([^"']+)["']\s*\)/g, (specifier) => specifier === 'react')

console.log('built lib/index.js and lib/client.js')
