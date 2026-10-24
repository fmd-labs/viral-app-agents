# The REST API

For agents that call viral.app with an API key instead of MCP, for example one that reacts to webhooks and runs on a schedule. Every MCP tool is the same procedure as a REST route, so inputs, roles and limits match; ids, units and dates follow the conventions in `SKILL.md`. Differences: over REST a dry run's `previewHash` is optional (a write that differs from the preview it carries is refused with 409 `CAMPAIGN_PREVIEW_MISMATCH` or `CUSTOM_RATES_PREVIEW_MISMATCH`), and group chats, broadcasts, marking a thread read, editing a creator's name or email and linking a single account exist only over REST. Full reference: https://viral.app/api/v1/docs (OpenAPI: https://viral.app/api/v1/openapi.json).

## Requests

- Base URL `https://viral.app/api/v1`, key in the `x-api-key` header. Keys are created per organization at https://viral.app/app/org/api/keys and need a plan with API access.
- Query arrays and objects use brackets: `languages[]=en`, `campaignIds[]=orgcamp_…`, `dateRange[from]=2026-07-26`. With curl, pass them through `-G -d` (or add `-g`): curl reads brackets in a URL as a glob otherwise.
- List responses differ per route (`items` with `nextPageToken`, `data` with `page` and `total`, `threads`): read the shape in the reference.
- Writes that reach creators take idempotency keys (`clientMessageId` per chat message, `broadcastId` per broadcast); campaign and custom-rate writes take the `previewHash` of their dry run.

## Partners with sub-organizations

Partners that run one viral.app organization per app or customer get an API key with sub-organization access from viral.app. It goes in `x-api-key` like any key (a key created in the dashboard cannot manage sub-orgs; the `x-partner-key` of the jobs feed is a different key).

- `POST /sub-orgs` with your own `externalId` (unique, idempotent: a retry returns the existing one), `name` and optionally `url`, `logoUrl`, `defaultCurrency`. `GET /sub-orgs` lists them with their `externalId`.
- Add `x-va-organization-id: <sub-org id>` to act inside one sub-org; without it the key acts on your own organization. Plan limits are shared across the family.
- Reference: https://viral.app/api/v1/partners/docs.

## Errors

| Status | Meaning | Do |
| --- | --- | --- |
| 400 | Validation failed; the body names the fields | Fix exactly those and retry once |
| 401 | Key missing, wrong or revoked | Stop; do not retry |
| 402 | Plan or billing: `PLAN_LIMIT_REACHED`, `LIMIT_REACHED` (e.g. the active-jobs cap), `SUBSCRIPTION_LAPSED`, `PAYMENT_REQUIRED`, `SUB_ORG_FAMILY_PAYOUT_HOLD` | Not retryable: tell the user |
| 403 | Missing role, scope or plan feature | Tell the user what is missing |
| 409 | Conflict (already exists, locked, not invited yet) | Read the code; usually take the existing record or do the prerequisite |
| 429 | Over the rate limit (sub-org keys: 2,000 requests per 10 minutes across all sub-orgs unless agreed otherwise) | Wait `Retry-After` seconds |

## Webhooks

Instead of polling, subscribe to events: in the dashboard's Webhooks tab, or with a sub-org key via `POST /webhooks` (`includeChildOrgs: true` delivers every sub-org's events to one URL with one signing secret). Each event carries `id`, `type`, `timestamp`, `organizationId`, the sub-org's `externalId`, `actor` and `data`. Skip events whose `actor.apiKeyId` is your own key, so your own writes do not trigger your agent again. The event types are listed in the API reference; the ones per workflow are in each skill's REST file.

## Routes per skill

- Briefs and the viral library: `creator-briefs/references/rest-api.md`
- Creators, invitations, accounts, chat, broadcasts: `creator-management/references/rest-api.md`
- Campaigns and custom rates: `creator-campaigns/references/campaign-setup.md` (REST table)
- Job postings: `creator-campaigns/references/job-posting.md` (REST table)
- Applications: `count_applications`, `list_applications`, `get_application`, `reply_to_application`, `open_application_chat` are `GET /applications/counts`, `GET /applications`, `GET /applications/{id}`, `POST /applications/{id}/reply`, `POST /applications/{id}/chat`
- Payouts (reads): `get_payout_counts`, `list_due_payouts`, `list_upcoming_payouts`, `list_paid_payouts`, `get_payout_breakdown` are `GET /payouts/counts`, `/payouts/due`, `/payouts/upcoming`, `/payouts/paid`, `/payouts/{id}/breakdown`
