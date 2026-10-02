---
name: viral-app-mcp
description: Core guide to the viral.app MCP server (UGC and creator-marketing analytics for TikTok, Instagram, YouTube, Facebook and Snapchat, plus the Creator Hub). Use whenever a task touches viral.app data or actions, to connect and authenticate the server, pick among its 100+ tools, follow the credit quote-then-confirm flow, get ids, units and date formats right, know what MCP cannot do, and load the specialized skill for the job (ugc-reporting, creator-campaigns, viral-research, ugc-automations). Not needed for general social-media advice that uses no viral.app data.
---

# viral.app MCP

viral.app tracks UGC performance across TikTok, Instagram, YouTube, Facebook and Snapchat and runs creator programs (campaigns, briefs, job postings, applications, chat, payouts). Its MCP server exposes 100+ tools built on the same procedures as the public API, so organization scoping, roles, rate limits and plan checks match the API.

- Endpoint: `https://viral.app/api/mcp` (streamable HTTP)
- Setup and API keys: https://viral.app/app/org/api/agents
- API reference: https://viral.app/api/v1/docs
- Review or revoke authorized clients: https://viral.app/app/user/settings/security
- The server also serves this guidance as the resource `mcp://viral.app/docs`; `search_content` and `read_content` search the viral.app docs.

## Pick the skill

| The user wants to | Load |
| --- | --- |
| Know how content, accounts, creators or campaigns performed; a weekly or monthly report; a recurring report | `ugc-reporting` |
| Write a brief, create or change a campaign, assign creators, post a job, answer applications, chat with creators, check payouts | `creator-campaigns` |
| Find what works in a niche, hooks, formats, similar videos, analyze a video's content | `viral-research` |
| Be alerted or have the agent act when something happens (new application, message, payout due, milestone); MCP Events (`events/list`) | `ugc-automations` |

## Connect and authenticate

- OAuth is the default. The user signs in in the browser and picks ONE organization; the grant stays scoped to it. In Claude Code: `/mcp`, select `viral_app`, authenticate. In Codex: `codex mcp login viral_app`.
- Do not ask for an API key or add an `x-api-key` header unless the user needs one agent to switch between several organizations. API keys are created per organization at https://viral.app/app/org/api/keys and carry that organization's scope.
- MCP needs a plan with API access. `UNAUTHORIZED` means the grant was revoked or the membership ended: re-authenticate, do not retry. `FORBIDDEN` names the missing role, scope or plan feature: tell the user.

## Rules for every tool

- **Track first, then analyze.** Tracking tools add accounts and videos, analytics tools read their history, `live_*` tools fetch current platform data without tracking it.
- **Credits: quote, then confirm.** Live lookups (`live_*`), refreshes (`refresh_*`) and `analyze_video` spend credits. Call without `confirm` first: nothing is spent and you get `estimated_credits` and `credits_remaining`. Show the quote, get explicit approval, then call again with the same arguments plus `confirm: true`. Never send `confirm: true` first. On `RATE_LIMITED`, stop and tell the user.
- **Anything that reaches people needs informed approval.** Tools that email, message or notify creators (`create_creator` with invite, `invite_creator`, `send_chat_message`, `reply_to_application`, `assign_creators_to_campaign`, brief writes with `notify: true`) are marked open-world: state the recipients and the exact text before calling. Set `notify: true` only when the user asked to notify.
- **Campaign writes need a preview.** Run `preview_campaign`, show its sentences and warnings, then pass its `previewHash` to `create_campaign` or `update_campaign`. Without it the call fails with `PREVIEW_REQUIRED`.
- **Content is markdown.** Briefs take `contentMarkdown`, job postings `bodyMarkdown` and `challengeBriefMarkdown`. Show the full draft before writing.
- **Jobs start as drafts.** `create_job` never publishes; `set_job_status` with `"public"` does, only after the user agrees.
- **Tracking is asynchronous.** After `add_tracked_accounts` or `add_tracked_videos`, data arrives over the next minutes. Do not poll in a loop; say it is syncing.
- **Read before replace.** `update_job`, `update_creator_accounts` and a brief's `sampleVideos` replace the whole value: read first (`get_job`, `get_creator`, `get_brief`) and send everything to keep.

## Ids, units and dates

- Organization account ids start with `orgacc_` (not platform ids), projects `orgproj_`, creators `orgcre_`, campaigns `orgcamp_`, briefs `orgbrief_`, jobs `orgjob_`, applications `orgjapp_`, library videos `orgrsv_`, chat threads `crchat_`, tags `orgtag_`/`systag_`.
- Platforms are lowercase: `tiktok`, `instagram`, `youtube`, `facebook`, `snapchat`.
- Date ranges are ISO `YYYY-MM-DD` (`{ from, to }`).
- Tag filters take tag ids from `list_tags` or `resolve_tags`. Names are silently ignored and the result comes back unfiltered.
- Money: campaign specs use major units (10 = 10.00). Job amounts, `list_due_payouts` and `list_upcoming_payouts` use minor units (divide by 10^precision). `list_paid_payouts` uses major units.
- Ranking: plain metrics (`viewCount`) rank lifetime totals; for "this week" or "last 30 days" rank by the `*InPeriod` metric.

## Showing results

In clients that render MCP Apps (Claude web, Desktop and mobile, ChatGPT), present results with `show`, using data you already fetched. It fetches nothing, changes nothing and costs no credits. One card per call; never invent or round numbers; once a card is shown, add the insight instead of repeating its numbers. In terminal clients (Claude Code, Codex CLI) `show` only returns the same data as markdown, so answer with text and tables there.

`show` takes one flat object: `card`, an optional `title`, and the one field named for the card.

| `card` | Field | Content |
| --- | --- | --- |
| `videos` / `video` | `videos` (1 to 12) / `video` | `platform`, `platformVideoId` plus metrics copied from `get_top_videos`, `list_videos` or `search_viral_video_library`; `tracked: true` for the organization's own videos, `id` (`orgrsv_`) for library videos |
| `account` | `account` | `platform` plus `username` or `platformAccountId`, and metrics (camelCase) |
| `creators` / `creator` | `creators` (1 to 24) / `creator` | `id`, `name`, `status`, `campaignName`, `accounts`, metrics |
| `campaign`, `job`, `brief` | same name | `{ "id": "orgcamp_…" }` (or `orgjob_`, `orgbrief_`) only; the card loads the rest |
| `kpis` | `kpis` | `tiles: [{ label, value, previousValue, format, currency, higherIsBetter }]`, `period`, `previousPeriod`; `previousValue` comes from the KPI tool's `previous` block |
| `chart-area`, `chart-bar`, `chart-pie` | `chart` | `xKey`, `series: [{ key, name }]`, `data` rows; pie: exactly one series and 2 to 12 rows |

```json
{ "card": "campaign", "title": "Fall launch", "campaign": { "id": "orgcamp_RwmraAffhMt9" } }
```

More examples per card: `references/cards.md`.

`open_viral_app_home` and `open_chat_cards` are ChatGPT UI entrypoints (the sidebar app and the conversation panel). Never call them yourself.

## Not available over MCP

Jobs Discovery (matching creators to jobs), starting or initiating payouts, canceling or reinstating payouts, deleting tracked accounts, and ad boosts. Point the user to the viral.app dashboard for these.

## Tool map

`references/tools.md` lists every tool by group with a one-line purpose. Use MCP tool discovery for exact input schemas.
