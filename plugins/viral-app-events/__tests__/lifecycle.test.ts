import { afterEach, expect, test } from "bun:test"
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-code", version: "test" } },
}

// When Claude Code goes away its end of the stdout pipe closes. The server must
// exit instead of looping on EPIPE errors.
test("the bundled server exits quietly when its stdout pipe closes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "viral-app-lifecycle-"))
  dirs.push(dir)
  const logFile = join(dir, "server.log")
  const child = spawn("node", [join(root, "dist", "server.mjs")], {
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      VIRAL_APP_EVENTS_STATE_DIR: dir,
      VIRAL_APP_EVENTS_DELIVERY: "off",
      VIRAL_APP_EVENTS_LOG_FILE: logFile,
    },
    stdio: ["pipe", "pipe", "ignore"],
  })
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)))

  child.stdin.write(`${JSON.stringify(initialize)}\n`)
  await new Promise<void>((resolve) => child.stdout.once("data", () => resolve()))
  child.stdout.destroy()
  // Keep stdin open and make the server write: it must notice the broken pipe.
  for (let id = 2; id < 6; id++) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" })}\n`)
  }

  const code = await Promise.race([exited, Bun.sleep(5_000).then(() => "timeout" as const)])
  if (code === "timeout") child.kill("SIGKILL")
  expect(code).toBe(0)
  const log = existsSync(logFile) ? readFileSync(logFile, "utf8") : ""
  expect(log.length).toBeLessThan(2_000)
  expect(log).not.toContain("uncaught exception")
})
