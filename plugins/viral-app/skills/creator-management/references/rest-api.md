# Creator management over the REST API

Base URL, keys, the partner header and query syntax: `viral-app-mcp/references/rest-api.md`.

## Routes

| Step | MCP tool | Route |
| --- | --- | --- |
| List, read creators | `list_creators`, `get_creator` | `GET /creators` (`search`, `ids[]`, `campaigns[]`, `statuses[]` for active or archived; filter invitation status and warnings yourself), `GET /creators/{id}`, `GET /creators/counts` |
| Create a creator | `create_creator` | `POST /creators` |
| Edit name, email, notes | (REST only) | `PUT /creators/{id}` |
| Replace linked accounts | `update_creator_accounts` | `POST /creators/{id}/accounts` (`accountIds`, `force`) |
| Link one account | (REST only) | `PUT /accounts/tracked/{orgAccountId}/creator` (`orgCreatorId`, or null to clear) |
| Track handles | `add_tracked_accounts` | `POST /accounts/tracked` |
| Tracked accounts | `list_tracked_accounts` | `GET /accounts/tracked` |
| Invite, resend | `invite_creator` | `POST /creators/{id}/invite` (`resend`) |
| Revoke an invitation | `revoke_creator_invitation` | `DELETE /creators/invitation` (`invitationId` = the creator row's `invitation.id`) |
| Applicant's handles | `get_application` | `GET /applications/{id}` (`socialAccounts`) |
| Direct thread | `start_creator_chat` | `POST /chat/threads` (`orgCreatorId` or `creatorUserId`) |
| Send a message | `send_chat_message` | `POST /chat/threads/{chatId}/messages` |
| Inbox | `list_chat_threads`, `get_chat_unread_count`, `get_chat_messages`, `search_chat_messages` | `GET /chat/threads` (`scope=org`), `GET /chat/unread-count` (`scope=org`), `GET /chat/threads/{chatId}/messages`, `GET /chat/threads/{chatId}/search` |
| Mark read | (REST only) | `POST /chat/threads/{chatId}/read` (`lastMessageId`) |
| Group chats | (REST only) | `POST /chat/groups`, `PATCH /chat/groups/{chatId}`, `POST` / `DELETE /chat/groups/{chatId}/members` |
| Broadcast | (REST only) | `GET /chat/broadcasts/preview`, `POST /chat/broadcasts` |
| Pace this period | `get_campaign_activity` | `GET /creator-hub/overview/activity` (`dateRange`, `progressFilter=behindSchedule`) |
| Brief readers | `get_brief_read_status` | `GET /briefs/{id}/read-status?filter=unread` |
| Seats | `get_usage_meter` | `GET /organization/meters/active_creators` |
| Payouts due | `get_payout_counts` | `GET /payouts/counts` |

Dashboard-only (no API): inviting many creators in one call, invite links, approving join requests, archiving a creator, deleting tracked accounts, creators submitting their own handles.

## Add a creator from a CSV row

```bash
# 1. Track the handles (already tracked ones come back under alreadyTracked)
curl https://viral.app/api/v1/accounts/tracked -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{
  "accounts": [
    { "platform": "tiktok", "username": "maya.ugc", "max_videos": 100 },
    { "platform": "instagram", "username": "maya.ugc", "max_videos": 100 }
  ]
}'

# 2. Find their orgacc_ ids
curl -G https://viral.app/api/v1/accounts/tracked -H "x-api-key: $VIRAL_APP_API_KEY" --data-urlencode "search=maya.ugc"

# 3. Create the creator, accounts linked, not invited yet
curl https://viral.app/api/v1/creators -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{
  "firstName": "Maya", "lastName": "Lopez", "email": "maya@example.com",
  "accountIds": ["orgacc_AbCdEf123456", "orgacc_GhIjKl789012"], "invite": false
}'
# 409 CREATOR_ALREADY_EXISTS: link the accounts to the existing creator instead

# 4. Invite once the user said so (sends a real email; resend:true re-sends a pending one, same link)
curl -X POST https://viral.app/api/v1/creators/orgcre_MnOpQr345678/invite -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{}'
```

`max_videos` takes 0, 10, 30, 60, 100, 200, 300, 400, 500, 1000, 2000 or 999999999 (unlimited). A plan limit answers 402 `PLAN_LIMIT_REACHED`, which is not retryable.

## Chat

```bash
# Direct message (409 CREATOR_NOT_INVITED for a creator who was never invited)
curl https://viral.app/api/v1/chat/threads -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{ "orgCreatorId": "orgcre_MnOpQr345678" }'
curl https://viral.app/api/v1/chat/threads/crchat_StUvWx901234/messages -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{
  "content": "Hey Maya! Could you send me your TikTok and Instagram usernames here?",
  "clientMessageId": "nudge-accounts-7f3a9c21"
}'

# Broadcast: preview the reach, then send (202, goes out in the background)
curl -G https://viral.app/api/v1/chat/broadcasts/preview -H "x-api-key: $VIRAL_APP_API_KEY" -d audience=campaigns -d 'campaignIds[]=orgcamp_YzAbCd567890'
curl https://viral.app/api/v1/chat/broadcasts -H "x-api-key: $VIRAL_APP_API_KEY" -H "content-type: application/json" -d '{
  "audience": "campaigns", "campaignIds": ["orgcamp_YzAbCd567890"],
  "content": "New week, new brief: have a look before your next post.",
  "broadcastId": "wk43-plannr-brief"
}'
```

- `content` max 8,000 characters. `senderIdentity: "member"` signs as the key owner ("Dennis from Acme"); the default signs as the brand.
- Broadcasts: `creators` (`orgCreatorIds`, up to 500), `campaigns` (`campaignIds`, up to 50), `all`, or `groups` (`groupChatIds`, up to 50). Text only. The same `broadcastId` with the same payload resends only what is missing.
- Groups: `{ "groupKind": "campaign", "campaignId": "orgcamp_…", "title": "Plannr US roster", "publicTitle": "Plannr creators" }`; `manual` takes `orgCreatorIds` (up to 500), `all` every active creator.

## Events

Subscribe in the dashboard's Webhooks tab, or with a sub-org key via `POST /webhooks` (`includeChildOrgs: true` for every sub-org). Every event carries `organizationId` and the sub-org's `externalId`; skip events whose `actor.apiKeyId` is your own key.

- Roster: `creator.created`, `creator.updated` (`changedFields`, e.g. accounts), `creator.invited`, `creator.joined`, `creator.invitation_declined`, `creator.invitation_revoked`, `creator.archived`, `creator.unarchived`, `creator.deleted`, `creator.join_request.created` / `approved` / `rejected` / `canceled`.
- Chat: `chat.message.received`, `chat.message.sent`, `chat.thread.updated`, `chat.system_message.created`.
- Work: `assignment.created`, `assignment.period_started`, `assignment.period_ended`, `video.published`, `sync.completed`. The last two are opt-in: a `"*"` subscription leaves them out, so list them by name.
