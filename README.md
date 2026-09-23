# viral-app-agents

Official [viral.app](https://viral.app) plugins and install shortcuts for coding agents and chat apps. One install connects your agent to the viral.app MCP server: 50+ tools for social analytics, account and video tracking, tags and workflows, Creator Hub, and live TikTok/Instagram/YouTube/Facebook lookups, plus a usage skill that teaches the agent how to use them well.

The MCP server lives at `https://viral.app/api/mcp` (streamable HTTP, OAuth). You need a viral.app account with API access. Manage everything at [viral.app/app/org/api/agents](https://viral.app/app/org/api/agents).

## Install

Every client signs in with OAuth in your browser. viral.app supports dynamic client registration, so you never paste a client ID, secret, or API key. During consent you pick one organization.

**Chat apps:** [Claude.ai and Claude Desktop](#claudeai-and-claude-desktop) · [ChatGPT](#chatgpt) · [Grok](#grok) · [Other chat apps](#other-chat-apps)

**Plugins (MCP server + skill):** [Claude Code](#claude-code) · [Codex CLI](#codex-cli) · [GitHub Copilot CLI](#github-copilot-cli) · [VS Code](#vs-code) · [Cursor](#cursor) · [Gemini CLI](#gemini-cli) · [Qwen Code](#qwen-code) · [Kiro](#kiro) · [Devin](#devin) · [Factory Droid](#factory-droid) · [Grok Build](#grok-build)

**MCP server only:** [Augment](#augment-and-auggie) · [JetBrains Junie](#jetbrains-junie) · [OpenCode](#opencode) · [Amp](#amp) · [Goose](#goose) · [Zed](#zed) · [Warp](#warp) · [Mistral Vibe](#mistral-vibe) · [Any other MCP client](#any-other-mcp-client)

### Chat apps

#### Claude.ai and Claude Desktop

Add a custom connector with this URL, and leave client ID and secret empty:

```text
https://viral.app/api/mcp
```

[Open the connector settings](https://claude.ai/new?modal=add-custom-connector#settings/customize-connectors) or go to Settings, Connectors, Add custom connector.

#### ChatGPT

Install the [viral.app plugin for ChatGPT](https://chatgpt.com/plugins/plugin_asdk_app_6a8713d41dc48191b33e75c49a764db3).

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

Install the plugin (MCP server and skill) through agent plugins. Add the marketplace to your user settings:

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

This repo also ships a Cursor plugin manifest (`.cursor-plugin/`) that bundles the MCP server and skill for the Cursor Marketplace.

#### Gemini CLI

```bash
gemini extensions install https://github.com/fmd-labs/viral-app-agents
```

Restart Gemini CLI, then run `/mcp auth viral_app` to sign in.

#### Qwen Code

```bash
qwen extensions install fmd-labs/viral-app-agents:viral-app
```

You get the MCP server and the skill; check the connection with `/mcp`.

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

These clients get the MCP server without the bundled skill.

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

To add the usage skill as well, run `goose plugin install https://github.com/fmd-labs/viral-app-agents.git`. Goose loads it as `viral-app:viral-app-mcp`.

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

## What's inside

| Path | Purpose |
| --- | --- |
| `.claude-plugin/marketplace.json` | Claude-format marketplace catalog (Claude Code, Copilot CLI, VS Code, Factory, Grok Build) |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog |
| `.cursor-plugin/marketplace.json` | Cursor marketplace catalog (Cursor, Grok Bot) |
| `gemini-extension.json` | Gemini CLI extension manifest (Gemini CLI, Qwen Code) |
| `plugin.json` | Agent Plugins 1.0 manifest for the repository root (Kiro, Mistral Vibe, and Copilot CLI or Devin when the repository root is installed directly; Goose imports only the skill) |
| `mcp.json` | Agent Plugins 1.0 MCP config for the repository root (read with `plugin.json`) |
| `skills/viral-app-mcp/SKILL.md` | Copy of the plugin skill for the root-level packages (Gemini CLI, Agent Plugins). Keep it identical to `plugins/viral-app/skills/viral-app-mcp/SKILL.md` |
| `server.json` | Official MCP Registry entry `io.github.fmd-labs/viral-app` |
| `.github/workflows/publish-mcp-registry.yml` | Validates `server.json` on pull requests and publishes it to the MCP Registry from `main` via GitHub OIDC |
| `plugins/viral-app/.claude-plugin/plugin.json` | Claude-format plugin manifest with the MCP server inline (Claude Code, Copilot CLI, VS Code, Devin, Grok Build) |
| `plugins/viral-app/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugins/viral-app/.cursor-plugin/plugin.json` | Cursor plugin manifest |
| `plugins/viral-app/.mcp.json` | Claude-format MCP config (Codex, Factory, Grok Build; Claude Code merges it with the inline entry) |
| `plugins/viral-app/skills/viral-app-mcp/SKILL.md` | The `viral-app-mcp` usage skill (canonical copy) |
| `plugins/viral-app/assets/` | Plugin logo (`logo.svg`, `logo.png` at 400x400) |

When releasing, bump `version` together in `plugin.json`, `gemini-extension.json`, `plugins/viral-app/.claude-plugin/plugin.json`, `plugins/viral-app/.codex-plugin/plugin.json`, `plugins/viral-app/.cursor-plugin/plugin.json`, and the plugin entries in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` (`grep -rn '"version"' --include=*.json .` lists them). Check that the two skill copies still match with `diff -r skills/viral-app-mcp plugins/viral-app/skills/viral-app-mcp`. `server.json` has its own version; the MCP Registry rejects a version it has already published, so bump it with every change to that file.

## Auth and security

- OAuth is the default. During consent you pick one organization; the grant is scoped to it permanently. Review or revoke authorized clients at [viral.app/app/user/settings/security](https://viral.app/app/user/settings/security).
- API keys are only for advanced setups where one agent must switch between multiple organizations. Create them per organization in the viral.app dashboard.
- This repository contains no secrets and never will. It only ships public configuration pointing at the viral.app endpoint; all credentials are issued at runtime through OAuth in your own browser.
- Tools that spend viral.app credits (live lookups, refreshes) quote their cost first and only execute when called again with explicit confirmation.

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
