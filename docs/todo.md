# To do

**Planned**
- **Login from a chat command:** not started. [design/command.md](design/command.md)
- **Web search:** not started. [design/search.md](design/search.md)
- **Quota:** not in version 1. [design/quota.md](design/quota.md)
- **Images per request:** a default of 20, and a setting on the Card. [design/models.md](design/models.md#open-points) open point 14
- **Compaction warning:** warn on the Card when saved sizes leave context minus output too small for DSH's automatic compaction (78,020 tokens with DSH's defaults). [design/models.md](design/models.md) B5

**To decide**
- **Card location:** Settings (today), the Plugins page, or DSH's Models page. [design/ui.md](design/ui.md#u1-card-location) U1

**To check**
- **Translations:** six of the eight languages are machine-translated; have native speakers review them. [design/ui.md](design/ui.md#u4-text-and-languages) U4
- **Real requests,** one at a time: a custom header on a model request; whether the long-context tier needs the version header; a personal account; and the Chat endpoint once a model uses it. [design/models.md](design/models.md#not-verified)
- **Older docs:** re-read login.md, ui.md and [study/official-dsh-docs.md](study/official-dsh-docs.md) against DSH 0.2.2-rc.1 and pi-ai 1.5.0. [design/overview.md](design/overview.md#versions)

**Before the first release**
- **Acceptance test:** run the first-run test with both sign-in methods. [DEVELOPMENT.md](../DEVELOPMENT.md#6-test-against-github) section 6
- **Version matrix:** a packed-install smoke test on exact released DSH versions (the npm tags `latest`, `next`, `alpha`) in CI, as `dsh-llm-github-copilot` does, and a boot-level composition test. [packaging.md](packaging.md#2-compatibility) section 2
- **Icon:** not designed yet. Without one, DSH's Plugins page shows its default plugin artwork; the official plugin skill asks for an original icon.
- **Distribution:** npm, a tarball or GitHub. [packaging.md](packaging.md#1-how-the-plugin-is-packaged) section 1
- **Name:** check the names of the repository, the npm package and the route id. [design/overview.md](design/overview.md#names)
- **Install modes:** check that the plugin's settings survive a switch between npm and a local link. [DEVELOPMENT.md](../DEVELOPMENT.md#3-profiles) section 3
