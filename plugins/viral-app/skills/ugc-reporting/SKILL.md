---
name: ugc-reporting
description: Build UGC performance reports from viral.app data, such as weekly or monthly recaps, KPI summaries with period-over-period change, leaderboards of top videos, accounts and creators, campaign KPIs and creator pacing, market breakdowns, Slack-ready summaries, and recurring reports through scheduled tasks or a ChatGPT page that stays updated. Use when the user asks how content, creators or campaigns performed over a period, wants a recap, dashboard or report for their team, or wants one on a schedule. Not for finding new formats or hooks (viral-research) or for alerts when a single event happens (ugc-automations).
---

# UGC performance reports

Reports read viral.app's tracked history. Load `viral-app-mcp` first if the server conventions (ids, units, tag ids) are not in context yet.

## 1. Settle the scope (ask only what you cannot infer)

- **Period**: "last week" = the last full Monday to Sunday; "last month" = the previous calendar month; "last 30 days" = the 30 days ending yesterday. Comparison period = the same length directly before. Dates are ISO `YYYY-MM-DD`.
- **Content**: whole organization, or `projects` (`list_projects`), `tags` (ids via `list_tags`/`resolve_tags`, never names), `accounts`, `platforms`. Own content only by default; `viewMode: "competitors"` or `"all"` for benchmarks.
- **Creator Hub**: campaigns (`list_campaigns`) and creators (`list_creators`) if the report covers paid creator programs.
- **Audience and format**: chat answer, cards, a Slack post, or a page or document.

## 2. Collect

1. `get_analytics_kpis` for the period and again for the comparison period. Compute absolute and percent change yourself.
2. `get_top_videos` with `metric: "viewCountInPeriod"` (limit 5 to 10). Add `onlyPublished: true` when the question is about content posted in the period.
3. `get_top_accounts` and, with a Creator Hub, `get_top_creators`, both on `*InPeriod` metrics.
4. Optional: `get_views_by_country` for markets; `get_account_history` or `get_creator_history` in week buckets for a trend line.
5. Campaigns: `get_campaign_kpis` with `scope: "dateRange"` (returns the previous-period comparison itself), `get_campaign_activity` with the behind-schedule filter for pacing, `get_payout_counts` for what is due.

Every leaderboard row already carries lifetime and in-period numbers: do not re-call with tweaked filters to cross-check. Recipes for each report type are in `references/recipes.md`.

## 3. Present

- Lead with 3 to 5 headline numbers and their change, then the leaderboards, then what to do next. Name the period, filters and data source in one line.
- Data syncs on each account's cadence, so the latest day can be incomplete: say so when the period ends today or yesterday.
- **UI clients** (Claude web, Desktop, mobile; ChatGPT): present with `show` cards built from the data you fetched: `kpis` for the headline numbers, `chart-area` for a trend, `chart-bar` for a leaderboard, `chart-pie` for a platform or market split, `videos` and `creators` for the top lists, `campaign` for one campaign. Add one or two sentences of interpretation; do not repeat every number in text.
- **Terminal clients** (Claude Code, Codex CLI): markdown tables. Skip `show` there; it only returns markdown.
- **Slack**: use the template in `references/recipes.md`: short, numbers first, links to the videos, no tables.

## 4. Make it recurring

Write a self-contained prompt that computes the period relative to the run date, names the filters by id, and states the output format. Then:

- **ChatGPT**: create a page that stays updated from connected tools (viral.app connected), or a scheduled task; in a team workspace a team task posts the same report for everyone.
- **Claude Desktop**: a scheduled task. **Claude Code**: a routine with `/schedule` (runs in the cloud; add the viral.app connector to the routine) or `/loop` while a session stays open.
- To react to single events instead of a fixed schedule (an application arrives, a video passes 100k views), use `ugc-automations`.

Prompt templates for these are in `references/recipes.md`.
