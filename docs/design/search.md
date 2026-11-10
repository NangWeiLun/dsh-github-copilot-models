# Web search

Status: not started. Planned. Whether it ships in version 1 or later is open.

Items marked [code] hold for the reference repositories at the commits linked below. They are not re-checked against the versions in [overview.md](overview.md). Nothing here has been run.

Evidence labels: **[decided]** a decision for this project. **[code]** read in source, not run. **[doc]** a README, ADR or comment says so. **[assumption]** an inference.

## Goal

Serve DSH web search through Copilot, with `dsh-commandcode-provider` as the reference for the structure **[decided]**.

## DSH side

- A search provider is registered with `ctx.web.registerSearchProvider(provider)` [doc, official plugin skill]. DSH's `dsh-web` README describes how DSH picks one: the provider named by the `searchProvider` setting, when it is registered and usable; without that setting, the only usable provider, or the error `WEB_PROVIDER_AMBIGUOUS` when several are usable [doc].
- A bundle patch row that overrides the shared `web` row replaces its whole `config`, including `fetchProvider` (pitfalls P14 and P20 in [ref-similar-plugins.md](../study/ref-similar-plugins.md#7-pitfalls)). So the plugin must not patch the `web` row. Ask the user to set `searchProvider`, or use the selection seam of `dsh-commandcode-provider` (below).

## Reference: dsh-commandcode-provider

[`dsh-commandcode-provider`](https://github.com/Mars-Sea/dsh-commandcode-provider/tree/79147b203d9d21314857dc16bce7105fabeda7c0), commit `79147b2` (2026-10-30): MIT, with a NOTICE for code ported from `pi-commandcode-provider`. About 1.3 MB of source, a 27 KB [`src/web-search.ts`](https://github.com/Mars-Sea/dsh-commandcode-provider/blob/79147b203d9d21314857dc16bce7105fabeda7c0/src/web-search.ts), and a full settings page [code].

- Its search calls Command Code's own endpoint (`POST {apiBase}/alpha/web-search`, which returns `{ results: [{ title, url, snippet }] }`). That endpoint cannot be reused for Copilot.
- Reusable structure:
  - a `WebSearchProvider` registered on `ctx.web` only when the web service is present,
  - a selection seam that writes the volatile `searchProvider` field of the `web` profile entry through `ctx.settings`, and restores the previous backend when turned off, so a sibling search plugin keeps working.

## Reference: Copilot's own search

**dsh-copilot-search**, in [`dsh-copilot-catalog/packages/search`](https://github.com/1yefuwang1/dsh-copilot-catalog/tree/816ec176228f8d6b477e9ee9744afb08cd3c03bf/packages/search) [code]:
- `POST /responses` with a `web_search` tool.
- SSE events are routed by `output_index`.
- Citations come only from structured fields: `web_search_call.action.sources` and `url_citation`.
- No check against `/models` beforehand. Errors are handled after the fact: 400, 404, 422 and failed responses map to "unsupported", with controlled `WEB_*` error codes.
- Its default search model is `gpt-6.1-sol` (`DEFAULT_SEARCH_MODEL`), set by its `model` option; its README asks for a model verified to support native search for the account [code, doc].
- Refreshes the Copilot token itself, inside the credential lock.
- Pins `engines.dsh` to exactly `0.2.1-rc.3`.
- Main files: `README.md`, `src/plugin.ts`, `src/provider.ts`, `src/responses.ts`, `src/auth.ts`, `src/refresh.ts`, `cordis.patch.yml`.
- Its README says no live native-search compatibility is asserted by the synthetic tests [doc].

**[`dsh-github-copilot`](https://github.com/cloga/dsh-github-copilot/tree/cb6bccbc861d1e09097abd5127772b9115a70c5a)** [code]:
- An inline `llm/stream` short-circuit that injects the server-side tool.
- `registerSearchProvider('github-copilot-hosted')` with a capability probe.
- A `routed-web` facade that re-parents the official `web` service.

## Plan from the old design (not confirmed)

- Follow the selection and settings pattern of `dsh-commandcode-provider`. Build the Copilot call in this plugin.
- The call: `POST /responses` with the `web_search` tool, SSE routed by `output_index`, citations from structured fields only, 400, 404 and 422 mapped to "unsupported".
- The search model is configurable, never hardcoded. Config candidates: the search model, and `searchMode`.
- Never change the shared `web` row.
- Possibly a separate package, so the search part can be removed on its own ([packaging.md](../packaging.md#3-package-shape) section 3).
- The call would use Login's output (host, Bearer token, integration id; [login.md](login.md) A7), like model requests [assumption].

## Risks

- Native search needs an enabled model whose Responses endpoint accepts `web_search`. Organisation policy can block it (pitfall P18 in [ref-similar-plugins.md](../study/ref-similar-plugins.md#7-pitfalls)) [doc].
- Search may not be available on the account or the model. Likelihood medium, impact low. Mitigation: a configurable model, and errors reported as "unsupported".

## Check that needs a real request

Needs one live request; not made yet.

- Does Copilot's native search work on a real account, and with which model?

## Done when

One search runs end to end, or the failure is reported clearly.
