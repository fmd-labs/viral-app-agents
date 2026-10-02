import type { PollTiming } from "./config.js"
import {
  type ChannelNotification,
  formatAuthNotice,
  formatEvent,
  formatGapNotice,
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
}

export interface PollerDeps {
  store: StateStore
  remote: () => EventsRemote | null
  emit: (notification: ChannelNotification) => Promise<void>
  /** Re-checked before every poll and before delivering its result. */
  isActive: () => boolean
  timing: PollTiming
  configureCommand: string
  /** Called once when viral.app rejects the API key. */
  onAuthFailure?: () => void
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
  /** Set when viral.app rejects the key; cleared by `resetAuth` when the key changes. */
  authError: string | null = null
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
    try {
      if (result.truncated && watch.cursor !== null) await this.deps.emit(formatGapNotice(watch))
      for (const event of fresh) await this.deps.emit(formatEvent(watch, event))
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

    if (err.kind === "auth") {
      const detail = err.status ? `HTTP ${err.status}` : err.message
      const first = this.authError === null
      this.authError = detail
      if (first) this.deps.onAuthFailure?.()
      this.log(`API key rejected (${detail}); pausing all watches`)
      if (first) {
        await this.deps.emit(formatAuthNotice(detail, this.deps.configureCommand)).catch(() => {})
      }
      return { kind: "auth_failed", error: detail }
    }

    const reason = `${err.kind.replace("_", " ")}: ${err.message}`
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
