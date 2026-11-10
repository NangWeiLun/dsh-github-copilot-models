# Packaging

This document describes how the plugin is packaged, distributed and kept compatible with DeepSeek Harness (DSH), and where it departs from DSH's official guide, [Package and install a plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish). Build, run and test procedures are in [DEVELOPMENT.md](../DEVELOPMENT.md), and open items in [todo.md](todo.md). Pitfall identifiers (P8, P13, …) refer to [ref-similar-plugins.md](study/ref-similar-plugins.md#7-pitfalls), section 7.

## 1. How the plugin is packaged

The plugin is a DSH bundle: an npm package whose manifest declares a bundle patch and a browser half in addition to its entry points.

### Bundle patch

`dsh.bundle.patch` names `cordis.patch.yml`, which inserts one row, `github-copilot-models`, into the profile. The patch must not:

- insert a service that the base bundle already mounts, such as `@deepseek-ai/dsh-authorization` from `dsh-base` (P8);
- turn off the shared `llm-pi-ai` row (P13), or patch any other row that DSH ships.

A matching override replaces a row's whole `config` instead of merging it (P20). If a DSH row ever has to be patched, the patch must restate every field and carry a `name` guard, so that a renamed row produces a warning instead of being patched by mistake.

### Entry points and packed files

| Manifest field | Content |
|---|---|
| `exports["."]` | The Host, `lib/index.js` |
| `exports["./client"]` | The browser half (the Card), `lib/client.js` |
| `exports["./locale/*.json"]` | The title and description shown on the Plugins page (`meta.title`, `meta.description`) |
| `dsh.client` | Declares the browser half; `inject` lists the client plugins that must load first |
| `files` | `lib/index.js`, `lib/client.js`, `cordis.patch.yml` and `locale/*.json` |

- DSH attaches the browser half only to the row named by the bare package name, and the module id in `lib/client.js` must equal the package name.
- npm also packs `package.json`, `README.md` and `LICENSE`: 14 files in all. Every path in `exports` must be packed (P31); check with `npm pack --dry-run` before each release.
- An icon, when added, goes into both `exports` (as `./icon`) and `files` (section 4).

### Dependencies

- Packages that DSH shares with the plugin are declared in `peerDependencies`, and at their exact DSH version in `devDependencies`. DSH supplies them at run time; the development copies serve the type checker and the unit tests.
- The peers are `@deepseek-ai/schemastery` and, for the Models adapter, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-llm-pi-ai` and `@earendil-works/pi-ai`.
- For a linked plugin, DSH resolves imports of declared peers to its own copies ([models.md](design/models.md) B1). This was confirmed on `web-dev`.
- The development versions of `@deepseek-ai/dsh-llm` and `@deepseek-ai/dsh-llm-pi-ai` (currently `0.2.2-rc.1`) move together with the DSH version in use.
- The Login Host does not import DSH's service types. It declares the services it uses as small local interfaces in `src/host/ports.ts` and `src/host/context.ts` (section 5).

### Build

`scripts/build.mjs` (esbuild) writes:

- `lib/index.js`, the Host: an ES module that imports only its peers, their subpaths and Node built-ins;
- `lib/client.js`, the Card: a CommonJS factory registered through `window.__ModuleLoader__.load({ id, factory })`, which requires only `react`.

The build fails on any other import. Every `@deepseek-ai/*` and `@earendil-works/*` import stays external, so a development copy is never bundled.

### Configuration

The plugin's `Config` holds only its own fields ([login.md](design/login.md) A1, [models.md](design/models.md) A5). Fields that can change while the plugin runs are marked `.volatile()`. Secrets are stored as credential references, never as plain configuration.

### Distribution

The plugin is distributed on npm as `dsh-github-copilot-models`, an unscoped public package. The [README](../README.md) gives the install command.

- `lib/` is not committed. `prepack` builds it into the tarball, and `prepublishOnly` runs `npm run check` before every publish.
- Releases are published manually, with npm two-factor authentication. Publishing from GitHub Actions through [trusted publishing](https://docs.npmjs.com/trusted-publishers) becomes possible once the package exists on npm.

Options considered:

| Option | Used by |
|---|---|
| **A built tarball on npm (chosen)**, or a `pnpm pack` tarball such as a GitHub Release asset | `dsh-copilot-catalog`, `dsh-github-copilot` |
| A GitHub install with `lib/` committed | `dsh-llm-github-copilot` (with a test that `lib/` equals the build of `src/`), `dsh-copilot-auth`, `dsh-plugin-copilot` |
| A GitHub install with a `prepare` script, which pnpm runs only once the profile's `pnpm-workspace.yaml` allows it | `dsh-plugin-subscriptions` |

## 2. Compatibility

### How DSH checks compatibility

DSH checks each plugin when a profile loads and when the plugin is installed (`evaluatePluginCompatibility` in `@deepseek-ai/dsh-app-boot`; examined and tested on DSH 0.2.1-rc.2, still present in 0.2.2-rc.1):

- A top-level `engines.dsh`, when present, decides alone; the peers are then ignored.
- Without it, every `@deepseek-ai/dsh` and `@deepseek-ai/dsh-*` peer range must match.
- Ranges include prereleases: `0.2.3-alpha.1` satisfies `>=0.2.2-rc.1 <0.3.0-0`.
- A nested `dsh.engines` field is not read (P24).
- The check is enforced, although the README of `dsh-package-manifest` calls compatibility "declarative". A refused plugin can still be installed with `dsh plugin allow-version`.

### Policy

- `engines.dsh` is `>=0.2.2-rc.1 <0.3.0-0`, and the `@deepseek-ai/dsh-llm` and `@deepseek-ai/dsh-llm-pi-ai` peers declare the same range.
- The lower bound is the DSH version that the type checker and the contract tests use. The upper bound, `<0.3.0-0`, also excludes the prereleases of 0.3.0.
- The range admits DSH versions that have not been tested. The Models adapter depends on DSH internals ([models.md](design/models.md) B6), so a release within the range can still break the plugin. Run the contract tests ([DEVELOPMENT.md](../DEVELOPMENT.md#5-build-and-test), section 5) on each new DSH release before relying on it.
- Whatever the policy, plan for one migration per DSH release: DSH published 39 versions between 2026-08-10 and 2026-10-27. A CI matrix of packed-install tests on released DSH versions is planned ([todo.md](todo.md)).

Policies considered:

| Policy | Effect | Used by |
|---|---|---|
| Exact version pin | Safe, but blocks the plugin on every new DSH release | `dsh-github-copilot`, `dsh-copilot-catalog` |
| Explicit version list in the peers | Needs a plugin release for each DSH prerelease | `dsh-plugin-subscriptions` |
| Range in the peers, no `engines.dsh` | Enforced only through the peers | `dsh-llm-github-copilot`, `dsh-plugin-copilot` |
| **Range in `engines.dsh` (chosen)** | Forward-compatible, but untested versions can load and break | `dsh-copilot-api`, `dsh-model-usage`, `dsh-commandcode-provider` (two ranges) |
| Nested `dsh.engines` | Ignored by DSH; do not use | Some published plugins |

### DSH interfaces to re-check on each release

- `authorization.begin`, `cancel` and `describe`
- `credentials` record operations and the `credentials/record-updated` event
- `connection.fetch.register`
- `llm.registerAdapter` and `registration.replace()`
- `PiAiAdapter`
- the Card slot
- the credential record key `llm-pi-ai/github-copilot`

## 3. Package shape

The plugin ships as one package. Open question: should web search ([search.md](design/search.md)) become a second package, so that it can be removed on its own?

- A search row that patches DSH's shared `web` row replaces that row's whole configuration (P14, P20).
- DSH's guidance: a sub-plugin whose page must outlive the other rows ships as its own package.
- `dsh-copilot-catalog` is split into three packages for independent versions and manifests, although all three pin the same DSH version.

## 4. Name, licence and icon

- **Name:** `dsh-github-copilot-models`, for both the repository and the npm package ([overview.md](design/overview.md#names)).
- **Licence:** MIT. `LICENSE` reads "Copyright (c) 2026 dsh-github-copilot-models contributors", `package.json` declares `"license": "MIT"`, and the README states that the plugin is not affiliated with GitHub, Microsoft or DeepSeek. npm packs `LICENSE` regardless of `files`. DSH sets no licence rule for plugins and is itself MIT-licensed.
- **Trademarks:** DSH's brand guidelines ask for "DSH" rather than the full "DeepSeek Harness" trademark in project names. The plugin uses no GitHub or Copilot logo, and its display names use "GitHub Copilot" only to say what it connects to.
- **Code from other plugins:** `dsh-plugin-copilot` has no LICENSE file (its `package.json` declares MIT), so none of its code, tests, locale strings or documentation may be reused. The other reference plugins are MIT-licensed; copying substantial code from them requires keeping their notice, so re-implementing a pattern is preferred.
- **Icon:** none yet; the Plugins page shows DSH's default artwork. DSH's plugin skill asks for an original icon, or artwork whose licence allows redistribution, in SVG, PNG, JPEG or WebP and at most 256 KiB.

## 5. Differences from the official guide

Compared on 2026-11-02 with the [plugin guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/), the [reference cookbooks](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-settings-card), the `cordis-plugin-development` skill shipped with DSH, and the README of DSH's Plugins page (`dsh-client-ui-plugin-manager`).

Everything not listed below follows the guide, including the bundle patch, `engines.dsh`, shared packages as peer and development dependencies, a Schemastery `Config`, registrations as effects, `ctx.get()` for optional services, `locale/*.json` in `exports` and `files`, a lazy CommonJS browser half with its text in `ctx.locale`, and the `--from-default-profile`, `dsh plugin add` and `--dump-config` commands.

### Plugin design

| Topic | Official guide | This plugin | Reason |
|---|---|---|---|
| Settings location | The Plugins page: `plugins.bundle.config` (the bundle's page) or `plugins.row.config` (a **Configure** control on its row). Settings is for DSH's own pages | A section in **Settings** (`settings.section`) | Adopted from the reference plugins (three of seven use `settings.section`), not chosen against the guide. Open: [ui.md](design/ui.md#u1-card-location) U1, which also considers DSH's Models page |
| Browser-half build | DSH's `clientBundle` tsdown preset, which is not published; a package outside the DSH repository reproduces the build itself | An esbuild script, `scripts/build.mjs` | The case the cookbook describes. The script writes the same wrapper and fails on any import other than `react` |
| DSH service types | Imported from DSH packages | Login: small local interfaces (`src/host/ports.ts`, `src/host/context.ts`, `src/client/index.tsx`). Models: the real types of its three peers | Login uses few members; the contract tests, not the compiler, catch a changed DSH signature. The Models adapter is DSH's own `PiAiAdapter`, so it imports DSH's packages as peers |
| Page–Host calls | Host methods marked `@Remote`, called from the page as `ctx.remote.<namespace>`; exact Fetch routes for responses outside the RPC envelope | Eleven exact Fetch routes under `/api/github-copilot-models/`, with JSON bodies ([login.md](design/login.md) A10, [models.md](design/models.md) A11) | The reference pairs `@Remote` with DSH's Typert build, which generates the page-side methods; its use outside the DSH repository was not tested, and no reference plugin uses it. Exact routes get the same trust check and browser sign-in as the rest of `/api` |
| `engines.dsh` | A range, for example `>=0.2.0 <0.3.0` | `>=0.2.2-rc.1 <0.3.0-0` | The Models adapter depends on DSH internals, so the range starts at the tested version (section 2) |
| Agent tools | Expose each page operation as an agent tool over the same Host method; actions that grant authority stay user-only | None yet, for Login or Models | Sign-in, PAT and sign-out grant or remove access. Custom headers can replace `Authorization`, so a headers tool would grant authority too. A read-only status tool is planned ([command.md](design/command.md)); tools for model toggles and sizes may follow |
| Icon | An original icon, or redistributable artwork, exported as `./icon` | None yet | Not designed (section 4) |

### Development workflow

| Topic | Official guide | This plugin | Reason |
|---|---|---|---|
| DSH used for testing | First-plugin tutorial: a clone of the DSH repository, run with `pnpm dsh`. Publish tutorial: the installed CLI | The published DSH, run with `npx @deepseek-ai/dsh` | Targets the version users run, as the publish tutorial does |
| First run | A `--patch` overlay that names the `.ts` file | An installed bundle | DSH attaches a browser half only to a row named by the package (cookbook, section 5); an overlay row cannot carry one |
| Profile | `--profile demo`, created by `dsh plugin add` on first use, with `dsh-base` only | The developer's own profile with a local link, or `web-dev`, created from the `web` template ([DEVELOPMENT.md](../DEVELOPMENT.md#3-profiles), section 3) | Testing needs the Web UI and the same plugins as the profiles users run |
| Installation | The skill: the agent's `plugin_manager` tool. The guide: `dsh plugin add` | `dsh plugin add` | The agent's tool installs only into the agent's own profile and refuses a package that is already installed (DEVELOPMENT.md, section 3) |
| Reload after a change | HMR reloads a plugin when its files change (with `root` set); `pnpm run dev:web` in a DSH checkout also rebuilds browser halves | Card: DSH picks up a rebuilt `lib/client.js` by itself. Host: stop `web-dev`, rebuild, start it | The base bundle runs HMR with `root: []`, so a rebuild alone does not reload the Host; a later change to the profile's patch file does ([DEVELOPMENT.md](../DEVELOPMENT.md#4-run-web-dev), section 4). The skill also requires a restart when a package's code is replaced |

## 6. Decision record

| Date | Decision |
|---|---|
| 2026-11-03 | No agent tools for Login or Models yet (section 5) |
| 2026-11-06 | `engines.dsh` became the range `>=0.2.2-rc.1 <0.3.0-0`. It replaced an exact pin on `0.2.1-rc.5`, which made DSH 0.2.2-rc.1 skip the plugin |
| 2026-11-08 | MIT licence; the first icon was removed |
| 2026-11-10 | npm chosen for distribution |
