import type { PollTiming } from "./config.js"
import {
  type ChannelNotification,
  formatAccessNotice,
  formatAuthNotice,
  formatEvent,
  formatGapNotice,
  formatQuotaNotice,
  formatStoppedNotice,
} from "./format.js"
import { classifyError, type EventsRemote, type RemoteError } from "./remote.js"
import { RECENT_EVENT_IDS, type StateStore, type Watch } from "./state.js"

/** Consecutive `hasMore` pages drained without waiting before the normal interval applies. */
const MAX_DRAIN_PAGES = 20
const DRAIN_DELAY_MS = 250
const BACKOFF_BASE_MS = 10_000

export function clampPollInterval(nextPollMs: number | undefined, timing: PollTiming): number {
  const value = typeof nextPollMs === "number" && Number.isFinite(nextPollMs) ? nextPollMs : timing.defaultPollMs
  return Math.min(timing.maxPollMs, Math.max(timing.minPollMs, value))
}

/** 10s, 20s, 40s, ... capped at `maxBackoffMs`; `random` adds up to 20% jitter. */
export function backoffDelay(consecutiveErrors: number, timing: PollTiming, random: () => number = Math.random): number {
  const exp = BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveErrors - 1)
  const capped = Math.min(timing.maxBackoffMs, exp)
  return Math.round(Math.min(timing.maxBackoffMs, capped * (1 + 0.2 * random())))
}

export interface WatchRuntime {
  consecutiveErrors: number
  lastError?: string
  lastErrorAt?: string
  nextPollAt?: string
  drainPages: number
  /** A quota notice went out for the current run of -32013 errors. */
  quotaNotified?: boolean
}

export interface PollerDeps {
  store: StateStore
  remote: () => EventsRemote | null
  emit: (notification: ChannelNotification) => Promise<void>
  /** Re-checked before every poll and before delivering its result. */
  isActive: () => boolean
  timing: PollTiming
  configureCommand: string
  /** Called once when viral.app rejects the API key or the organization's access. */
  onAuthFailure?: () => void
  /**
   * viral.app's `x-viral-text-fields` for an event (from `events/list`), or
   * undefined when unknown; the formatter then falls back to its heuristic.
   */
  textFields?: (event: string) => Promise<readonly string[] | undefined>
  log?: (message: string) => void
  now?: () => number
  random?: () => number
}

export type PollOutcome =
  | { kind: "delivered"; delivered: number; delayMs: number }
  | { kind: "retry"; delayMs: number; error: string }
  | { kind: "stopped"; reason: string }
  | { kind: "auth_failed"; error: string }
  | { kind: "skipped"; reason: string }

/**
 * Polls `events/poll` once per watch on its own timer. One instance runs in
 * the session that holds poller leadership; `sync` reconciles timers with the
 * watches in the state file, which other sessions may edit.
 */
export class Poller {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly inflight = new Set<string>()
  readonly runtime = new Map<string, WatchRuntime>()
  /**
   * Why every watch is paused (null when polling): the key was rejected
   * (`auth`, HTTP 401/403) or the organization or credential may not use
   * events (`access`, -32012 with an org-wide reason). Cleared by `resetAuth`.
   */
  authError: string | null = null
  pauseKind: "auth" | "access" | null = null
  pausedAt: number | null = null
  /** The pause problem last announced, so a retry that fails the same way stays quiet. */
  private lastPauseNotice: string | null = null
  private stopped = false

  constructor(private readonly deps: PollerDeps) {}

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private log(message: string): void {
    this.deps.log?.(message)
  }

  runtimeFor(id: string): WatchRuntime {
    let rt = this.runtime.get(id)
    if (!rt) {
      rt = { consecutiveErrors: 0, drainPages: 0 }
      this.runtime.set(id, rt)
    }
    return rt
  }

  /** Schedules every active watch that has no timer yet; drops timers of removed or stopped watches. */
  sync(): void {
    if (this.stopped) return
    const watches = this.deps.store.read().watches
    const active = new Set(watches.filter((w) => w.status === "active").map((w) => w.id))
    for (const id of [...this.timers.keys()]) {
      if (!active.has(id)) this.cancel(id)
    }
    if (!this.deps.isActive() || this.authError) {
      this.cancelAll()
      return
    }
    for (const id of active) {
      if (!this.timers.has(id) && !this.inflight.has(id)) this.schedule(id, 0)
    }
  }

  schedule(id: string, delayMs: number): void {
    if (this.stopped) return
    this.cancel(id)
    this.runtimeFor(id).nextPollAt = new Date(this.now() + delayMs).toISOString()
    const timer = setTimeout(() => {
      this.timers.delete(id)
      void this.run(id)
    }, delayMs)
    timer.unref?.()
    this.timers.set(id, timer)
  }

  cancel(id: string): void {
    const timer = this.timers.get(id)
    if (timer) clearTimeout(timer)
    this.timers.delete(id)
    const rt = this.runtime.get(id)
    if (rt) rt.nextPollAt = undefined
  }

  cancelAll(): void {
    for (const id of [...this.timers.keys()]) this.cancel(id)
  }

  stop(): void {
    this.stopped = true
    this.cancelAll()
  }

  resetAuth(): void {
    this.authError = null
    this.pauseKind = null
    this.pausedAt = null
  }

  private async run(id: string): Promise<void> {
    if (this.inflight.has(id)) return
    this.inflight.add(id)
    let outcome: PollOutcome
    try {
      outcome = await this.pollOnce(id)
    } catch (err) {
      const rt = this.runtimeFor(id)
      rt.consecutiveErrors += 1
      rt.lastError = (err as Error).message
      outcome = { kind: "retry", delayMs: backoffDelay(rt.consecutiveErrors, this.deps.timing, this.deps.random), error: rt.lastError }
      this.log(`watch ${id}: ${rt.lastError}`)
    } finally {
      this.inflight.delete(id)
    }
    if (outcome.kind === "delivered" || outcome.kind === "retry") this.schedule(id, outcome.delayMs)
    else if (outcome.kind === "auth_failed") this.cancelAll()
  }

  /** One `events/poll` round for one watch. Exposed for tests. */
  async pollOnce(id: string): Promise<PollOutcome> {
    const watch = this.deps.store.read().watches.find((w) => w.id === id)
    if (!watch || watch.status !== "active") return { kind: "skipped", reason: "watch removed or stopped" }
    if (!this.deps.isActive()) return { kind: "skipped", reason: "not the active poller" }
    if (this.authError) return { kind: "skipped", reason: "API key rejected" }
    const remote = this.deps.remote()
    if (!remote) return { kind: "skipped", reason: "no API key configured" }

    const rt = this.runtimeFor(id)
    const { timing } = this.deps
    let result: Awaited<ReturnType<EventsRemote["poll"]>>
    try {
      result = await remote.poll({
        name: watch.event,
        arguments: watch.arguments,
        cursor: watch.cursor,
        maxEvents: timing.maxEventsPerPoll,
        maxAgeMs: timing.maxAgeMs,
      })
    } catch (err) {
      return this.handleError(watch, classifyError(err))
    }

    // Leadership can move to a newer session while the request is in flight:
    // drop the result without saving the cursor; the new poller fetches it again.
    if (!this.deps.isActive()) return { kind: "skipped", reason: "lost poller leadership" }

    const seen = new Set(watch.recentEventIds)
    const fresh = result.events.filter((e) => !seen.has(e.eventId))
    const textFields =
      fresh.length > 0 && this.deps.textFields
        ? await this.deps.textFields(watch.event).catch(() => undefined)
        : undefined
    try {
      if (result.truncated && watch.cursor !== null) await this.deps.emit(formatGapNotice(watch))
      for (const event of fresh) await this.deps.emit(formatEvent(watch, event, textFields))
    } catch (err) {
      // The session transport is gone; keep the cursor so nothing is skipped.
      return this.retry(watch, rt, `could not deliver to Claude Code: ${(err as Error).message}`)
    }

    const nowIso = new Date(this.now()).toISOString()
    this.deps.store.updateWatch(id, (w) => {
      w.cursor = result.cursor
      w.lastPollAt = nowIso
      if (fresh.length) {
        w.lastEventAt = nowIso
        w.delivered += fresh.length
        w.recentEventIds = [...w.recentEventIds, ...fresh.map((e) => e.eventId)].slice(-RECENT_EVENT_IDS)
      }
    })
    rt.consecutiveErrors = 0
    rt.lastError = undefined
    rt.quotaNotified = false
    this.lastPauseNotice = null

    let delayMs: number
    if (result.hasMore && rt.drainPages < MAX_DRAIN_PAGES) {
      rt.drainPages += 1
      delayMs = DRAIN_DELAY_MS
    } else {
      rt.drainPages = 0
      delayMs = clampPollInterval(result.nextPollMs, timing)
    }
    return { kind: "delivered", delivered: fresh.length, delayMs }
  }

  private retry(watch: Watch, rt: WatchRuntime, message: string): PollOutcome {
    rt.consecutiveErrors += 1
    rt.lastError = message
    rt.lastErrorAt = new Date(this.now()).toISOString()
    const delayMs = backoffDelay(rt.consecutiveErrors, this.deps.timing, this.deps.random)
    this.log(`watch ${watch.id}: ${message}; retrying in ${Math.round(delayMs / 1000)}s`)
    return { kind: "retry", delayMs, error: message }
  }

  private async handleError(watch: Watch, err: RemoteError): Promise<PollOutcome> {
    const rt = this.runtimeFor(watch.id)
    if (err.kind === "transient") return this.retry(watch, rt, err.message)

    if (err.kind === "auth" || err.kind === "access") {
      const detail =
        err.kind === "auth"
          ? err.status
            ? `HTTP ${err.status}`
            : err.message
          : `${err.reason ?? "forbidden"}: ${err.message}`
      const first = this.authError === null
      this.authError = detail
      this.pauseKind = err.kind
      this.pausedAt = this.now()
      if (first) this.deps.onAuthFailure?.()
      this.log(`${err.kind === "auth" ? "API key rejected" : "events not available"} (${detail}); pausing all watches`)
      const noticeKey = `${err.kind}:${err.reason ?? err.status ?? ""}`
      if (noticeKey !== this.lastPauseNotice) {
        this.lastPauseNotice = noticeKey
        const notice =
          err.kind === "auth"
            ? formatAuthNotice(detail, this.deps.configureCommand)
            : formatAccessNotice(err.reason, err.message, this.deps.configureCommand)
        await this.deps.emit(notice).catch(() => {})
      }
      return { kind: "auth_failed", error: detail }
    }

    if (err.kind === "quota") {
      // The organization's subscription cap: this watch's lease lapsed and no
      // slot is free. Others may free one; try again at the slowest pace.
      rt.consecutiveErrors += 1
      rt.lastError = `subscription limit reached: ${err.message}`
      rt.lastErrorAt = new Date(this.now()).toISOString()
      if (!rt.quotaNotified) {
        rt.quotaNotified = true
        const max = typeof err.data?.max === "number" ? err.data.max : undefined
        await this.deps.emit(formatQuotaNotice(watch, max)).catch(() => {})
      }
      return { kind: "retry", delayMs: this.deps.timing.maxBackoffMs, error: rt.lastError }
    }

    const reason = stopReason(watch, err)
    this.deps.store.updateWatch(watch.id, (w) => {
      w.status = "stopped"
      w.stopReason = reason
    })
    this.cancel(watch.id)
    this.log(`watch ${watch.id} stopped (${reason})`)
    await this.deps.emit(formatStoppedNotice(watch, reason)).catch(() => {})
    return { kind: "stopped", reason }
  }
}

/** Why a watch stopped, in words for the user. */
export function stopReason(watch: Watch, err: RemoteError): string {
  switch (err.kind) {
    case "forbidden":
      return `your role in this organization cannot receive ${watch.event} events (${err.message})`
    case "not_found":
      return `viral.app has no event named ${watch.event} (${err.message})`
    case "invalid":
      return `viral.app rejected the filter arguments (${err.message})`
    case "unsupported":
      return `viral.app does not offer polling for this event (${err.message})`
    default:
      return `${err.kind.replace("_", " ")}: ${err.message}`
  }
}
