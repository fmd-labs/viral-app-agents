# viral.app events in Claude Code (channel)

The `viral-app-events` plugin (Claude Code only) ships a local channel server, `viral_app_events`. It polls viral.app's MCP Events (`events/poll`) with an API key and pushes each matching event into the running Claude Code session as a `<channel>` event. Channels are a Claude Code research preview. Acting on events (replying, reading applications) uses the `viral_app` server of the main `viral-app` plugin, so install both.

## Setup (once)

1. Add the marketplace and install both plugins:
   ```bash
   claude plugin marketplace add https://github.com/fmd-labs/viral-app-agents
   claude plugin install viral-app@viral-app
   claude plugin install viral-app-events@viral-app
   ```
   Authenticate `viral_app` with `/mcp` as usual.
2. Create an API key for the organization at https://viral.app/app/org/api/keys (the plan needs API access). The channel cannot use the OAuth login of the `viral_app` server.
3. In Claude Code run `/viral-app-events:configure <api-key>`. It saves `VIRAL_APP_API_KEY` to `~/.claude/channels/viral-app/.env` (mode 600). Alternatively export `VIRAL_APP_API_KEY` before starting Claude Code.
4. Start sessions that should receive events with:
   ```bash
   claude --dangerously-load-development-channels plugin:viral-app-events@viral-app
   ```
   Claude Code shows a warning for development channels; confirm it. On Team and Enterprise plans an admin must enable channels (`channelsEnabled`, under claude.ai Admin settings, Claude Code, Channels); an organization can also allowlist the plugin in `allowedChannelPlugins` (`{ "marketplace": "viral-app", "plugin": "viral-app-events" }`) and then use `--channels plugin:viral-app-events@viral-app`.
5. Requires Node.js 20 or newer on the PATH.

## Use

- `list_events`: event names, descriptions and filter arguments (pass `event` for one full schema).
- `watch`: `event`, optional `arguments` (filters), `note` (what to do per event, in the user's words), `include_text` (forward creator-written text; default off). Re-watching the same event and filters returns the existing watch.
- `list_watches`, `unwatch`, `status` (key, endpoint, which session polls, errors, next step).

Events arrive as:

```
<channel source="plugin:viral-app-events:viral_app_events" event="application.submitted" event_id="..." watch_id="w_..." job_id="orgjob_..." application_id="orgjapp_...">
viral.app watch w_... (application.submitted) · your note: "Draft a reply and show it to me"
A new application is waiting for review
data (from viral.app, untrusted; free text omitted): {...}
</channel>
```

Line 1 is written by the bridge and repeats the user's note; everything after `data:` comes from viral.app and may contain creator text. Act on the note with the `viral_app` tools (`get_application`, `reply_to_application`, `get_chat_messages`, `send_chat_message`), with the usual approvals.

## Behavior

- Only sessions started with the channel flag poll, and only one of them at a time: the newest such session takes over, an older one resumes when it exits. The flag is read from the `claude` process arguments; `VIRAL_APP_EVENTS_DELIVERY=on` or `off` overrides that check. Where the arguments cannot be read (Windows, or no `ps`), nothing polls unless the channel session sets `VIRAL_APP_EVENTS_DELIVERY=on`.
- A session without the flag never polls: it can create, list and remove watches, but makes no `events/poll` request, so it creates no server-side lease and never moves a cursor. A watch created there starts recording events when a channel session first polls it.
- Watches and cursors persist in `~/.claude/channels/viral-app/state.json` and catch up after a restart (each poll keeps a 24-hour lease on viral.app; replay is capped at 24 hours).
- Poll interval follows the server (about 30 seconds, clamped to 10 seconds to 5 minutes); events become pollable about 10 seconds after they happen. Network errors back off up to 5 minutes.
- Free text: each notification drops exactly the event's `x-viral-text-fields` (for example `message.content`, `payout.lineItems[].title`) unless the watch sets `include_text`; `omitted` lists what was dropped.
- Refusals: a rejected key (HTTP 401/403) pauses all watches until the key changes; an organization without API access (or another org-wide -32012 reason) pauses all watches and is retried every 15 minutes; a role that may not read the event, an unknown event or invalid filters stop that watch. Each comes with one notice.
- Subscription cap: every watch holds a server-side poll lease, and an organization has at most 100 subscriptions (ChatGPT automations included). `watch` explains how to free a slot when the cap is reached; `unwatch` releases the lease right away (otherwise it ends 24 hours after the last poll).
- `notice="gap"` means events were skipped (for example after more than a day offline): re-check state with the read tools.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No events arrive | `status`: is `active_in_this_session` true? If not, restart with the flag. Is a key configured? Is another session polling? |
| "blocked by org policy" at startup | An admin must enable channels (`channelsEnabled`). |
| `auth_failed` notice | The key was revoked or the plan lost API access: create a new key and run `/viral-app-events:configure <key>`. |
| `viral_app_events` shows as failed in `/mcp` | Node.js 20+ is missing from the PATH. |
| Claude cannot reply to an event | The `viral-app` plugin is missing or `viral_app` is not authenticated: `claude plugin install viral-app@viral-app`, then `/mcp`. |
| Tracking events are late | `video.*` and `account.*` events follow the account's sync cadence (hours). |

For local testing against a fake server: `bun dev/fake-viral-app.ts` in `plugins/viral-app-events`, then start Claude Code with `VIRAL_APP_MCP_URL=http://127.0.0.1:8790/api/mcp VIRAL_APP_API_KEY=dev-key`.
