# Contributing

Contributions are welcome through pull requests. They are accepted under the project's [MIT licence](LICENSE).

## Before opening a pull request

- Set up the project and run the checks as described in [DEVELOPMENT.md](DEVELOPMENT.md): `npm run check` (type-check, unit tests, build) and `npm run test:contract` (offline checks against the installed DSH).
- The tests fake GitHub and Copilot and send no request. Before any live request to GitHub or Copilot, read [DEVELOPMENT.md](DEVELOPMENT.md#6-test-against-github), section 6: a fine-grained token of a Copilot Business account sent to the wrong Copilot host blocks the account's Copilot access for about an hour.
- Never commit a token, a `.env` file or a saved API reply (`schema/`).

## Pull request titles

Pull requests are squash-merged: the title becomes the single commit on `main` and a line in the release notes. Write it as `<type>: <summary>`, with the summary in the imperative, for example `fix: refuse a size above the prompt limit`.

| Type | Use for | In the release notes |
|---|---|---|
| `feat` | A new feature or a change in behaviour | Features |
| `fix` | A bug fix | Fixes |
| `docs` | Documentation only | No |
| `refactor` | A code change without a change in behaviour | No |
| `test` | Tests only | No |
| `ci` | Workflows | No |
| `chore` | Maintenance, dependencies and releases | No |

Mark a breaking change with `!` after the type, for example `feat!: rename the route id`. It is listed under Breaking changes, whatever its type.

## Changelog and releases

- Do not edit [CHANGELOG.md](CHANGELOG.md): the maintainer updates it for each release, from the pull request titles.
- Only the maintainer releases, by pushing a version tag ([docs/cicd.md](docs/cicd.md)).
