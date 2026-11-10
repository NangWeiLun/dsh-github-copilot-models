# dsh-github-copilot-models

Use the models of your GitHub Copilot account in [DeepSeek Harness](https://www.deepseek.com/en/harness) (DSH): sign in, choose which models appear in the model picker, and adjust their sizes.

> 🚧 **Early stage.** Sign-in and the model list work, tested with one Copilot Business account. Not yet tested with a personal (Individual, Pro, Free) account.

## ✨ Features

- 🔐 **Sign in**
  - 🌐 **Browser:** enter a one-time code on the GitHub page.
  - 🔑 **Personal access token (PAT):** a fine-grained token with the account permission **Copilot Requests**.
  - 👤 **Account:** shows who is signed in and the account's Copilot API host, with **Refresh** and **Sign out**.
- 🤖 **Models**
  - 🎚️ **Picker filter:** the account's live model list from Copilot, with an on/off switch per model. Switched-on models appear in DSH's model picker under **GitHub Copilot (plugin)**.
  - 📏 **Editable sizes:** each model's context window and output token limit. Copilot's values apply until you set your own; **Default** and **Long** (where Copilot offers both tiers) fill them in.
  - 💰 **Prices:** each model's prices in AI credits, per tier.
  - 🏷️ **Picker badge:** each model shows its context size in the picker (for example `1M`), or **Deprecating** when Copilot announces its retirement.
  - 🧩 **Custom headers:** request headers sent to Copilot. The default, `X-GitHub-Api-Version: 2026-08-01`, makes Copilot report the long-context limits and prices.
  - 🔍 **Details:** the full entry Copilot returns for each model.

## 📋 Requirements

- DSH `>=0.2.2-rc.1 <0.3.0-0` with its web UI (last checked on `0.2.2-rc.1`).
- DSH's built-in `llm-pi-ai` plugin, turned on. This plugin uses its GitHub Copilot sign-in and request code.

## 📦 Install

```sh
npx -- @deepseek-ai/dsh plugin --profile <profile> add dsh-github-copilot-models
```

`<profile>` is the DSH profile to install into, for example `web`. Then restart DSH. To install from a checkout instead, see [DEVELOPMENT.md](DEVELOPMENT.md#3-profiles).

## 🚀 Use

1. Open **Settings → Models: Copilot**.
2. Sign in with the browser or a PAT.
3. Switch models on or off. Models that Copilot shows in its own picker start switched on.
4. Choose a model in DSH's model picker, under **GitHub Copilot (plugin)**.

## 💡 Good to know

- 🔗 **Shared sign-in:** the sign-in is shared with DSH's built-in GitHub Copilot route and with every DSH profile on the machine, so signing in or out here does the same there.
- ⚠️ **PAT and the built-in route:** while a PAT is stored, DSH's built-in GitHub Copilot route does not work. This plugin's own route, `github-copilot-models`, does.
- 🛡️ **Tokens stay on the server:** the settings page never receives one.

## 📝 Changes

See [CHANGELOG.md](CHANGELOG.md), or the [GitHub Releases](https://github.com/NangWeiLun/dsh-github-copilot-models/releases) page.

## 🛠️ Development

[DEVELOPMENT.md](DEVELOPMENT.md) covers setup, the test profile, tests and troubleshooting. The design is in [docs/design/](docs/design/overview.md). Pull requests follow [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE).

GitHub Copilot is a product of GitHub. This plugin is not affiliated with or endorsed by GitHub, Microsoft or DeepSeek, and your use of Copilot through it is governed by GitHub's own terms.
