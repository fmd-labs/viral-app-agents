import { expect, test } from "bun:test"
import { detectDeliveryMode, isClaudeCodeClient, processAncestors } from "../src/detect"

const chain = (...args: string[]) => () => args.map((a, i) => ({ pid: 100 + i, args: a }))

test("only Claude Code clients get the channel", () => {
  expect(isClaudeCodeClient("claude-code", {})).toBe(true)
  expect(isClaudeCodeClient("Visual Studio Code", {})).toBe(false)
  expect(isClaudeCodeClient(undefined, {})).toBe(false)
  expect(isClaudeCodeClient("smoke", { VIRAL_APP_EVENTS_CLIENT: "any" })).toBe(true)
})

test("delivery is on when Claude Code was started with this channel", () => {
  for (const args of [
    "claude --dangerously-load-development-channels plugin:viral-app-events@viral-app",
    "/Users/me/.local/bin/claude --channels plugin:telegram@claude-plugins-official plugin:viral-app-events@viral-app",
    "node /x/@anthropic-ai/claude-code/cli.js --dangerously-load-development-channels=server:viral_app_events",
  ]) {
    expect(detectDeliveryMode({}, chain("sh -c node server.mjs", args)).active).toBe(true)
  }
})

test("delivery is off in a plain session or for another channel", () => {
  expect(detectDeliveryMode({}, chain("claude")).active).toBe(false)
  expect(detectDeliveryMode({}, chain("claude --channels plugin:telegram@claude-plugins-official")).active).toBe(false)
  expect(detectDeliveryMode({}, chain("claude --resume plugin:viral-app-events@viral-app")).active).toBe(false)
  expect(detectDeliveryMode({}, chain("claude --dangerously-load-development-channels plugin:viral-app-events-extra@x")).active).toBe(false)
  // The main plugin has no channel; naming it does not enable this one.
  expect(detectDeliveryMode({}, chain("claude --dangerously-load-development-channels plugin:viral-app@viral-app")).active).toBe(false)
  expect(detectDeliveryMode({}, chain("bun test")).reason).toContain("no Claude Code process")
  // Only the nearest claude process counts, not an outer shell that mentions the flag.
  expect(
    detectDeliveryMode(
      {},
      chain(
        "/Users/me/.local/bin/claude --plugin-dir x mcp list",
        "/bin/zsh -c claude --dangerously-load-development-channels plugin:viral-app-events@viral-app",
      ),
    ).active,
  ).toBe(false)
  expect(
    detectDeliveryMode(
      {},
      chain("/Users/me/.local/share/claude/versions/2.1.280 --dangerously-load-development-channels plugin:viral-app-events@viral-app"),
    ).active,
  ).toBe(true)
})

test("overrides and unknown parents", () => {
  expect(detectDeliveryMode({ VIRAL_APP_EVENTS_DELIVERY: "on" }, chain("claude")).active).toBe(true)
  expect(
    detectDeliveryMode(
      { VIRAL_APP_EVENTS_DELIVERY: "off" },
      chain("claude --channels plugin:viral-app-events@viral-app"),
    ).active,
  ).toBe(false)
  // Unknown means off: never poll from a session that might drop the events.
  expect(detectDeliveryMode({}, () => []).active).toBe(false)
  expect(
    detectDeliveryMode({}, () => {
      throw new Error("ps missing")
    }).active,
  ).toBe(false)
  expect(detectDeliveryMode({ VIRAL_APP_EVENTS_DELIVERY: "on" }, () => []).active).toBe(true)
})

test("reads real ancestors on this platform", () => {
  if (process.platform === "win32") return
  const ancestors = processAncestors(process.pid, 2)
  expect(ancestors[0]?.pid).toBe(process.pid)
  expect(ancestors[0]?.args).toContain("bun")
})
