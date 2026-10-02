import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolvePollTiming } from "../src/config"
import type { ChannelNotification } from "../src/format"
import { backoffDelay, clampPollInterval, Poller } from "../src/poller"
import { type EventsRemote, type PollParams, type PollResult, RemoteError } from "../src/remote"
import { StateStore, type Watch } from "../src/state"

const timing = resolvePollTiming({})
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

type Step = PollResult | RemoteError | Error

/** Replays scripted results and records every poll. */
class ScriptedRemote implements EventsRemote {
  readonly calls: PollParams[] = []
  constructor(private readonly steps: Step[]) {}
  async listEvents() {
    return []
  }
  async poll(params: PollParams): Promise<PollResult> {
    this.calls.push(structuredClone(params))
    const step = this.steps.shift()
    if (!step) throw new Error("no more scripted steps")
    if (step instanceof Error) throw step
    return step
  }
  async close() {}
}

function result(overrides: Partial<PollResult> = {}): PollResult {
  return { events: [], cursor: "c1", truncated: false, hasMore: false, nextPollMs: 30_000, ...overrides }
}

function evt(id: string, name = "application.submitted") {
  return { eventId: id, name, timestamp: "2026-10-02T10:00:00.000Z", data: { application: { id: `orgjapp_${id}`, jobId: "orgjob_1" } } }
}

function setup(steps: Step[], watchOverrides: Partial<Watch> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "viral-app-poller-"))
  dirs.push(dir)
  const store = new StateStore(dir)
  store.update((s) => {
    s.watches.push({
      id: "w_test",
      event: "application.submitted",
      arguments: { jobId: "orgjob_1" },
      includeText: false,
      note: "tell me",
      createdAt: "2026-10-02T09:00:00.000Z",
      cursor: "c0",
      status: "active",
      delivered: 0,
      recentEventIds: [],
      ...watchOverrides,
    })
  })
  const remote = new ScriptedRemote(steps)
  const emitted: ChannelNotification[] = []
  const state = { active: true, authFailures: 0 }
  const poller = new Poller({
    store,
    remote: () => remote,
    emit: async (n) => {
      emitted.push(n)
    },
    isActive: () => state.active,
    timing,
    configureCommand: "/viral-app:configure-events",
    onAuthFailure: () => {
      state.authFailures += 1
    },
    random: () => 0,
  })
  const current = () => store.read().watches.find((w) => w.id === "w_test")
  return { store, remote, emitted, state, poller, current }
}

describe("timing", () => {
  test("nextPollMs is clamped to 10s..5min with a 30s default", () => {
    expect(clampPollInterval(undefined, timing)).toBe(30_000)
    expect(clampPollInterval(1_000, timing)).toBe(10_000)
    expect(clampPollInterval(60_000, timing)).toBe(60_000)
    expect(clampPollInterval(3_600_000, timing)).toBe(300_000)
    expect(clampPollInterval(Number.NaN, timing)).toBe(30_000)
  })

  test("backoff doubles from 10s and caps at 5 minutes", () => {
    const delays = [1, 2, 3, 4, 5, 6, 7, 20].map((n) => backoffDelay(n, timing, () => 0))
    expect(delays).toEqual([10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000])
    expect(backoffDelay(1, timing, () => 1)).toBe(12_000)
    expect(backoffDelay(9, timing, () => 1)).toBe(300_000)
  })
})

describe("pollOnce", () => {
  test("sends the persisted cursor and saves the new one", async () => {
    const t = setup([result({ cursor: "c1", events: [evt("e1"), evt("e2")], nextPollMs: 45_000 })])
    const outcome = await t.poller.pollOnce("w_test")
    expect(outcome).toEqual({ kind: "delivered", delivered: 2, delayMs: 45_000 })
    expect(t.remote.calls[0]).toEqual({
      name: "application.submitted",
      arguments: { jobId: "orgjob_1" },
      cursor: "c0",
      maxEvents: 50,
      maxAgeMs: 86_400_000,
    })
    expect(t.emitted.map((n) => n.meta.event_id)).toEqual(["e1", "e2"])
    expect(t.current()).toMatchObject({ cursor: "c1", delivered: 2, recentEventIds: ["e1", "e2"] })
  })

  test("hasMore polls again right away, then falls back to the server interval", async () => {
    const t = setup([result({ cursor: "c1", hasMore: true, events: [evt("e1")] }), result({ cursor: "c2" })])
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ delayMs: 250 })
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ delayMs: 30_000 })
    expect(t.remote.calls.map((c) => c.cursor)).toEqual(["c0", "c1"])
  })

  test("truncated results announce a gap before the events", async () => {
    const t = setup([result({ cursor: "c5", truncated: true, events: [evt("e9")] })])
    await t.poller.pollOnce("w_test")
    expect(t.emitted.map((n) => n.meta.notice ?? n.meta.event_id)).toEqual(["gap", "e9"])
    expect(t.current()?.cursor).toBe("c5")
  })

  test("no gap notice on the bootstrap poll", async () => {
    const t = setup([result({ cursor: "c1", truncated: true })], { cursor: null })
    await t.poller.pollOnce("w_test")
    expect(t.emitted).toEqual([])
    expect(t.remote.calls[0].cursor).toBeNull()
  })

  test("events already delivered are not repeated", async () => {
    const t = setup([result({ cursor: "c1", events: [evt("e1"), evt("e2")] })], { recentEventIds: ["e1"] })
    await t.poller.pollOnce("w_test")
    expect(t.emitted.map((n) => n.meta.event_id)).toEqual(["e2"])
    expect(t.current()?.recentEventIds).toEqual(["e1", "e2"])
  })

  test("a null cursor from the server is stored as null", async () => {
    const t = setup([result({ cursor: null })])
    await t.poller.pollOnce("w_test")
    expect(t.current()?.cursor).toBeNull()
  })

  test("transient errors back off and keep the cursor", async () => {
    const t = setup([
      new RemoteError("transient", "socket hang up"),
      new RemoteError("transient", "HTTP 503"),
      result({ cursor: "c1" }),
    ])
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "retry", delayMs: 10_000 })
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "retry", delayMs: 20_000 })
    expect(t.current()?.cursor).toBe("c0")
    expect(t.poller.runtimeFor("w_test").lastError).toBe("HTTP 503")
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "delivered" })
    expect(t.poller.runtimeFor("w_test").consecutiveErrors).toBe(0)
    expect(t.emitted).toEqual([])
  })

  test("unknown events and forbidden filters stop the watch with one notice", async () => {
    for (const err of [
      new RemoteError("not_found", "NotFound", -32011),
      new RemoteError("forbidden", "Forbidden", -32012),
      new RemoteError("invalid", "bad args", -32602),
    ]) {
      const t = setup([err])
      expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "stopped" })
      expect(t.current()).toMatchObject({ status: "stopped" })
      expect(t.emitted).toHaveLength(1)
      expect(t.emitted[0].meta).toMatchObject({ notice: "watch_stopped", watch_id: "w_test" })
      expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "skipped" })
    }
  })

  test("a rejected key pauses everything with a single notice", async () => {
    const t = setup([new RemoteError("auth", "unauthorized", "CLIENT_HTTP_AUTHENTICATION", 401)])
    expect(await t.poller.pollOnce("w_test")).toEqual({ kind: "auth_failed", error: "HTTP 401" })
    expect(t.emitted).toHaveLength(1)
    expect(t.emitted[0].meta).toEqual({ notice: "auth_failed" })
    expect(t.emitted[0].content).toContain("/viral-app:configure-events")
    expect(t.state.authFailures).toBe(1)
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "skipped", reason: "API key rejected" })
    expect(t.remote.calls).toHaveLength(1)
    expect(t.current()?.status).toBe("active")
    t.poller.resetAuth()
    expect(t.poller.authError).toBeNull()
  })

  test("losing leadership mid-request discards the result", async () => {
    const t = setup([result({ cursor: "c1", events: [evt("e1")] })])
    const poll = t.remote.poll.bind(t.remote)
    t.remote.poll = async (p) => {
      const r = await poll(p)
      t.state.active = false
      return r
    }
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "skipped", reason: "lost poller leadership" })
    expect(t.emitted).toEqual([])
    expect(t.current()?.cursor).toBe("c0")
  })

  test("a failed delivery keeps the cursor for the next attempt", async () => {
    const t = setup([result({ cursor: "c1", events: [evt("e1")] })])
    const poller = new Poller({
      store: t.store,
      remote: () => t.remote,
      emit: async () => {
        throw new Error("transport closed")
      },
      isActive: () => true,
      timing,
      configureCommand: "x",
      random: () => 0,
    })
    expect(await poller.pollOnce("w_test")).toMatchObject({ kind: "retry" })
    expect(t.current()?.cursor).toBe("c0")
  })

  test("inactive sessions and stopped watches do not poll", async () => {
    const t = setup([result()])
    t.state.active = false
    expect(await t.poller.pollOnce("w_test")).toMatchObject({ kind: "skipped" })
    expect(t.remote.calls).toEqual([])
    const s = setup([result()], { status: "stopped" })
    expect(await s.poller.pollOnce("w_test")).toMatchObject({ kind: "skipped" })
  })
})

test("sync schedules active watches and the timer polls", async () => {
  const t = setup([result({ cursor: "c1", events: [evt("e1")] }), result({ cursor: "c2" })])
  t.poller.sync()
  for (let i = 0; i < 50 && t.emitted.length === 0; i++) await Bun.sleep(10)
  expect(t.emitted).toHaveLength(1)
  expect(t.poller.runtimeFor("w_test").nextPollAt).toBeDefined()
  t.store.update((s) => {
    s.watches = []
  })
  t.poller.sync()
  expect(t.poller.runtimeFor("w_test").nextPollAt).toBeUndefined()
  t.poller.stop()
})
