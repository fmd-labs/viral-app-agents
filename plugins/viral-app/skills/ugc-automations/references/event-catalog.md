# viral.app event catalog

The MCP Events catalog is viral.app's customer webhook catalog plus three tracking events: 56 events, each offered for webhook delivery (ChatGPT) and polling (the Claude Code channel). `events/list` returns them 20 per page with `nextCursor`; each has an `inputSchema` and a `payloadSchema` and lists `x-viral-text-fields`, the paths into `data` that hold free text people wrote.

Filters: every argument is optional and narrows the stream; unknown names or wrong types are refused (-32602). No filters means every event of that type in the organization.

| Filter | Value |
| --- | --- |
| `chatId` | a conversation, `crchat_…` |
| `creatorId` | a roster creator, `orgcre_…` |
| `creatorUserId` | a creator's user, `user_…` (applicants and join requests have no roster id yet) |
| `campaignId` | a campaign, `orgcamp_…` |
| `briefId` | a brief, `orgbrief_…` |
| `jobId` | a job posting, `orgjob_…` |
| `accountId` | a tracked account, `orgacc_…` |
| `platform` | `tiktok`, `instagram`, `youtube`, `facebook`, `snapchat` |
| `minMilestone` | integer: only milestones at least this high (for example 100000) |
| `status` | an application status (`open`, `in_review`, `accepted`, `rejected`, `withdrawn`, `auto_closed`, `invited`, `not_interested`, `answered`, `retracted`) |

Latency: events become pollable about 10 seconds after they happen and the channel polls about every 30 seconds; ChatGPT receives webhooks as they are sent. Daily jobs and the tracking sync add their own delays (noted below).

## Chat (near real time)

Filters on every chat event: `chatId`, `creatorId` (direct threads only), `campaignId` (campaign groups only).

| Event | When | Free text |
| --- | --- | --- |
| `chat.message.received` | A creator sent a message in a direct thread or a group (`isFirstMessage` marks the first) | `message.content`, `message.replyTo.contentPreview`, `thread.title`, `thread.publicTitle` |
| `chat.message.sent` | Your side sent a message (dashboard, API, Copilot, broadcast, application reply, join note) | same as above |
| `chat.system_message.created` | viral.app posted a status message (application decision, assignment, payout, group created) | same as above |
| `chat.message.updated` | A message was edited | same as above |
| `chat.message.deleted` | A message was deleted (the id stays) | `thread.title`, `thread.publicTitle` |
| `chat.reaction.added` / `chat.reaction.removed` | An emoji reaction was added or taken back | `thread.title`, `thread.publicTitle` |
| `chat.thread.updated` | A group was renamed or a manual group's members changed | `thread.title`, `thread.publicTitle` |
| `chat.thread.deleted` | A conversation and its messages were deleted | `thread.title`, `thread.publicTitle` |

Do not act on `chat.message.sent` with replies: your own replies trigger it (loops).

## Creators (near real time)

| Event | When | Filters | Free text |
| --- | --- | --- | --- |
| `creator.created` | Added to the roster (by hand, accepted application, approved join request, invitation link) | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.updated` | Your team changed profile, notes, tags or tracked accounts (`changedFields`) | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.invited` | A platform invitation was emailed or re-sent | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.invitation_declined` / `creator.invitation_revoked` | Declined by the creator, or revoked by your team | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.joined` | Became a member of your organization on viral.app | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.archived` / `creator.unarchived` | Archived, or restored to the active roster | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.deleted` | Removed for good (by your team, or the creator deleted their account) | `creatorId`, `creatorUserId` | `creator.notes` |
| `creator.join_request.created` | A creator asked to join through your invitation link | `creatorUserId` | `joinRequest.message` |
| `creator.join_request.approved` | Approved; the creator was onboarded | `creatorUserId`, `creatorId` | `joinRequest.message`, `creator.notes` |
| `creator.join_request.rejected` / `.canceled` | Rejected by your team, or canceled after 30 days without a decision | `creatorUserId` | `joinRequest.message` |

## Campaigns and briefs

| Event | When | Filters | Free text |
| --- | --- | --- | --- |
| `campaign.created` / `campaign.updated` / `campaign.deleted` | Created; name, description, video target, payout terms or end date changed; deleted | `campaignId` | `campaign.description` |
| `campaign.started` | Reached its start date (right away, or shortly after 00:00 UTC on the day) | `campaignId` | `campaign.description` |
| `campaign.ended` | Its last day passed (shortly after 00:00 UTC the next day) | `campaignId` | `campaign.description` |
| `campaign.reactivated` | Its end date was cleared | `campaignId` | `campaign.description` |
| `brief.published` | A brief reached its creators (published with a notification, or newly linked, sent or shared) | `briefId`, `campaignId`, `creatorId` | none |
| `brief.read` | A creator read a brief version for the first time | `briefId`, `creatorId`, `creatorUserId` | none |

## Assignments and billing periods

Filters on every assignment event: `campaignId`, `creatorId`. No free text.

| Event | When |
| --- | --- |
| `assignment.created` | A creator was assigned to a campaign (now, backdated or in the future) |
| `assignment.started` | An assignment became active (right away, or shortly after 00:00 UTC on its first day) |
| `assignment.updated` | An end was scheduled, moved or cleared (`previous` holds the old dates) |
| `assignment.canceled` | Removed entirely; periods it covered are no longer due |
| `assignment.ended` | Its last day passed |
| `assignment.period_started` | A new billing period began (periods turn at 00:00 UTC) |
| `assignment.period_ended` | A billing period completed; `payoutState` says `due`, `paid` or `canceled` |

## Payouts (paying stays in the dashboard)

Filters on every payout event except `payout_hold.changed` (none): `campaignId`, `creatorId`.

| Event | When | Free text |
| --- | --- | --- |
| `payout.due` | A billing window became due (morning pass around 06:40 UTC; windows already due when you subscribed are not reported, `list_due_payouts` has them) | none |
| `payout.due_cleared` | A due window left the Due tab (paid, partials, written off, closed at zero, canceled, retracted) | none |
| `payout.initiated` | A payout was issued or marked as paid | `payout.notes`, `payout.reference`, `payout.lineItems[].title` |
| `payout.status_changed` | The payout provider moved a payout | same as above |
| `payout.paid` | Money reached the creator | same as above |
| `payout.withdrawn` | Your team withdrew an unclaimed payout; the window is due again | same as above |
| `payout.canceled` / `payout.reinstated` | A window's payout was canceled, or reinstated | none |
| `payout_hold.changed` | The organization's payout hold changed (`watch`, `soft`, `hard`, lifted) | none |

## Jobs and applications (near real time)

| Event | When | Filters | Free text |
| --- | --- | --- | --- |
| `job.created` / `job.updated` / `job.deleted` | Created (draft or published) or duplicated; a published or paused posting was edited; deleted | `jobId` | `job.productDescription` |
| `job.status_changed` | Published, paused or resumed | `jobId` | `job.productDescription` |
| `application.created` | A creator applied (`source: applied`) or your team invited a matched creator (`invited`) | `jobId`, `creatorUserId` | none |
| `application.submitted` | An application arrived and waits on your team; count applications by this one | `jobId`, `creatorUserId` | none |
| `application.status_changed` | Moved to in review, accepted, rejected, withdrawn, answered, declined, retracted or auto-closed after 14 days | `jobId`, `creatorUserId`, `status` | none |

Application payloads carry the applicant's name and country, not their answers: read those with `get_application`.

## Tracking (follows each account's sync cadence: hours, not seconds)

These three are opt-in on viral.app's customer webhooks (an endpoint subscribed to all events does not receive them); over MCP you subscribe to them by name like any other event.

| Event | When | Filters | Free text |
| --- | --- | --- | --- |
| `video.published` | A tracked account posted a new video, seen in the next sync (only videos published after tracking started) | `accountId`, `platform` | `video.caption` |
| `video.views_milestone` | A tracked video passed 10k, 50k, 100k, 250k, 500k, 1M, 5M or 10M views in the synced data (one event per milestone) | `accountId`, `platform`, `minMilestone` | none |
| `account.followers_milestone` | A tracked account passed 1k, 10k, 50k, 100k, 500k, 1M, 5M or 10M followers | `accountId`, `platform`, `minMilestone` | none |

## Who may subscribe

Subscribing and polling need a plan with API access and the role that may read the matching data (viewers, members, admins and owners; never creators). The organization holds at most 100 live subscriptions, ChatGPT automations and Claude Code watches together; `list_event_subscriptions` and `delete_event_subscription` show and remove them.
