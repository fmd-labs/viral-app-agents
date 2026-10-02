// viral.app events channel for Claude Code.
//
// Claude Code spawns this stdio MCP server from the viral-app-events plugin. It
// declares the `claude/channel` capability, polls viral.app's MCP Events
// (`events/poll`) for the watches the user created, and pushes each event into
// the running session as a `notifications/claude/channel` notification.
//
// The Claude Code side uses the v1 SDK on purpose: Claude Code does not
// register a channel server that negotiates protocol revision 2026-07-28.
import { appendFileSync } from "node:fs"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Bridge, CHANNEL_INSTRUCTIONS } from "./bridge.js"
import { resolveStateDir, SERVER_NAME, SERVER_VERSION } from "./config.js"
import { detectDeliveryMode } from "./detect.js"
import type { ChannelNotification } from "./format.js"

const LOG_FILE = process.env.VIRAL_APP_EVENTS_LOG_FILE

function log(message: string): void {
  const line = `${SERVER_NAME}: ${message}\n`
  try {
    process.stderr.write(line)
  } catch {}
  if (LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}`)
    } catch {}
  }
}


const mcp = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  {
    capabilities: {
      tools: {},
      experimental: { "claude/channel": {} },
    },
    instructions: CHANNEL_INSTRUCTIONS,
  },
)

let connected = false

async function emit(notification: ChannelNotification): Promise<void> {
  if (!connected) throw new Error("not connected")
  // A Claude Code extension method, outside the SDK's ServerNotification union.
  await (mcp.notification as (n: { method: string; params: ChannelNotification }) => Promise<void>)({
    method: "notifications/claude/channel",
    params: notification,
  })
}

const bridge = new Bridge({
  stateDir: resolveStateDir(),
  emit,
  detectDelivery: () => detectDeliveryMode(),
  log,
})

/** Starts the bridge once the client is known (normally on `notifications/initialized`). */
function ensureStarted(): void {
  connected = true
  bridge.start(mcp.getClientVersion()?.name)
}

mcp.setRequestHandler(ListToolsRequestSchema, async () => {
  ensureStarted()
  return { tools: bridge.tools() }
})

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  ensureStarted()
  const args = (request.params.arguments ?? {}) as Record<string, unknown>
  const result = await bridge.callTool(request.params.name, args)
  return { ...result }
})

mcp.oninitialized = ensureStarted

let shuttingDown = false
function shutdown(): void {
  if (shuttingDown) return
  shuttingDown = true
  connected = false
  setTimeout(() => process.exit(0), 1_500).unref()
  void bridge.shutdown().finally(() => process.exit(0))
}

function isBrokenPipe(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  return code === "EPIPE" || code === "ERR_STREAM_DESTROYED"
}

// A closed pipe means Claude Code is gone: shut down instead of logging (and
// failing to write) the same error over and over.
process.stdout.on("error", (err) => {
  if (isBrokenPipe(err)) shutdown()
})
process.stderr.on("error", () => {})
process.on("unhandledRejection", (err) => log(`unhandled rejection: ${err}`))
process.on("uncaughtException", (err) => {
  if (isBrokenPipe(err)) return shutdown()
  log(`uncaught exception: ${err}`)
})

// Claude Code closes stdin when the session ends; stop polling then so no
// orphaned poller keeps leadership.
process.stdin.on("end", shutdown)
process.stdin.on("close", shutdown)
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
process.on("SIGHUP", shutdown)

await mcp.connect(new StdioServerTransport())

setInterval(() => {
  if (process.stdin.destroyed || process.stdin.readableEnded) shutdown()
}, 5_000).unref()
