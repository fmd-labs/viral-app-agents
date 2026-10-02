# `show` cards: examples

`show` draws one card per call from data a previous tool returned. The input is a flat object: `card`, optional `title` (max 120 characters), and exactly the field named for the card. Copy values from tool results; never invent or round them.

## videos (1 to 12) and video

From `get_top_videos` or `list_videos` (the organization's tracked videos):

```json
{
  "card": "videos",
  "title": "Top videos, Sep 22 to 28",
  "videos": [
    {
      "platform": "tiktok",
      "platformVideoId": "7421234567890123456",
      "tracked": true,
      "accountUsername": "anna.creates",
      "caption": "Day 3 of budgeting",
      "thumbnailUrl": "https://assets.viral.app/tiktok/videos/thumbnail/7421234567890123456.webp",
      "publishedAt": "2026-09-23T17:02:11.000Z",
      "viewCount": 912000,
      "likeCount": 81000,
      "engagementRate": 0.094
    }
  ]
}
```

From `search_viral_video_library`, pass the library `id` (`orgrsv_…`) instead of `tracked`, so the card gets the library's menu. `video` takes one object of the same shape.

## account

```json
{ "card": "account", "account": { "platform": "instagram", "username": "acme", "tracked": true, "id": "orgacc_A1b2C3d4E5f6", "followerCount": 48200, "totalViews": 3100000, "engagementRate": 0.051 } }
```

Live results use snake_case: map `account_username` to `username`, `follower_count` to `followerCount`, `video_count` to `videoCount`. An account needs `username` or `platformAccountId`.

## creators (1 to 24) and creator

From `list_creators`, `get_creator` or `get_top_creators`:

```json
{
  "card": "creators",
  "title": "Top creators this month",
  "creators": [
    {
      "id": "orgcre_A1b2C3d4E5f6",
      "name": "Anna Kowalski",
      "status": "joined",
      "campaignName": "US Creators",
      "accounts": [{ "platform": "tiktok", "username": "anna.creates" }],
      "viewCountInPeriod": 1840000,
      "videoCountInPeriod": 14,
      "engagementRate": 0.072
    }
  ]
}
```

A creator needs a `name`, an `id` or at least one account. `engagementRate` is a ratio (0.05 = 5%).

## campaign, job, brief (id only)

```json
{ "card": "campaign", "campaign": { "id": "orgcamp_RwmraAffhMt9" } }
{ "card": "job", "job": { "id": "orgjob_RwmraAffhMt9" } }
{ "card": "brief", "brief": { "id": "orgbrief_RwmraAffhMt9" } }
```

The card loads the current record itself, so it never shows a stale copy.

## kpis

One tile per metric (up to 12). `get_analytics_kpis` and `get_campaign_kpis` (with `scope: "dateRange"`) return the current values plus a `previous` block for the period of equal length before; pass those as `previousValue` and the card computes the change.

```json
{
  "card": "kpis",
  "title": "Last 7 days",
  "kpis": {
    "period": { "from": "2026-09-22", "to": "2026-09-28" },
    "previousPeriod": { "from": "2026-09-15", "to": "2026-09-21" },
    "tiles": [
      { "label": "Views", "value": 15420000, "previousValue": 12100000 },
      { "label": "Engagement", "value": 0.1076, "previousValue": 0.1018, "format": "percent" },
      { "label": "Effective CPM", "value": 1.42, "previousValue": 1.61, "format": "currency", "currency": "USD", "higherIsBetter": false }
    ]
  }
}
```

`format`: `number` (default, compact), `percent` (a ratio), `currency` (major units, `currency` ISO code, default USD), `duration` (seconds). Set `higherIsBetter: false` for costs such as CPM.

## chart-area, chart-bar, chart-pie

`chart` holds `xKey`, `series` (each `{ key, name }`) and `data` rows keyed by `xKey` and each series `key`. Area and bar: 2 to 500 rows, up to 6 series. Pie: exactly one series and 2 to 12 rows with numeric values.

```json
{
  "card": "chart-area",
  "title": "Weekly views",
  "chart": {
    "xKey": "week",
    "series": [{ "key": "views", "name": "Views" }],
    "data": [
      { "week": "2026-09-01", "views": 2100000 },
      { "week": "2026-09-08", "views": 2480000 },
      { "week": "2026-09-15", "views": 3010000 }
    ]
  }
}
```

```json
{
  "card": "chart-pie",
  "title": "Views by platform",
  "chart": {
    "xKey": "platform",
    "series": [{ "key": "views" }],
    "data": [{ "platform": "TikTok", "views": 9800000 }, { "platform": "Instagram", "views": 4200000 }]
  }
}
```
