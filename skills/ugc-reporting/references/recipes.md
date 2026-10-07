# Recipes

All ranges are ISO dates. "Previous period" means the same number of days directly before.

## Metric definitions

- **Views in period**: views gained by tracked videos during the range, whatever their post date. Lifetime totals (`viewCount`) include everything since posting.
- **New content**: videos published inside the range (`onlyPublished: true` or `publicationMode: "onlyPublished"`).
- **Campaign views** (`get_campaign_kpis`): views gained by videos posted while the creator was assigned to the campaign, counted as long as the assignment lasts.
- **Effective CPM**: spend (paid plus projected) per 1,000 campaign views; **paid CPM** uses paid spend only. Amounts come back in the campaign currency for a single campaign, otherwise the organization's default currency.
- **Comparisons**: `get_analytics_kpis` always compares with the period of equal length directly before (`previous`, plus `changes` as absolute differences). `get_campaign_kpis` with `scope: "dateRange"` does the same, with `changes` as percentages. Campaign KPI keys: `totalViews`, `publishedVideos`, `eligibleVideos`, `activeCreators`, `activeAccounts`, `payoutTotal`, `paidPayoutTotal`, `spendPerVideo`, `effectiveCpm`, `paidCpm`.
- **Engagement rate**: as returned by the tools; do not recompute it from rounded numbers.

## Weekly UGC recap

1. `get_analytics_kpis` for last Monday to Sunday (its `previous` block is the week before).
2. `get_top_videos` (`metric: "viewCountInPeriod"`, `limit: 10`) and the same with `onlyPublished: true` to separate new hits from evergreen videos.
3. `get_top_accounts` (`viewCountInPeriod`, `limit: 5`).
4. With a Creator Hub: `get_top_creators` (`viewCountInPeriod`), `get_campaign_kpis` (`scope: "dateRange"`), `get_campaign_activity` filtered to creators behind schedule, `get_payout_counts`.
5. Output: headline KPIs with week-over-week change, top 5 videos (account, platform, views in period, link), top creators, campaign health (on schedule vs behind, spend, CPM), payouts due.

## Monthly campaign recap

1. `list_campaigns` and pick the active ones (or the ones the user named).
2. Per campaign: `get_campaign_kpis` with `campaignIds: [id]`, `scope: "dateRange"` for the month; `get_campaign_activity` for pacing; `get_top_creators` filtered to the campaign's creators if needed.
3. Payouts: `list_paid_payouts` for what went out in the month (major units), `list_due_payouts` for what is owed now (minor units, divide by 10^`payoutPrecision`).
4. Output per campaign: views, posted vs eligible videos, spend, effective CPM, change vs the previous month, creators behind schedule, best video.

## Creator leaderboard

- `get_top_creators` with `metric` `viewCountInPeriod`, `videoCountInPeriod`, `averageViewsPerVideoInPeriod` or `engagementRateInPeriod`, depending on the question (reach, output, quality, engagement).
- `get_creator_history` in week buckets for a creator's trend; `get_creator` for linked accounts and contact status.

## Competitor benchmark

- Make sure competitors are tracked and flagged (`list_tracked_accounts`; `set_account_competitor` after the user agrees).
- Run `get_analytics_kpis` and `get_top_videos` with `viewMode: "internal"` and again with `viewMode: "competitors"` for the same range; compare views, posting volume and engagement.

## Markets

- `get_views_by_country` for the range: view gains per country with top accounts and videos. Pair it with a `chart-pie` card (share by market, up to 12 slices) or a `chart-bar` card (top markets):

```json
{ "card": "chart-bar", "title": "Views by market", "chart": {
    "xKey": "country", "series": [{ "key": "views", "name": "Views" }],
    "data": [{ "country": "US", "views": 6200000 }, { "country": "DE", "views": 2100000 }, { "country": "GB", "views": 1300000 }] } }
```

## Trend lines

- `get_account_history` and `get_creator_history` return day, week or month buckets of views, likes, posts, followers and engagement. Use week buckets for ranges over six weeks, day buckets below.
- Show them as `chart-area` with one row per bucket (2 to 500 rows, up to 6 series), for example `xKey: "date"` and series `views` and `likes`.

## Top lists as cards

- `get_top_videos` rows go into a `videos` card (up to 12): copy `platform`, `platformVideoId`, the account username, caption, thumbnail and metrics, and set `tracked: true`.
- `get_top_creators` rows go into a `creators` card (up to 24): `id`, `name`, accounts and the `*InPeriod` metrics.

## Slack-ready summary

```
*UGC weekly, Sep 22 to 28* (all tracked accounts, own content)
• Views: 4.2M (+18% vs prior week) · New videos: 63 (+5) · Engagement: 6.1% (-0.3 pt)
• Top video: @handle on TikTok, 910k views this week <link>
• Creators: 12 of 15 on schedule; behind: @a, @b
• Payouts due: 4 windows, 1,240.00 USD
Next: <one concrete suggestion>
```

Rules: bold title with the date range, one bullet per theme, signed changes, links instead of tables, under 10 lines.

## Prompts for recurring runs

Write prompts that stand alone, because a scheduled run has no memory of this chat:

> Every Monday at 9:00, use viral.app to summarize last week (Monday to Sunday) vs the week before for project orgproj_XXXX: views, new videos, engagement, top 5 videos by views gained, top 3 creators, campaigns behind schedule and payouts due. Format it as a short Slack-ready summary with links. If data for Sunday looks incomplete, say so.

> Keep this page updated from viral.app: KPIs for the last 30 days vs the 30 days before, top 10 videos by views gained, and per-campaign views, spend and CPM. Refresh the numbers each time the page is opened.

- ChatGPT: use the first as a scheduled task (or a team task in a workspace), the second as a page that stays updated from connected tools.
- Claude Desktop: a scheduled task with the first prompt. Claude Code: `/schedule` creates a cloud routine (add the viral.app connector to it; minimum interval one hour); `/loop 1d <prompt>` repeats only while the session stays open.
