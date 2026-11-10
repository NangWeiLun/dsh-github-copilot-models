# Changelog

Notable changes to `dsh-github-copilot-models`, newest first. Each version lists its features, fixes and breaking changes; changes to documentation, tests and CI are not listed. The same notes appear on the [GitHub Releases](https://github.com/NangWeiLun/dsh-github-copilot-models/releases) page.

## 0.1.0 - 2026-11-10

First release. Requires DSH `>=0.2.2-rc.1 <0.3.0-0` with DSH's built-in `llm-pi-ai` plugin turned on.

### Features

- Sign in with a browser device code or a fine-grained personal access token. The Card shows the signed-in account and its Copilot API host, with Refresh and Sign out.
- The account's live Copilot model list, with an on/off switch per model. Switched-on models appear in DSH's model picker under "GitHub Copilot (plugin)".
- Editable context and output sizes per model, with Copilot's Default and Long values one click away.
- Prices in AI credits per tier, a context-size or "Deprecating" badge in the picker, custom request headers, and the full entry Copilot returns for each model.
