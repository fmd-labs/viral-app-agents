# viral.app event catalog

The MCP Events catalog is viral.app's customer webhook catalog plus three tracking events. The "Narrow by" column names the kind of filter that makes sense; the exact argument names and which filters each event accepts come from `events/list` (Claude Code: `list_events`; ChatGPT: the plugin's event list). Payloads keep ids and short fields; fetch full records with the read tools.

## Chat (near real time)

| Event | When | Narrow by | Follow up with |
| --- | --- | --- | --- |
| `chat.message.received` | A creator sent a message in a direct thread or a group | chat, creator, campaign | `get_chat_messages`, `send_chat_message` |
| `chat.message.sent` | Your side sent a message (dashboard, API, Copilot, broadcast, application reply) | chat | avoid acting on it (loops) |
| `chat.message.updated` | A message was edited | chat | `get_chat_messages` |
| `chat.message.deleted` | A message was deleted | chat | |
| `chat.reaction.added` / `chat.reaction.removed` | An emoji reaction was added or taken back | chat | |
| `chat.system_message.created` | viral.app posted a status message (application decision, assignment, payout) | chat | |
| `chat.thread.updated` | A group was renamed or its members changed | chat | `list_chat_threads` |
| `chat.thread.deleted` | A conversation was deleted | chat | |

## Creators (near real time; join request cancel after 30 days)

| Event | When | Narrow by |
| --- | --- | --- |
| `creator.created` | A creator was added to the roster | |
| `creator.updated` | Your team changed a creator's profile, notes, tags or accounts | creator |
| `creator.archived` / `creator.unarchived` | Archived or restored | creator |
| `creator.deleted` | Removed for good | creator |
| `creator.invited` | A platform invitation was emailed (or resent) | creator |
| `creator.invitation_declined` / `creator.invitation_revoked` | Invitation declined by the creator, or revoked by your team | creator |
| `creator.joined` | A creator became a member of your organization | creator |
| `creator.join_request.created` | A creator asked to join through your invitation link | |
| `creator.join_request.approved` / `.rejected` / `.canceled` | The request was decided, or canceled after 30 days | |

## Campaigns and briefs

| Event | When | Narrow by |
| --- | --- | --- |
| `campaign.created` / `campaign.updated` / `campaign.deleted` | Created, changed (name, target, pay terms, end date), deleted | campaign |
| `campaign.started` | Reached its start date (shortly after 00:00 UTC) | campaign |
| `campaign.ended` | Its last day passed (shortly after 00:00 UTC the next day) | campaign |
| `campaign.reactivated` | Its end date was cleared | campaign |
| `brief.published` | A brief reached its creators (published with a notification, or newly linked) | brief, campaign |
| `brief.read` | A creator read a brief version for the first time | brief, creator |

## Assignments and billing periods (period events after 00:00 UTC)

| Event | When | Narrow by |
| --- | --- | --- |
| `assignment.created` | A creator was assigned to a campaign | campaign, creator |
| `assignment.started` | An assignment became active | campaign, creator |
| `assignment.updated` | An assignment's end was scheduled, moved or cleared | campaign, creator |
| `assignment.canceled` | An assignment was removed entirely | campaign, creator |
| `assignment.ended` | An assignment's last day passed | campaign, creator |
| `assignment.period_started` | A new billing period began | campaign, creator |
| `assignment.period_ended` | A billing period completed; a `payout.due` follows when there is an amount | campaign, creator |

## Payouts (read-only follow-ups; paying stays in the dashboard)

| Event | When | Narrow by |
| --- | --- | --- |
| `payout.due` | A billing window became due (morning pass around 06:40 UTC) | campaign, creator |
| `payout.due_cleared` | A due window left the Due tab (paid, written off, canceled, retracted) | campaign, creator |
| `payout.initiated` | A payout was issued or marked as paid | campaign, creator |
| `payout.status_changed` | The payout provider moved a payout | creator |
| `payout.paid` | Money reached the creator | campaign, creator |
| `payout.withdrawn` | Your team withdrew an unclaimed payout; the window is due again | creator |
| `payout.canceled` / `payout.reinstated` | A window's payout was canceled, or reinstated | campaign, creator |
| `payout_hold.changed` | The organization's payout hold changed (`watch`, `soft`, `hard`, lifted) | |

## Jobs and applications (near real time)

| Event | When | Narrow by | Follow up with |
| --- | --- | --- | --- |
| `job.created` / `job.updated` / `job.deleted` | A posting was created, edited (published or paused ones), deleted | job | `get_job` |
| `job.status_changed` | Published, paused or resumed | job | |
| `application.created` | A creator applied, or your team invited a matched creator | job | `get_application` |
| `application.submitted` | An application arrived and waits on your team (count applications by this one) | job | `get_application`, `reply_to_application` |
| `application.status_changed` | In review, accepted, rejected, withdrawn, answered, declined, closed after 14 days | job | `get_application` |

## Tracking (follows each account's sync cadence: hours, not seconds)

| Event | When | Narrow by | Follow up with |
| --- | --- | --- | --- |
| `video.published` | A tracked account posted a new video, detected when viral.app syncs the account | tracked account, project, platform | `get_video`, `get_video_history` |
| `video.views_milestone` | A tracked video crossed 10k, 50k, 100k, 250k, 500k, 1M, 5M or 10M views, detected after each data build | tracked account, minimum milestone | `get_video`, `analyze_video` (credits) |
| `account.followers_milestone` | A tracked account crossed a followers milestone | tracked account, minimum milestone | `get_account_history` |
