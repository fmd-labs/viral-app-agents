import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { z } from "zod"
import type { JsonObject } from "./state.js"

export interface EventDefinition {
  name: string
  description?: string
  delivery?: string[]
  inputSchema?: JsonObject
  payloadSchema?: JsonObject
  /**
   * viral.app's free-text paths into `data` (dots between keys, `[]` for every
   * array element, e.g. `message.content`, `payout.lineItems[].title`).
   */
  "x-viral-text-fields"?: string[]
}

export interface PollParams {
  name: string
  arguments: JsonObject
  cursor: string | null
  maxEvents?: number
  maxAgeMs?: number
}

export interface EventOccurrence {
  eventId: string
  name: string
  timestamp: string
  data: JsonObject
}

export interface PollResult {
  events: EventOccurrence[]
  cursor: string | null
  truncated: boolean
  hasMore: boolean
  nextPollMs?: number
}

/** A server-side MCP event subscription (poll lease or webhook), from `list_event_subscriptions`. */
export interface RemoteSubscription {
  id: string
  event: string
  arguments: JsonObject
  deliveryMode: string
}

/** The MCP Events methods the bridge uses, plus the subscription tools for cleanup. */
export interface EventsRemote {
  listEvents(): Promise<EventDefinition[]>
  poll(params: PollParams): Promise<PollResult>
  listSubscriptions?(): Promise<RemoteSubscription[]>
  deleteSubscription?(id: string): Promise<boolean>
  close(): Promise<void>
}

/**
 * What an error means for the bridge (viral.app's MCP_EVENTS_ERROR_CODES):
 * - auth: HTTP 401/403, the API key was rejected before any method ran: pause
 *   every watch until the key changes.
 * - access: -32012 for the whole organization or credential (`data.reason`
 *   `api_access_required`, `read_only`, `scope`, `no_organization`,
 *   `unauthenticated`): pause every watch, retry now and then.
 * - forbidden: -32012 `role`, this role cannot receive this event: stop the watch.
 * - not_found (-32011 unknown event), invalid (-32602 arguments),
 *   unsupported (-32014, or -32601 when the server has no events/poll),
 *   callback (-32015, webhook verification; never expected from a poll): stop the watch.
 * - quota: -32013, the organization's subscription cap (`data.max`): retry later.
 * - transient: anything else (network, timeouts, 5xx, 429, -32603): retry with backoff.
 */
export type RemoteErrorKind =
  | "auth"
  | "access"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "unsupported"
  | "callback"
  | "quota"
  | "transient"

export class RemoteError extends Error {
  constructor(
    readonly kind: RemoteErrorKind,
    message: string,
    readonly code?: number | string,
    readonly status?: number,
    readonly data?: JsonObject,
  ) {
    super(message)
    this.name = "RemoteError"
  }

  /** `data.reason` of an MCP Events refusal, when present. */
  get reason(): string | undefined {
    return typeof this.data?.reason === "string" ? this.data.reason : undefined
  }
}

/** viral.app's MCP Events error codes (`MCP_EVENTS_ERROR_CODES`). */
export const MCP_EVENTS_ERROR_CODES = {
  INVALID_PARAMS: -32602,
  METHOD_NOT_FOUND: -32601,
  NOT_FOUND: -32011,
  FORBIDDEN: -32012,
  RESOURCE_EXHAUSTED: -32013,
  UNSUPPORTED: -32014,
  CALLBACK_ENDPOINT_ERROR: -32015,
} as const

const PROTOCOL_ERROR_KINDS: Record<number, RemoteErrorKind> = {
  [MCP_EVENTS_ERROR_CODES.INVALID_PARAMS]: "invalid",
  [MCP_EVENTS_ERROR_CODES.METHOD_NOT_FOUND]: "unsupported",
  [MCP_EVENTS_ERROR_CODES.NOT_FOUND]: "not_found",
  [MCP_EVENTS_ERROR_CODES.FORBIDDEN]: "forbidden",
  [MCP_EVENTS_ERROR_CODES.RESOURCE_EXHAUSTED]: "quota",
  [MCP_EVENTS_ERROR_CODES.UNSUPPORTED]: "unsupported",
  [MCP_EVENTS_ERROR_CODES.CALLBACK_ENDPOINT_ERROR]: "callback",
}

/** -32012 reasons that concern the whole organization or credential rather than one event. */
const ORG_WIDE_FORBIDDEN_REASONS = new Set([
  "api_access_required",
  "read_only",
  "scope",
  "no_organization",
  "unauthenticated",
])

export function classifyError(err: unknown): RemoteError {
  if (err instanceof RemoteError) return err
  const e = err as { code?: unknown; message?: unknown; data?: unknown }
  const message = typeof e?.message === "string" ? e.message : String(err)
  const data = e?.data && typeof e.data === "object" && !Array.isArray(e.data) ? (e.data as JsonObject) : undefined
  const status = typeof data?.status === "number" ? data.status : undefined
  if (
    status === 401 ||
    status === 403 ||
    e?.code === "CLIENT_HTTP_AUTHENTICATION" ||
    e?.code === "CLIENT_HTTP_FORBIDDEN"
  ) {
    return new RemoteError("auth", message, e?.code as string, status, data)
  }
  if (typeof e?.code === "number") {
    let kind = PROTOCOL_ERROR_KINDS[e.code] ?? "transient"
    if (kind === "forbidden" && typeof data?.reason === "string" && ORG_WIDE_FORBIDDEN_REASONS.has(data.reason)) {
      kind = "access"
    }
    return new RemoteError(kind, message, e.code, status, data)
  }
  return new RemoteError("transient", message, e?.code as string | undefined, status, data)
}

const EventDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    delivery: z.array(z.string()).optional(),
    inputSchema: z.record(z.string(), z.unknown()).optional(),
    payloadSchema: z.record(z.string(), z.unknown()).optional(),
    "x-viral-text-fields": z.array(z.string()).optional(),
  })
  .loose()

const ListEventsResultSchema = z
  .object({
    events: z.array(EventDefinitionSchema).default([]),
    nextCursor: z.string().nullish(),
  })
  .loose()

const PollResultSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            eventId: z.string().min(1),
            name: z.string(),
            timestamp: z.string(),
            data: z.record(z.string(), z.unknown()).nullish(),
          })
          .loose(),
      )
      .default([]),
    // Absent means null (MCP Events "Cursor Lifecycle").
    cursor: z.string().nullish(),
    truncated: z.boolean().nullish(),
    hasMore: z.boolean().nullish(),
    nextPollMs: z.number().nullish(),
  })
  .loose()

const CallToolResultSchema = z
  .object({
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).default([]),
    structuredContent: z.unknown().optional(),
    isError: z.boolean().optional(),
  })
  .loose()

const SubscriptionsSchema = z.object({
  subscriptions: z
    .array(
      z
        .object({
          id: z.string(),
          event: z.string(),
          arguments: z.record(z.string(), z.unknown()).nullish(),
          deliveryMode: z.string(),
        })
        .loose(),
    )
    .default([]),
})

export interface McpEventsRemoteOptions {
  url: string
  apiKey: string
  clientName?: string
  clientVersion?: string
  timeoutMs?: number
}

/**
 * Talks to the viral.app MCP endpoint with the v2 client, which negotiates
 * protocol revision 2026-07-28 (`server/discover`, per-request `_meta`
 * envelope) and falls back to the 2025 `initialize` handshake on older
 * servers. Authenticates with the `x-api-key` header.
 */
export class McpEventsRemote implements EventsRemote {
  private client: Client | undefined
  private connecting: Promise<Client> | undefined

  constructor(private readonly options: McpEventsRemoteOptions) {}

  async listEvents(): Promise<EventDefinition[]> {
    const events: EventDefinition[] = []
    let cursor: string | undefined
    for (let page = 0; page < 20; page++) {
      const result = await this.request(
        "events/list",
        cursor ? { cursor } : {},
        ListEventsResultSchema,
      )
      events.push(...(result.events as EventDefinition[]))
      if (!result.nextCursor) break
      cursor = result.nextCursor
    }
    return events
  }

  async poll(params: PollParams): Promise<PollResult> {
    const body: JsonObject = {
      name: params.name,
      arguments: params.arguments,
      cursor: params.cursor,
    }
    if (params.maxEvents !== undefined) body.maxEvents = params.maxEvents
    if (params.maxAgeMs !== undefined) body.maxAgeMs = params.maxAgeMs
    const result = await this.request("events/poll", body, PollResultSchema)
    return {
      events: result.events.map((e) => ({
        eventId: e.eventId,
        name: e.name,
        timestamp: e.timestamp,
        data: (e.data ?? {}) as JsonObject,
      })),
      cursor: result.cursor ?? null,
      truncated: result.truncated === true,
      hasMore: result.hasMore === true,
      nextPollMs: typeof result.nextPollMs === "number" ? result.nextPollMs : undefined,
    }
  }

  /** `list_event_subscriptions`: the credential's own MCP event subscriptions. */
  async listSubscriptions(): Promise<RemoteSubscription[]> {
    const parsed = SubscriptionsSchema.safeParse(await this.callTool("list_event_subscriptions", {}))
    if (!parsed.success) throw new RemoteError("invalid", "unexpected list_event_subscriptions result")
    return parsed.data.subscriptions.map((sub) => ({
      id: sub.id,
      event: sub.event,
      arguments: (sub.arguments ?? {}) as JsonObject,
      deliveryMode: sub.deliveryMode,
    }))
  }

  /** `delete_event_subscription`: ends a subscription (for a poll lease, frees its slot under the cap). */
  async deleteSubscription(id: string): Promise<boolean> {
    const result = (await this.callTool("delete_event_subscription", { id })) as { deleted?: unknown } | null
    return result?.deleted === true
  }

  /** Calls one of the server's tools; tool failures come back as `invalid`. */
  private async callTool(name: string, args: JsonObject): Promise<unknown> {
    const result = await this.request("tools/call", { name, arguments: args }, CallToolResultSchema)
    const text = result.content.find((c) => c.type === "text")?.text
    if (result.isError) throw new RemoteError("invalid", text ?? `${name} failed`)
    if (result.structuredContent !== undefined) return result.structuredContent
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }

  async close(): Promise<void> {
    const client = this.client
    this.client = undefined
    this.connecting = undefined
    await client?.close().catch(() => {})
  }

  private async request<S extends z.ZodTypeAny>(
    method: string,
    params: JsonObject,
    schema: S,
  ): Promise<z.output<S>> {
    try {
      const client = await this.connect()
      return (await client.request({ method, params }, schema, {
        timeout: this.options.timeoutMs ?? 30_000,
      })) as z.output<S>
    } catch (err) {
      const classified = classifyError(err)
      // A dropped connection or expired session gets a fresh client next time.
      if (classified.kind === "transient" || classified.kind === "auth") await this.close()
      throw classified
    }
  }

  private connect(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client)
    if (!this.connecting) {
      this.connecting = (async () => {
        const client = new Client(
          {
            name: this.options.clientName ?? "viral-app-events",
            version: this.options.clientVersion ?? "0.0.0",
          },
          { versionNegotiation: { mode: "auto" } },
        )
        const transport = new StreamableHTTPClientTransport(new URL(this.options.url), {
          requestInit: { headers: { "x-api-key": this.options.apiKey } },
        })
        try {
          await client.connect(transport)
        } catch (err) {
          await client.close().catch(() => {})
          throw err
        }
        this.client = client
        return client
      })().finally(() => {
        this.connecting = undefined
      })
    }
    return this.connecting
  }
}
