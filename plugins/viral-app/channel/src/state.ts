import { randomBytes } from "node:crypto"
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

export type JsonObject = Record<string, unknown>

export interface Watch {
  /** Identifier-safe id (`w_` + 10 base32 chars), used as the `watch_id` meta key value. */
  id: string
  /** Event name from `events/list`, e.g. `application.submitted`. */
  event: string
  /** Filter arguments sent with every `events/poll`. */
  arguments: JsonObject
  /** Forward creator-written free text (message bodies, answers) in notifications. */
  includeText: boolean
  /** What the user wants done when the event arrives, in their words. */
  note?: string
  createdAt: string
  /** Opaque server cursor; `null` means "start from now". */
  cursor: string | null
  status: "active" | "stopped"
  stopReason?: string
  lastPollAt?: string
  lastEventAt?: string
  delivered: number
  /** Recently delivered event ids, newest last, for at-least-once dedup across restarts. */
  recentEventIds: string[]
}

export interface State {
  version: 1
  watches: Watch[]
}

export const RECENT_EVENT_IDS = 200
// A read-modify-write takes milliseconds; a lock older than LOCK_STALE_MS was
// left by a crashed writer and is removed.
const LOCK_WAIT_MS = 6_000
const LOCK_STALE_MS = 5_000

export function emptyState(): State {
  return { version: 1, watches: [] }
}

export function newWatchId(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"
  const bytes = randomBytes(10)
  let id = "w_"
  for (const b of bytes) id += alphabet[b % alphabet.length]
  return id
}

/** JSON with sorted object keys, so `{a,b}` and `{b,a}` identify the same watch. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as JsonObject)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Watches and cursors in `<stateDir>/state.json`. Several Claude Code
 * sessions can share the file (one polls, the others only edit watches), so
 * every change is a locked read-modify-write and every write is atomic
 * (temp file + rename). Files are owner-only.
 */
export class StateStore {
  readonly dir: string
  readonly file: string
  private readonly lockFile: string

  constructor(dir: string) {
    this.dir = dir
    this.file = join(dir, "state.json")
    this.lockFile = join(dir, "state.lock")
  }

  read(): State {
    let text: string
    try {
      text = readFileSync(this.file, "utf8")
    } catch {
      return emptyState()
    }
    try {
      return normalizeState(JSON.parse(text))
    } catch {
      // Keep the unreadable file for inspection instead of silently dropping watches.
      try {
        renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
      } catch {}
      return emptyState()
    }
  }

  update<T>(mutate: (state: State) => T): T {
    this.ensureDir()
    this.lock()
    try {
      const state = this.read()
      const result = mutate(state)
      this.write(state)
      return result
    } finally {
      this.unlock()
    }
  }

  /** Applies `mutate` to one watch if it still exists; returns the updated copy. */
  updateWatch(id: string, mutate: (watch: Watch) => void): Watch | undefined {
    return this.update((state) => {
      const watch = state.watches.find((w) => w.id === id)
      if (!watch) return undefined
      mutate(watch)
      return { ...watch }
    })
  }

  private write(state: State): void {
    const tmp = `${this.file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    renameSync(tmp, this.file)
  }

  private ensureDir(): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 })
  }

  private lock(): void {
    const deadline = Date.now() + LOCK_WAIT_MS
    for (;;) {
      try {
        closeSync(openSync(this.lockFile, "wx", 0o600))
        return
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err
      }
      try {
        if (Date.now() - statSync(this.lockFile).mtimeMs > LOCK_STALE_MS) {
          rmSync(this.lockFile, { force: true })
          continue
        }
      } catch {
        continue
      }
      if (Date.now() > deadline) {
        throw new Error(`state file is locked by another process (${this.lockFile})`)
      }
      sleepSync(15)
    }
  }

  private unlock(): void {
    rmSync(this.lockFile, { force: true })
  }
}

function normalizeState(raw: unknown): State {
  const state = emptyState()
  const watches = (raw as { watches?: unknown })?.watches
  if (!Array.isArray(watches)) return state
  for (const w of watches) {
    if (!w || typeof w !== "object") continue
    const v = w as Partial<Watch>
    if (typeof v.id !== "string" || typeof v.event !== "string") continue
    state.watches.push({
      id: v.id,
      event: v.event,
      arguments: v.arguments && typeof v.arguments === "object" ? v.arguments : {},
      includeText: v.includeText === true,
      note: typeof v.note === "string" ? v.note : undefined,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
      cursor: typeof v.cursor === "string" ? v.cursor : null,
      status: v.status === "stopped" ? "stopped" : "active",
      stopReason: typeof v.stopReason === "string" ? v.stopReason : undefined,
      lastPollAt: typeof v.lastPollAt === "string" ? v.lastPollAt : undefined,
      lastEventAt: typeof v.lastEventAt === "string" ? v.lastEventAt : undefined,
      delivered: typeof v.delivered === "number" ? v.delivered : 0,
      recentEventIds: Array.isArray(v.recentEventIds)
        ? v.recentEventIds.filter((id): id is string => typeof id === "string").slice(-RECENT_EVENT_IDS)
        : [],
    })
  }
  return state
}
