import { afterAll, describe, expect, test } from "bun:test"
import { CATALOG, type FakeViralApp, startFakeViralApp } from "../dev/fake-viral-app"
import { classifyError, McpEventsRemote, RemoteError } from "../src/remote"

const fakes: FakeViralApp[] = []
afterAll(() => {
  for (const fake of fakes) fake.stop()
})

for (const legacy of [false, true]) {
  describe(`McpEventsRemote against the fake server (${legacy ? "2025 fallback" : "2026-07-28"})`, () => {
    const fake = startFakeViralApp({ apiKey: "k", legacy, nextPollMs: 12_000 })
    fakes.push(fake)
    const remote = new McpEventsRemote({ url: fake.url, apiKey: "k" })

    test("lists every event across pages, with text fields", async () => {
      const before = fake.requests.filter((r) => r.method === "events/list").length
      const events = await remote.listEvents()
      expect(events).toHaveLength(CATALOG.length)
      expect(CATALOG.length).toBeGreaterThan(40)
      expect(fake.requests.filter((r) => r.method === "events/list").length - before).toBe(Math.ceil(CATALOG.length / 20))
      const chat = events.find((e) => e.name === "chat.message.received")
      expect(chat?.["x-viral-text-fields"]).toContain("message.content")
      expect(chat?.delivery).toEqual(["webhook", "poll"])
      expect(chat?.inputSchema?.additionalProperties).toBe(false)
    })

    test("polls from now, then from the cursor, with filters", async () => {
      const first = await remote.poll({ name: "application.submitted", arguments: { jobId: "orgjob_a" }, cursor: null })
      expect(first).toMatchObject({ events: [], truncated: false, hasMore: false, nextPollMs: 12_000 })
      expect(first.cursor).toBeString()

      fake.emit("application.submitted", { application: { id: "orgjapp_1", jobId: "orgjob_a" } })
      fake.emit("application.submitted", { application: { id: "orgjapp_2", jobId: "orgjob_b" } })
      fake.emit("chat.message.received", { message: { id: "m1", chatId: "c1" } })

      const second = await remote.poll({
        name: "application.submitted",
        arguments: { jobId: "orgjob_a" },
        cursor: first.cursor,
        maxEvents: 50,
        maxAgeMs: 60_000,
      })
      expect(second.events.map((e) => e.data)).toEqual([{ application: { id: "orgjapp_1", jobId: "orgjob_a" } }])
      expect(second.cursor).not.toBe(first.cursor)

      const sent = fake.requests.filter((r) => r.method === "events/poll").at(-1)?.params
      expect(sent).toMatchObject({ name: "application.submitted", maxEvents: 50, maxAgeMs: 60_000 })
    })

    test("an unreadable cursor is a gap, not an error", async () => {
      const result = await remote.poll({ name: "payout.due", arguments: {}, cursor: "not-a-cursor" })
      expect(result).toMatchObject({ events: [], truncated: true })
      expect(result.cursor).toBeString()
    })

    test("expired history comes back truncated", async () => {
      const start = await remote.poll({ name: "payout.due", arguments: {}, cursor: null })
      const e = fake.emit("payout.due", { window: { id: "w1", campaignId: "orgcamp_1" } })
      fake.expireThrough(e.seq)
      fake.emit("payout.due", { window: { id: "w2", campaignId: "orgcamp_1" } })
      const next = await remote.poll({ name: "payout.due", arguments: {}, cursor: start.cursor })
      expect(next.truncated).toBe(true)
      expect(next.events.map((x) => (x.data.window as { id: string }).id)).toEqual(["w2"])
    })

    test("maps viral.app's MCP Events error codes", async () => {
      const attempt = (name: string, args = {}) =>
        remote.poll({ name, arguments: args, cursor: null }).then(
          () => null,
          (err: RemoteError) => ({ kind: err.kind, reason: err.reason }),
        )
      expect(await attempt("nope.nope")).toEqual({ kind: "not_found", reason: undefined })
      expect(await attempt("application.submitted", { bogus: 1 })).toMatchObject({ kind: "invalid" })
      expect(await attempt("video.views_milestone", { minMilestone: "100k" })).toMatchObject({ kind: "invalid" })
      fake.forbidEvent("brief.read")
      expect(await attempt("brief.read")).toEqual({ kind: "forbidden", reason: "role" })
      fake.denyAccess("api_access_required")
      expect(await attempt("payout.due")).toEqual({ kind: "access", reason: "api_access_required" })
      await expect(remote.listEvents()).rejects.toMatchObject({ kind: "access" })
      fake.denyAccess(null)
    })

    test("HTTP 401 and 403 are auth errors, 5xx is transient, and the client recovers", async () => {
      const bad = new McpEventsRemote({ url: fake.url, apiKey: "wrong" })
      await expect(bad.listEvents()).rejects.toMatchObject({ kind: "auth", status: 401 })
      fake.failWith(403)
      await expect(remote.listEvents()).rejects.toMatchObject({ kind: "auth", status: 403 })
      fake.failWith(503)
      await expect(remote.listEvents()).rejects.toMatchObject({ kind: "transient" })
      fake.failWith(null)
      expect((await remote.listEvents()).length).toBeGreaterThan(0)
    })

    test("lists and deletes its poll subscriptions", async () => {
      await remote.poll({ name: "job.created", arguments: { jobId: "orgjob_sub" }, cursor: null })
      const subs = await remote.listSubscriptions()
      const sub = subs.find((s) => s.event === "job.created" && s.arguments.jobId === "orgjob_sub")
      expect(sub?.deliveryMode).toBe("poll")
      expect(await remote.deleteSubscription(sub!.id)).toBe(true)
      expect(await remote.deleteSubscription(sub!.id)).toBe(false)
    })
  })
}

test("the subscription cap answers -32013 with the limit", async () => {
  const fake = startFakeViralApp({ apiKey: "k", subscriptionCap: 1 })
  fakes.push(fake)
  const remote = new McpEventsRemote({ url: fake.url, apiKey: "k" })
  await remote.poll({ name: "payout.due", arguments: {}, cursor: null })
  // Renewing the same lease fits; a second one does not.
  await remote.poll({ name: "payout.due", arguments: {}, cursor: null })
  const err = await remote.poll({ name: "payout.paid", arguments: {}, cursor: null }).catch((e: RemoteError) => e)
  expect(err).toMatchObject({ kind: "quota", code: -32013 })
  expect((err as RemoteError).data).toEqual({ limit: "subscriptions", max: 1 })
})

test("classifyError covers every MCP Events code", () => {
  expect(classifyError(new Error("ECONNRESET")).kind).toBe("transient")
  expect(classifyError({ code: -32603, message: "internal" }).kind).toBe("transient")
  expect(classifyError({ code: -32602, message: "x" }).kind).toBe("invalid")
  expect(classifyError({ code: -32601, message: "x" }).kind).toBe("unsupported")
  expect(classifyError({ code: -32011, message: "x", data: { kind: "event" } }).kind).toBe("not_found")
  expect(classifyError({ code: -32012, message: "x", data: { reason: "role" } }).kind).toBe("forbidden")
  for (const reason of ["api_access_required", "read_only", "scope", "no_organization", "unauthenticated"]) {
    expect(classifyError({ code: -32012, message: "x", data: { reason } }).kind).toBe("access")
  }
  expect(classifyError({ code: -32013, message: "x", data: { limit: "subscriptions", max: 100 } }).kind).toBe("quota")
  expect(classifyError({ code: -32014, message: "x" }).kind).toBe("unsupported")
  const callback = classifyError({ code: -32015, message: "x", data: { reason: "rate_limited" } })
  expect([callback.kind, callback.reason]).toEqual(["callback", "rate_limited"])
  expect(classifyError({ code: "CLIENT_HTTP_FORBIDDEN", message: "x" }).kind).toBe("auth")
  const original = new RemoteError("forbidden", "x")
  expect(classifyError(original)).toBe(original)
})
