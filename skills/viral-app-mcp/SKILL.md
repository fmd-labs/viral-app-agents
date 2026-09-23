---
name: viral-app-mcp
description: Work with viral.app through its MCP server. Use when the user asks about viral.app data or workflows, social media analytics for tracked accounts and videos, UGC or creator campaign performance, tag workflows, or live TikTok/Instagram/YouTube/Facebook lookups. Covers connecting the server, OAuth vs API-key auth, the credit quote-then-confirm flow, and picking the right tool group.
---

# viral.app MCP

viral.app tracks and analyzes UGC performance across TikTok, Instagram, YouTube, and Facebook. Its MCP server exposes 50+ tools built on the same API procedures as the public REST API, so organization scoping, permissions, rate limits, and plan checks match normal API behavior.

- MCP endpoint: `https://viral.app/api/mcp` (streamable HTTP)
- Setup hub: https://viral.app/app/org/api/agents
- Full API reference: https://viral.app/api/v1/docs
- Authorized-client review/revocation: https://viral.app/app/user/settings/security

## Connecting and auth

If this plugin's MCP server (`viral_app`) is not yet authenticated, the user completes a browser OAuth flow (in Claude Code: `/mcp`, select `viral_app`, authenticate). During consent they pick ONE organization; the grant is permanently scoped to it.

Rules:

- Default to OAuth. Do NOT ask the user for an API key or add an `x-api-key` header unless they explicitly need one agent to switch between multiple viral.app organizations. API keys are created per organization at Settings -> API Keys and carry that organization's scope.
- If a call fails with an authorization error, the grant may have been revoked or the user removed from the organization; re-authenticate rather than retrying.

## Tool groups: pick the right one

- **Tracking** (`list_tracked_accounts`, `add_tracked_accounts`, `list_tracked_videos`, `get_tracking_status`, `refresh_*`): manage what viral.app follows over time. Adding an account or video starts background sync; cadence depends on the organization's plan.
- **Analytics** (`list_accounts`, `get_account_history`, `list_videos`, `get_video_history`, `get_analytics_kpis`, `get_top_*`): read the tracked historical dataset. This is the core workflow: track first, then query history.
- **Tags and workflows** (`list_tags`, `create_tag_workflow`, `add_video_tags`, `preview_tag_workflow`, ...): organization tags, account-level tag rules, tag workflows, and video tag assignments.
- **Live lookups** (`live_get_account`, `live_get_video`, `live_search_*`): fetch fresh platform data right now. Live results do NOT add anything to tracking and build no history. Use for just-in-time checks like "how many views does this video have right now?".
- **Creator Hub** (`list_creators`, `list_campaigns`, `list_projects`): campaign and creator management reads.

## Credits: quote then confirm

Live lookups and refresh tools spend viral.app credits and use a two-step protocol:

1. Call the tool WITHOUT `confirm` first. It spends nothing and returns `confirm_required`, `estimated_credits`, and `credits_remaining`.
2. Show the user the quote and get their explicit approval.
3. Call the same tool again with `confirm: true` to execute. The result includes a credit receipt.

Never pass `confirm: true` on the first call. Credit spends are rate limited per organization; if the limit trips, stop and tell the user instead of retrying.

## Data model notes

- Organization account IDs are prefixed `orgacc_`; they are NOT platform account IDs. Project IDs are prefixed `orgproj_`.
- Platform values are lowercase: `tiktok`, `instagram`, `youtube`, `facebook`.
- Date ranges use ISO `YYYY-MM-DD`.
- Use MCP tool discovery for exact input schemas; the server also exposes an `mcp://viral.app/docs` resource with the same guidance.
