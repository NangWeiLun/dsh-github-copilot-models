# DSH plugins that use the GitHub Copilot provider

Surveyed on **2026-10-28** against DeepSeek Harness (DSH) `0.2.1-rc.2`.

Six of these were read in depth, together with `dsh-commandcode-provider`, which is not a Copilot plugin: [ref-similar-plugins.md](ref-similar-plugins.md).

This covers DSH plugins that use GitHub Copilot as an LLM provider, sign in to it, extend it, or read its quota. Plugins that only have "copilot" in their name are listed separately under [Excluded](#excluded-copilot-in-the-name-but-not-github-copilot).

- **Version** is the npm `latest` tag on the survey date. GitHub-only projects show the version in their repo's `package.json`.
- **Last update** is the date of the most recent release, including pre-releases: an npm publish or a GitHub release, whichever is newer. Projects with no release show the date of their last commit, marked `(commit)`.
- **Supported DSH** is the DSH version the release notes or README say the plugin supports or was tested on. It is blank when neither says. A version range copied from `package.json` is not shown unless the README repeats it.
- **⭐** is the project's GitHub star count on the survey date.
- **Route** is the model provider ID (route id) the plugin registers or activates. **Re-checked on 2026-11-01 in each plugin's code** (the npm `latest` tarball, or the GitHub default branch for GitHub-only projects); the other columns are still from 2026-10-28. See [Route IDs](#route-ids-checked-in-code-2026-11-01).

## Quick list

**On npm (32):** dsh-plugin-subscriptions, @goodandready/dsh-subscriptions, dsh-llm-bridge, dsh-subscriptions, dsh-oauth-login, dsh-vendor-login, dsh-subscription-login, dsh-auth-everying, @askdkc/dsh-auth, @edge-sky/dsh-oauth-adapter, dsh-hub-oauth-gateway, @dsh-one/dsh-llm-provider, pi2dsh, dsh-oauth-copilot, @bobhuhu/dsh-llm-github-copilot-cli, dsh-copilot-api, @lujianjun19/dsh-llm-github-copilot, dsh-github-copilot, iasiv5/dsh-copilot-auth, @huanlin/dsh-plugin-copilot, dsh-github-copilot-accounts, dsh-copilot-catalog, dsh-copilot-search, dsh-copilot-tool-schema, @softspark/dsh-orchestrator, @iasiv5/dsh-quota-watch, @francescoli/dsh-quota, dsh-provider-usage, dsh-spend, @ponydev/dsh-model-usage, dsh-keys-manager, @1yefuwang1/dsh-worktrees

**GitHub only, not on npm (22):** dsh-llm-oauth, dsh-plugin-subhub, dsh-subscription-hub, dsh-unified, dsh-subscription-signin, dsh-plugin-oauth-subs, dsh-AuthInOne, dsh-everything-oauth, arzvaak/dsh-provider-hub, dsh-multi-provider-profile, dsh-provider-copilot, dsh-copilot-sdk, nathan5580/dsh-copilot, dsh-llm-copilot, @vincent-raffin/dsh-llm-github-copilot, dsh-llm-copilot-acp, dsh-github-copilot-signin, dsh-github-auth, dsh-copilot-acp, dsh-github-copilot-credits, dsh-copilot-quota, dsh-see-image

---

## Route IDs (checked in code, 2026-11-01)

The route id is the `provider` name a model request carries. DSH gives each id exactly one adapter; a second `registerAdapter` for a taken id fails with `DUPLICATE_ADAPTER`. DSH's own `llm-pi-ai` registers `github-copilot` only while the profile's settings contain `llm-pi-ai.providers.github-copilot`.

Read in the npm `latest` tarballs (25 packages) and the GitHub default branches (18 repos) on 2026-11-01: the `registerAdapter` calls, the constants they use, and the settings the plugin writes. Nothing was installed or run. Plugins that serve no Copilot model (quota, delegation, search only) are left out.

| Route id | How the plugin uses it | Plugins |
|---|---|---|
| `github-copilot` | **Configures DSH's built-in route.** No adapter of its own; signs in, writes the settings entry, or edits the model list | @lujianjun19/dsh-llm-github-copilot, iasiv5/dsh-copilot-auth, @huanlin/dsh-plugin-copilot, dsh-copilot-catalog (runs DSH's `llm-pi-ai` from a replacement row), dsh-vendor-login, dsh-subscription-login, dsh-github-copilot-accounts, dsh-keys-manager, amosogra/dsh-subscription-signin, 805996329/dsh-github-copilot-signin, Jacky521L/dsh-github-auth |
| `github-copilot` | **Registers its own adapter on the built-in's id.** Works only while DSH's `llm-pi-ai` doesn't hold it | dsh-oauth-copilot (own `PiAiAdapter`; skips registering if the id is taken), @edge-sky/dsh-oauth-adapter (own `PiAiAdapter`; first removes `llm-pi-ai.providers.github-copilot` from settings and waits for `llm-pi-ai` to release the id), ziyou979/dsh-llm-oauth (own adapter; fails with an error if the id is taken), Stormycry-cryp/dsh-AuthInOne (own transport), pi2dsh (id taken from pi's provider list; read, not run), @dsh-one/dsh-llm-provider (turns off the official `llm-pi-ai` row and runs its code on a newer pi-ai) |
| `copilot` | Own adapter | dsh-plugin-subscriptions, @goodandready/dsh-subscriptions, dsh-llm-bridge, dsh-subscriptions, zdz6215591/dsh-subscription-hub, why-au/dsh-unified, @bobhuhu/dsh-llm-github-copilot-cli, youngrock-labs/dsh-provider-copilot (default; configurable), GongYuanCaiJi/dsh-copilot-sdk, nathan5580/dsh-copilot. arzvaak/dsh-provider-hub uses dsh-plugin-subscriptions' route |
| `copilot-oauth` | Own adapter | dsh-auth-everying, kam74515-boop/dsh-everything-oauth, ericleoo/dsh-llm-copilot |
| `github-copilot-preview` | Own adapter, a subclass of `PiAiAdapter` | dsh-github-copilot |
| `github-copilot-oauth` | Own adapter | dsh-hub-oauth-gateway |
| `pi-github-copilot` | Own adapter | dsh-oauth-login |
| `oauth-copilot` | A route declared in `llm-pi-ai` settings, pointing at the plugin's local proxy. The `oauth` prefix is configurable | lingdong0128-sys/dsh-plugin-oauth-subs |
| `dsh-plugin-subhub-github` | Own adapter. Its code says it avoids `github-copilot` because DSH's provider directory already declares that id | kinoward/dsh-plugin-subhub |
| `github-copilot-sdk` | Own adapter, through the Copilot SDK and CLI | 83uc0/dsh-copilot-auth (`@vincent-raffin/dsh-llm-github-copilot`) |
| `github-copilot-acp` | Own adapter, through the Copilot CLI over ACP | donalaaaaaaa/dsh-llm-copilot-acp |
| `copilot-api` | Own adapter, for a running copilot-api gateway | dsh-copilot-api |
| `github-copilot-official` | Named in the profile's comment for an older version of dsh-llm-github-copilot. Its current version registers no route | Ai110002/dsh-multi-provider-profile |

- **No Copilot route found:** @askdkc/dsh-auth 0.1.2. Its provider list (`openai-codex`, `anthropic`, `xai`, `opencode`, `opencode-go`, `openrouter`, `orcarouter`, `nous`, `infron`) has no Copilot.
- **Most common ids:** `github-copilot` (17 plugins) and `copilot` (10). Two plugins with the same id can't run in one profile.
- **Not used by any plugin above:** `copilot-live`, `github-copilot-live`, `copilot-account`, `github-copilot-account`, `copilot-models`, `github-copilot-models`, `copilot-direct`, `copilot-native`, `github-copilot-native`.

---

## 1. Built-in (official)

| Package | Route | Notes |
|---|---|---|
| `@deepseek-ai/dsh-llm-pi-ai` (ships with DSH) | `github-copilot` | Built-in pi-ai catalog route. Reads the credential from `COPILOT_GITHUB_TOKEN`; default base URL is `https://api.individual.githubcopilot.com`. The add-ons in [section 4](#4-add-ons-for-the-built-in-github-copilot-route) add sign-in UI, account handling, and catalog fixes on top of it. |

There's no official standalone Copilot package: `@deepseek-ai/dsh-llm-github-copilot` and `@deepseek-ai/dsh-llm-copilot` both return 404 on npm.

## 2. Multi-provider subscription plugins (Copilot plus others)

### On npm

| Plugin | Version | Last update | Supported DSH | ⭐ | Copilot support | Route |
|---|---|---|---|---|---|---|
| [dsh-plugin-subscriptions](https://www.npmjs.com/package/dsh-plugin-subscriptions) · [repo](https://github.com/V1ki/dsh-plugin-subscriptions) | 0.9.11 | 2026-10-26 | 0.1.1-rc.2, 0.1.2, 0.1.3, 0.1.5 and 0.1.7-rc lines; 0.2.0-rc.2; 0.2.1-alpha.2, alpha.3, rc.2, rc.3 | 522 | ChatGPT/Codex, Claude, Grok, **Copilot**, Antigravity. Copilot signs in with the GitHub device flow and uses the live model catalog from `api.githubcopilot.com/models`, with reasoning effort per model. | `copilot` |
| [@goodandready/dsh-subscriptions](https://www.npmjs.com/package/@goodandready/dsh-subscriptions) · [repo](https://github.com/GooDAnDReaDY/dsh-subscriptions) | 0.7.23 | 2026-10-27 |  | 21 | 16 subscriptions, including Copilot (device flow, chat completions); optional Copilot CLI driver | `copilot` |
| [dsh-llm-bridge](https://www.npmjs.com/package/dsh-llm-bridge) · [repo](https://github.com/jayden-dang/dsh-llm-bridge) | 0.1.1 | 2026-09-21 |  | 1 | Same provider set as @goodandready/dsh-subscriptions | `copilot` |
| [dsh-subscriptions](https://www.npmjs.com/package/dsh-subscriptions) · [repo](https://github.com/goodboys-ai/dsh-subscriptions) | 0.2.2 | 2026-10-17 | 0.1.7-rc.2, 0.2.0-rc.2, 0.2.1-rc.2 (tested) | 0 | Subscription providers (Codex, Claude, Grok, Copilot, Antigravity, Cursor, …) plus a usage dashboard | `copilot` |
| [dsh-oauth-login](https://www.npmjs.com/package/dsh-oauth-login) · [repo](https://github.com/aa2246740/dsh-oauth-login) | 0.2.9 | 2026-10-14 | 0.2.0-rc.2 (peer `>=0.2.0-rc.1 <0.2.1`) | 1 | OAuth for ChatGPT, Claude, Grok, Copilot, OpenRouter, and Kimi, built on Pi AI adapters | `pi-github-copilot` |
| [dsh-vendor-login](https://www.npmjs.com/package/dsh-vendor-login) · [repo](https://github.com/MochiNek0/dsh-vendor-login) | 0.3.0 | 2026-10-27 | ≥ 0.1.2-rc.1 | 0 | Sign in from the Settings UI for Claude, ChatGPT, Copilot (device code), and SuperGrok | `github-copilot` |
| [dsh-subscription-login](https://www.npmjs.com/package/dsh-subscription-login) · [repo](https://github.com/woodfood111/dsh-subscription-login) | 0.1.2 | 2026-10-18 | contracts checked against 0.2.1-rc.2; 0.1.2 fixes cold boot on 0.1.7-rc.2 and later | 1 | One sign-in page for DSH's own authorization flows (Codex, Claude, Copilot, OpenRouter, Kimi, xAI). | `github-copilot` |
| [dsh-auth-everying](https://www.npmjs.com/package/dsh-auth-everying) · [repo](https://github.com/chenbin-dev/dsh-auth-everying) | 0.1.4 | 2026-08-21 |  | 4 | Imports existing local Claude, Codex, Grok, Gemini, Copilot, and OpenCode logins; OAuth for the official providers | `copilot-oauth` |
| [@askdkc/dsh-auth](https://www.npmjs.com/package/@askdkc/dsh-auth) · [repo](https://github.com/askdkc/dsh-auth-fork) | 0.1.2 | 2026-09-28 |  | 0 | Provider auth and model routes for the pi-ai OAuth providers, including Copilot; bundled with dsh-tui | none in 0.1.2 (no Copilot in its provider list) |
| [@edge-sky/dsh-oauth-adapter](https://www.npmjs.com/package/@edge-sky/dsh-oauth-adapter) · [repo](https://github.com/edge-sky/dsh-oauth-adapter) | 0.1.3-rc.5 | 2026-10-19 | ≥ 0.2.0-rc.2 (older DSH needs older adapter releases) | 7 | Web and Desktop account page for DSH's official authorization flows; Copilot through a GitHub or GitHub Enterprise device code | `github-copilot` (own adapter; removes the built-in's settings entry first) |
| [dsh-hub-oauth-gateway](https://www.npmjs.com/package/dsh-hub-oauth-gateway) · [repo](https://github.com/lninghaha/dsh-hub-oauth-gateway) | 1.13.6 | 2026-10-23 | verified on 0.1.1-rc.2; install range covers 0.1.x and 0.2.x | 1 | Usage center plus subscription OAuth. The Copilot route stays off until you set `oauthDevice.copilotClientId`. | `github-copilot-oauth` |
| [@dsh-one/dsh-llm-provider](https://www.npmjs.com/package/@dsh-one/dsh-llm-provider) · [repo](https://github.com/imchangchang/dsh-llm-provider) | 0.2.2 | 2026-10-02 (pre-release 0.3.0-alpha.3) | ≥ 0.1.6-alpha.1, including the 0.2 line | 1 | Replaces the built-in llm-pi-ai and llm-deepseek adapters and the model picker; shows only the Copilot models your account can use, plus Copilot quota | `github-copilot` |
| [pi2dsh](https://www.npmjs.com/package/pi2dsh) · [repo](https://github.com/weijiafu14/pi2dsh) | 0.27.1 | 2026-10-26 | 0.2.1-rc.2, 0.2.1-rc.3 | 213 | Runs Pi extensions in DSH. Its `subscription-login` example adds ChatGPT, Claude, Copilot, and Kimi through `/login`. | `github-copilot` (pi's provider id) |

### GitHub only (not on npm)

| Repo | Version | Last update | Supported DSH | ⭐ | Copilot support | Route |
|---|---|---|---|---|---|---|
| [ziyou979/dsh-llm-oauth](https://github.com/ziyou979/dsh-llm-oauth) | 0.2.0 | 2026-10-18 (commit) | reviewed against 0.1.5-rc.2 | 6 | OAuth providers: Grok, Copilot (optional GitHub Enterprise URL), Codex, Anthropic, OpenRouter. | `github-copilot` |
| [kinoward/dsh-plugin-subhub](https://github.com/kinoward/dsh-plugin-subhub) | 1.8.1 | 2026-08-22 |  | 6 | ChatGPT, Grok, and Copilot through browser sign-in | `dsh-plugin-subhub-github` |
| [zdz6215591/dsh-subscription-hub](https://github.com/zdz6215591/dsh-subscription-hub) | 0.1.6 | 2026-10-27 |  | 1 | Hub with 12 providers, forked from dsh-plugin-subscriptions; Copilot through a device code; multi-account pool | `copilot` |
| [why-au/dsh-unified](https://github.com/why-au/dsh-unified) | 0.1.0 | 2026-10-16 (commit) |  | 0 | 18+ platforms, including Copilot (device flow), with account rotation | `copilot` |
| [amosogra/dsh-subscription-signin](https://github.com/amosogra/dsh-subscription-signin) | — | 2026-10-13 (commit) | ≥ 0.2.0-rc.2 | 0 | Sign-in button for subscription routes; Copilot signs in through a device code | built-in `github-copilot` |
| [lingdong0128-sys/dsh-plugin-oauth-subs](https://github.com/lingdong0128-sys/dsh-plugin-oauth-subs) | 0.0.110 | 2026-10-21 (commit) |  | 2 | Backup mirror of the now-offline xxww0098/dsh-plugin-oauth-subs; 12 subscriptions, including Copilot (device code, or import `~/.config/github-copilot/hosts.json`) | `oauth-copilot` (an `llm-pi-ai` route to its local proxy) |
| [Stormycry-cryp/dsh-AuthInOne](https://github.com/Stormycry-cryp/dsh-AuthInOne) | 0.2.0-alpha.4 | 2026-08-15 | verified on 0.1.0-rc.6 | 102 | Provider login, model switching, and usage analytics; Copilot device login is marked experimental | `github-copilot` (own transport) |
| [kam74515-boop/dsh-everything-oauth](https://github.com/kam74515-boop/dsh-everything-oauth) | 0.1.0 | 2026-08-14 (commit) |  | 3 | Imports existing local Codex, Grok, Claude, Copilot, and Gemini logins | `copilot-oauth` |
| [arzvaak/dsh-provider-hub](https://github.com/arzvaak/dsh-provider-hub) | 0.1.0 | 2026-10-08 |  | 0 | Provider setup UI that embeds dsh-plugin-subscriptions' Copilot sign-in, so it requires that plugin. Not the same as npm's `dsh-provider-hub`, which has no Copilot support. | via `copilot` |
| [Ai110002/dsh-multi-provider-profile](https://github.com/Ai110002/dsh-multi-provider-profile) | — | 2026-08-28 (commit) | verified on 0.1.1-rc.2 | 0 | Ready-made DSH profile with Codex, Copilot, and Claude; Copilot comes from dsh-llm-github-copilot | `github-copilot-official` (per its comment; that plugin now registers no route) |

## 3. Dedicated Copilot provider plugins (register their own Copilot route)

### On npm

| Plugin | Version | Last update | Supported DSH | ⭐ | How it works | Route |
|---|---|---|---|---|---|---|
| [dsh-oauth-copilot](https://www.npmjs.com/package/dsh-oauth-copilot) · [repo](https://github.com/FMDD61/dsh-oauth-copilot) | 0.3.2 | 2026-10-18 | verified on 0.2.1-rc.2; peer range covers 0.1.5-rc.1 up to (not including) 0.3.0 | 1 | GitHub OAuth sign-in plus a Copilot model route backed by pi-ai's Copilot catalog; includes a `dsh-copilot-auth` CLI | `github-copilot` (own `PiAiAdapter`; skips registering when the id is taken) |
| [@bobhuhu/dsh-llm-github-copilot-cli](https://www.npmjs.com/package/@bobhuhu/dsh-llm-github-copilot-cli) · [repo](https://github.com/BobHuHu/dsh-llm-github-copilot-cli) | 0.1.6 | 2026-09-02 | 0.1.1-rc.2 | 0 | Built on the official `@github/copilot-sdk` and the Copilot CLI; doesn't call Copilot endpoints directly | `copilot` |
| [dsh-copilot-api](https://www.npmjs.com/package/dsh-copilot-api) · [repo](https://github.com/caozhiyuan/dsh-copilot-api) | 0.1.8 | 2026-10-21 | 0.2.1-rc.2 (tested) | 1 | Provider for a running [copilot-api](https://github.com/caozhiyuan/copilot-api) gateway (same author) | `copilot-api` |

### GitHub only (not on npm)

| Repo | Version | Last update | Supported DSH | ⭐ | How it works | Route |
|---|---|---|---|---|---|---|
| [youngrock-labs/dsh-provider-copilot](https://github.com/youngrock-labs/dsh-provider-copilot) | 0.0.1 | 2026-09-03 (commit) |  | 4 | Uses a Copilot subscription as an ordinary LLM provider; adds `/copilot login`, `logout`, and `status` | `copilot` |
| [GongYuanCaiJi/dsh-copilot-sdk](https://github.com/GongYuanCaiJi/dsh-copilot-sdk) | 1.0.11 | 2026-08-15 (commit) |  | 5 | Port of `@github/copilot-sdk`; your subscription's models show up in the model picker; adds `/copilot status`, `models`, and `stop` | `copilot` |
| [nathan5580/dsh-copilot](https://github.com/nathan5580/dsh-copilot) | 0.1.0 | 2026-08-17 (commit) | ≥ 0.1.0-rc.6 | 0 | OpenAI-compatible adapter and profile bundle; needs a local Copilot proxy such as copilot2api. The npm package named `dsh-copilot` is an unrelated placeholder. | `copilot` |
| [ericleoo/dsh-llm-copilot](https://github.com/ericleoo/dsh-llm-copilot) | 0.1.0-rc.6 | 2026-09-11 (commit) |  | 0 | Chat-completions adapter with OAuth device-flow sign-in. Its `package.json` uses the `@deepseek-ai/` scope, but it isn't official or published. | `copilot-oauth` |
| [83uc0/dsh-copilot-auth](https://github.com/83uc0/dsh-copilot-auth) | 0.1.0 | 2026-09-08 (commit) | 0.1.1-rc.2 | 0 | Package `@vincent-raffin/dsh-llm-github-copilot`; Copilot through the official SDK and CLI | `github-copilot-sdk` |
| [donalaaaaaaa/dsh-llm-copilot-acp](https://github.com/donalaaaaaaa/dsh-llm-copilot-acp) | 0.1.7-rc.2 | 2026-09-28 (commit) |  | 0 | Talks to the local Copilot CLI over ACP (`copilot --acp`); targets DSH Desktop | `github-copilot-acp` |

## 4. Add-ons for the built-in `github-copilot` route

These don't include an adapter of their own. They add sign-in UI, accounts, model discovery, search, or tool-schema fixes to the built-in route in `@deepseek-ai/dsh-llm-pi-ai`.

### On npm

| Plugin | Version | Last update | Supported DSH | ⭐ | What it adds |
|---|---|---|---|---|---|
| [@lujianjun19/dsh-llm-github-copilot](https://www.npmjs.com/package/@lujianjun19/dsh-llm-github-copilot) · [repo](https://github.com/lujianjun19/dsh-llm-github-copilot) | 0.4.11 | 2026-10-24 | 0.1.7-rc.1 to 0.1.7-rc.2, 0.2.0-rc.1 to 0.2.0-rc.2, 0.2.1-rc.2 to 0.2.1-rc.3 | 12 | Device-flow sign-in page and slash commands; saves the credential the built-in route uses |
| [dsh-github-copilot](https://www.npmjs.com/package/dsh-github-copilot) · [repo](https://github.com/cloga/dsh-github-copilot) | 0.4.1 | 2026-10-25 (pre-release 0.1.0-alpha.5.dsh.0.2.1.rc.3) | stable 0.4.1: 0.2.0-rc.2; pre-release line: 0.2.1-rc.3 | 2 | Sign-in, model profiles per account, tool compatibility, and Copilot-hosted web search. **Also registers its own route `github-copilot-preview`** (a `PiAiAdapter` subclass with the account's live models), so it is not only an add-on |
| [iasiv5/dsh-copilot-auth](https://github.com/iasiv5/dsh-copilot-auth) | 1.2.23 | 2026-10-26 | 0.1.7-rc.2, 0.2.0-rc.1, 0.2.0-rc.2, 0.2.1-rc.2, 0.2.1-rc.3 (tested) | 1 | Settings page for device-code login and logout, a preconfigured route, and model-list management |
| [@huanlin/dsh-plugin-copilot](https://www.npmjs.com/package/@huanlin/dsh-plugin-copilot) · [repo](https://github.com/HuanLinOTO/dsh-plugin-copilot) | 0.3.1 | 2026-09-30 | ≥ 0.1.2-alpha.1 (needs the built-in `dsh-llm-pi-ai` Copilot route) | 1 | One-click GitHub authorization card; turns on the route and trims the model list |
| [dsh-github-copilot-accounts](https://www.npmjs.com/package/dsh-github-copilot-accounts) · [repo](https://github.com/JacobCodeShow/dsh-github-copilot-accounts) | 0.1.2-dsh-0.2.0-rc.1 | 2026-09-30 | 0.2.0-rc.1 (desktop); 0.1.7-rc.2 also works | 0 | Multiple accounts (github.com and GitHub Enterprise), one-click switching, quota and token usage |
| [dsh-copilot-catalog](https://www.npmjs.com/package/dsh-copilot-catalog) · [repo](https://github.com/1yefuwang1/dsh-copilot-catalog) | 0.2.8 | 2026-10-24 | 0.2.1-rc.3 (exact) | 0 | Discovers the Copilot models your account can use and sends Copilot-compatible request headers (wraps the pi-ai adapter) |
| [dsh-copilot-search](https://www.npmjs.com/package/dsh-copilot-search) · same repo | 0.1.4 | 2026-10-24 | 0.2.1-rc.3 (exact) | 0 | Copilot's own web search, exposed as a DSH search provider (`github-copilot-search`) |
| [dsh-copilot-tool-schema](https://www.npmjs.com/package/dsh-copilot-tool-schema) · same repo | 0.1.2 | 2026-10-24 | 0.2.1-rc.3 (exact) | 0 | Fixes tool definitions for Copilot's Gemini models by adding the missing root `properties` field |

### GitHub only (not on npm)

| Repo | Version | Last update | Supported DSH | ⭐ | What it adds |
|---|---|---|---|---|---|
| [805996329/dsh-github-copilot-signin](https://github.com/805996329/dsh-github-copilot-signin) | 0.1.0 | 2026-10-19 (commit) | 0.2.0-rc.2, 0.2.1-rc.2 | 1 | Sign in to Copilot from inside a DSH session, with no terminal |
| [Jacky521L/dsh-github-auth](https://github.com/Jacky521L/dsh-github-auth) | 0.1.0-beta.2 | 2026-10-07 | baseline 0.1.5-alpha.1 | 0 | Contains a `dsh-copilot-auth` plugin (Copilot account sign-in and model-list checks) and a repository-auth plugin |

## 5. Copilot as a delegated agent (not a model route)

| Plugin | Source | Last update | Supported DSH | ⭐ | Notes |
|---|---|---|---|---|---|
| [@softspark/dsh-orchestrator](https://www.npmjs.com/package/@softspark/dsh-orchestrator) | npm 2.0.0 | 2026-09-06 | 2.0.0 targets 0.1.2-rc.1 (the older 1.1.0 targets 0.1.1-rc.2) | 3 | Hands single tasks to Claude Code or to Copilot's Gemini models through your existing logins. **The GitHub repo is archived.** |
| [m17316536232-cmd/dsh_copilot_acp](https://github.com/m17316536232-cmd/dsh_copilot_acp) | GitHub, 0.1.1 | 2026-09-11 (commit) | 0.1.2-rc.1 (peers pinned to that release) | 0 | Package `dsh-copilot-acp`. Runs the official Copilot CLI as an ACP subagent that the DSH agent can delegate work to |

## 6. Quota, usage, and other plugins that use Copilot

| Plugin | Source | Last update | Supported DSH | ⭐ | How it uses Copilot |
|---|---|---|---|---|---|
| [@iasiv5/dsh-quota-watch](https://www.npmjs.com/package/@iasiv5/dsh-quota-watch) | npm 0.1.37 | 2026-10-28 | ≥ 0.2.0-rc.1; 0.2.1-rc.2 audited and run-tested | 2 | Floating widget showing Copilot credits (and GLM Coding Plan quota) |
| [@francescoli/dsh-quota](https://www.npmjs.com/package/@francescoli/dsh-quota) | npm 0.3.1 | 2026-10-26 |  | 0 | Quota monitor for many providers; picks up Copilot credentials already on the machine |
| [dsh-provider-usage](https://www.npmjs.com/package/dsh-provider-usage) | npm 0.3.17 | 2026-10-21 |  | 4 | `github-copilot` plan usage from `api.github.com/copilot_internal/user` |
| [dsh-spend](https://www.npmjs.com/package/dsh-spend) | npm 0.6.3 | 2026-09-07 |  | 8 | Live Copilot quota (needs `GH_TOKEN`/`GITHUB_TOKEN` or `gh auth login`) |
| [@ponydev/dsh-model-usage](https://www.npmjs.com/package/@ponydev/dsh-model-usage) | npm 1.13.3 | 2026-10-25 | `>=0.2.0-rc.2 <0.3.0` | 1 | Copilot usage from `copilot_internal/user`, using `GITHUB_TOKEN` |
| [dsh-keys-manager](https://www.npmjs.com/package/dsh-keys-manager) | npm 0.2.10 | 2026-10-26 | `^0.2.1-rc.3` | 1 | Rotates and fails over between multiple keys; supports the `github-copilot` route |
| [@1yefuwang1/dsh-worktrees](https://www.npmjs.com/package/@1yefuwang1/dsh-worktrees) | npm 0.2.24 | 2026-10-24 | 0.2.1-rc.3 (exact) | 0 | Git worktree threads; uses `github-copilot/gpt-6-luna` to name threads by default |
| [805996329/dsh-github-copilot-credits](https://github.com/805996329/dsh-github-copilot-credits) | GitHub 0.1.0 | 2026-10-19 (commit) | 0.2.0-rc.2, 0.2.1-rc.2 | 1 | Copilot monthly credits next to context usage; reads the built-in route's credential (for example, from dsh-github-copilot-signin) |
| [vowa-antilamer/dsh-copilot-quota](https://github.com/vowa-antilamer/dsh-copilot-quota) | GitHub 0.1.0 | 2026-10-06 (commit) | `>=0.1.0-rc.6 <0.3.0`; verified on 0.2.0-rc.2 | 0 | Remaining chat, completion, and AI-credit quota next to the message box |
| [tiefeiyu/dsh-see-image](https://github.com/tiefeiyu/dsh-see-image) | GitHub 1.0.0 | 2026-08-14 | tested on 0.1.0-rc.6 | 1 | `see_image` vision tool; uses Copilot's `gpt-4.1` by default |

---

## Excluded: "copilot" in the name, but not GitHub Copilot

- `dsh-copilot` (npm 0.0.1): a placeholder package ("Copilot mode for dsh agents"); not a GitHub Copilot integration.
- `dsh-copilot-key`: Windows Copilot keyboard-key hook.
- `dsh-pet-copilot`, `dsh-whale-copilot`: desktop pets.
- `dsh-audio-copilot`, `dsh-update-copilot`, `dsh-ima-copilot`, `dsh-copilot-vision` (computer use), `dsh-prompt-for-me`, `cqai-dsh-plugin-xiaobao`, `seminar-copilot-dsh-plugin`, `recruiting-copilot`, `dsh-adhd-copilot`: here "copilot" just means "assistant".
- `dsh-load-agent-rules`, `dsh-import-copilot-files`, `dsh-plugin-workspace-rules`: only load Copilot instruction files such as `.github/copilot-instructions.md`.
- `madoka-dsh-github-mcp`: GitHub's hosted MCP server (`api.githubcopilot.com/mcp`) using a personal access token, not the Copilot model provider.
- `dsh-github-flow`: dispatches the Copilot coding agent through the `gh` CLI; not a model provider.
- Agent dispatchers such as `dsh-agent-picker` and `dsh-agent-conductor`: can launch Copilot CLI alongside many other agent CLIs.
- CodeBuddy and WorkBuddy plugins (`dsh-connect-workbuddy`, `dsh-codebuddy-models`, `@shatyuka/dsh-llm-codebuddy`, `dsh-router-codebuddy`, …): another vendor's Copilot-named endpoint, not GitHub's.
- `oh-dsh-copilot`, `dsh-copilot-sync`: work in the other direction (DSH inside the Copilot app, or DSH's models exported to VS Code Copilot BYOK).
- `copilot-dsh-provider` (Jidong-Yang): built for an "IRA DSH runtime" and serves Copilot to OpenAI Codex; has no DSH plugin manifest.
- `dsh-codex-provider` (Hu9956): archived Codex provider; mentions Copilot only in its deprecation notice.
- `elexpecial/dsh-vision-router`: personal fork that adds a Copilot vision backend; marked for local use only.

## Notes

- **Use one plugin per route.** Several plugins register or activate the same route id (`github-copilot`, `copilot`). DSH lets one adapter own each id (`DUPLICATE_ADAPTER`), and the Models page directory refuses a second declaration of the same provider (`DUPLICATE_DIRECTORY`; the dsh-plugin-copilot README reports a profile failing to start with it). See [Route IDs](#route-ids-checked-in-code-2026-11-01).
- **Your GitHub account needs Copilot access.** The dsh-subscription-login README shows sign-in failing with `no_copilot_access` on an account without it.
- **All of these are community plugins.** The only official Copilot code is the built-in route in `@deepseek-ai/dsh-llm-pi-ai`.
- **GitHub-only plugins can be installed from GitHub.** For example, the dsh-llm-github-copilot README installs it with `dsh plugin --profile <profile> add github:lujianjun19/dsh-llm-github-copilot -w`.
- Versions and star counts change quickly. Check them again before you install anything.

## How this list was built

- Ran about 65 npm registry searches (`copilot` with `dsh`/`deepseek-harness`, `keywords:dsh-plugin`, `keywords:deepseek-harness`, `keywords:cordis-plugin`, and others), which returned about 17,600 unique packages.
- Narrowed those to about 8,860 DSH-related packages and searched every README, name, and description for "copilot"; reviewed all of the roughly 130 matches.
- Searched GitHub repositories (`topic:dsh-plugin`, `topic:deepseek-harness`, and matches in names, descriptions, and READMEs). For each GitHub-only project, checked its `package.json` name against npm.
- Compared against community lists: bruc3van/awesome-dsh-plugin, beancookie/awesome-dsh-plugin, Zhiyuan-Fan/Awesome-DeepSeek-Harness-Plugins, 0xsline, Dominic789654, and fendouai awesome-deepseek-harness, leenkcool/Blue-Whale-Harness, imsai-sh, and dshworks.
- For **Last update** and **Supported DSH**, read each plugin's npm publish dates, GitHub releases feed (release notes), commit feed, README, and CHANGELOG. Supported DSH is only filled in where a release note, README, or changelog gives a version; it is blank otherwise.
- Limits: npm search doesn't find everything (`dsh-vendor-login` only turned up through GitHub), and GitHub's API rate limit cut some searches short, so a few plugins may be missing.
- **Route ids, 2026-11-01:** downloaded the npm `latest` tarball of the 25 npm plugins in sections 2 to 4, shallow-cloned the 18 GitHub-only repos in sections 2 to 4, and read each one's `registerAdapter` calls and settings writes. Repeated six npm searches (`copilot keywords:cordis-plugin`, `dsh-copilot`, `dsh github copilot`, `copilot dsh-llm`, `copilot harness plugin`, `github copilot deepseek`) and one web search: no new Copilot model plugin turned up. Newer npm versions seen on that date: dsh-plugin-subscriptions 0.9.12, @goodandready/dsh-subscriptions 0.7.64, dsh-subscriptions 0.2.3, dsh-copilot-api 0.1.9, dsh-copilot-catalog 0.2.9, dsh-copilot-search 0.1.5, dsh-copilot-tool-schema 0.1.3, dsh-keys-manager 0.2.11. The other columns were not refreshed.
