# UI

What the user sees of the plugin in the DSH web UI: where the Card appears, how it is laid out, its text, and its display metadata. What each control does is in the component designs: Login in [login.md](login.md), Models in [models.md](models.md).

Checked on the `web-dev` development profile ([DEVELOPMENT.md](../../DEVELOPMENT.md#3-profiles) section 3) against DSH 0.2.1-rc.5 on 2026-11-02 (Login) and 2026-11-03 (Models), and against DSH 0.2.2-rc.1 on 2026-11-07 (the Models card with the size control) and 2026-11-08 (the title, numbers and size fields, the Japanese price headers, and the Plugins page).

| Section | State |
|---|---|
| [U1. Card location](#u1-card-location) | **Open** |
| [U2. Menu entry](#u2-menu-entry) | Decided 2026-11-02 |
| [U3. Card layout](#u3-card-layout) | Built |
| [U4. Text and languages](#u4-text-and-languages) | Built |
| [U5. Theme](#u5-theme) | Built |
| [U6. Plugins page entry](#u6-plugins-page-entry) | Built |

## U1. Card location

Where the Card, the plugin's settings page, appears. **Open** since 2026-11-02. The choice also covers the Models component, whose model list and toggles go on the same Card (models.md A4). Moving the Card changes only the slot that `src/client/index.tsx` registers; the page itself stays the same.

**Now:** a section of its own in Settings (`settings.section`, id `github-copilot-models`), last in the menu (U2).

| Option | Slot | The user finds it at | Notes |
|---|---|---|---|
| Settings section (now) | `settings.section` | Settings → Models: Copilot | Three reference plugins do this. DSH describes the slot for feature pages. Limits in U2 |
| Plugins page: the bundle's page | `plugins.bundle.config`, keyed by `dsh-github-copilot-models` | Plugins → Installed plugins → GitHub Copilot models | Where DSH's docs put a third-party bundle's configuration. DSH draws our title, icon and description above it. `dsh-github-copilot` does this |
| Plugins page: our row's page | `plugins.row.config`, keyed by `dsh-github-copilot-models#github-copilot-models` | The bundle's page → **Configure** on our row | Also per DSH's docs; one click deeper. `dsh-plugin-copilot` does this |
| Models page: below the providers | `settings.models.footer` | Settings → Models, under the provider cards and **Add model provider** | One of two places the Models page offers outside plugins. The Card fits unchanged, and the extra Settings entry goes away. It cannot go between the cards and the button. `dsh-github-copilot` does this, falling back to a Settings section |
| Models page: inside a provider card | `settings.models.provider-card`, keyed by a route family's settings namespace | Settings → Models, inside the card of a provider row | Needs a provider row for our route first; whether `github-copilot-models` gets one is not checked. Suits the Models component more than the sign-in. `dsh-commandcode-provider` and `dsh-github-copilot` do this |

Sources, DSH 0.2.1-rc.5: the READMEs and slot types of `dsh-client-ui-plugin-manager` ("A plugin that carries its own configuration renders it on this page rather than in Settings"), `dsh-client-ui-settings-models` and `dsh-client-ui-settings`, and the [settings card cookbook](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-settings-card). Reference plugins: [ref-similar-plugins.md](../study/ref-similar-plugins.md#2-side-by-side) 2.

## U2. Menu entry

Applies while the Card is a Settings section (U1).

| Item | Value |
|---|---|
| Label | **Models: Copilot**; Chinese **模型：Copilot**. Chosen on 2026-11-02 |
| Position | Last, after DSH's own sections (`order: 91`; General, Models, Built-in plugins and Agent presets use 0, 10, 15 and 20) |
| Icon | A gear, which DSH chooses |

- **Label width.** The menu leaves 112 px for a label (14 px system font, measured on web-dev) and cuts a longer one with "…", without a tooltip. Measured widths: "Models: Copilot" 97 px, "模型：Copilot" 86 px. Rejected because they are cut: "GitHub Copilot Models" (141 px), "Models: GH Copilot" (122 px), "GitHub Copilot 模型" (123 px).
- **Icon.** DSH picks the icon by section id (`navIcon` in `dsh-client-ui-settings-general`) and has its own icons only for `account`, `models`, `agent-presets`, `plugins` and `archived-sessions`. Every other id gets the gear, and a section has no icon option, in DSH 0.2.2-alpha.2 either. The Models icon is out of reach without taking the id `models`, which belongs to DSH's own Models page.
- **Icon workaround, not used** (2026-11-02). dsh-better-sidebar and dsh-plugin-wallpaper-engine find their own menu entry in the page and swap the gear for their icon. Left out: it depends on DSH's menu markup and goes against DSH's guidance not to touch other parts of the page.

## U3. Card layout

Top to bottom:

1. **Heading and intro**, as on DSH's Models page: the heading "GitHub Copilot models" (Chinese "GitHub Copilot 模型"), the plugin's name on the Plugins page (U6), in DSH's page-title style; then the intro "Sign in to GitHub Copilot, then choose which models of your account appear in the model picker." Decided on 2026-11-07, when the page got its heading; the intro used to cover only signing in.
2. **Status card.** A dot and the title "GitHub Copilot", then the status text.
   - The dot is grey when signed out, green when signed in, and amber when a credential is stored but not verified (login.md A3).
   - While signed in: method, account, Copilot host and domain, with **Refresh** and **Sign out**.
   - Also shown here: the stored lookup error, "Checking the Copilot API address…", and "Changed outside the plugin. Press Refresh." (login.md A2).
3. **Sign-in card.** Titled "Sign in", or "Sign in again" while signed in, with the hint "A new sign-in replaces the stored credential."
   - **Domain** field: editable only while signed out (login.md A1).
   - **Browser:** the hint "Get a one-time code, then enter it on the GitHub page." and the header line "Requests to Copilot send the header `Copilot-Integration-Id: vscode-chat`.", then **Sign in with browser**, and **Cancel** while it runs. Below them the device code with a **Copy** button, the link, and the caption "Keep this page open until sign-in finishes." (login.md A4, B4).
   - **Personal access token:** a password field and **Save**, which stays disabled while the field is empty. Three notes below: the permission the token needs; the header line "Requests to Copilot send the header `Copilot-Integration-Id: copilot-developer-cli`."; and that DSH's built-in route does not work while a PAT is stored (login.md A2, A5).
   - **Header lines:** one text, `integrationHint` ("Requests to Copilot send the header {header}."), in all eight languages (U4), shown as a hint line in each section. The header comes from `INTEGRATION_ID` in `src/shared/api.ts`, the constant the Host sends with each method (login.md A5, models.md A1), so the Card shows the value in use. With a PAT, Copilot requires `copilot-developer-cli`; browser sign-in uses `vscode-chat`, the value pi-ai sends. Added on 2026-11-08.
4. **Models card**, below the sign-in card (chosen on 2026-11-03), titled "Models" (models.md A4, A6):
   - A hint: the models of the Copilot account, fetched from Copilot; switched-on models appear in the picker under "GitHub Copilot (plugin)".
   - A summary line: "`<n>` models from `<host>`, fetched `<time>`. `<n>` in the picker." While a fetch runs: "Fetching models…". After a failed fetch, the error, and that the list is from an earlier fetch (models.md A3, A10). Signed out with no list: "Sign in to list the models of your Copilot account."
   - **One block per model**, separated by thin lines: the models that can be served first, then those that cannot, each group in reply order (models.md A4). The panel is about 540 px wide, so the rows are stacked blocks, not a table: a first version as a table overflowed sideways (seen on web-dev, 2026-11-03). The blocks of the models that cannot be served sit in one fold after the others, "`<n>` models cannot be served", closed at first (open when no model can be served).
     - Head: the name; an amber "Policy: `<state>`" badge, only when the row's policy is not `enabled`; and the switch on the right. The switch is a copy of DSH's Switch primitive (`role="switch"`, 36×20 px), because DSH's plugin guide asks plugins to copy its primitives rather than import them. A row that cannot be served has no switch: its name is grey, "Cannot be served" stands on the right, and the reason code shows with its text, for example "NO_ENDPOINT: no endpoint this plugin can call". Decided on 2026-11-07 (models.md A4).
     - The id and the wire, in monospace.
     - **Info:** Copilot's `info_messages` as received, one line each, amber for a planned deprecation, for example "GPT-5.6 Terra has a planned deprecation date of 2026-11-16."
     - **Context and output:** two rows, **Context** and **Output**, with their labels in a column on the left. Each row is a field and a **Default** button; on a two-tier row, Context also has **Long**. A field shows the stored value, or Copilot's value when none is stored, as plain digits, and takes digits only: no separators in any language, because `,` and `.` swap meaning between languages (decided 2026-11-08, models.md A4). Full-width digits (０–９) count as digits and show as 0–9 once you leave the field. The buttons only fill their field and show as pressed while it holds their value. **Save**, under the two rows, stores both. Beside Save: why the values cannot be saved, checked as you type; the check that failed after Save; "Saved." after a save; and a warning while stored sizes no longer pass. Decided on 2026-11-05 (models.md A4).
     - **Prices:** a fold titled Prices, open at first, holding a small table indented under the title: captioned "AI credits per 1000000 tokens", a row each for Default and Long, and columns Prompt up to, Input, Output, Cache read, Cache write, and Cache write 1h where a model has it, numbers right-aligned. With nothing to fold, the title and the fact stand on one line: "Prices  All prices are 0" when every price is 0 (most rows in the replies seen), "Prices  Price not reported by Copilot" without billing. Rows that cannot be served keep their prices. Decided on 2026-11-07 (models.md A4).
     - **Details:** a fold titled Details, closed at first, with the row as received, as JSON.
     - The folds copy the "Customized" section of DSH's Models page: a grey title with a chevron that points right, and down while open. Each opens and closes on its own; the state is not stored, so a page reload brings back the first state.
   - **No longer returned:** ids with stored choices that the last fetch did not return, each with **Clear**. Shown only when there are any.
   - **Custom request headers:** name and value fields per header, **Remove** per row, **Add**, **Save headers**, and the note that they override the plugin's own headers, are stored as plain configuration, and that a change to the `/models` reply appears after Refresh.

   With a full list of about 30 rows, most of which cannot be served, the card was about 5,000 px tall, and about 5,900 px once Prices became an open fold (2026-11-07). The same day the rows that cannot be served were folded into one group, closed at first (models.md A4).

Results of an action appear under the control that started it. Sign in and Save are disabled while any sign-in runs, here or in another tab (login.md A4).

## U4. Text and languages

- The Card has text in the eight languages DSH 0.2.2-rc.1 offers: English, Chinese, Japanese, Spanish, French, German, Russian and Portuguese. Each language is one dictionary in `src/client/locales/` (`en.ts`, `zh.ts`, `ja.ts`, `es.ts`, `fr.ts`, `de.ts`, `ru.ts`, `pt.ts`), registered with DSH's locale service under the namespace `settings.github-copilot-models`, so the Card follows DSH's language setting. DSH requires English and Chinese; a text a language lacks falls back to English (DSH's fallback chain). Until 2026-11-08 the Card had only English and Chinese, so the other six showed it in English.
- English is the source of every key. The type checker requires every other language to have exactly English's keys; a unit test checks the placeholders, the parts that stay verbatim (the reason codes, `/models`, "GitHub Copilot (plugin)"), the menu label's width and the page heading.
- English titles and labels are in sentence case, as DSH's official plugin skill asks: only the first word and names start with a capital, as in "GitHub Copilot models" and "Copilot host". Names keep their own spelling, such as "Copilot Requests", GitHub's name for the token permission, and the reason codes. Checked on 2026-11-08: only the title was not; it was "GitHub Copilot Models" until then.
- Numbers and the time are written one way in every language: plain digits without separators (272000), a dot for decimals (0.25), and the fetch time as local 24-hour time (15:58), whatever the browser's language. `,` and `.` swap meaning between languages, so this form cannot be misread, and a count reads the way the size fields take it (models.md A4). Decided on 2026-11-08; until then numbers were written the English way (272,000) and the time followed the browser's language. The model picker's size label (328K) stays as it is (models.md A9).
- English and Chinese were written with the design. The other six were machine-translated on 2026-11-08, with DSH's own translations of shared words as the glossary, and nobody who speaks them has reviewed them. Decided on 2026-11-07.
- Kept as received in every language: model names, Copilot's notices (`info_messages`), the reason codes before their explanation, and the `Copilot-Integration-Id: …` header in the header lines (U3).
- Error messages are built on the Card from the codes and parameters the Host sends (login.md A8, A10).

## U5. Theme

- The Card uses DSH's theme variables (`--dsw-*`) for text colours, fonts, borders, radii and state colours, so it follows DSH's light and dark themes. Every font size, weight and line height comes from DSH's font tokens (`--dsw-font-*`; the monospace text from its code tokens, which follow DSH's code font size), since 2026-11-07; DSH has no tokens for sizes and spacing. Checked in both themes on 2026-11-02 (Login), and on 2026-11-03 for the Models card: the switch, the badges, the fields and the details box follow the dark palette. The Models card was also checked in English and Chinese on 2026-11-03. The head of 2026-11-07, with the switch copied from DSH's, was checked in both themes on web-dev that day: the switch's computed sizes and colours are those of DSH's Switch CSS.
- Styles are in `src/client/styles.ts`, scoped by a `gcm-` class prefix, and rendered with the Card, so they go away when it unmounts.

## U6. Plugins page entry

What the Plugins page shows for the bundle, read from the package without loading the plugin:

| Item | Value | File |
|---|---|---|
| Title | GitHub Copilot models (sentence case, U4), in DSH's eight languages, for example Chinese GitHub Copilot 模型, German GitHub Copilot-Modelle | `locale/<language>.json` (`meta.title`) for `en`, `zh`, `ja`, `es`, `fr`, `de`, `ru`, `pt` |
| Description | Sign in to GitHub Copilot with a browser code or a personal access token, and use the models of your Copilot account in DSH. Translated into the same languages (U4) | Same files (`meta.description`) |
| Icon | None yet: the Plugins page shows DSH's default plugin artwork. The first icon (2026-11-02) was removed on 2026-11-08 until one is designed ([todo.md](../todo.md)) | — |

The description was extended for the Models component on 2026-11-03, in both languages and in `package.json`. The first version was checked on the Plugins page on 2026-11-02 (DEVELOPMENT.md, section 4). On 2026-11-08 the page showed the title "GitHub Copilot models" with DSH's default plugin artwork.
