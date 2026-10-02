import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadSettings, parseEnvFile, resolveStateDir } from "../src/config"
import { Leadership } from "../src/leader"
import { canonicalJson, newWatchId, StateStore, type Watch } from "../src/state"

const dirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "viral-app-channel-"))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function watch(id: string, overrides: Partial<Watch> = {}): Watch {
  return {
    id,
    event: "application.submitted",
    arguments: { jobId: "orgjob_1" },
    includeText: false,
    createdAt: new Date().toISOString(),
    cursor: null,
    status: "active",
    delivered: 0,
    recentEventIds: [],
    ...overrides,
  }
}

describe("StateStore", () => {
  test("missing file reads as empty", () => {
    expect(new StateStore(join(tempDir(), "nested")).read()).toEqual({ version: 1, watches: [] })
  })

  test("persists watches and cursors across instances, owner-only, no temp files left", () => {
    const dir = join(tempDir(), "viral-app")
    const store = new StateStore(dir)
    store.update((s) => {
      s.watches.push(watch("w_1"))
    })
    store.updateWatch("w_1", (w) => {
      w.cursor = "seq:42"
      w.recentEventIds.push("evt_1")
    })

    const reloaded = new StateStore(dir).read()
    expect(reloaded.watches).toHaveLength(1)
    expect(reloaded.watches[0].cursor).toBe("seq:42")
    expect(reloaded.watches[0].recentEventIds).toEqual(["evt_1"])
    if (process.platform !== "win32") {
      expect(statSync(store.file).mode & 0o777).toBe(0o600)
      expect(statSync(dir).mode & 0o777).toBe(0o700)
    }
    expect(readdirSync(dir).sort()).toEqual(["state.json"])
  })

  test("updateWatch on a removed watch is a no-op", () => {
    const store = new StateStore(tempDir())
    expect(store.updateWatch("w_missing", () => {})).toBeUndefined()
  })

  test("a corrupt file is set aside instead of crashing", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "state.json"), "{not json")
    const store = new StateStore(dir)
    expect(store.read().watches).toEqual([])
    expect(readdirSync(dir).some((f) => f.startsWith("state.json.corrupt-"))).toBe(true)
  })

  test("normalizes partial records and drops invalid ones", () => {
    const dir = tempDir()
    writeFileSync(
      join(dir, "state.json"),
      JSON.stringify({ version: 1, watches: [{ id: "w_1", event: "x.y" }, { nope: true }] }),
    )
    const [w] = new StateStore(dir).read().watches
    expect(w).toMatchObject({ id: "w_1", event: "x.y", cursor: null, status: "active", includeText: false })
  })

  test("a stale lock left by a crashed writer is taken over", () => {
    const dir = tempDir()
    const store = new StateStore(dir)
    writeFileSync(join(dir, "state.lock"), "")
    const old = new Date(Date.now() - 60_000)
    require("node:fs").utimesSync(join(dir, "state.lock"), old, old)
    store.update((s) => {
      s.watches.push(watch("w_2"))
    })
    expect(store.read().watches.map((w) => w.id)).toEqual(["w_2"])
    expect(existsSync(join(dir, "state.lock"))).toBe(false)
  })
})

test("watch ids are identifier-safe", () => {
  for (let i = 0; i < 50; i++) expect(newWatchId()).toMatch(/^w_[a-z0-9]{10}$/)
})

test("canonical JSON ignores key order", () => {
  expect(canonicalJson({ b: 1, a: { d: [1, 2], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, 2] }, b: 1 }))
  expect(canonicalJson({ a: undefined })).toBe("{}")
})

describe("settings", () => {
  test("state dir honors overrides", () => {
    expect(resolveStateDir({ VIRAL_APP_EVENTS_STATE_DIR: "/x" })).toBe("/x")
    expect(resolveStateDir({ CLAUDE_CONFIG_DIR: "/cfg" })).toBe(join("/cfg", "channels", "viral-app"))
  })

  test("parses env files", () => {
    expect(parseEnvFile('# c\nVIRAL_APP_API_KEY="abc"\nexport OTHER=1\n\nbad line')).toEqual({
      VIRAL_APP_API_KEY: "abc",
      OTHER: "1",
    })
  })

  test("environment wins over the file; the file is locked down to 0600", () => {
    const dir = tempDir()
    writeFileSync(join(dir, ".env"), "VIRAL_APP_API_KEY=file-key\nVIRAL_APP_MCP_URL=http://127.0.0.1:1/api/mcp\n", {
      mode: 0o644,
    })
    expect(loadSettings(dir, {})).toMatchObject({
      apiKey: "file-key",
      apiKeySource: "file",
      mcpUrl: "http://127.0.0.1:1/api/mcp",
    })
    expect(loadSettings(dir, { VIRAL_APP_API_KEY: "env-key" })).toMatchObject({ apiKey: "env-key", apiKeySource: "env" })
    if (process.platform !== "win32") expect(statSync(join(dir, ".env")).mode & 0o777).toBe(0o600)
    expect(loadSettings(tempDir(), {})).toMatchObject({ apiKey: undefined, apiKeySource: "none", mcpUrl: "https://viral.app/api/mcp" })
  })
})

describe("Leadership", () => {
  test("newest claimant wins, the old one sees it lost", () => {
    const dir = tempDir()
    const a = new Leadership(dir, 1001, Date.now, () => true)
    const b = new Leadership(dir, 1002, Date.now, () => true)
    a.claim()
    expect(a.isLeader()).toBe(true)
    expect(b.isFree()).toBe(false)
    b.claim()
    expect(a.isLeader()).toBe(false)
    expect(a.heartbeat()).toBe(false)
    expect(b.heartbeat()).toBe(true)
    b.release()
    expect(a.isFree()).toBe(true)
  })

  test("a dead or silent holder frees the slot", () => {
    const dir = tempDir()
    let now = 1_000_000
    const alive = new Set([2001])
    const holder = new Leadership(dir, 2001, () => now, (pid) => alive.has(pid))
    const other = new Leadership(dir, 2002, () => now, (pid) => alive.has(pid))
    holder.claim()
    expect(other.isFree()).toBe(false)
    now += 91_000
    expect(other.isFree()).toBe(true)
    now -= 91_000
    alive.delete(2001)
    expect(other.isFree()).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, "poller.json"), "utf8")).pid).toBe(2001)
  })
})
