import { afterAll, afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { startFakeViralApp } from "../dev/fake-viral-app"
import { Bridge, validateAgainstCatalog } from "../src/bridge"
import type { ChannelNotification } from "../src/format"

const fake = startFakeViralApp({ apiKey: "k", nextPollMs: 50 })
afterAll(() => fake.stop())
const dirs: string[] = []
const bridges: Bridge[] = []
afterEach(async () => {
  for (const b of bridges.splice(0)) await b.shutdown()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function makeBridge(opts: { client?: string; delivery?: boolean; key?: string | null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "viral-app-bridge-"))
  dirs.push(dir)
  if (opts.key !== null) writeFileSync(join(dir, ".env"), `VIRAL_APP_API_KEY=${opts.key ?? "k"}\nVIRAL_APP_MCP_URL=${fake.url}\n`)
  const emitted: ChannelNotification[] = []
  const bridge = new Bridge({
    stateDir: dir,
    env: { VIRAL_APP_EVENTS_MIN_POLL_MS: "20" },
    emit: async (n) => {
      emitted.push(n)
    },
    detectDelivery: () => ({ active: opts.delivery ?? true, reason: "test" }),
  })
  bridges.push(bridge)
  bridge.start(opts.client ?? "claude-code")
  return { bridge, emitted, dir }
}

function json(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text)
}

async function waitFor(check: () => boolean, ms = 3_000) {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) await Bun.sleep(20)
}

describe("tools", () => {
  test("other MCP clients only see status", async () => {
    const { bridge } = makeBridge({ client: "Visual Studio Code" })
    expect(bridge.tools().map((t) => t.name)).toEqual(["status"])
    expect((await bridge.callTool("watch", { event: "payout.due" })).isError).toBe(true)
    expect(json(await bridge.callTool("status", {})).message).toContain("does nothing in other clients")
  })

  test("Claude Code sees all five tools", () => {
    const { bridge } = makeBridge()
    expect(bridge.tools().map((t) => t.name)).toEqual(["watch", "unwatch", "list_watches", "list_events", "status"])
  })

  test("watch -> event delivered as a channel notification -> unwatch", async () => {
    const { bridge, emitted } = makeBridge()
    const res = await bridge.callTool("watch", {
      event: "application.submitted",
      arguments: { jobId: "orgjob_x" },
      note: "Show me each new applicant",
    })
    expect(res.isError).toBeUndefined()
    const created = json(res)
    expect(created.watch_id).toMatch(/^w_/)
    expect(created.delivery).toContain("active")

    fake.emit("application.submitted", { application: { id: "orgjapp_9", jobId: "orgjob_x", answers: "pick me" } })
    await waitFor(() => emitted.length > 0)
    expect(emitted).toHaveLength(1)
    expect(emitted[0].meta).toMatchObject({
      event: "application.submitted",
      watch_id: created.watch_id,
      application_id: "orgjapp_9",
      job_id: "orgjob_x",
    })
    expect(emitted[0].content).toContain('your note: "Show me each new applicant"')
    expect(emitted[0].content).not.toContain("pick me")

    const again = json(await bridge.callTool("watch", { event: "application.submitted", arguments: { jobId: "orgjob_x" } }))
    expect(again).toMatchObject({ watch_id: created.watch_id, already_watching: true })

    const listed = json(await bridge.callTool("list_watches", {}))
    expect(listed.watches[0]).toMatchObject({ watch_id: created.watch_id, delivered: 1, status: "active" })

    expect(json(await bridge.callTool("unwatch", { watch_id: created.watch_id }))).toMatchObject({ removed: created.watch_id })
    expect((await bridge.callTool("unwatch", { watch_id: created.watch_id })).isError).toBe(true)
  })

  test("watch validates against events/list and the server", async () => {
    const { bridge } = makeBridge()
    const typo = await bridge.callTool("watch", { event: "application.submited" })
    expect(typo.isError).toBe(true)
    expect(typo.content[0].text).toContain("application.submitted")
    const webhookOnly = await bridge.callTool("watch", { event: "job.status_changed" })
    expect(webhookOnly.content[0].text).toContain("does not support poll")
    const unknownArg = await bridge.callTool("watch", { event: "payout.due", arguments: { jobId: "x" } })
    expect(unknownArg.content[0].text).toContain("campaignId")
    const forbidden = await bridge.callTool("watch", { event: "application.submitted", arguments: { jobId: "orgjob_forbidden" } })
    expect(forbidden.content[0].text).toContain("refused")
    expect((await bridge.callTool("watch", { event: "bad name!" })).isError).toBe(true)
    expect((await bridge.callTool("list_watches", {})).content[0].text).toContain("No watches yet")
  })

  test("missing or rejected keys explain the configure command", async () => {
    const none = makeBridge({ key: null })
    expect((await none.bridge.callTool("watch", { event: "payout.due" })).content[0].text).toContain(
      "/viral-app:configure-events",
    )
    expect(json(await none.bridge.callTool("status", {})).next_step).toContain("/viral-app:configure-events")

    const wrong = makeBridge({ key: "nope" })
    const res = await wrong.bridge.callTool("watch", { event: "payout.due" })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("HTTP 401")
  })

  test("a session without the channel flag saves watches but does not poll", async () => {
    const { bridge, emitted } = makeBridge({ delivery: false })
    const created = json(await bridge.callTool("watch", { event: "payout.due" }))
    expect(created.delivery).toContain("--dangerously-load-development-channels plugin:viral-app@viral-app")
    fake.emit("payout.due", { payout: { id: "p_1" } })
    await Bun.sleep(150)
    expect(emitted).toEqual([])
    const status = json(await bridge.callTool("status", {}))
    expect(status.delivery.active_in_this_session).toBe(false)
    expect(status.api_key).toMatchObject({ configured: true, source: "file" })
    expect(status.api_key.preview).toBe("*")
  })

  test("list_events summarizes filters and returns one definition on request", async () => {
    const { bridge } = makeBridge()
    const all = json(await bridge.callTool("list_events", {}))
    const views = all.events.find((e: { name: string }) => e.name === "video.views_milestone")
    expect(views.filters).toEqual([
      "accountId (string): Only videos of this tracked account (orgacc_...).",
      "minMilestone (integer): Only milestones at or above this view count.",
    ])
    const one = json(await bridge.callTool("list_events", { event: "payout.due" }))
    expect(one.name).toBe("payout.due")
  })
})

test("validateAgainstCatalog", () => {
  const catalog = [
    { name: "a.b", delivery: ["poll"], inputSchema: { type: "object", properties: { x: {} }, required: ["x"] } },
  ]
  expect(validateAgainstCatalog(catalog, "a.b", { x: 1 })).toBeNull()
  expect(validateAgainstCatalog(catalog, "a.b", {})).toContain("needs")
  expect(validateAgainstCatalog([], "anything", {})).toBeNull()
})
