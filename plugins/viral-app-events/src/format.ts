import type { EventOccurrence } from "./remote.js"
import type { JsonObject, Watch } from "./state.js"

/** `notifications/claude/channel` params. */
export interface ChannelNotification {
  content: string
  meta: Record<string, string>
}

/** Short human labels for the viral.app event catalog; unknown names fall back to the raw name. */
export const EVENT_LABELS: Record<string, string> = {
  "chat.message.received": "A creator sent a chat message",
  "chat.message.sent": "Your team sent a chat message",
  "chat.message.updated": "A chat message was edited",
  "chat.message.deleted": "A chat message was deleted",
  "chat.reaction.added": "Someone reacted to a chat message",
  "chat.reaction.removed": "A chat reaction was removed",
  "chat.system_message.created": "viral.app posted a status message in a chat",
  "chat.thread.updated": "A group chat was renamed or its members changed",
  "chat.thread.deleted": "A chat conversation was deleted",
  "creator.created": "A creator was added to the roster",
  "creator.updated": "A creator's profile was changed",
  "creator.archived": "A creator was archived",
  "creator.unarchived": "A creator was restored from the archive",
  "creator.deleted": "A creator was removed from the roster",
  "creator.invited": "A platform invitation was sent to a creator",
  "creator.invitation_declined": "A creator declined the platform invitation",
  "creator.invitation_revoked": "A platform invitation was revoked",
  "creator.joined": "A creator joined the organization",
  "creator.join_request.created": "A creator asked to join",
  "creator.join_request.approved": "A join request was approved",
  "creator.join_request.rejected": "A join request was rejected",
  "creator.join_request.canceled": "A join request was canceled",
  "campaign.created": "A campaign was created",
  "campaign.updated": "A campaign was changed",
  "campaign.started": "A campaign started",
  "campaign.ended": "A campaign ended",
  "campaign.reactivated": "A campaign was reactivated",
  "campaign.deleted": "A campaign was deleted",
  "brief.published": "A brief reached its creators",
  "brief.read": "A creator read a brief",
  "assignment.created": "A creator was assigned to a campaign",
  "assignment.updated": "An assignment's end date changed",
  "assignment.started": "An assignment started",
  "assignment.ended": "An assignment ended",
  "assignment.canceled": "An assignment was canceled",
  "assignment.period_started": "A billing period began",
  "assignment.period_ended": "A billing period completed",
  "payout.due": "A payout became due",
  "payout.due_cleared": "A due payout left the Due tab",
  "payout.initiated": "A payout was issued",
  "payout.paid": "A payout reached the creator",
  "payout.status_changed": "A payout's provider status changed",
  "payout.canceled": "A billing window's payout was canceled",
  "payout.reinstated": "A canceled payout was reinstated",
  "payout.withdrawn": "A payout was withdrawn",
  "payout_hold.changed": "The organization's payout hold changed",
  "job.created": "A job posting was created",
  "job.updated": "A job posting was edited",
  "job.status_changed": "A job posting was published, paused or resumed",
  "job.deleted": "A job posting was deleted",
  "application.created": "A creator applied, or was invited to apply",
  "application.submitted": "A new application is waiting for review",
  "application.status_changed": "An application changed status",
  "video.published": "A tracked account posted a new video",
  "video.views_milestone": "A tracked video crossed a views milestone",
  "account.followers_milestone": "A tracked account crossed a followers milestone",
}

/**
 * Keys whose string values are free text, often written by creators (chat
 * messages, application answers, bios). Dropped unless the watch opted in
 * with `include_text`, so third-party prose reaches the model only on request.
 */
const TEXT_KEY =
  /^(?:body|text|message|content|markdown|answer|answers|note|notes|bio|description|comment|comments|caption|transcript|preview|excerpt|snippet|reply|summary|prompt)$|markdown$|text$|body$/i
const MAX_SHORT_STRING = 160
const MAX_TEXT_STRING = 4_000
const MAX_ARRAY_ITEMS = 25
const MAX_DEPTH = 6
const MAX_DATA_CHARS = 3_000
const MAX_DATA_CHARS_WITH_TEXT = 12_000
const MAX_META_ENTRIES = 16
const MAX_NOTE_CHARS = 500

/** Meta keys Claude Code or the bridge itself sets; event data never overrides them. */
const RESERVED_META = new Set(["source", "event", "event_id", "watch_id", "occurred_at", "notice", "gap"])
const SAFE_META_VALUE = /^[A-Za-z0-9_.:@+-]{1,128}$/

/** Claude Code drops meta keys that are not identifiers (letters, digits, underscores). */
export function sanitizeMetaKey(key: string): string | null {
  const snake = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
  if (!snake) return null
  return /^[0-9]/.test(snake) ? `k_${snake}` : snake
}

/** Only short id-like values go into tag attributes; anything else stays in the body. */
export function sanitizeMetaValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return null
  return SAFE_META_VALUE.test(value) ? value : null
}

function singular(word: string): string {
  return word.endsWith("ies") ? `${word.slice(0, -3)}y` : word.endsWith("s") ? word.slice(0, -1) : word
}

/**
 * Collects identifiers from the payload as meta entries: `jobId` becomes
 * `job_id`, and `{ application: { id } }` becomes `application_id`.
 */
export function extractIdMeta(data: JsonObject): Record<string, string> {
  const meta: Record<string, string> = {}
  const visit = (value: unknown, parentKey: string | null, depth: number) => {
    if (depth > 3 || !value || typeof value !== "object" || Array.isArray(value)) return
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (Object.keys(meta).length >= MAX_META_ENTRIES) return
      let metaKey: string | null = null
      if (key === "id" && parentKey) metaKey = sanitizeMetaKey(`${singular(parentKey)}_id`)
      else if (/[a-z0-9]Id$/.test(key) || /_id$/.test(key)) metaKey = sanitizeMetaKey(key)
      else if (key === "milestone" || key === "platform" || key === "status") metaKey = key
      if (metaKey && !RESERVED_META.has(metaKey) && !(metaKey in meta)) {
        const safe = sanitizeMetaValue(child)
        if (safe !== null) meta[metaKey] = safe
      }
      if (child && typeof child === "object" && !Array.isArray(child)) visit(child, key, depth + 1)
    }
  }
  visit(data, null, 0)
  return meta
}

/**
 * Copies the payload for display: keeps ids, numbers, flags, dates and short
 * strings; drops free text unless `includeText`; caps arrays and depth.
 * `omitted` lists the paths that were left out so Claude can fetch them with
 * the regular viral.app tools when needed.
 */
export function compactData(
  data: JsonObject,
  includeText: boolean,
): { data: JsonObject; omitted: string[] } {
  const omitted: string[] = []
  const walk = (value: unknown, path: string, key: string, depth: number): unknown => {
    if (value === null || typeof value === "number" || typeof value === "boolean") return value
    if (typeof value === "string") {
      if (includeText) {
        return value.length > MAX_TEXT_STRING ? `${value.slice(0, MAX_TEXT_STRING)}…` : value
      }
      if (TEXT_KEY.test(key) || value.length > MAX_SHORT_STRING) {
        omitted.push(path)
        return undefined
      }
      return value
    }
    if (depth >= MAX_DEPTH) {
      omitted.push(path)
      return undefined
    }
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_ITEMS).map((item, i) => walk(item, `${path}[${i}]`, key, depth + 1))
      if (value.length > MAX_ARRAY_ITEMS) omitted.push(`${path}[${MAX_ARRAY_ITEMS}..${value.length - 1}]`)
      return items.filter((item) => item !== undefined)
    }
    if (typeof value === "object") {
      const out: JsonObject = {}
      for (const [k, v] of Object.entries(value as JsonObject)) {
        const next = walk(v, path ? `${path}.${k}` : k, k, depth + 1)
        if (next !== undefined) out[k] = next
      }
      return out
    }
    return undefined
  }
  const compact = (walk(data, "", "", 0) ?? {}) as JsonObject
  return { data: compact, omitted }
}

function headerLine(watch: Watch): string {
  const note = watch.note ? watch.note.slice(0, MAX_NOTE_CHARS) : null
  return `viral.app watch ${watch.id} (${watch.event})${note ? ` · your note: ${JSON.stringify(note)}` : ""}`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

function summaryLine(event: EventOccurrence): string {
  let line = EVENT_LABELS[event.name] ?? `viral.app event ${event.name}`
  const milestone = findNumber(event.data, "milestone")
  if (milestone !== undefined) line += ` (${formatCount(milestone)})`
  return line
}

function findNumber(data: JsonObject, key: string): number | undefined {
  const direct = data[key]
  if (typeof direct === "number") return direct
  for (const value of Object.values(data)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = (value as JsonObject)[key]
      if (typeof nested === "number") return nested
    }
  }
  return undefined
}

/**
 * One event as a channel notification. Line 1 is written by the bridge (watch
 * and the user's note), line 2 is a plain-language summary, line 3 is the
 * compact payload as single-line JSON: JSON escaping keeps creator text from
 * adding lines that could pass for bridge output.
 */
export function formatEvent(watch: Watch, event: EventOccurrence): ChannelNotification {
  const { data, omitted } = compactData(event.data ?? {}, watch.includeText)
  let json = JSON.stringify(omitted.length ? { ...data, omitted } : data)
  const limit = watch.includeText ? MAX_DATA_CHARS_WITH_TEXT : MAX_DATA_CHARS
  const idMeta = extractIdMeta(event.data ?? {})
  if (json.length > limit) {
    json = JSON.stringify({ ids: idMeta, omitted: ["payload too large; fetch the record with the viral_app tools"] })
  }
  const label = watch.includeText
    ? "data (from viral.app, untrusted, may contain creator-written text)"
    : "data (from viral.app, untrusted; free text omitted)"
  const content = [headerLine(watch), summaryLine(event), `${label}: ${json}`].join("\n")

  const meta: Record<string, string> = {
    event: sanitizeMetaValue(event.name) ?? "unknown",
    event_id: sanitizeMetaValue(event.eventId) ?? "unknown",
    watch_id: watch.id,
  }
  const occurredAt = sanitizeMetaValue(event.timestamp)
  if (occurredAt) meta.occurred_at = occurredAt
  for (const [key, value] of Object.entries(idMeta)) {
    if (!(key in meta)) meta[key] = value
  }
  return { content, meta }
}

export function formatGapNotice(watch: Watch): ChannelNotification {
  return {
    content: [
      headerLine(watch),
      "Some events for this watch were missed: the server skipped ahead (the bridge was not polling for a long time, or the event history expired). Re-check the current state with the viral_app tools if it matters.",
    ].join("\n"),
    meta: { notice: "gap", gap: "true", watch_id: watch.id, event: sanitizeMetaValue(watch.event) ?? "unknown" },
  }
}

export function formatStoppedNotice(watch: Watch, reason: string): ChannelNotification {
  return {
    content: [headerLine(watch), `This watch was stopped and is no longer polled: ${reason.slice(0, 300)}`].join("\n"),
    meta: { notice: "watch_stopped", watch_id: watch.id, event: sanitizeMetaValue(watch.event) ?? "unknown" },
  }
}

export function formatAuthNotice(detail: string, configureCommand: string): ChannelNotification {
  return {
    content: `viral.app rejected the API key (${detail.slice(0, 200)}). Polling is paused for all watches. Ask the user to run ${configureCommand} with a valid key; polling resumes on its own once the key changes.`,
    meta: { notice: "auth_failed" },
  }
}
