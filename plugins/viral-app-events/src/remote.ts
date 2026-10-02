import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { z } from "zod"
import type { JsonObject } from "./state.js"

export interface EventDefinition {
  name: string
  description?: string
  delivery?: string[]
  inputSchema?: JsonObject
  payloadSchema?: JsonObject
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

/** The two MCP Events methods the bridge uses. */
export interface EventsRemote {
  listEvents(): Promise<EventDefinition[]>
  poll(params: PollParams): Promise<PollResult>
  close(): Promise<void>
}

/**
 * - auth: the API key was rejected at the HTTP layer (401/403): stop all polling.
 * - forbidden / not_found / invalid / unsupported / quota: this watch cannot
 *   work as configured (MCP Events error codes -32012, -32011, -32602,
 *   -32014 or -32601, -32013): stop the watch.
 * - transient: anything else (network, timeouts, 5xx, 429): retry with backoff.
 */
export type RemoteErrorKind =
  | "auth"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "unsupported"
  | "quota"
  | "transient"

export class RemoteError extends Error {
  constructor(
    readonly kind: RemoteErrorKind,
    message: string,
    readonly code?: number | string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "RemoteError"
  }
}

const PROTOCOL_ERROR_KINDS: Record<number, RemoteErrorKind> = {
  [-32012]: "forbidden",
  [-32011]: "not_found",
  [-32602]: "invalid",
  [-32014]: "unsupported",
  [-32601]: "unsupported",
  [-32013]: "quota",
}

export function classifyError(err: unknown): RemoteError {
  if (err instanceof RemoteError) return err
  const e = err as { code?: unknown; message?: unknown; data?: { status?: unknown } }
  const message = typeof e?.message === "string" ? e.message : String(err)
  const status = typeof e?.data?.status === "number" ? e.data.status : undefined
  if (
    status === 401 ||
    status === 403 ||
    e?.code === "CLIENT_HTTP_AUTHENTICATION" ||
    e?.code === "CLIENT_HTTP_FORBIDDEN"
  ) {
    return new RemoteError("auth", message, e?.code as string, status)
  }
  if (typeof e?.code === "number") {
    return new RemoteError(PROTOCOL_ERROR_KINDS[e.code] ?? "transient", message, e.code, status)
  }
  return new RemoteError("transient", message, e?.code as string | undefined, status)
}

const EventDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    delivery: z.array(z.string()).optional(),
    inputSchema: z.record(z.string(), z.unknown()).optional(),
    payloadSchema: z.record(z.string(), z.unknown()).optional(),
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
