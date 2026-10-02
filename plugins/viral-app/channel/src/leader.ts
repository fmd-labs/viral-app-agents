import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

interface LeaderRecord {
  pid: number
  token: string
  heartbeatAt: number
}

/** A holder that has not refreshed its heartbeat for this long is treated as gone. */
export const LEADER_STALE_MS = 90_000

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM"
  }
}

/**
 * Exactly one Claude Code session polls viral.app at a time, so events are
 * delivered once. The newest session started with the channel flag takes
 * over (`claim`); an older one notices on its next check and goes on standby,
 * and resumes when the newer session exits (`release`) or dies.
 */
export class Leadership {
  readonly token = randomUUID()
  private readonly file: string

  constructor(
    private readonly dir: string,
    private readonly pid: number = process.pid,
    private readonly now: () => number = Date.now,
    private readonly alive: (pid: number) => boolean = isProcessAlive,
  ) {
    this.file = join(dir, "poller.json")
  }

  holder(): LeaderRecord | null {
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8")) as Partial<LeaderRecord>
      if (typeof raw.pid !== "number" || typeof raw.token !== "string") return null
      return { pid: raw.pid, token: raw.token, heartbeatAt: Number(raw.heartbeatAt) || 0 }
    } catch {
      return null
    }
  }

  isLeader(): boolean {
    return this.holder()?.token === this.token
  }

  /** Free when nobody holds it, the holder died, or its heartbeat went stale. */
  isFree(): boolean {
    const holder = this.holder()
    if (!holder) return true
    if (holder.token === this.token) return false
    if (!this.alive(holder.pid)) return true
    return this.now() - holder.heartbeatAt > LEADER_STALE_MS
  }

  claim(): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    const record: LeaderRecord = { pid: this.pid, token: this.token, heartbeatAt: this.now() }
    const tmp = `${this.file}.${this.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 })
    renameSync(tmp, this.file)
  }

  /** Refreshes the heartbeat if still the leader; returns whether it is. */
  heartbeat(): boolean {
    if (!this.isLeader()) return false
    this.claim()
    return true
  }

  release(): void {
    if (this.isLeader()) rmSync(this.file, { force: true })
  }
}
