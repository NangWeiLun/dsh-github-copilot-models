# CI/CD

**Status:** proposed, not implemented. This document describes how the plugin is to be tested, released and published from GitHub Actions. Packaging, distribution and the DSH compatibility policy are in [packaging.md](packaging.md); manual tests are in [DEVELOPMENT.md](../DEVELOPMENT.md); the rules for pull requests are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Principles

- **Everything runs on GitHub.** No real GitHub or Copilot account, device or token is used in CI: sign-in and the Copilot API are faked by the unit and contract tests.
- **No npm token.** Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm accepts a publish only from this repository's `publish.yml`, through a short-lived token that GitHub issues for that run.
- **Two DSH versions.** Every test run covers DSH's npm tags `latest` and `next`, so that a DSH change is found before it reaches users of DSH `latest`.
- **A release is a version tag.** Only a `v*` tag pushed by the maintainer publishes; nothing else does. A tag ruleset on GitHub lets only the maintainer create, move or delete `v*` tags, so pushing the tag is the release decision and no further approval step follows.
- **Release notes come from pull request titles.** Titles follow the `<type>: <summary>` form of CONTRIBUTING.md, which sorts each change into the release notes or out of them.

## 2. Workflows

| Workflow | Runs on | Does |
|---|---|---|
| `ci.yml` | Push to `main`, pull requests, once a day, manual start | The title check (section 6) on pull requests, and the test job (section 3) |
| `publish.yml` | Push of a `v*` tag | The test job, then the publish job (section 4) |

```
maintainer: npm version (writes CHANGELOG.md) → git push --follow-tags
                                   │
publish.yml:  test (DSH latest, DSH next) ──pass──▶ publish (npm, trusted publishing) ──▶ GitHub Release (notes from CHANGELOG.md)
```

The daily run of `ci.yml` is what finds a break early: when DSH publishes a `next` that breaks the plugin, the run fails and GitHub notifies the maintainer, even if the plugin itself has not changed.

## 3. Test job

1. Install the plugin's dependencies (`npm ci`) and run `npm run check`: type-check, unit tests over fakes, build. The type-check uses the DSH versions pinned in `devDependencies`.
2. For each DSH tag, `latest` and `next` (once only when both name the same version):
   - **Contract tests:** install that DSH version into a temporary folder and run `npm run test:contract` with `DSH_INSTALL_DIR` pointing at it. The tests load the real DSH and pi-ai code, with GitHub and Copilot faked and the network blocked.
   - **Package check:** pack the plugin, install the tarball into a profile in a throwaway DSH home, and check that the composed configuration carries the plugin's row (`--dump-config`). The profile is signed out, so no request is sent.
3. A DSH version outside `engines.dsh` makes the package check fail, by design: it is the prompt to run the contract tests on that version and widen the range ([packaging.md](packaging.md#2-compatibility), section 2).

## 4. Publish job

1. Choose the npm tag from the version: a plain version (`0.1.1`) publishes as `latest`; a preview version (`0.2.0-next.0`) publishes as `next`.
2. Require the tests for the DSH the release is made for: DSH `latest` for a `latest` release, DSH `next` for a `next` release. A failure on the other DSH tag is reported but does not block the release.
3. Run `npm publish --tag <tag>` through trusted publishing. npm adds provenance, because the repository and the package are public.
4. Create a GitHub Release for the tag, with the version's section of `CHANGELOG.md` as its notes.

## 5. Release channels

| Release made for | Example version | npm tag | `engines.dsh` |
|---|---|---|---|
| DSH `latest` (and `next`, when it still works there) | `0.1.1` | `latest` | A range that covers DSH `latest` |
| DSH `next` only: a fix for a break that DSH `next` introduced | `0.2.0-next.0` | `next` | Starts at that DSH `next` version, so DSH `latest` refuses it |
| DSH moves that `next` to `latest` | `0.2.0` | `latest` | Unchanged |

- `dsh plugin add dsh-github-copilot-models` installs the `latest` tag. Users of DSH `next` opt in with `dsh-github-copilot-models@next`.
- `engines.dsh` is what keeps each user on a fitting version: DSH refuses to install or load a version whose range excludes the running DSH.
- A `next` release is promoted by publishing a plain version, so CI never needs permission to move npm tags.

## 6. Release notes

- **Pull request titles:** pull requests are squash-merged, so each title becomes one commit on `main`; the maintainer's direct commits use the same `<type>: <summary>` form. `ci.yml` rejects a pull request whose title does not follow [CONTRIBUTING.md](../CONTRIBUTING.md#pull-request-titles).
- **CHANGELOG.md:** `npm version` runs the package's `version` script, which writes the new version's section from the commit subjects since the previous tag. `feat` goes under Features, `fix` under Fixes, and any type marked `!` under Breaking changes; the other types are left out. The section becomes part of the version commit, so the maintainer can edit it and amend the commit before pushing the tag.
- **GitHub Release:** the publish job copies that section into the release for the tag.
- Contributors never edit `CHANGELOG.md`, so pull requests do not conflict on it.

## 7. Maintainer steps

**Each release:**

```sh
npm version 0.1.1 -m "chore: release %s"              # or: npm version preminor --preid next -m "chore: release %s"
git push --follow-tags origin main
```

`npm version` sets the version, writes the version's section of `CHANGELOG.md`, commits both and creates the tag; the push starts `publish.yml`. No npm login, 2FA or Copilot sign-in is needed.

**Once:**

1. Add `.github/workflows/ci.yml`, `publish.yml`, and the `version` script that writes `CHANGELOG.md`.
2. On GitHub, under the repository's Settings → General → Pull Requests, allow squash merging only, with the pull request title as the default commit message.
3. On GitHub, under the repository's Settings → Rules → Rulesets, add a tag ruleset for `v*` that restricts creations, updates and deletions, with the Repository admin role as the only bypass.
4. On npmjs.com, under the package's Settings → Trusted publisher → GitHub Actions, enter `NangWeiLun`, `dsh-github-copilot-models` and `publish.yml`, and allow `npm publish`. This asks for the maintainer's npm login and 2FA.
5. Complete the first publish from `publish.yml` within 2 days of step 4; an unused configuration expires.
6. Then, under the package's Settings → Publishing access, select "Require two-factor authentication and disallow tokens".

## 8. Limits

- **Real GitHub and Copilot are not tested.** A change in the real API (the host lookup, `/models`, chat requests) is not caught by the fakes; it surfaces through user reports. The manual release test in [DEVELOPMENT.md](../DEVELOPMENT.md#6-test-against-github), section 6, remains available but is not part of a release.
- **Only two DSH versions.** Versions between DSH `latest` and `next`, and DSH `alpha`, are not tested.
- **Release notes are as clear as the titles.** The title check enforces the form, not the wording.

## 9. Common practice

The design follows what most DSH plugins that publish from CI do: a tag push starts the workflow, which publishes through trusted publishing; most plugins carry only the `latest` tag; and none of the reference plugins uses a GitHub or Copilot account in CI. Conventional pull request titles and a `CHANGELOG.md` are also common among the reference plugins. The data is in [cicd-similar-plugins.md](study/cicd-similar-plugins.md).

## 10. Open decisions

- **DSH `alpha`:** a third test target, reported but never blocking.
