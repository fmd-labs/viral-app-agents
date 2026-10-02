import { chmodSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const SERVER_NAME = "viral_app_events"
export const SERVER_VERSION = "0.1.0"
export const DEFAULT_MCP_URL = "https://viral.app/api/mcp"
/** The `--channels` / `--dangerously-load-development-channels` entry for this plugin. */
export const CHANNEL_ENTRY = "plugin:viral-app-events@viral-app"
export const CONFIGURE_COMMAND = "/viral-app-events:configure"
/** The plugin whose `viral_app` server Claude uses to act on events. */
export const MAIN_PLUGIN_INSTALL = "claude plugin install viral-app@viral-app"

export type Env = Record<string, string | undefined>

/** Polling bounds. The server suggests `nextPollMs`; the bridge clamps it. */
export interface PollTiming {
  defaultPollMs: number
  minPollMs: number
  maxPollMs: number
  maxBackoffMs: number
  maxAgeMs: number
  maxEventsPerPoll: number
}

export function resolvePollTiming(env: Env = process.env): PollTiming {
  const minPollMs = positiveInt(env.VIRAL_APP_EVENTS_MIN_POLL_MS) ?? 10_000
  return {
    defaultPollMs: Math.max(minPollMs, 30_000),
    minPollMs,
    maxPollMs: 5 * 60_000,
    maxBackoffMs: 5 * 60_000,
    // Bounds catch-up after a long absence; matches the server's 24h poll lease.
    maxAgeMs: positiveInt(env.VIRAL_APP_EVENTS_MAX_AGE_MS) ?? 24 * 60 * 60_000,
    maxEventsPerPoll: 50,
  }
}

export function resolveStateDir(env: Env = process.env): string {
  return (
    env.VIRAL_APP_EVENTS_STATE_DIR ??
    join(env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "channels", "viral-app")
  )
}

/** Parses KEY=VALUE lines; ignores blanks and comments, strips one layer of matching quotes. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    out[match[1]] = value
  }
  return out
}

export interface Settings {
  apiKey: string | undefined
  apiKeySource: "env" | "file" | "none"
  mcpUrl: string
  envFile: string
}

/**
 * Reads the API key and endpoint. A real environment variable wins over the
 * state-dir `.env` file (like the official channel plugins). The file is
 * re-read on every call, so a key saved by the configure command takes effect
 * without restarting the session.
 */
export function loadSettings(stateDir: string, env: Env = process.env): Settings {
  const envFile = join(stateDir, ".env")
  let fileValues: Record<string, string> = {}
  try {
    // The key is a credential: keep the file owner-only. No-op on Windows.
    chmodSync(envFile, 0o600)
  } catch {}
  try {
    fileValues = parseEnvFile(readFileSync(envFile, "utf8"))
  } catch {}

  const envKey = env.VIRAL_APP_API_KEY?.trim()
  const fileKey = fileValues.VIRAL_APP_API_KEY?.trim()
  const apiKey = envKey || fileKey || undefined
  const apiKeySource = envKey ? "env" : fileKey ? "file" : "none"
  const mcpUrl = (env.VIRAL_APP_MCP_URL || fileValues.VIRAL_APP_MCP_URL || DEFAULT_MCP_URL).trim()
  return { apiKey, apiKeySource, mcpUrl, envFile }
}

/** Shows enough of a key to recognize it, never the whole secret. */
export function maskKey(key: string | undefined): string | null {
  if (!key) return null
  if (key.length <= 8) return `${"*".repeat(key.length)}`
  return `${key.slice(0, 4)}…${key.slice(-2)} (${key.length} chars)`
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}
