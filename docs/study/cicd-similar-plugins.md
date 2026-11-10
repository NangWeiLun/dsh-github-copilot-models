# CI/CD of similar plugins

Snapshot taken on 2026-11-10, from npm registry data and from the reference repositories at the commits listed in [ref-similar-plugins.md](ref-similar-plugins.md), section 1.

How other DSH plugins test, release and publish, as background for [cicd.md](../cicd.md). Sources: an npm registry search (keywords `dsh-plugin`, `deepseek-harness` and `dsh`, and the text "deepseek harness plugin") ranked by monthly downloads; the record of each package's latest version, which shows whether trusted publishing was used (`_npmUser`) and whether provenance is attached; each package's npm tags; and, for the clones in `repos/`, their `.github/workflows/` and release scripts, their top-level files and their last 30 commit subjects. No request was sent to GitHub.

## 1. How the most-downloaded plugins publish

Of the 40 most-downloaded DSH packages, 38 are DSH bundles (`dsh-plugin-catalog` and `dsh-plugin-updates` are not). Their latest versions were published as follows:

| Method | Plugins |
|---|---|
| Trusted publishing from GitHub Actions | 15, 14 of them with provenance |
| A token in CI, with provenance | 3 |
| By hand, or with a token and no provenance | 20 |

| Package | Downloads a month | Method | Provenance | npm tags besides `latest` |
|---|---|---|---|---|
| dshmarket | 1,166,002 | Trusted publishing | Yes | `dev`, `beta` |
| dsh-windows-mcp | 716,731 | By hand or token | No | |
| dsh-pet | 522,317 | By hand or token | No | `hevc`, `test` |
| dsh-whale-widget | 455,587 | Trusted publishing | No | |
| dsh-context | 446,085 | Trusted publishing | Yes | |
| dsh-ops | 187,679 | By hand or token | No | `beta` |
| @michengai/dsh-skills-manager | 155,917 | Trusted publishing | Yes | |
| dsh-plugin-wallpaper-engine | 151,910 | By hand or token | No | |
| dsh-cost-meter | 151,032 | By hand or token | No | |
| cc-safety-net | 142,750 | Trusted publishing | Yes | |
| @xmanrui/dsh-im | 127,901 | By hand or token | No | |
| dsh-mnemon | 111,832 | Token in CI | Yes | `rc` |
| @michengai/dsh-archive-manager | 111,209 | Trusted publishing | Yes | |
| dsh-free-search | 109,103 | By hand or token | No | |
| dsh-genui | 107,778 | Token in CI | Yes | `alpha` |
| dsh-dafeiyu | 103,848 | Trusted publishing | Yes | `alpha` |
| dsh-connect-workbuddy | 101,724 | By hand or token | No | |
| dsh-session-superagent | 95,782 | By hand or token | No | |
| dsh-remote | 93,212 | By hand or token | No | `windows-remote`, `fix-upload` |
| @tencent-connect/dsh-qqbot | 87,131 | By hand or token | No | |
| dsh-onebot-qq | 86,881 | By hand or token | No | |
| dsh-token-diet | 86,132 | By hand or token | No | |
| @michengai/dsh-codex-ui | 77,764 | Trusted publishing | Yes | |
| dsh-meme | 75,307 | By hand or token | No | |
| dsh-image-gen | 74,077 | By hand or token | No | |
| @deepseek-harness-tui/dsh-tui | 72,448 | Token in CI | Yes | |
| @liustack/modsearch | 71,032 | Trusted publishing | Yes | |
| @michengai/dsh-agency-agents | 70,509 | Trusted publishing | Yes | |
| @michengai/dsh-im-connect | 69,120 | Trusted publishing | Yes | |
| dsh-bili-scroll | 68,922 | By hand or token | No | |
| @changfenhuang/dsh-genui | 67,317 | Trusted publishing | Yes | `preview` |
| dsh-unlag | 66,812 | By hand or token | No | |
| dsh-vision-router | 64,589 | Trusted publishing | Yes | |
| dsh-univer-office | 63,920 | By hand or token | No | `alpha` |
| dsh-mobile-plugin | 63,541 | Trusted publishing | Yes | |
| @nanmicoder/dsh-agent-teams | 63,007 | Trusted publishing | Yes | `alpha`, `next` |
| dsh-plugin | 51,407 | By hand or token | No | |
| @wxg-prc-cpg/browser-skill-dsh-plugin | 50,782 | By hand or token | No | |

"Token in CI" means provenance without trusted publishing: the package was built in CI, which provenance requires, but authenticated with a token. A record without either cannot tell a publish by hand from one with a token.

## 2. npm tags

- 34 of 45 plugins (the 38 above and the 7 reference plugins) carry only `latest`.
- The other 11 mostly keep their own preview channels: `alpha`, `beta`, `rc`, `dev`, `preview`, `test`, and names such as `windows-remote`, `fix-upload` and `hevc`.
- Two align a tag with DSH versions. `dsh-github-copilot` publishes `alpha` = `0.1.0-alpha.5.dsh.0.2.1.rc.3`, which requires exactly DSH 0.2.1-rc.3. `@nanmicoder/dsh-agent-teams` publishes `next` = `0.1.24-rc.1`, whose DSH peers list exact release candidates.
- DSH's own tags: `latest` and `next` are 0.2.2-rc.1, and `alpha` is 0.2.2-alpha.3.

## 3. Workflows of the reference plugins

| Plugin (npm name) | CI on push and pull requests | Release starts on | Publishes with |
|---|---|---|---|
| @lujianjun19/dsh-llm-github-copilot | Build, unit tests, `npm run check`, and a test matrix over DSH versions (`test:harness`) | Tag push | Trusted publishing, then a GitHub Release |
| dsh-plugin-subscriptions | None; the release workflow runs the tests | Tag push | Trusted publishing with provenance after `npm pack --dry-run`, then a GitHub Release |
| @inventec/dsh-copilot-auth | Build and test, as a matrix | Tag push or manual start | Trusted publishing |
| @mars-sea/dsh-commandcode-provider | Type-check, tests, build, and engine, install and pack tests; `npm audit` in a separate workflow | Manual start | Trusted publishing of the tested tarball |
| dsh-copilot-catalog | A verification matrix | A published GitHub Release | Staged publishing (`pnpm stage publish --provenance`) in a GitHub environment named `npm` |
| dsh-github-copilot | Verification against DSH's own packages, as a matrix | Push to `main`; a release script decides | Trusted publishing through a script, and a workflow that verifies the published package |
| @huanlin/dsh-plugin-copilot | None | None | By hand, without provenance |

- 6 of the 7 publish through trusted publishing, all with provenance.
- No workflow uses a GitHub or Copilot account credential, so none runs a real sign-in. The only secret any of them names is GitHub's own `GITHUB_TOKEN`.

## 4. Release notes and commit style

| Plugin (npm name) | `CHANGELOG.md` | `CONTRIBUTING.md` | Conventional subjects in the last 30 commits | GitHub Release created by CI |
|---|---|---|---|---|
| @lujianjun19/dsh-llm-github-copilot | Yes | No | 23 | Yes: the install command and a link to `CHANGELOG.md` |
| dsh-plugin-subscriptions | No | No | 20 | Yes: GitHub's generated notes (`--generate-notes`) |
| @inventec/dsh-copilot-auth | No | No | 19 | No |
| @mars-sea/dsh-commandcode-provider | Yes | No | 1 | No |
| dsh-copilot-catalog | Yes | Yes | 7 | No: a GitHub Release published by hand starts the publish workflow |
| dsh-github-copilot | Yes | Yes | 26 | Yes: the version's section of `CHANGELOG.md`, through the GitHub API |
| @huanlin/dsh-plugin-copilot | No | No | 8 | No |

- 4 of the 7 keep a `CHANGELOG.md`, and 2 a `CONTRIBUTING.md`.
- 4 of the 7 write most commit subjects as Conventional Commits (`feat:`, `fix:`, `chore(release):`). The other three mix plain subjects such as "Upgrade to dsh 0.2.1-alpha.5" with occasional prefixes.
- `dsh-github-copilot` takes its release notes from the version's section of `CHANGELOG.md`, the approach of [cicd.md](../cicd.md).
