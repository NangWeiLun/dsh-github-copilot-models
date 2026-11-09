# Quota

Status: not in version 1. Nothing is designed yet. This file keeps what was found.

Not re-checked against the versions in [overview.md](overview.md).

Evidence labels: **[tested]** a real call in this project. **[code]** read in source, not run. **[doc]** a README or comment says so. **[reported]** a third party says so. **[assumption]** an inference.

## The endpoint

`GET https://api.github.com/copilot_internal/user`. For another GitHub domain, `https://api.<domain>/copilot_internal/user`, as in [login.md](login.md) A1.

- **Undocumented.** The usage notes of `dsh-github-copilot` call it "not a stable public third-party REST contract" ([docs/copilot-usage.md](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/docs/copilot-usage.md#L101)) [doc]. Treat every field as optional.
- Several plugins use it for quota [reported]. dsh-plugin-subscriptions says Copilot has no usage endpoint [code]. Treat quota as fragile.
- **The Login component already calls it** at sign-in, at start-up and on Refresh, and reads only `endpoints.api` and `login` ([login.md](login.md) A3). A quota display could read `quota_snapshots` from that same reply, with no request of its own. This is an idea, not a decision.
- The reply carries `x-ratelimit-*` headers, so each call counts against a GitHub rate limit.

## How other plugins show quota

- **[`dsh-github-copilot`](https://github.com/cloga/dsh-github-copilot/tree/cb6bccbc861d1e09097abd5127772b9115a70c5a)**: reads `chat` and `premium_interactions` from `quota_snapshots`, keeps the result for 60 seconds, and shows a pill in the composer [code]. See its [`docs/copilot-usage.md`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/docs/copilot-usage.md) and [`src/copilot-usage-host.ts`](https://github.com/cloga/dsh-github-copilot/blob/cb6bccbc861d1e09097abd5127772b9115a70c5a/src/copilot-usage-host.ts). It calls the endpoint with the browser-login token [code].
- **Quota plugins in the survey:** [scan-similar-plugins.md, section 6](../study/scan-similar-plugins.md#6-quota-usage-and-other-plugins-that-use-copilot). Several read `copilot_internal/user` with `GITHUB_TOKEN`, `GH_TOKEN` or the credential of DSH's built-in route.

## Reply schema (field names only, no data)

Derived from one saved reply (not published; it holds account data). Only field names and types are recorded here.

**Request that produced it [tested, 2026-10-30, one call, a PAT]:** `GET https://api.github.com/copilot_internal/user` with only two headers, `Accept: application/json` and `Authorization: token <PAT>`. No `X-GitHub-Api-Version` and no editor headers. Result: `200 OK`, `application/json; charset=utf-8`.

**Top level, 13 fields that are not booleans**

| Field | Type | Note |
|---|---|---|
| `id` | integer | Account id |
| `login` | string | Account name. Read by Login |
| `access_type_sku` | string | Seat-type label |
| `analytics_tracking_id` | string | Opaque id |
| `assigned_date` | string, ISO-8601 datetime | When the seat was assigned |
| `copilot_plan` | string | Plan name |
| `enterprise_list` | array of object | Element field: `id` (integer) |
| `organization_login_list` | array of string | Organisation logins |
| `organization_list` | array of object | Element fields: `id` (integer), `login` (string), `name` (type not known) |
| `endpoints` | object | See below |
| `quota_reset_date` | string, `YYYY-MM-DD` | |
| `quota_reset_date_utc` | string, ISO-8601 datetime | |
| `quota_snapshots` | object | See below |

**Top level, 15 boolean flags:** `can_signup_for_limited`, `can_upgrade_plan`, `chat_enabled`, `cli_enabled`, `cli_remote_control_enabled`, `cloud_session_storage_enabled`, `copilot_app_enabled`, `copilotignore_enabled`, `editor_preview_features_enabled`, `enterprise_usage_telemetry`, `is_mcp_enabled`, `is_staff`, `restricted_telemetry`, `te` (meaning not known), `token_based_billing`.

**`endpoints`: 5 fields, all strings in origin form (scheme and host, no path)**

| Field | Use |
|---|---|
| `api` | The Copilot host for the account. Read by Login ([login.md](login.md) A3) |
| `proxy` | The host that the Copilot token's `proxy-ep` names. Replacing `proxy.` with `api.` gave the same value as `api` in the saved reply (offline check) |
| `origin-tracker`, `telemetry`, `exp` | Not used |

**`quota_snapshots`: 3 objects, `chat`, `completions` and `premium_interactions`.** All three have the same 14 fields with the same types (checked by script).

| Field | Type |
|---|---|
| `overage_count`, `credits_used`, `overage_entitlement`, `remaining`, `entitlement`, `quota_reset_at` | integer |
| `percent_remaining`, `quota_remaining` | number (float) |
| `overage_permitted`, `unlimited`, `has_quota`, `token_based_billing` | boolean |
| `quota_id` | string |
| `timestamp_utc` | string, ISO-8601 datetime |

**Response header names (24):** `access-control-allow-origin`, `access-control-expose-headers`, `cache-control`, `content-encoding`, `content-security-policy`, `content-type`, `date`, `etag`, `referrer-policy`, `server`, `strict-transport-security`, `transfer-encoding`, `vary`, `x-content-type-options`, `x-frame-options`, `x-github-edge-region`, `x-github-media-type`, `x-github-request-id`, `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `x-ratelimit-resource`, `x-ratelimit-used`, `x-xss-protection`. Keep `x-github-request-id` for support questions.

## Not verified

- Other plans. The parser of `dsh-github-copilot` also names `monthly_quotas`, `limited_user_quotas` and `limited_user_reset_date`, which the saved reply did not have [code]. They probably belong to other plans [assumption].
- The reply's fields with a browser-login token. Login sends this call with that token at every browser sign-in, but reads only `endpoints.api` and `login` ([login.md](login.md) A3); `dsh-github-copilot` reads the quota fields that way [code]. Also not tried: `Authorization: Bearer` (only the `token` scheme was used).
- Whether the reply changes with the headers the client sends. A third-party report says `endpoints.api` did, for one Enterprise account across Copilot CLI versions [reported, copilot-cli issue 5165].
