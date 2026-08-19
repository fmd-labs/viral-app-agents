# viral-app-agents

Official [viral.app](https://viral.app) plugins and install shortcuts for coding agents. One install connects your agent to the viral.app MCP server: 50+ tools for social analytics, account and video tracking, tags and workflows, Creator Hub, and live TikTok/Instagram/YouTube/Facebook lookups, plus a usage skill that teaches the agent how to use them well.

The MCP server lives at `https://viral.app/api/mcp` (streamable HTTP, OAuth). You need a viral.app account with API access. Manage everything at [viral.app/app/org/api/agents](https://viral.app/app/org/api/agents).

## Install

### Claude Code

```bash
claude plugin marketplace add https://github.com/fmd-labs/viral-app-agents
claude plugin install viral-app@viral-app
```

Or interactively: `/plugin marketplace add https://github.com/fmd-labs/viral-app-agents`, then `/plugin install viral-app`. Afterwards run `/mcp`, pick `viral_app`, and authenticate in the browser. The `fmd-labs/viral-app-agents` shorthand also works if you have GitHub SSH access.

### Claude.ai and Claude Desktop

Add a custom connector with this URL, and leave client ID and secret empty (viral.app supports dynamic client registration):

```text
https://viral.app/api/mcp
```

[Open the connector settings](https://claude.ai/new?modal=add-custom-connector#settings/customize-connectors) or go to Settings, Connectors, Add custom connector.

### Codex CLI

```bash
codex plugin marketplace add https://github.com/fmd-labs/viral-app-agents
codex plugin add viral-app@viral-app
```

Or interactively: `/plugins` in the Codex TUI. Start a new session afterwards, then authenticate with `codex mcp login viral_app`.

If you only want the MCP server without the plugin:

```bash
codex mcp add viral_app --url https://viral.app/api/mcp
codex mcp login viral_app
```

### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=viral_app&config=eyJ1cmwiOiAiaHR0cHM6Ly92aXJhbC5hcHAvYXBpL21jcCJ9)

Or add to `.cursor/mcp.json`:

```json
{ "mcpServers": { "viral_app": { "type": "http", "url": "https://viral.app/api/mcp" } } }
```

### VS Code

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_viral.app_MCP-0098FF)](https://vscode.dev/redirect/mcp/install?name=viral_app&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fviral.app%2Fapi%2Fmcp%22%7D)

Or add to `.vscode/mcp.json`:

```json
{ "servers": { "viral_app": { "type": "http", "url": "https://viral.app/api/mcp" } } }
```

### Any other MCP client

Point the client at `https://viral.app/api/mcp` with streamable HTTP and OAuth. The server publishes standard OAuth discovery metadata and supports dynamic client registration, so no pre-shared credentials are needed.

## What's inside

| Path | Purpose |
| --- | --- |
| `.claude-plugin/marketplace.json` | Claude Code marketplace catalog for this repo |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog for this repo |
| `plugins/viral-app/` | The viral.app plugin: shared MCP server config and `viral-app-mcp` skill, with manifests for both Claude Code and Codex |

## Auth and security

- OAuth is the default. During consent you pick one organization; the grant is scoped to it permanently. Review or revoke authorized clients at [viral.app/app/user/settings/security](https://viral.app/app/user/settings/security).
- API keys are only for advanced setups where one agent must switch between multiple organizations. Create them per organization in the viral.app dashboard.
- This repository contains no secrets and never will. It only ships public configuration pointing at the viral.app endpoint; all credentials are issued at runtime through OAuth in your own browser.
- Tools that spend viral.app credits (live lookups, refreshes) quote their cost first and only execute when called again with explicit confirmation.

## Related

- [viral.app docs](https://viral.app/docs)
- [API reference](https://viral.app/api/v1/docs)
- [viral-app-skills](https://github.com/fmd-labs/viral-app-skills): CLI-based skill for API-key workflows
- [n8n-nodes-viral-app](https://www.npmjs.com/package/n8n-nodes-viral-app): n8n community node

## License

[MIT](LICENSE)
