# Briefs over the REST API

For agents with an API key instead of MCP, for example one that runs on webhooks and schedules. Every MCP tool in the workflow is the same procedure as a REST route, so inputs, limits and errors match. Full reference: https://viral.app/api/v1/docs (OpenAPI: https://viral.app/api/v1/openapi.json).

## Requests

Base URL, keys, the header for sub-orgs, query syntax (`languages[]=en`; with curl use `-G -d`) and errors: `viral-app-mcp/references/rest-api.md`.

## Routes

| Step | MCP tool | Route |
| --- | --- | --- |
| Read briefs | `list_briefs`, `get_brief` | `GET /briefs`, `GET /briefs/{id}` |
| Read campaigns, creators, accounts | `list_campaigns`, `list_creators`, `list_tracked_accounts` | `GET /campaigns`, `GET /creators`, `GET /accounts/tracked` |
| Library search | `search_viral_video_library` | `GET /library/viral-videos` |
| More like one video | `find_similar_viral_videos` | `GET /library/viral-videos/{videoId}/similar` |
| One video in depth | `get_viral_video_insights` | `GET /library/viral-videos/{videoId}/ai-insights` |
| Own best videos | `get_top_videos` | `GET /analytics/top-videos` |
| Create | `create_brief` | `POST /briefs` |
| Attach samples | `add_brief_sample_videos` | `POST /briefs/{id}/samples` |
| Who reads it | `set_brief_audience` | `PUT /briefs/{id}/audience` |
| Send to single creators | `update_brief_creators` | `PATCH /briefs/{id}/creators` |
| Link campaigns only | `set_brief_campaigns` | `PUT /briefs/{id}/campaigns` |
| Edit | `update_brief` | `PUT /briefs/{id}` |
| Who read it | `get_brief_read_status` | `GET /briefs/{id}/read-status` |
| Delete (permanent, silent) | `delete_brief` | `DELETE /briefs/{id}` |

## Find samples

```bash
curl -G https://viral.app/api/v1/library/viral-videos \
  -H "x-api-key: $VIRAL_APP_API_KEY" \
  --data-urlencode "search=college study planner app" \
  -d 'languages[]=en' -d limit=12
```

- `data[]` items carry `id` (`orgrsv_…`, the id to attach), `platform`, `platformVideoId`, `accountUsername`, `thumbnailUrl`, `viewCount`, `outlierFactor`, `formatPrimary`, `hookArchetype`, `hookTextOverlay`, `whyItWorked` and `replicationTip`. Facet values are snake_case ids: write them in plain words in the brief.
- The default sort ranks a search by relevance; keep it. Use 3 to 6 words: long sentences match nothing. An empty `data` after one shorter retry means the library has nothing on the topic (`related=true` tops a thin result up with related videos, flagged `relatedMatch`).
- Filters: `formats[]`, `hookArchetypes[]`, `productTypes[]`, `verticals[]`, `languages[]` (ISO 639-1, the language in the video; omitted, every language), `platform` (`tiktok`, `instagram`), `dateRange` (`all`, `7d`, `14d`, `30d`), `minViews`, `minOutlierFactor`; `limit` up to 60, paging with `offset` / `nextOffset`. Filter values: `viral-research/references/library-filters.md`.
- More of one kind: `GET /library/viral-videos/{videoId}/similar?limit=8` (up to 24).

Own tracked videos over the last 90 days:

```bash
curl -G https://viral.app/api/v1/analytics/top-videos -H "x-api-key: $VIRAL_APP_API_KEY" \
  -d 'dateRange[from]=2026-07-26' -d 'dateRange[to]=2026-10-24' -d metric=viewCountInPeriod -d limit=20
```

Items carry `platform`, `platformVideoId` and `orgAccountId` for attaching.

## Create and attach

```bash
curl https://viral.app/api/v1/briefs -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{
  "name": "Plannr: deadline panic",
  "contentMarkdown": "Hi $creator_first_name,\n\n## The assignment\n...",
  "notify": false
}'
# → { "id": "orgbrief_…", "version": 1 }

curl https://viral.app/api/v1/briefs/orgbrief_AbCdEf123456/samples -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{
  "videos": [
    { "libraryVideoId": "orgrsv_AbCdEf123456", "label": "Deadline panic" },
    { "libraryVideoId": "orgrsv_GhIjKl789012", "label": "Screen-recording reveal" },
    { "platform": "tiktok", "platformVideoId": "7419876543210987654", "orgAccountId": "orgacc_MnOpQr345678", "label": "Before / after" }
  ],
  "notify": false
}'
```

- `name` is internal (creators never see it), unique per organization (409 `DUPLICATE_TITLE`), max 150 characters. `contentMarkdown` max 50,000; an unknown `$variable` is refused (400 `CONTENT_INVALID`), a price like `$10` is fine.
- Samples append after the brief's existing ones, in the order sent; videos the brief already lists are skipped (the answer counts `addedCount` and `skippedCount`). Library videos are tracked as reference-only samples (hidden from analytics and payouts) and count against the tracked-videos limit (402 when the plan has no room). Labels max 60 characters. Up to 50 videos per call; keep a brief at 10 or fewer.
- A library video that left the library fails the whole call with 404 `LIBRARY_VIDEO_NOT_FOUND`, listing it in `data.libraryVideoIds`: drop those ids and send the rest again.
- `POST /briefs` can also take the audience (`campaignIds`, `creatorIds`, `allCreators`) directly; setting it in a separate step after the user confirms keeps the draft a draft.

## Audience and notify

```bash
# notify true only after the user said yes to notifying (SKILL.md rule 5)
curl -X PUT https://viral.app/api/v1/briefs/orgbrief_AbCdEf123456/audience -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" \
  -d '{ "campaignIds": ["orgcamp_StUvWx901234"], "notify": false }'
```

- `allCreators: true` reaches everyone at the organization, creators who join later included. It excludes campaign and creator links: send `campaignIds: []` and `creatorIds: []` in the same call when links exist (409 otherwise).
- `campaignIds` link campaigns (a campaign holds one brief, so linking moves it off its old one); `creatorIds` send it directly, outside any campaign. Omitted parts stay as they are; removals are silent.
- `PATCH /briefs/{id}/creators` with `add` / `remove` (org creator ids, up to 500 per call) changes single creators without touching the rest. Not available on a brief for everyone at the organization.
- `notify: true` sends the creators it newly reaches a chat message and an email. Everyone it reaches has to read it on their next visit either way.
- `PUT /briefs/{id}` changes only the fields it is sent. `sampleVideos`, when sent, is the complete new list (read `GET /briefs/{id}` first and copy each entry's `orgAccountId`, `platform`, `platformVideoId`, `url` and `label`); omitted, the samples stay. `notify: true` bumps the version and every creator in the audience must read it again; `notify: false` saves in place.
- `notifiableCreatorCount` (on `GET /briefs/{id}`; writes return only `id` and `version`) is how many creators a notify on an edit or a sample change would reach right now. It decides the notify question for `PUT /briefs/{id}` and `POST /briefs/{id}/samples` only; for audience changes, count the joined creators the change newly reaches.

## Events

Webhook events for an agent that reacts instead of polling (subscribe in the dashboard's Webhooks tab, or a sub-org key with `POST /webhooks` and `includeChildOrgs: true`):

- `brief.published`: a brief reached creators. `data.kind` is `created`, `updated` or `assigned`; `data.brief` carries `id`, `name`, `version`, `campaignIds`, `creatorIds`, `allCreators` and `lastNotifiedAt`.
- `brief.read`: a creator read a version for the first time. `data.briefId`, `data.version`, `data.creator.userId`, `data.creator.orgCreatorId`, `data.readAt`.

Every event carries `organizationId` and the sub-org's `externalId`. Skip events whose `actor.apiKeyId` is your own key, so your writes do not trigger your agent again.
