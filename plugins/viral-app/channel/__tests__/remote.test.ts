import { afterAll, describe, expect, test } from "bun:test"
import { type FakeViralApp, startFakeViralApp } from "../dev/fake-viral-app"
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

    test("lists events", async () => {
      const events = await remote.listEvents()
      expect(events.map((e) => e.name)).toContain("application.submitted")
      expect(events[0].inputSchema).toBeDefined()
    })

    test("polls from now, then from the cursor, with filters", async () => {
      const first = await remote.poll({ name: "application.submitted", arguments: { jobId: "orgjob_a" }, cursor: null })
      expect(first).toMatchObject({ events: [], truncated: false, hasMore: false, nextPollMs: 12_000 })
      expect(first.cursor).toMatch(/^seq:\d+$/)

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

    test("maps MCP Events error codes", async () => {
      const attempt = (name: string, args = {}) =>
        remote.poll({ name, arguments: args, cursor: null }).then(
          () => null,
          (err: RemoteError) => err.kind,
        )
      expect(await attempt("nope.nope")).toBe("not_found")
      expect(await attempt("job.status_changed")).toBe("unsupported")
      expect(await attempt("application.submitted", { bogus: 1 })).toBe("invalid")
      expect(await attempt("application.submitted", { jobId: "orgjob_forbidden" })).toBe("forbidden")
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

    test("expired history comes back truncated", async () => {
      const start = await remote.poll({ name: "payout.due", arguments: {}, cursor: null })
      const e = fake.emit("payout.due", { payout: { id: "p1", campaignId: "orgcamp_1" } })
      fake.expireThrough(e.seq)
      fake.emit("payout.due", { payout: { id: "p2", campaignId: "orgcamp_1" } })
      const next = await remote.poll({ name: "payout.due", arguments: {}, cursor: start.cursor })
      expect(next.truncated).toBe(true)
      expect(next.events.map((x) => (x.data.payout as { id: string }).id)).toEqual(["p2"])
    })
  })
}

test("classifyError falls back to transient", () => {
  expect(classifyError(new Error("ECONNRESET")).kind).toBe("transient")
  expect(classifyError({ code: -32603, message: "internal" }).kind).toBe("transient")
  expect(classifyError({ code: -32013, message: "quota" }).kind).toBe("quota")
  expect(classifyError({ code: "CLIENT_HTTP_FORBIDDEN", message: "x" }).kind).toBe("auth")
  const original = new RemoteError("forbidden", "x")
  expect(classifyError(original)).toBe(original)
})
