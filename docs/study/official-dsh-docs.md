# Official DSH plugin docs

Where DSH's own plugin documentation is, and a digest of its rules. Read on DSH 0.2.1-rc.2 (2026-10-28 to 2026-10-30); not re-checked since. How this plugin applies them is in [packaging.md](../packaging.md); the pitfall numbers refer to [ref-similar-plugins.md](ref-similar-plugins.md#7-pitfalls) section 7.

## 1. Where the docs are

**Shipped with DSH**, under `node_modules/@deepseek-ai/` of the DSH install (with `npx`: `<npm cache>/_npx/<hash>/node_modules/@deepseek-ai`). Read in this order:

| # | Path | Learn |
|---|---|---|
| 1 | `dsh-agent-preset/skills/cordis-plugin-development/SKILL.md` | The official authoring loop, and where to look things up |
| 2 | same folder, `references/host-plugin.md` | Bundle manifest, patch, exports, display metadata and icon, install and observe |
| 3 | same folder, `references/practices.md` | Rules for stable, performant plugins (effects, extension points, UI) |
| 4 | same folder, `references/ui-plugin.md`, `user-actions.md`, `verification.md` (rc.5 also has `mcp-bundle.md`) | Client module, slots, operations shared by UI and tools, how to verify |
| 5 | `dsh-llm/README.md` | The model-call service and the adapter contract |
| 6 | `dsh-llm-pi-ai/README.md` | "Configure provider routes", "Sign in to a provider", "Resolve the model catalog", "Known Limitations" |
| 7 | `dsh-authorization/README.md`, `dsh-credentials/README.md` | Sign-in flows and credential records |
| 8 | `dsh-web/README.md` | Search provider selection |
| 9 | `dsh-client-ui-settings-models/README.md` | What the Models page already does, including the `settings.models.sign-in` slot |
| 10 | `dsh-package-manifest/README.md`, `dsh-plugin-manager/README.md`, `dsh-base/cordis.patch.yml` | Manifest fields, install behaviour, what the base bundle already mounts |
| 11 | `dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/` | A UI plugin template to copy |

The skill relies on the `cordis_inspect_list`, `cordis_inspect_query` and `plugin_manager` tools, which exist only in DSH's Creator mode. Elsewhere, read the package READMEs and `lib/types/**/*.d.ts`; installed packages ship `lib/` only, not `src/`.

**Public repo `deepseek-ai/deepseek-harness`, folder `docs/`.** Read: `cookbook/adding-an-llm-adapter.md`, `cookbook/adding-a-settings-card.md`, `defensive-patterns/package-surface.md`, `upgrade-guide/v0.2.1-rc.4/model-listing-refresh/guide.md` (DeepSeek routes and `ModelListingCache`; no effect unless the plugin uses that cache). Not read yet: `cordis-tutorial/`, the other `defensive-patterns/` and `cookbook/` pages, `testing.md`, `development.md`, `cordis-primer.md`, `capability-seams.md`, and the other upgrade guides from `v0.2.0-rc.2` on. The installed Cordis README links `docs/tutorials/build-a-plugin.md`, which is not in the public repo; it has `docs/cordis-tutorial/` instead.

## 2. Digest

- A **bundle** is a package whose `package.json` has `dsh.bundle.patch`. The YAML patch inserts rows `{ id, name, config }`. A matching override **replaces the whole `config`**, never merging it (P20).
- A function plugin exports `name`, `inject`, `Config` and `apply`. A service plugin default-exports a class. Do not mix the two forms or add other exports to the entry. No top-level `await` in package modules.
- Register everything inside `apply` through `ctx.effect` or `ctx.on`, and return the cleanup.
- Config uses schemastery. Mark live-editable fields `.volatile()` and read `.get()` once per operation.
- **Client half:** `dsh.client` in `package.json` and a `./client` export: a CJS bundle wrapped in `window.__ModuleLoader__.load({ id, factory })`, whose `id` equals the package name. React comes from the host module table. Use the host theme tokens (`--dsw-alias-*`); never import `dsh-client-ui-primitives`; no iframe.
- **LLM adapter:** extend `LlmAdapter`, implement `stream`, and register with `ctx.llm.registerAdapter([route], adapter)`. A route has one owner; a duplicate fails with `DUPLICATE_ADAPTER`. Emit `usage` before `finish` and nothing after. Tool arguments are raw JSON strings. Honour the abort signal. Use `LlmError` with stable codes. For the GUI, `listModels` must return the models.
- **Sign-in flow:** `ctx.authorization.registerFlow({ key: '<scope>/<id>', … })`. The flow must commit its record through `ctx.credentials` before it resolves. A sign-in lives only in the process that started it.
- **Search:** `ctx.web.registerSearchProvider(provider)`. DSH selects a provider by the `searchProvider` setting, or automatically when exactly one usable provider exists.
- **Install:** through `plugin_manager install_bundle`, or `dsh plugin --profile <name> add <target>`. A new bundle can go live through HMR. Replacing an installed package needs a restart.
