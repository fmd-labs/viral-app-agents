# viral.app MCP tools by group

One line per tool. `(credits)` marks quote-then-confirm tools, `(reaches people)` marks tools that email, message or notify creators. Exact input schemas come from MCP tool discovery.

## Plan and usage

- `get_plan_usage`: the organization's subscription, billing period and benefits (admins and owners only).
- `get_usage_meter`: usage against quota for one meter: `tracked_videos`, `tracked_accounts`, `active_creators`, `creator_invites_daily`, `active_jobs`, `team_seats`, `extra_credits`.

## Tracking

- `list_tracked_accounts`: tracking configuration (platform, username, max videos, competitor flag). For performance use `list_accounts`.
- `add_tracked_accounts`: start tracking accounts; many per call; asynchronous. Already tracked accounts come back under `alreadyTracked`.
- `refresh_tracked_accounts` (credits): force a fresh sync; asynchronous.
- `update_account_max_videos`: change how many recent videos an account tracks.
- `set_account_competitor`: mark or unmark an account as a competitor (separates it in analytics).
- `list_tracked_videos`, `add_tracked_videos`: individually tracked videos; adding is asynchronous.
- `refresh_tracked_videos` (credits): force a fresh sync of videos.
- `get_tracking_status`: recent sync runs (queued, running, completed, failed); filter by the event ids the add or refresh call returned.
- `resolve_tiktok_short_url`, `resolve_facebook_share_urls`: turn short or share links into usable handles or ids before tracking.
- `list_projects`: named groupings of tracked accounts (`orgproj_`), usable as filters.

## Analytics (tracked history)

- `get_analytics_kpis`: organization KPIs (views, likes, comments, shares, engagement) for a date range. Best first call for "how did we do".
- `get_top_videos`, `get_top_accounts`, `get_top_creators`: leaderboards for a date range; rank by `*InPeriod` metrics for time windows.
- `get_views_by_country`: view gains by country tag with each market's top accounts and videos.
- `list_accounts`, `get_account`, `get_account_history`: accounts with metrics; history in day, week or month buckets incl. followers.
- `list_videos`, `get_video`, `get_video_history`: videos with metrics; per-video time series.

Common filters: `dateRange`, `platforms`, `accounts`, `projects`, `tags` or `tagGroups` (ids only), `contentTypes` (`video`, `slideshow`), `viewMode` (`internal`, `competitors`, `all`), `publicationMode` or `onlyPublished`.

## Live lookups (credits; nothing is tracked)

- `live_get_video`, `live_get_account`, `live_get_account_videos`: current platform data for one video or account.
- `live_get_video_comments`: comments of a public TikTok video; one or two pages are usually enough.
- `live_search_users`, `live_search_videos`, `live_search_hashtags`: fresh platform search.

## Tags and tag workflows

- `list_tags`, `suggest_tags`, `resolve_tags`, `create_tag`, `update_tag`, `delete_tag`, `delete_tags_bulk`: organization tags. Tag items are `{ scope, tagId }`.
- `list_video_tags`, `list_video_tags_bulk`, `list_account_video_tags_bulk`: read tag assignments.
- `add_video_tags`, `add_video_tags_bulk`, `remove_video_tags`: tag specific tracked and synced videos.
- `set_tracked_account_tags`, `add_tracked_account_tags_bulk`, `remove_tracked_account_tag_from_all_videos`, `list_account_tag_rules`: account-level tag rules (apply to the account's videos).
- `list_tag_workflows`, `preview_tag_workflow`, `create_tag_workflow`, `update_tag_workflow`, `delete_tag_workflow`, `get_tag_workflow_impact`, `apply_tag_workflow_to_past_videos`, `list_tag_workflow_runs`: rules that tag videos automatically.

## Creators

- `list_creators`, `get_creator`, `get_creator_history`: the roster, one creator's detail and linked accounts, metrics over time.
- `create_creator` (reaches people with `invite: true`), `invite_creator` (reaches people), `revoke_creator_invitation`.
- `update_creator_accounts`: replaces the creator's linked accounts; read `get_creator` first.

## Campaigns

- `list_campaigns`, `get_campaign`: campaigns and how they pay, as summary sentences.
- `preview_campaign`: dry run that returns sentences, warnings and the `previewHash`; required before create and update.
- `create_campaign`, `update_campaign`, `reactivate_campaign`.
- `get_campaign_end_context`, `end_campaign`: end dates to offer and consent for running assignments.
- `get_assignment_options`, `assign_creators_to_campaign` (reaches people): start options, then one call for many creators.
- `get_campaign_kpis`: campaign views, posted videos, spend and CPM, with previous-period comparison for `scope: "dateRange"`.
- `get_campaign_activity`: per-creator pace (`onSchedule`, `runningTight`, `overdue`) for the current billing period.

## Briefs

- `list_briefs`, `get_brief`: briefs, their markdown, linked campaigns, samples, and how many creators a notify would reach.
- `create_brief`, `update_brief` (reach people with `notify: true`): markdown in `contentMarkdown`.
- `set_brief_campaigns`: reconcile which campaigns use the brief.
- `add_brief_sample_videos`: append tracked videos or viral-library videos (`libraryVideoId`) as samples.
- `delete_brief`: permanent; silent.

## Jobs and applications

- `count_jobs`, `list_jobs`, `get_job`: job postings by status (`draft`, `public`, `paused`).
- `create_job`: creates a DRAFT with `bodyMarkdown` and `challengeBriefMarkdown`; amounts in minor units.
- `update_job`: full replace; read `get_job` first and send every field.
- `duplicate_job`: copy into a new draft.
- `set_job_status`: `public` publishes, `paused` pauses, `public` again resumes.
- `list_applications`, `count_applications`, `get_application`: applications with filters (`jobIds`, `statuses`, `unreadOnly`, `bookmarkedOnly`, ...).
- `reply_to_application` (reaches people): message plus optional status `open`, `in_review`, `accepted`, `rejected`. Accepting onboards the creator.
- `open_application_chat`: the chat thread with an applicant (`chatId`).

## Creator chat

- `list_chat_threads`, `get_chat_unread_count`: inbox; organization staff use `scope: "org"`.
- `start_creator_chat`: get or create the direct thread with an invited creator.
- `get_chat_messages`, `search_chat_messages`: read a thread.
- `send_chat_message` (reaches people): needs a fresh random `clientMessageId` (8 to 64 chars) per message.

## Payouts (read only)

- `get_payout_counts`: counts by status; cheap first call for "do I owe anything?".
- `list_due_payouts`: finished billing periods not paid yet (minor units).
- `list_upcoming_payouts`: running billing periods (minor units).
- `list_paid_payouts`: payout history (major units).
- `get_payout_breakdown`: stored breakdown of one paid payout.
- `calculate_payout_preview`: runs the payout engine for ONE creator and window; heavy, never in loops.

## Viral video library and AI

- `search_viral_video_library`: curated library of proven performance-UGC videos with format, hook, `whyItWorked` and `replicationTip`.
- `find_similar_viral_videos`: more videos like one library result.
- `get_viral_video_insights`: deep breakdown of one library video (hook, CTA, persona, scenes).
- `analyze_video` (credits): AI watches one tracked video and answers a prompt, optionally into an `outputSchema`.

## Docs

- `search_content`, `read_content`: search and read viral.app docs and guides.

## Cards and event subscriptions

- `show`: render interactive cards (`videos`, `video`, `account`, `creators`, `creator`, `campaign`, `job`, `brief`, `kpis`, `chart-area`, `chart-bar`, `chart-pie`) in clients with UI; markdown fallback elsewhere.
- `list_event_subscriptions`, `delete_event_subscription`: see and remove MCP Events subscriptions (for example the ones ChatGPT created for a task).
