import { execFileSync } from "node:child_process"
import type { Env } from "./config.js"

export interface ProcessInfo {
  pid: number
  args: string
}

export interface DeliveryMode {
  /** Whether this process should poll viral.app and push channel notifications. */
  active: boolean
  reason: string
}

const CHANNEL_FLAG = /(?:^|\s)--(?:dangerously-load-development-)?channels(?:[=\s]|$)/
const CHANNEL_ENTRY = /(?:^|[\s=,])(?:plugin:viral-app(?:@[\w.-]+)?|server:viral_app_events)(?=$|[\s,])/
const CLAUDE_BINARY = /(?:^|[\s/\\])claude(?:\.exe)?(?:\s|$)|@anthropic-ai[/\\]claude-code/

/** The Claude Code client identifies itself as `claude-code` in `initialize`. */
export function isClaudeCodeClient(clientName: string | undefined, env: Env = process.env): boolean {
  if (env.VIRAL_APP_EVENTS_CLIENT === "any") return true
  return clientName === "claude-code"
}

/**
 * Claude Code spawns every plugin MCP server in every session, but only
 * delivers channel notifications when the session was started with
 * `--channels` or `--dangerously-load-development-channels` naming this
 * plugin, and it never tells the server which case applies. Polling in a
 * session that drops the notifications would advance the cursors and lose
 * the events, so the bridge reads the flag from the Claude Code process
 * arguments. `VIRAL_APP_EVENTS_DELIVERY=on|off` overrides the check.
 */
export function detectDeliveryMode(
  env: Env = process.env,
  ancestors: () => ProcessInfo[] = () => processAncestors(process.ppid),
): DeliveryMode {
  const forced = env.VIRAL_APP_EVENTS_DELIVERY?.toLowerCase()
  if (forced === "on") return { active: true, reason: "forced on by VIRAL_APP_EVENTS_DELIVERY" }
  if (forced === "off") return { active: false, reason: "forced off by VIRAL_APP_EVENTS_DELIVERY" }

  let chain: ProcessInfo[]
  try {
    chain = ancestors()
  } catch {
    chain = []
  }
  if (chain.length === 0) {
    return {
      active: true,
      reason: "could not inspect the parent process; assuming the channel is enabled",
    }
  }
  for (const proc of chain) {
    if (CHANNEL_FLAG.test(proc.args) && CHANNEL_ENTRY.test(proc.args)) {
      return { active: true, reason: "Claude Code was started with this channel enabled" }
    }
  }
  const claude = chain.find((proc) => CLAUDE_BINARY.test(proc.args))
  return {
    active: false,
    reason: claude
      ? "Claude Code was started without the viral.app channel flag"
      : "the parent process is not a Claude Code session started with the viral.app channel flag",
  }
}

/** Walks up to `depth` ancestors with `ps` (macOS, Linux). Empty where `ps` is unavailable. */
export function processAncestors(startPid: number, depth = 5): ProcessInfo[] {
  if (process.platform === "win32") return []
  const chain: ProcessInfo[] = []
  let pid = startPid
  for (let i = 0; i < depth && pid > 1; i++) {
    let line: string
    try {
      line = execFileSync("ps", ["-o", "ppid=,args=", "-p", String(pid)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2_000,
      }).trim()
    } catch {
      break
    }
    const match = line.match(/^(\d+)\s+(.*)$/s)
    if (!match) break
    chain.push({ pid, args: match[2] })
    pid = Number(match[1])
  }
  return chain
}
