# Reference plugins

Snapshot of the reference plugins at the commits listed in section 1, taken between 2026-10-28 and 2026-10-30 against DSH 0.2.1-rc.2 and pi-ai 1.3.0.

Six of the DSH plugins for GitHub Copilot found by [scan-similar-plugins.md](scan-similar-plugins.md) were read for this project, plus `dsh-commandcode-provider`, a DSH provider plugin for Command Code (not GitHub Copilot), read for its settings pattern and search structure. Items marked [code] were read in the source at the commit listed; they were not independently re-checked.

Evidence labels: **[code]** read in source, not run. **[doc]** a README, ADR, changelog or comment says so. **[reported]** a third party says so.

## 1. The repos

| Project | Repository | Version read | Commit read | Licence | Role |
|---|---|---|---|---|---|
| dsh-plugin-subscriptions | [V1ki/dsh-plugin-subscriptions](https://github.com/V1ki/dsh-plugin-subscriptions) | 0.9.11 | `7639ed9` (2026-10-26) | MIT | Own route and adapter |
| dsh-llm-github-copilot | [lujianjun19/dsh-llm-github-copilot](https://github.com/lujianjun19/dsh-llm-github-copilot) | 0.4.11 | `894d38d` (2026-10-24) | MIT | Credential provider for the built-in route, with its decisions recorded in ADRs |
| dsh-copilot-auth | [iasiv5/dsh-copilot-auth](https://github.com/iasiv5/dsh-copilot-auth) | 1.2.23 | `1d2d6eb` (2026-10-26) | MIT | Preset route and model-list management |
| dsh-plugin-copilot | [HuanLinOTO/dsh-plugin-copilot](https://github.com/HuanLinOTO/dsh-plugin-copilot) | 0.3.1 | `f939770` (2026-10-17) | No LICENSE file; `package.json` declares MIT | Sign-in card and route autofill |
| dsh-copilot-catalog | [1yefuwang1/dsh-copilot-catalog](https://github.com/1yefuwang1/dsh-copilot-catalog) | dsh-copilot-catalog 0.2.8, dsh-copilot-search 0.1.4, dsh-copilot-tool-schema 0.1.2 | `816ec17` (2026-10-24) | MIT | Monorepo: account-aware model list, Copilot search, a tool-schema fix, and an unrelated worktrees package |
| dsh-github-copilot | [cloga/dsh-github-copilot](https://github.com/cloga/dsh-github-copilot) | 0.1.0-alpha.5.dsh.0.2.1.rc.3 | `cb6bccb` (2026-10-25) | MIT | Accounts, usage, compaction, search and its own route |
| dsh-commandcode-provider | [Mars-Sea/dsh-commandcode-provider](https://github.com/Mars-Sea/dsh-commandcode-provider) | 0.16.0 | `79147b2` (2026-10-30) | MIT, with a NOTICE | Command Code provider, not a Copilot plugin. Settings pattern and search structure |

Versions are the ones in each repository's `package.json` at the commit read. npm and repository links for the six Copilot plugins are in [scan-similar-plugins.md](scan-similar-plugins.md).

dsh-plugin-copilot has no LICENSE file; its `package.json` declares MIT. This project uses no code from it.

**Where to look in each repo** (links are pinned to the commit read):
- **dsh-plugin-subscriptions:** [`src/providers/copilot.ts`](https://github.com/V1ki/dsh-plugin-subscriptions/blob/7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d/src/providers/copilot.ts) (46 KB: constants, device flow, token exchange, headers, `latestVsCodeVersion`, `fetchCopilotModels`, `copilotWireFor`, `copilotRequestWire`, request bodies, `CopilotResponsesItemNormalizer`, `CopilotAdapter`), [`src/auth/device-flow.ts`](https://github.com/V1ki/dsh-plugin-subscriptions/blob/7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d/src/auth/device-flow.ts), [`src/index.ts`](https://github.com/V1ki/dsh-plugin-subscriptions/blob/7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d/src/index.ts), [`src/compat.ts`](https://github.com/V1ki/dsh-plugin-subscriptions/blob/7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d/src/compat.ts) (P10), [`test/copilot.spec.ts`](https://github.com/V1ki/dsh-plugin-subscriptions/blob/7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d/test/copilot.spec.ts), [`scripts/manual/real-copilot-replay-probe.mjs`](https://github.com/V1ki/dsh-plugin-subscriptions/blob/7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d/scripts/manual/real-copilot-replay-probe.mjs). Its Codex, Claude, Grok and Antigravity providers were not read.
- **dsh-llm-github-copilot:** [`docs/adr/0002-narrow-to-credential-provider.md`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/docs/adr/0002-narrow-to-credential-provider.md), the [README](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/README.md#selecting-a-model) section "Selecting a model", the [CHANGELOG](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/CHANGELOG.md) entries 0.4.1, 0.4.7 and 0.4.8 (bug fixes), [`docs/issues/github-copilot-model-list-refresh.md`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/docs/issues/github-copilot-model-list-refresh.md), [`src/host/10-config-resolution.js`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/src/host/10-config-resolution.js), [`src/host/11-device-flow.js`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/src/host/11-device-flow.js), [`src/host/12-apply.js`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/src/host/12-apply.js), [`docs/dsh-v0.2.1-rc.3-compatibility-analysis.md`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/docs/dsh-v0.2.1-rc.3-compatibility-analysis.md), [`tests/credential-handoff.test.mjs`](https://github.com/lujianjun19/dsh-llm-github-copilot/blob/894d38dee71a8d98bded3312f66c61bab2422c0f/tests/credential-handoff.test.mjs).
- **dsh-copilot-auth** (patches the model catalog; its ADRs 0001 and 0004 explain the trade-offs; docs in Chinese): [`cordis.patch.yml`](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/cordis.patch.yml), the [README](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/README.md) section 版本兼容, [`docs/adr/0001-data-level-catalog-patch.md`](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/docs/adr/0001-data-level-catalog-patch.md), [`docs/adr/0004-safe-model-management-and-profile-isolation.md`](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/docs/adr/0004-safe-model-management-and-profile-isolation.md), [`src/auth-flow.mjs`](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/src/auth-flow.mjs), [`src/auth-host.mjs`](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/src/auth-host.mjs), [`src/copilot-models.mjs`](https://github.com/iasiv5/dsh-copilot-auth/blob/1d2d6eb3521f19b69019cb1335b39dd380db082b/src/copilot-models.mjs).
- **dsh-plugin-copilot:** [`src/gateway.ts`](https://github.com/HuanLinOTO/dsh-plugin-copilot/blob/f939770dc849c46baabc92d2ac74370c6c887e50/src/gateway.ts), [`src/status.ts`](https://github.com/HuanLinOTO/dsh-plugin-copilot/blob/f939770dc849c46baabc92d2ac74370c6c887e50/src/status.ts), [`src/client/CopilotAuthCard.tsx`](https://github.com/HuanLinOTO/dsh-plugin-copilot/blob/f939770dc849c46baabc92d2ac74370c6c887e50/src/client/CopilotAuthCard.tsx), [`src/client/controller.ts`](https://github.com/HuanLinOTO/dsh-plugin-copilot/blob/f939770dc849c46baabc92d2ac74370c6c887e50/src/client/controller.ts), and the per-release migration plans in [`docs/plans/`](https://github.com/HuanLinOTO/dsh-plugin-copilot/tree/f939770dc849c46baabc92d2ac74370c6c887e50/docs/plans) (P11).
- **dsh-copilot-catalog:** [`packages/catalog/README.md`](https://github.com/1yefuwang1/dsh-copilot-catalog/blob/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/catalog/README.md#wire-identity) section "Wire identity", and in `packages/catalog/src/`: [`discovery.ts`](https://github.com/1yefuwang1/dsh-copilot-catalog/blob/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/catalog/src/discovery.ts), [`identity.ts`](https://github.com/1yefuwang1/dsh-copilot-catalog/blob/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/catalog/src/identity.ts), [`plugin.ts`](https://github.com/1yefuwang1/dsh-copilot-catalog/blob/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/catalog/src/plugin.ts), [`runtime.ts`](https://github.com/1yefuwang1/dsh-copilot-catalog/blob/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/catalog/src/runtime.ts). Search: see [search.md](../design/search.md). [`packages/worktrees`](https://github.com/1yefuwang1/dsh-copilot-catalog/tree/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/worktrees) is unrelated and was not read.
- **dsh-github-copilot** (145 `.ts` files in `src/`): [`AGENTS.md`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/AGENTS.md) (the "plugin-only boundary" and the list of 12 surfaces), [`docs/copilot-accounts.md`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/docs/copilot-accounts.md), [`docs/copilot-usage.md`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/docs/copilot-usage.md), [`docs/copilot-compaction.md`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/docs/copilot-compaction.md), [`src/copilot-auth.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/copilot-auth.ts), [`src/authorization-controller.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/authorization-controller.ts), [`src/account-model-source.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/account-model-source.ts), [`src/account-model-catalog.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/account-model-catalog.ts), [`src/preview-route.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/preview-route.ts), [`src/copilot-accounts-host.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/copilot-accounts-host.ts), [`src/copilot-usage-host.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/copilot-usage-host.ts), [`deployment-baseline.json`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/deployment-baseline.json), [`docs/official-first-021-rc3.md`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/docs/official-first-021-rc3.md).

**Not read:** most test bodies, `scripts/*` in most repos, dsh-github-copilot's `AGENTS.md` beyond the architecture sections, and dsh-llm-github-copilot's CI workflow. Nothing in the reference repos was built or run.

**Pull them again.** The clones are not part of this repository. Locally they go in `repos/`, which is git-ignored, and are only read. These commands fetch the commits that were read:

```sh
mkdir -p repos && cd repos
git clone https://github.com/V1ki/dsh-plugin-subscriptions.git
git -C dsh-plugin-subscriptions checkout 7639ed9958a9a1c4159faa1f4e6e15e9ede60b7d
git clone https://github.com/lujianjun19/dsh-llm-github-copilot.git
git -C dsh-llm-github-copilot checkout 894d38dee71a8d98bded3312f66c61bab2422c0f
git clone https://github.com/iasiv5/dsh-copilot-auth.git
git -C dsh-copilot-auth checkout 1d2d6eb3521f19b69019cb1335b39dd380db082b
git clone https://github.com/1yefuwang1/dsh-copilot-catalog.git
git -C dsh-copilot-catalog checkout 816ec176228f8d6b477e9ee9744afb08cd3c03bf
git clone https://github.com/cloga/dsh-github-copilot.git
git -C dsh-github-copilot checkout cb6bccbc861d1e09097abd5127772b9115a70c5a
git clone https://github.com/Mars-Sea/dsh-commandcode-provider.git
git -C dsh-commandcode-provider checkout 79147b203d9d21314857dc16bce7105fabeda7c0
git clone https://github.com/HuanLinOTO/dsh-plugin-copilot.git   # no LICENSE file; package.json declares MIT; this project uses no code from it
git -C dsh-plugin-copilot checkout f939770dc849c46baabc92d2ac74370c6c887e50
```

## 2. Side by side

Approaches: **A** own route and own adapter. **B** sign-in for DSH's built-in `github-copilot` route. **C** own route id over pi-ai's published adapter. This plugin is C ([models.md](../design/models.md) A8).

**Sign-in and credential**

| | dsh-plugin-subscriptions | dsh-llm-github-copilot | dsh-copilot-auth | dsh-plugin-copilot | dsh-copilot-catalog | dsh-github-copilot |
|---|---|---|---|---|---|---|
| Approach | A | B, credential provider only | B, preset route plus catalog patching | B, sign-in card plus autofill | B, replaces the official `llm-pi-ai` row and changes its catalog | C |
| Route id | `copilot` | built-in `github-copilot` | built-in | built-in | built-in, inside a replacement row `llm-pi-ai-catalog` | `github-copilot-preview` |
| Adapter | own `CopilotAdapter` | none | none | none | the original `llm-pi-ai` adapter, called from its own `apply()` | `AccountRoutingAdapter extends PiAiAdapter` |
| Sign-in | own device flow | own device flow, writes a grant | pi-ai's flow through `authorization.begin` | same | none, reads an existing credential | pi-ai's flow, plus `registerFlow` for extra accounts |
| Credential store | own file `auth.json` under the DSH home, plain text, mode 0600 | DSH credentials, `llm-pi-ai/github-copilot` | same key, read and delete only | same | same key, read only | same key, plus `github-copilot/account-<uuid>` |
| Copilot token refresh | the plugin (`TokenManager`, 5 min before expiry) | pi-ai | pi-ai | pi-ai | pi-ai. Search refreshes inside the credential lock | pi-ai, wrapped so a refresh does not abort running streams |
| GitHub Enterprise | no | no | blank domain only | configurable domain, answers the prompt | `*.ghe.com` via `grant.enterpriseUrl` | github.com and `tenant.ghe.com`, no GHES |
| Multi-account | yes, pooling and failover | no | no | no | no | yes, per-session accounts |

**Models, requests and wires**

| | dsh-plugin-subscriptions | dsh-llm-github-copilot | dsh-copilot-auth | dsh-plugin-copilot | dsh-copilot-catalog | dsh-github-copilot |
|---|---|---|---|---|---|---|
| Model list | live `GET /models`, stored in `models.json`, refreshed hourly | pi-ai's bundled catalog | user-edited table (live list ∩ catalog) | `availableModelIds` ∩ catalog, written to settings | live `GET /models` once at start-up, 10 s deadline, fail-open | live `GET /models`, 24 h TTL per account, 5 min failure cooldown |
| Models newer than DSH's catalog | yes | no | yes, by patching pi-ai's catalog | no | yes, by changing the shared catalog in memory | yes |
| Sends model requests | the plugin | built-in route | built-in route | built-in route | built-in route | the published adapter, one per account |
| Client headers | its own constants; the editor version is looked up live (24 h cache) | defined but unused | pi-ai 0.84.4's, for `/models` only | none | its own values, set by a `fetch` wrapper | pi-ai's, read from pi-ai's model entries at runtime |
| Wires | chat completions and Responses, no Anthropic messages | n/a | n/a | n/a | Responses, then messages, then chat | messages, then Responses, then chat |

This plugin sets no client identity headers of its own except `Copilot-Integration-Id`, chosen by sign-in method: `vscode-chat`, pi-ai's value, after a browser sign-in, and `copilot-developer-cli` with a PAT, which Copilot requires for PATs. Its model requests reuse pi-ai's header block ([models.md](../design/models.md) A7, A8).

**UI, packaging and size**

| | dsh-plugin-subscriptions | dsh-llm-github-copilot | dsh-copilot-auth | dsh-plugin-copilot | dsh-copilot-catalog | dsh-github-copilot |
|---|---|---|---|---|---|---|
| Client | React page | settings section, login dialog, nav icon | settings section | one card | none | provider card, composer pill, many slots |
| Slots | `settings.section` | `settings.section`, `conversation.input.overlay` | `settings.section` | `plugins.row.config` | none | `settings.models.provider-card`, `plugins.bundle.config`, composer and chat slots |
| Host↔client | `connection.fetch.register` | `connection.fetch.register` | `webServer` (7 routes, same-origin guard) | `webServer` prefix, same-origin guard (POST and JSON only) | none | Typert `@Remote` with zod codecs |
| Language and build | TypeScript, `tsc` + `tsdown` | plain JS, numbered files concatenated | `.mjs` + one `.jsx`, `esbuild` | TypeScript, `tsdown` | TypeScript, `tsc` | TypeScript, `tsc` + `tsdown` |
| Build output committed | no (`prepare`) | yes | yes (client) | yes | no | no (GitHub Release `.tgz`) |
| `engines.dsh` and peers | explicit version list in peers | peer ranges | nested `dsh.engines`, which DSH ignores (P24) | optional peers `^0.2.1-alpha.5` | exact `0.2.1-rc.3`, exact peers | exact `0.2.1-rc.3`, exact peers, runtime check |
| Size | about 20.7k lines | 20 files, about 54 KB | about 4.6k lines | about 1.7k lines | about 109 KB in three packages | 145 `.ts` files in `src/`, about 25k lines |

## 3. What most of them do

| Pattern | Who |
|---|---|
| One npm package with a Host half (`.`) and a `./client` export. A `cordis.patch.yml` named in `dsh.bundle.patch` inserts the plugin's row | all 5 with a UI |
| Sign-in by GitHub device code: the UI shows the code, a copy button and a link. Polling honours `authorization_pending`, `slow_down` (+5 s) and `expired_token` | all 6 |
| The credential lives in the DSH credentials service under `llm-pi-ai/github-copilot` | 5 of 6 (dsh-plugin-subscriptions has its own file) |
| Requests to GitHub and Copilot carry editor client headers and a fixed OAuth client id, as pi-ai's do. The header values differ between repos | all that make requests |
| Settings read once per operation: live-editable config is `.volatile()` and read when used | dsh-llm-github-copilot, dsh-plugin-copilot, dsh-copilot-catalog |
| Offline tests with a hand-built fake `ctx`, injected `fetch` and clock. No live Copilot calls | all 6 |
| Errors mapped to stable `LlmError` codes: 401 and 403 to AUTH, 429 to RATE_LIMIT with `Retry-After` | dsh-plugin-subscriptions, dsh-github-copilot |
| English and Chinese UI, registered with `ctx.locale.register`, plus `locale/{en,zh}.json` | dsh-llm-github-copilot, dsh-plugin-copilot, dsh-copilot-auth |

## 4. What each has that the others do not

- **dsh-plugin-subscriptions:**
  - Looks up the current editor version for its client headers (24 h cache), and retries once after a forced token refresh on any 401.
  - Encrypted-reasoning replay kept in adapter memory, keyed by account × conversation × model, idle TTL 30 min.
  - A Responses item normaliser that rewrites ids to `copilot-item-<output_index>`, because the gateway mints a new id on every event.
  - A per-model `wire` override in config.
  - `src/compat.ts`: a namespace import, so one build survives the `CallId` → `ToolCallId` rename (P10).
- **dsh-llm-github-copilot:**
  - ADR 0002 with a checkable expiry: re-open the decision when `extends AuthorizationService` or `dsh-authorization` appears in the bundle patches.
  - Writes the grant, then **reads it back and compares**, because the record format belongs to pi-ai.
  - Accurate sign-out: reports `credentialRemaining` when an env or `.env` token remains (P25).
  - Host-side polling with a generation counter that keeps running after the dialog closes.
  - Tests against the **real** `LocalCredentialProvider`, and a packed-install Chromium smoke test on exact released RCs (`scripts/test-harness.mjs <rc>`).
  - A bilingual README with tests that keep the two in sync.
- **dsh-copilot-auth:**
  - A bundle patch row that presets the built-in provider, with a `name` guard.
  - A user-editable "manage model list" table backed by live `/models` evidence.
  - Patches pi-ai's catalog JSON inside the DSH install, or injects into its in-memory table. Both need a write-ahead transaction engine with boot recovery.
  - Per-profile state under `<profile>/copilot-auth/`, a hardened npm tarball fetch, a Windows-safe directory fsync.
- **dsh-plugin-copilot:**
  - Finds pi-ai's flow by scanning `authorization.list()` for `llm-pi-ai/github-copilot`.
  - An event ring (64 entries) with sequence numbers and cursor polling, so the device code survives a page reload.
  - Answers the Enterprise-domain prompt by matching `/enterprise/i`, and relays other prompts to the browser.
  - Opens the verification link with `window.open`, so sidebar plugins cannot hijack it.
  - A read-only `copilot_status` tool for the model.
  - Per-release migration docs.
- **dsh-copilot-catalog:**
  - Wraps the original `llm-pi-ai` module and calls its `apply()` with a `baseURL` overlay. To do that it disables the official row.
  - Changes pi-ai's shared `GITHUB_COPILOT_MODELS` in place after one discovery at start-up.
  - A `fetch` wrapper, scoped to Copilot hosts and reference-counted, that rewrites Copilot headers, including device and session ids read from local VS Code files, with three modes through `DSH_COPILOT_WIRE_IDENTITY`.
  - Resolves pi-ai from the adapter's own location, so it shares the adapter's singleton.
- **dsh-github-copilot:**
  - A "plugin-only boundary": fix things only through published Core and pi-ai APIs. No patched `node_modules`, no Core edits, no changing shared catalogs, no second wire implementation. `cordis.patch.yml` counts as composition, not a Core patch.
  - Wraps pi-ai's `oauth.refresh`, so a refresh that keeps the account, endpoint and entitlements does not abort running streams.
  - Agent contract files (`agent-contract.json`, `agent-execution-policy.json`) and a `verify:agent` script.

## 5. Patterns worth adopting

| Pattern | From | Why |
|---|---|---|
| Insert only the plugin's own row in the bundle patch, with a `name` guard on any row it patches | dsh-copilot-auth | No duplicate-service error, no silent patching of the wrong row |
| Find pi-ai's sign-in flow with `authorization.list()`, drive it with `begin` and a host-side `interaction` | dsh-plugin-copilot, dsh-copilot-auth, dsh-github-copilot | No second flow, so no `DUPLICATE_FLOW` (used in [login.md](../design/login.md)) |
| Event ring with sequence numbers and cursor polling for the device code | dsh-plugin-copilot | Reload-safe notices (used in login.md A4) |
| Generation counter for timers, Host-side polling that outlives the dialog | dsh-llm-github-copilot | No stale timers, no lost sign-in |
| Write a record, then read it back and compare | dsh-llm-github-copilot | A foreign record format can silently drop a write |
| Thin adapter over `PiAiAdapter` plus `registerAdapter().replace()` | dsh-github-copilot | Live account models without a second wire implementation (used in models.md A8) |
| Fail open with a deadline and controlled error codes | dsh-copilot-catalog | A broken `/models` does not empty the picker |
| Mapping rules as data with fixed rejection codes, with no guessed metadata | dsh-github-copilot, dsh-copilot-catalog | Unknown models are diagnosed, not mis-served |
| Accurate sign-out (`credentialRemaining`) | dsh-llm-github-copilot | Env tokens outlive a sign-out |
| `connection.fetch.register` for the browser↔Host channel | dsh-plugin-subscriptions, dsh-llm-github-copilot | Authenticated by DSH (P30) |
| Real-credentials test and packed-install smoke test on exact released DSH versions | dsh-llm-github-copilot | Catches breakage the `engines` gate cannot |
| A compatibility doc that separates "accepted by the gate" from "verified" | dsh-llm-github-copilot, dsh-github-copilot | Accurate support claims |
| Namespace import for symbols that moved between DSH lines | dsh-plugin-subscriptions | One build, two DSH lines |

## 6. Approaches this plugin avoids

Each was seen in at least one of the reference repos. The pitfall numbers point to section 7.

| Approach | Cost |
|---|---|
| Patching pi-ai data inside `node_modules` or the DSH install | Needs a restart, works in one process only, breaks on version changes, and needs a write-ahead transaction engine with boot recovery (P12) |
| Changing pi-ai's shared in-memory catalog, or wrapping `globalThis.fetch` | Process-wide: every plugin in the process sees the changed catalog, and every plugin's requests to Copilot hosts pass through the wrapper |
| Disabling the shared official `llm-pi-ai` row | Every other provider on that row must be copied by hand (P13) |
| Exact DSH pins on every package | A release for every DSH pre-release, even one with no behaviour change (P15) |
| Hard-coded client header and API version values | They go stale: an outdated `Editor-Version` gets `401 IDE token expired` (P9). This plugin reuses pi-ai's header block |
| Reading the local VS Code device and machine ids and sending them with Copilot requests | Links the requests to the local VS Code install |
| Host routes registered with `ctx.webServer.register()` | DSH does not authenticate them. An Origin check blocks cross-site browser requests but does not authenticate the caller (P2, P30) |
| Matching command output with a regular expression to open a dialog, or a `MutationObserver` to place an icon | Breaks when the wording or the page structure changes |
| A fixed model for web search | Stops working when the model is retired or an organisation's policy turns it off |
| Sign-out that leaves the provider entry and models in place | Models stay visible without a credential |
| Many features in one plugin | Each DSH release can break any of them. This plugin covers sign-in and the model list |
| Docs that drift from the code | Readers act on claims that no longer hold. Keep claims checkable, and check them |

## 7. Pitfalls

Learned from the reference repos. Other documents cite these numbers, so they are kept stable; P16 is not used.

| # | What happened | Source | Lesson |
|---|---|---|---|
| P1 | Sign-in works, but no models appear until a provider entry for the built-in route is added by hand. The built-in `github-copilot` route stays dormant until that entry exists | dsh-llm-github-copilot README, ADR 0002 [doc] | This plugin's own route avoids it |
| P2 | A Host route registered with `ctx.webServer.register()` was unauthenticated and not reachable from the browser's `/api`. Sign-in requests returned 404 for a release | dsh-llm-github-copilot CHANGELOG 0.4.8 [doc] | Use `ctx.connection.fetch.register()` |
| P3 | An empty model list was cached for 5 min after logout, so the picker stayed empty after re-login. Fix: a 5 s TTL for empty or failed results, and clear caches on sign-in | dsh-llm-github-copilot CHANGELOG 0.4.1 [doc] | Clear lists on sign-in and sign-out (models.md A3) |
| P4 | A listener for the credentials-changed event used an old event name and did not fire | dsh-llm-github-copilot CHANGELOG [doc] | Use the event name from the package, and test it |
| P5 | Legacy model snapshots shown as duplicate picker names | dsh-llm-github-copilot CHANGELOG [doc] | `model_picker_enabled` sets the toggle default (models.md A4) |
| P6 | A second flow for the same credential record is refused: `DUPLICATE_FLOW` | dsh-llm-github-copilot ADR 0002; `@deepseek-ai/dsh-authorization` 0.2.1-rc.2 `lib/index.js:77` [code] | Reuse pi-ai's flow; do not register one for that key |
| P7 | A second adapter for the same route fails plugin loading: `DUPLICATE_ADAPTER`. A second `github-copilot` provider failed profile boot | pi-ai README; dsh-plugin-copilot README [doc] | Own route id |
| P8 | Inserting `@deepseek-ai/dsh-authorization` when the base bundle already mounts it gives `service "authorization" has been registered`, and the entry does not activate | dsh-copilot-auth `cordis.patch.yml` [code] | Do not insert services the base bundle ships |
| P9 | A stale `Editor-Version` header gives `401 IDE token expired`; a fresh token does not fix it | dsh-plugin-subscriptions `copilot.ts` comment [reported] | Reuse pi-ai's header block rather than own constants (models.md A7, A8) |
| P10 | A named import of a symbol DSH renamed (`CallId` → `ToolCallId`) broke the whole profile at link time on one of two DSH lines | dsh-plugin-subscriptions `src/compat.ts` [code] | Namespace imports for anything that moved between versions |
| P11 | Each of four DSH releases needed a migration: package moves, `ctx.settings.register` removed, `settings.plugin.item` deprecated, peers enforced at install | dsh-plugin-copilot `docs/plans/*migration*.md` [doc] | Budget a migration per release, keep a compatibility log |
| P12 | Patching pi-ai catalog data inside `node_modules` works, but needs a restart, is single-process only and breaks on version changes | dsh-copilot-auth ADR 0001, 0004 [doc] | Do not patch `node_modules` |
| P13 | Disabling the official `llm-pi-ai` row to replace it takes every other provider on that adapter down too | dsh-copilot-catalog `packages/catalog/cordis.patch.yml` [code] | Do not disable the shared row |
| P14 | A bundle patch that overrides the shared `web` row replaces its whole config, including `fetchProvider` | dsh-copilot-catalog `packages/search/cordis.patch.yml` [code] | Do not patch the `web` row ([search.md](../design/search.md)) |
| P15 | Exact `engines.dsh` pins block installs on every other DSH version | dsh-copilot-search; dsh-github-copilot [code] | [packaging.md](../packaging.md#2-compatibility) 2 |
| P17 | A Copilot model with both chat and Responses endpoints rejects function tools combined with a reasoning effort on chat completions (400 `invalid_request_body`, seen on `gpt-5.4`) | dsh-plugin-subscriptions `copilot.ts` comment [code] | models.md A7 picks `/responses` first whenever a row lists it |
| P18 | Native search needs an enabled model whose Responses endpoint accepts `web_search`. Organisation or enterprise policy can restrict it, and the README states that its synthetic tests assert no live native-search compatibility | dsh-copilot-search README [doc] | Do not promise it works |
| P19 | A sign-in dies if the page reloads mid-login | pi-ai README [doc] | login.md A4 |
| P20 | Two patch layers behave differently. A non-insert bundle patch replaces `config` wholesale. Settings layers (`settings.yaml` over the entry config) merge plain objects recursively and replace arrays | `@deepseek-ai/cordis-plugin-include` 1.0.10 `lib/index.js` (`patch:`); `@deepseek-ai/dsh-settings` 0.2.1-rc.2 `lib/index.js:281` (`mergeLayers`) [code] | Do not ship a patch row that carries `config` for a shared row |
| P21 | dsh-plugin-copilot's patch inserts `@deepseek-ai/dsh-authorization`; its comment says no shipped bundle mounts it. On DSH 0.2.1-rc.2 the base bundle does | `@deepseek-ai/dsh-base` 0.2.1-rc.2 `cordis.patch.yml` [code] | Check the base bundle before inserting a service |
| P22 | `PiAiAdapter`, `recordKeyFor` and `supportedProtocols` are exported by `@deepseek-ai/dsh-llm-pi-ai` | `@deepseek-ai/dsh-llm-pi-ai` 0.2.1-rc.2 `lib/index.js:2968` [code] | models.md B6 |
| P23 | Models missing from a mixed-protocol catalog cannot be added by a profile `models` list | `@deepseek-ai/dsh-llm-pi-ai` 0.2.1-rc.2 `lib/index.js:563`, `:690` [code] | models.md C3 |
| P24 | DSH ignores a nested `dsh.engines`, so dsh-copilot-auth's floor `>=0.1.7-rc.2` is not enforced; its test checks the nested field | `@deepseek-ai/dsh-app-boot` 0.2.1-rc.2 reads the top-level `engines.dsh`, then the `@deepseek-ai/dsh*` peers [code] | Top-level `engines.dsh` ([packaging.md](../packaging.md#2-compatibility) 2) |
| P25 | A read-only env credential reference rejects `credentials.set`. Sign-out then reports success while a token remains | dsh-llm-github-copilot 0.4.10, 0.4.11 [doc] | Check `describe(ref).writable`, report a remaining token (login.md A6) |
| P26 | Cordis returns a different traced object on each service read | dsh-github-copilot alpha.14 [doc] | Use `symbols.original` to identify the credentials service |
| P27 | A Responses-wire 401 can be a replay-scope error, not an auth failure. Only the body tells them apart. dsh-plugin-subscriptions retries any 401 once with a refresh | dsh-github-copilot; dsh-plugin-subscriptions [code] | Read the body before treating a 401 as a sign-in problem |
| P28 | dsh-plugin-subscriptions' device polling stops on a transient network error | dsh-plugin-subscriptions [code] | pi-ai runs this plugin's polling (login.md B2) |
| P29 | Gemini on Copilot: tool schemas without `properties` give a 400. Usage arrives as zero on every chunk, with thinking in `reasoning_text` | dsh-copilot-tool-schema; dsh-plugin-subscriptions [code], measured on one account each | [overview.md](../design/overview.md#scope), Scope |
| P30 | DSH does not authenticate routes registered with `webServer.register`, so a plugin has to guard them itself: dsh-plugin-copilot and dsh-copilot-auth both check the request's Origin. `connection.fetch.register` routes are authenticated: an unauthenticated GET gets 401 in dsh-llm-github-copilot's packed-install test | dsh-llm-github-copilot CHANGELOG 0.4.8 [doc]; dsh-plugin-copilot `src/gateway.ts`, dsh-copilot-auth `src/host.mjs` [code] | Same as P2 |
| P31 | dsh-plugin-copilot's `package.json` exports `./src/*`, although `src` is not in `files` | dsh-plugin-copilot [code] | Test the `exports` and `files` surface |
| P32 | `authorization` flow state lives in the process that started it. A page reload or Host restart loses it, and an unanswered prompt hangs the flow until Cancel | dsh-plugin-copilot; pi-ai README [code, doc] | login.md A4, B4 |
