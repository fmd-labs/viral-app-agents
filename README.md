# viral-app-agents

Official [viral.app](https://viral.app) plugins and install shortcuts for coding agents and chat apps. One install connects your agent to the viral.app MCP server: 100+ tools for UGC analytics, account and video tracking, tags and tag workflows, the Creator Hub (campaigns, briefs, job postings, applications, creator chat, payouts), the viral video library, and live TikTok/Instagram/YouTube/Facebook lookups. Plugins also bring [five skills](#skills) that teach the agent the workflows.

The MCP server lives at `https://viral.app/api/mcp` (streamable HTTP, OAuth). You need a viral.app account with API access. Manage everything at [viral.app/app/org/api/agents](https://viral.app/app/org/api/agents).

## Install

Every client signs in with OAuth in your browser. viral.app supports dynamic client registration, so you never paste a client ID, secret, or API key. During consent you pick one organization.

**Chat apps:** [Claude.ai and Claude Desktop](#claudeai-and-claude-desktop) · [ChatGPT](#chatgpt) · [Grok](#grok) · [Other chat apps](#other-chat-apps)

**Plugins (MCP server + skills):** [Claude Code](#claude-code) · [Codex CLI](#codex-cli) · [GitHub Copilot CLI](#github-copilot-cli) · [VS Code](#vs-code) · [Cursor](#cursor) · [Gemini CLI](#gemini-cli) · [Qwen Code](#qwen-code) · [Kiro](#kiro) · [Devin](#devin) · [Factory Droid](#factory-droid) · [Grok Build](#grok-build)

**MCP server only:** [Augment](#augment-and-auggie) · [JetBrains Junie](#jetbrains-junie) · [OpenCode](#opencode) · [Amp](#amp) · [Goose](#goose) · [Zed](#zed) · [Warp](#warp) · [Mistral Vibe](#mistral-vibe) · [Any other MCP client](#any-other-mcp-client)

### Chat apps

#### Claude.ai and Claude Desktop

Add a custom connector with this URL, and leave client ID and secret empty:

```text
https://viral.app/api/mcp
```

[Open the connector settings](https://claude.ai/new?modal=add-custom-connector#settings/customize-connectors) or go to Settings, Connectors, Add custom connector.

Results such as top videos, creators, campaigns and KPI charts render as interactive cards in Claude on the web, Desktop and mobile.

#### ChatGPT

Install the [viral.app plugin for ChatGPT](https://chatgpt.com/plugins/plugin_asdk_app_6a8713d41dc48191b33e75c49a764db3).

- **Cards:** results render as interactive cards in the chat; ChatGPT desktop also offers viral.app as a sidebar app with a conversation panel.
- **Events:** in Work chats (ChatGPT web, or the desktop app with Cloud selected) and in dots, ask ChatGPT to watch viral.app for something and say what to do, for example "Whenever a creator applies to my Habit Tracker job, summarize the application and draft a reply for me to approve." ChatGPT subscribes through viral.app's [MCP Events](https://developers.openai.com/plugins/build/mcp-events) and viral.app delivers each matching event to that chat. Chat, application and payout events arrive within about a minute; new-video and view-milestone events follow each account's sync cadence (hours). Ask ChatGPT to stop monitoring to end a subscription.

#### Grok

On [grok.com](https://grok.com), open Connectors, choose New Connector, then Custom, and paste `https://viral.app/api/mcp`.

For Grok Bot, install viral.app from its Marketplace once it is listed there.

#### Other chat apps

These accept a custom remote MCP URL with OAuth. Use `https://viral.app/api/mcp`:

- **Perplexity**: Settings, Connectors, Custom connector, Remote. Pick OAuth and Streamable HTTP.
- **Mistral Vibe** (formerly Le Chat), Work mode: Connectors, Add Connector, Custom MCP Connector. Only admins can add connectors; use a name without special characters, such as `viralapp`.
- **Notion custom agents** (Business and Enterprise): an admin enables custom MCP servers under Settings, Connections. Then open the agent's Tools & Access, Add connection, Custom MCP server.

### Plugins

#### Claude Code

```bash
claude plugin marketplace add https://github.com/fmd-labs/viral-app-agents
claude plugin install viral-app@viral-app
```

Or interactively: `/plugin marketplace add https://github.com/fmd-labs/viral-app-agents`, then `/plugin install viral-app`. Afterwards run `/mcp`, pick `viral_app`, and authenticate in the browser. The `fmd-labs/viral-app-agents` shorthand also works if you have GitHub SSH access.

##### Events channel (research preview)

A second, Claude Code only plugin, `viral-app-events`, adds `viral_app_events`: a local [channel](https://code.claude.com/docs/en/channels) that pushes viral.app events (new applications, creator messages, payouts due, new videos, view milestones) into a running Claude Code session, so Claude can react while you are away. It polls viral.app's MCP Events with an API key; nothing listens on a port. Claude acts on the events with the `viral_app` server's tools, so keep the `viral-app` plugin installed alongside it.

1. Install the events plugin next to `viral-app`:

   ```bash
   claude plugin install viral-app-events@viral-app
   ```

2. Create an API key for the organization at [viral.app/app/org/api/keys](https://viral.app/app/org/api/keys) (the plan needs API access).
3. In Claude Code run `/viral-app-events:configure <api-key>`. It stores the key as `VIRAL_APP_API_KEY=...` in `~/.claude/channels/viral-app/.env` with mode 600. The command passes the key through the conversation; to keep it out of the transcript, write that file yourself or export `VIRAL_APP_API_KEY` before starting Claude Code. `/viral-app-events:configure` without arguments shows the setup status.
4. Start the sessions that should receive events with the channel enabled. Channels are a research preview and this one is not on Anthropic's allowlist, so it needs the development flag:

   ```bash
   claude --dangerously-load-development-channels plugin:viral-app-events@viral-app
   ```

5. Ask Claude to watch something, for example "tell me when a creator applies to my Habit Tracker job and draft a reply". Claude uses the channel's `list_events` and `watch` tools; `list_watches`, `unwatch` and `status` manage them.

Requirements and controls:

- Node.js 20 or newer on the PATH. The server is a single bundled file (`plugins/viral-app-events/dist/server.mjs`); there is no install step.
- Team and Enterprise plans: an owner enables channels under claude.ai Admin settings, Claude Code, Channels (`channelsEnabled` in managed settings). To run it without the development flag, an admin adds `{ "marketplace": "viral-app", "plugin": "viral-app-events" }` to `allowedChannelPlugins`; users then start with `claude --channels plugin:viral-app-events@viral-app`.
- Only sessions started with the channel flag poll, and only one at a time (the newest takes over; an older one resumes when it exits). Claude Code does not tell a channel server whether the session enabled it, so the server reads the flag from the `claude` process arguments. A session without the flag never polls: it can create and list watches but makes no `events/poll` request, so it neither moves a cursor nor keeps a subscription alive. Set `VIRAL_APP_EVENTS_DELIVERY=on` or `off` before starting Claude Code to override the check. Where the arguments cannot be read (Windows, or no `ps`), the server does not poll unless `VIRAL_APP_EVENTS_DELIVERY=on` is set for the channel session.
- Watches and cursors persist in `~/.claude/channels/viral-app/state.json` and catch up after a restart (up to 24 hours back). A watch created in a session without the flag starts recording when a channel session first polls it.
- Each watch holds a poll subscription on viral.app, which counts toward the organization's limit of 100 event subscriptions (ChatGPT automations included). `unwatch` releases it right away; otherwise it ends 24 hours after the last poll. An organization without API access pauses all watches (retried every 15 minutes); a role that may not read an event stops that watch.
- Security: event content can include text written by creators. The channel strips the paths viral.app declares as free text for each event (`x-viral-text-fields`, such as `message.content`) unless a watch opts in, and its instructions tell Claude to treat event content as untrusted data, never follow instructions in it, and act only on what you asked when creating the watch. Replies and other writes still go through the regular `viral_app` tools and your approval. The API key acts for its organization, so use one you are comfortable leaving on this machine.

#### Codex CLI

```bash
codex plugin marketplace add https://github.com/fmd-labs/viral-app-agents
codex plugin add viral-app@viral-app
```

Or interactively: `/plugins` in the Codex TUI. Start a new session afterwards, then authenticate with `codex mcp login viral_app`.

Requires Codex CLI 0.147 or newer. Older versions fail the OAuth login with an "Authorization server response missing required issuer" error (a Codex bug fixed in 0.147.0); update with `npm install -g @openai/codex@latest` and retry.

If you only want the MCP server without the plugin:

```bash
codex mcp add viral_app --url https://viral.app/api/mcp
codex mcp login viral_app
```

#### GitHub Copilot CLI

```bash
copilot plugin marketplace add fmd-labs/viral-app-agents
copilot plugin install viral-app@viral-app
```

#### VS Code

Install the plugin (MCP server and skills) through agent plugins. Add the marketplace to your user settings:

```json
"chat.plugins.enabled": true,
"chat.plugins.marketplaces": ["fmd-labs/viral-app-agents"]
```

Then search `@agentPlugins` in the Extensions view and install `viral-app`.

For the MCP server alone:

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_viral.app_MCP-0098FF)](https://vscode.dev/redirect/mcp/install?name=viral_app&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fviral.app%2Fapi%2Fmcp%22%7D)

Or add to `.vscode/mcp.json`:

```json
{ "servers": { "viral_app": { "type": "http", "url": "https://viral.app/api/mcp" } } }
```

#### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=viral_app&config=eyJ1cmwiOiAiaHR0cHM6Ly92aXJhbC5hcHAvYXBpL21jcCJ9)

Or add to `.cursor/mcp.json`:

```json
{ "mcpServers": { "viral_app": { "type": "http", "url": "https://viral.app/api/mcp" } } }
```

This repo also ships a Cursor plugin manifest (`.cursor-plugin/`) that bundles the MCP server and skills for the Cursor Marketplace.

#### Gemini CLI

```bash
gemini extensions install https://github.com/fmd-labs/viral-app-agents
```

Restart Gemini CLI, then run `/mcp auth viral_app` to sign in.

#### Qwen Code

```bash
qwen extensions install fmd-labs/viral-app-agents:viral-app
```

You get the MCP server and the skills; check the connection with `/mcp`.

#### Kiro

In the Powers panel choose Add Custom Power, then Import power from GitHub, and enter:

```text
https://github.com/fmd-labs/viral-app-agents
```

#### Devin

```bash
devin plugins install fmd-labs/viral-app-agents#plugins/viral-app
```

Sign in to Devin first (`devin auth login`) if you have not, then run `devin mcp login viral_app` to connect viral.app.

#### Factory Droid

```bash
droid plugin marketplace add https://github.com/fmd-labs/viral-app-agents
droid plugin install viral-app@viral-app-agents --scope user
```

Droid names the marketplace after the repository, hence `@viral-app-agents`. Run `/mcp` to finish the browser sign-in.

#### Grok Build

```bash
grok plugin marketplace add fmd-labs/viral-app-agents
grok plugin install viral-app --trust
```

The CLI refuses to install a plugin until you pass `--trust`.

### MCP server only

These clients get the MCP server without the bundled skills.

#### Augment and Auggie

```bash
auggie mcp add viral_app --transport http --url https://viral.app/api/mcp
```

In the IDE extension: Settings, MCP, Add remote MCP, connection type HTTP.

#### JetBrains Junie

Add to `.junie/mcp/mcp.json` in your project (or `~/.junie/mcp/mcp.json`), or use Settings, Tools, Junie, MCP Settings:

```json
{ "mcpServers": { "viral_app": { "url": "https://viral.app/api/mcp" } } }
```

In the Junie CLI, run `/mcp`, select `viral_app`, and choose Authorize.

#### OpenCode

Add to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": { "viral_app": { "type": "remote", "url": "https://viral.app/api/mcp" } }
}
```

Then run `opencode mcp auth viral_app`.

#### Amp

```bash
amp mcp add viral_app https://viral.app/api/mcp
```

Amp opens the browser sign-in on its next start.

#### Goose

Open this link to add the extension to Goose Desktop (GitHub does not render `goose://` links, so copy it into your browser):

```text
goose://extension?type=streamable_http&url=https%3A%2F%2Fviral.app%2Fapi%2Fmcp&id=viral_app&name=viral.app&description=UGC%20analytics%20and%20tracking%20from%20viral.app
```

In the CLI: `goose configure`, Add Extension, Remote Extension (Streamable HTTP), URL `https://viral.app/api/mcp`.

To add the skills as well, run `goose plugin install https://github.com/fmd-labs/viral-app-agents.git`. Goose loads them as `viral-app:viral-app-mcp`, `viral-app:ugc-reporting`, and so on.

#### Zed

Add to your Zed settings, or use Settings, AI, MCP Servers, Add Server, Add Remote Server:

```json
{ "context_servers": { "viral_app": { "url": "https://viral.app/api/mcp" } } }
```

Zed prompts you to sign in.

#### Warp

Settings, Agents, MCP servers, Add, then paste:

```json
{ "mcpServers": { "viral_app": { "url": "https://viral.app/api/mcp" } } }
```

#### Mistral Vibe

```bash
vibe mcp add viral_app --url https://viral.app/api/mcp
```

#### Any other MCP client

Point the client at `https://viral.app/api/mcp` with streamable HTTP and OAuth. The server publishes standard OAuth discovery metadata and supports dynamic client registration, so no pre-shared credentials are needed. Its [official MCP Registry](https://registry.modelcontextprotocol.io) name is `io.github.fmd-labs/viral-app`.

## Skills

Plugins bundle five skills. Agents load them on demand, and each keeps longer material in a `references/` folder next to it.

| Skill | Use it for |
| --- | --- |
| `viral-app-mcp` | The core guide: connecting and auth, the credit quote-then-confirm flow, rules for writes that reach creators, ids and units, what MCP cannot do, and which skill to load next |
| `ugc-reporting` | Weekly or monthly UGC reports, KPI and leaderboard recipes with period-over-period change, cards in Claude and ChatGPT, Slack summaries, recurring reports through scheduled tasks or a ChatGPT page |
| `creator-campaigns` | Creator Hub end to end: briefs in markdown, campaigns with the preview step, creator assignment, job drafts and publishing, applications, creator chat, and payout reads |
| `viral-research` | The viral video library, similar videos, hook and scene breakdowns, AI analysis of tracked videos, live lookups, and turning findings into hooks and a brief |
| `ugc-automations` | "Watch for X and do Y": MCP Events in ChatGPT, the Claude Code events channel, polling fallbacks, latency per event, and handling untrusted creator text |

## What's inside

| Path | Purpose |
| --- | --- |
| `.claude-plugin/marketplace.json` | Claude-format marketplace catalog (Claude Code, Copilot CLI, VS Code, Factory, Grok Build). Lists `viral-app` and the Claude Code only `viral-app-events` |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog |
| `.cursor-plugin/marketplace.json` | Cursor marketplace catalog (Cursor, Grok Bot) |
| `gemini-extension.json` | Gemini CLI extension manifest (Gemini CLI, Qwen Code) |
| `plugin.json` | Agent Plugins 1.0 manifest for the repository root (Kiro, Mistral Vibe, and Copilot CLI or Devin when the repository root is installed directly; Goose imports only the skills) |
| `mcp.json` | Agent Plugins 1.0 MCP config for the repository root (read with `plugin.json`) |
| `skills/` | Copy of the plugin skills for the root-level packages (Gemini CLI, Agent Plugins). Generated from `plugins/viral-app/skills/` with `scripts/sync-skills.sh` |
| `server.json` | Official MCP Registry entry `io.github.fmd-labs/viral-app` |
| `.github/workflows/publish-mcp-registry.yml` | Validates `server.json` on pull requests and publishes it to the MCP Registry from `main` via GitHub OIDC |
| `plugins/viral-app/.claude-plugin/plugin.json` | Claude-format plugin manifest with the MCP server inline (Claude Code, Copilot CLI, VS Code, Devin, Grok Build) |
| `plugins/viral-app/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugins/viral-app/.cursor-plugin/plugin.json` | Cursor plugin manifest |
| `plugins/viral-app/.mcp.json` | Claude-format MCP config (Codex, Factory, Grok Build; Claude Code merges it with the inline entry) |
| `plugins/viral-app/skills/` | The five skills (canonical copy) |
| `plugins/viral-app-events/` | The Claude Code only events channel plugin: `.claude-plugin/plugin.json` (declares only the `viral_app_events` stdio server), `commands/configure.md` (`/viral-app-events:configure`), TypeScript sources (`src/`), the bundled `dist/server.mjs` that Claude Code runs, tests (`__tests__/`), and a fake viral.app server plus a stdio smoke test (`dev/`). It is listed only in `.claude-plugin/marketplace.json`; other hosts that read that catalog only see `status` if someone installs it |
| `scripts/sync-skills.sh` | Copies `plugins/viral-app/skills/` to `skills/`; `--check` fails when they differ |
| `scripts/build-chatgpt-package.sh` | Builds `dist/viral-app-chatgpt.zip` for OpenAI's plugin dashboard (Upload new version): the Codex manifest, `.mcp.json`, skills and assets of `plugins/viral-app`, checked against OpenAI's package rules, without the Claude and Cursor manifests |
| `plugins/viral-app/assets/` | Plugin logo (`logo.svg`, `logo.png` at 400x400) |

When releasing:

- Bump the `viral-app` `version` together in `plugin.json`, `gemini-extension.json`, `plugins/viral-app/.claude-plugin/plugin.json`, `plugins/viral-app/.codex-plugin/plugin.json`, `plugins/viral-app/.cursor-plugin/plugin.json`, and its entries in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` (`grep -rn '"version"' --include=*.json . | grep -v viral-app-events` lists them).
- `viral-app-events` versions on its own: `plugins/viral-app-events/.claude-plugin/plugin.json`, `plugins/viral-app-events/package.json`, `SERVER_VERSION` in `plugins/viral-app-events/src/config.ts`, and its entry in `.claude-plugin/marketplace.json`.
- Edit skills only in `plugins/viral-app/skills/`, then run `scripts/sync-skills.sh` (`--check` verifies the copies match).
- After changing `plugins/viral-app-events/src/`, run `bun install`, `bun run build`, `bun test` and `bun run smoke` in `plugins/viral-app-events` and commit `dist/server.mjs` (a test fails when the bundle is stale).
- For ChatGPT, run `scripts/build-chatgpt-package.sh` and upload `dist/viral-app-chatgpt.zip` as a new version in the [OpenAI plugin dashboard](https://platform.openai.com/plugins). Changes to the hosted MCP server need no upload; manifest and skill changes do.
- `server.json` has its own version; the MCP Registry rejects a version it has already published, so bump it with every change to that file.

## Auth and security

- OAuth is the default. During consent you pick one organization; the grant is scoped to it permanently. Review or revoke authorized clients at [viral.app/app/user/settings/security](https://viral.app/app/user/settings/security).
- API keys are only for advanced setups where one agent must switch between multiple organizations, and for the Claude Code events channel (`viral-app-events`). Create them per organization in the viral.app dashboard.
- This repository contains no secrets and never will. It only ships public configuration pointing at the viral.app endpoint; all credentials are issued at runtime through OAuth in your own browser.
- Tools that spend viral.app credits (live lookups, refreshes, video analysis) quote their cost first and only execute when called again with explicit confirmation.
- The events channel keeps its API key only on your machine (`~/.claude/channels/viral-app/.env`, mode 600). Events can carry text written by creators; the channel and the skills treat it as untrusted data.

## Support and privacy

- Support: [support@viral.app](mailto:support@viral.app)
- Privacy policy: [viral.app/legal/privacy](https://viral.app/legal/privacy)
- Terms of service: [viral.app/legal/terms](https://viral.app/legal/terms)

## Related

- [viral.app docs](https://viral.app/docs)
- [API reference](https://viral.app/api/v1/docs)
- [viral-app-skills](https://github.com/fmd-labs/viral-app-skills): CLI-based skill for API-key workflows
- [n8n-nodes-viral-app](https://www.npmjs.com/package/n8n-nodes-viral-app): n8n community node

## License

[MIT](LICENSE)
