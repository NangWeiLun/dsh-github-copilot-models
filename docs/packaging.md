# Packaging

How this repository applies DSH's official [Package and install a plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish) guide: the manifest, compatibility, package shape, name and licence, and where it differs from the official guide. Steps to build, run and test are in [DEVELOPMENT.md](../DEVELOPMENT.md). The pitfall numbers (P8, P13, …) refer to [ref-similar-plugins.md](study/ref-similar-plugins.md#7-pitfalls) section 7.

## 1. How the plugin is packaged

- **`dsh.bundle.patch`** names `cordis.patch.yml`, which inserts only this plugin's own row. Rules for the patch:
  - Never insert a service the base bundle already mounts (P8), such as `@deepseek-ai/dsh-authorization` (in `dsh-base`'s `cordis.patch.yml`, checked on 0.2.2-rc.1).
  - Never turn off the shared `llm-pi-ai` row (P13), and never patch a row that DSH ships.
  - A matching override replaces a row's whole `config`, never merging it (P20). If a row of DSH's ever has to be patched, restate every field and add a `name` guard, so a renamed row warns instead of being patched by mistake (as `dsh-copilot-auth` does).
- **`engines.dsh`** decides compatibility: `>=0.2.2-rc.1 <0.3.0-0` (section 2). The dev dependencies `@deepseek-ai/dsh-llm` and `@deepseek-ai/dsh-llm-pi-ai` are pinned to `0.2.2-rc.1`; move them together with the DSH you run.
- **`dsh.client`** declares the browser half. DSH serves `exports["./client"]`, `lib/client.js`, whose module id must equal the package name, and attaches it only to the row named by the bare package name. `dsh.client.inject` lists the client plugins that must load first.
- **`exports`** also carries `./locale/*.json` (`meta.title`, `meta.description`) for the Plugins page, and `files` lists everything a packed tarball must contain. An icon would add `./icon` to both; there is none yet (section 4). Test this surface (P31).
- **Config:** the plugin's own fields ([login.md](design/login.md) A1, [models.md](design/models.md) A5). Live-editable fields are `.volatile()`. Secrets are credential references, never plain config.
- **Peers.** A package DSH must share with the plugin goes in `peerDependencies`, and at its exact DSH version in `devDependencies`: DSH supplies it at run time, and the dev copy serves the type checker and the unit tests. The peers are `@deepseek-ai/schemastery`, and for the Models adapter `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-llm-pi-ai` and `@earendil-works/pi-ai`. DSH resolves a linked plugin's import of a name its manifest lists as a peer to DSH's own copy (models.md B1); on web-dev, the models state reported the three adapter peers under DSH's install, not under this folder's `node_modules` (2026-11-03). The Login Host still declares the DSH services it uses as small local interfaces (`src/host/ports.ts`, `src/host/context.ts`).
- **The build** (`scripts/build.mjs`, esbuild) writes the Host as an ES module that imports only its peers and their subpaths and Node built-ins, and the Card as a CommonJS factory in `window.__ModuleLoader__.load({ id, factory })` that requires only `react`. It fails if either imports anything else. Every `@deepseek-ai/*` and `@earendil-works/*` import stays external, so a dev copy is never bundled by mistake.
- **Distribution** is not decided. The guide's options: publish to npm with `lib/` built, ship a `pnpm pack` tarball, or install from GitHub with a `prepare` script, which pnpm only runs once it is allowed in the profile's `pnpm-workspace.yaml`. What the reference repos do: committed `lib/` for `github:` installs (`dsh-llm-github-copilot`, `dsh-copilot-auth`, `dsh-plugin-copilot`; the first has a test that `lib/` equals the build of `src/` byte for byte), a `prepare` script (`dsh-plugin-subscriptions`), or a built tarball on npm or a GitHub Release (`dsh-copilot-catalog`, `dsh-github-copilot`).

## 2. Compatibility

**How DSH checks** (`evaluatePluginCompatibility` in `@deepseek-ai/dsh-app-boot`; read and run on 0.2.1-rc.2, still present in 0.2.2-rc.1):

- DSH checks every plugin at profile load and at install. A refused plugin can still be installed with `dsh plugin allow-version`.
- If top-level `engines.dsh` is present, it **alone** decides and peers are ignored. Otherwise every `@deepseek-ai/dsh` and `@deepseek-ai/dsh-*` peer must match.
- Prereleases count in ranges, so `0.2.3-alpha.1` matches `>=0.2.2-rc.1 <0.3.0-0`.
- A nested `dsh.engines` is **not read** (P24). `dsh-package-manifest`'s README calls compatibility "declarative"; the code enforces it.
- Tested on rc.2 with sample manifests: an exact `"0.2.1-rc.2"` fails on rc.4, `>=0.2.0-rc.1` passes, and a peer of `^0.1.7-rc.1` fails on 0.2.1-rc.2.

**Policy** since 2026-11-06: the range `>=0.2.2-rc.1 <0.3.0-0` in top-level `engines.dsh`, with the same range on the `dsh-llm` and `dsh-llm-pi-ai` peers. It starts at the version the type checker and the contract tests use, and replaced an exact pin on `0.2.1-rc.5`, which made DSH 0.2.2-rc.1 skip the plugin. The Models adapter depends on DSH internals ([models.md](design/models.md) B6), so a release inside the range can still break it: run the contract tests ([DEVELOPMENT.md](../DEVELOPMENT.md#5-build-and-test) section 5) on each new DSH before relying on it. The options considered:

| Policy | Used by | Effect |
|---|---|---|
| Exact pin | `dsh-github-copilot`, `dsh-copilot-catalog` | Safe, but blocks the plugin on every DSH release |
| Explicit list in peers | `dsh-plugin-subscriptions` | A plugin release for each DSH prerelease |
| Range in peers, no `engines.dsh` | `dsh-llm-github-copilot`, `dsh-plugin-copilot` | Enforced only through peers |
| Range in `engines.dsh` (ours) | `dsh-copilot-api`, `dsh-model-usage`, `dsh-commandcode-provider` (two ranges) | Forward-compatible, but untested versions can load and break |
| Nested `dsh.engines` | Some published plugins | Silently ignored. Do not use |

Budget one migration per DSH release whatever the policy: DSH published 39 versions between 2026-08-10 and 2026-10-27, and every reference repo records breakage per prerelease. `dsh-llm-github-copilot` keeps its claim accurate with a CI matrix of packed-install smoke tests on exact RCs; `dsh-github-copilot` with per-Core release lines and a verified `deployment-baseline.json` (134 KB).

**DSH contact surface to re-check at each release:** `authorization.begin/cancel/describe`, `credentials` record operations and the `credentials/record-updated` event, `connection.fetch.register`, `llm.registerAdapter` and `registration.replace()`, `PiAiAdapter`, the Card slot, and the record key `llm-pi-ai/github-copilot`.

## 3. Package shape

Open: one package, or a second one for web search ([search.md](design/search.md)) so it can be removed on its own? A search row that patches the shared `web` row replaces its whole config (P14, P20). The official note: a sub-plugin whose page must outlive the other rows ships as its own package. `dsh-copilot-catalog` splits into three packages for independent versions and manifests, though all three pin the same DSH.

## 4. Name, licence and icon

- **Name:** see [overview.md](design/overview.md#names). Other npm names, checked 2026-10-28: taken `dsh-copilot`, `dsh-github-copilot`, `dsh-oauth-copilot`, `dsh-copilot-api`, `dsh-copilot-catalog`, `dsh-copilot-search`, `dsh-copilot-tool-schema`, `dsh-github-copilot-accounts`; free then `dsh-llm-github-copilot`, `dsh-provider-copilot`, `dsh-plugin-copilot`, `dsh-copilot-provider`, `dsh-copilot-auth`, `dsh-copilot-oauth`.
- **Licence:** MIT, decided on 2026-11-08: `LICENSE` with `Copyright (c) 2026 dsh-github-copilot-models contributors`, `"license": "MIT"`, and a README line saying the plugin is not affiliated with GitHub, Microsoft or DeepSeek. npm packs `LICENSE` whatever `files` says. DSH sets no licence rule for plugins; DSH itself is MIT, and its brand guidelines ask for "DSH" rather than the full "DeepSeek Harness" trademark in project names.
- **Copying:** `dsh-plugin-copilot` has no LICENSE file (its `package.json` declares MIT): reuse no code, tests, locale strings or docs from it. The other reference repos are MIT; copying substantial code means keeping their notice, so prefer re-implementing the pattern.
- **Icon:** none since 2026-11-08 ([todo.md](todo.md)); the Plugins page shows DSH's default artwork. The official skill asks for an original icon, or artwork whose licence allows redistribution (SVG, PNG, JPEG or WebP, 256 KiB at most). Use no GitHub or Copilot logo; display names use "GitHub Copilot" only to say what the plugin connects to.

## 5. Where this differs from the official guide

Compared on 2026-11-02 with the [plugin guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/), the [reference cookbooks](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-settings-card), the `cordis-plugin-development` skill shipped with DSH, and the README of DSH's Plugins page (`dsh-client-ui-plugin-manager`).

**Same as the guide:** a bundle with `dsh.bundle.patch` that inserts its own row; a profile made with `--from-default-profile`; the checkout installed with `dsh plugin add`, which links it and appends the bundle; `--dump-config` to check the layer; `engines.dsh`; shared packages as both peer and dev dependency; `Config` as a Schemastery schema with a `.volatile()` field; registrations as effects; optional services read with `ctx.get()` where they are used; `locale/*.json` in `exports` and `files`, checked on the Plugins page after installing; a browser half in the lazy-CJS factory format, with its text in `ctx.locale`.

**Different from the guide:**

| Topic | Official guide | Here | Why |
|---|---|---|---|
| Where the settings page lives | A third-party bundle registers its configuration on the **Plugins** page: `plugins.bundle.config` (the bundle's page) or `plugins.row.config` (a **Configure** control on its row). Settings is for DSH's own pages. | Its own section in **Settings** (`settings.section`) | Not a choice made against the guide: it came from the reference plugins (three of the seven use `settings.section`). **Open:** see [ui.md](design/ui.md#u1-card-location) U1, which also lists the Models page. |
| Where DSH runs from | First-plugin tutorial: a clone of the DSH repository, run with `pnpm dsh`. The publish tutorial assumes the installed CLI | The published DSH, run with `npx @deepseek-ai/dsh` | The plugin targets the version users run, as in the publish tutorial. |
| First run of a plugin | A `--patch` overlay that names the `.ts` file | Straight to an installed bundle | The plugin has a browser half, and DSH attaches a browser half only to a row named by the package (cookbook, section 5). An overlay row cannot carry it. |
| Profile | `--profile demo`, made by `dsh plugin add` on first use, with `dsh-base` only | Your own profile with a local link, or `web-dev`, made from the `web` template ([DEVELOPMENT.md](../DEVELOPMENT.md#3-profiles) section 3) | We need the Web UI and the same plugins as the profile users run. |
| Building the browser half | DSH's `clientBundle` tsdown preset, which is not published; the cookbook says a package outside the DSH repository reproduces that build itself | Our own esbuild script (`scripts/build.mjs`) | That is the case the cookbook describes. The script writes the same wrapper and fails on any import other than `react`. |
| Types of DSH services | Import `Context` and service types from DSH packages | Login: small local interfaces (`src/host/ports.ts`, `src/host/context.ts`, and in `src/client/index.tsx`). Models: the real types of its three peers | Login needs few members. The cost: the compiler does not notice when DSH changes a signature; the contract tests do. The Models adapter is DSH's own `PiAiAdapter`, so it imports DSH's packages as peers. |
| Page ↔ Host calls | The API gateway reference: a Host service marks methods `@Remote`, and the page calls them as `ctx.remote.<namespace>`. Exact Fetch routes are for responses outside the RPC envelope | Eleven exact Fetch routes under `/api/github-copilot-models/` (login.md A10, models.md A11), with JSON bodies | Not tried. The reference describes `@Remote` together with DSH's Typert build, which generates the page-side methods; we did not check whether a package outside the DSH repository can use it without that build. No reference plugin uses it, and dsh-plugin-subscriptions uses exact routes too. Exact routes get the same trust check and browser sign-in as the rest of `/api`. |
| `engines.dsh` | A range, for example `>=0.2.0 <0.3.0` | `>=0.2.2-rc.1 <0.3.0-0` | The Models adapter depends on DSH internals (models.md B6). |
| Agent tool | The skill: expose each page operation to the agent too, as a tool over the same Host method; an action that grants authority stays user-only | No tool yet, for Login or Models (decided on 2026-11-03) | Sign-in, PAT and sign-out grant or remove access, so they stay user-only. Custom headers can replace `Authorization`, so a headers tool would grant authority too. A read-only status tool is planned ([command.md](design/command.md)); tools for model toggles and sizes are possible later. |
| Installing | The skill: an agent installs with its `plugin_manager` tool; the guide: `dsh plugin add` | `dsh plugin add` | The guide's way. The agent's tool installs only into the agent's own profile, and refuses a package that is already installed ([DEVELOPMENT.md](../DEVELOPMENT.md#3-profiles) section 3). |
| Icon | The skill: an original icon, or artwork whose licence allows redistribution, exported as `./icon` | None yet | Not designed; the first one was removed on 2026-11-08. The Plugins page shows DSH's default artwork meanwhile ([todo.md](todo.md)). |
| Reload after a change | HMR reloads a plugin when its file changes (needs `root` set); `pnpm run dev:web` in a DSH checkout also rebuilds browser halves | Card: DSH picks up `lib/client.js` by itself. Host: stop `web-dev`, rebuild, start it | The base bundle runs HMR with `root: []` (no source watching), so a rebuild alone does not reload the Host. But HMR also watches the profile's patch file, and a change there reloads a plugin whose built file changed ([DEVELOPMENT.md](../DEVELOPMENT.md#4-run-web-dev) section 4). The skill also says replacing a package's code needs a restart. |

**Not done yet** (the guide or skill asks for it): a decision on distribution (npm, tarball, or GitHub with a `prepare` script), and an icon. The packed file list was checked on 2026-11-08 with `npm pack --dry-run`: `LICENSE`, `README.md`, `cordis.patch.yml`, `lib/client.js`, `lib/index.js`, the eight locale files and `package.json`, nothing else. npm adds `LICENSE` and `README.md` whatever `files` says.
