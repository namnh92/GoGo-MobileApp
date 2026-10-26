import { env } from '@/shared/config/env'

import { currentAccessGrant } from '../client'
import type { AssistantMessage, AssistantStreamEvent } from '../types'
import { xhrSseConnector, type SseConnector, type SseEvent } from './sse-connection'

/**
 * The GoGo AI reply stream (`GET …/messages/{messageId}/stream`,
 * GoGo-MobileApp#378). Same transport as the room events (#286): the repo's
 * own `XMLHttpRequest` SSE reader, bearer auth from the shared single-flight
 * refresh, resume with `Last-Event-ID`. No new native module, no
 * `EventSource` polyfill.
 *
 * Three layers, each testable without a socket:
 * - `decodeAssistantFrame` turns one SSE frame into a contract event;
 * - `applyAssistantEvent` folds an event into the message the screen shows;
 * - `followAssistantReply` keeps one reply attached: it resumes a dropped
 *   connection from the last frame it saw and drops replays it already has.
 */

const TYPES = new Set(['step', 'delta', 'sources', 'card', 'proposal', 'follow_ups', 'notice', 'done', 'error'])

/**
 * One frame → one event, or `null` for anything this client cannot use: a
 * keep-alive, malformed JSON, an event name the contract does not list, or a
 * payload whose `type` disagrees with its SSE `event:` name. Unknown frames are
 * skipped rather than thrown, so a server that adds a frame type does not end
 * the reply.
 */
export function decodeAssistantFrame(frame: SseEvent): AssistantStreamEvent | null {
  if (!TYPES.has(frame.type)) return null
  let payload: unknown
  try {
    payload = JSON.parse(frame.data)
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const event = payload as { type?: unknown; seq?: unknown }
  if (event.type !== frame.type || typeof event.seq !== 'number') return null
  return payload as AssistantStreamEvent
}

/** Whether this event is the last frame of the reply. */
export function isTerminalEvent(event: AssistantStreamEvent): boolean {
  return event.type === 'done' || event.type === 'error'
}

/**
 * Folds one event into the assistant message. `step` changes nothing stored —
 * it is the live "what am I doing" line, which the caller keeps on its own.
 * `sources` replaces (the server sends the complete list so far); cards append
 * in order; a proposal with an id already present replaces it. `done` with
 * `truncated` keeps the text and sources and drops cards, proposals and
 * follow-ups (contract: unfinished structured outputs are discarded).
 */
export function applyAssistantEvent(
  message: AssistantMessage,
  event: AssistantStreamEvent,
  now: () => string = () => new Date().toISOString(),
): AssistantMessage {
  switch (event.type) {
    case 'delta':
      return { ...message, text: message.text + event.text }
    case 'sources':
      return { ...message, sources: event.sources }
    case 'card':
      return { ...message, cards: [...(message.cards ?? []), event.card] }
    case 'proposal': {
      const others = (message.proposals ?? []).filter(proposal => proposal.id !== event.proposal.id)
      return { ...message, proposals: [...others, event.proposal] }
    }
    case 'follow_ups':
      return { ...message, followUps: event.groups }
    case 'notice':
      return { ...message, notice: event.notice }
    case 'done':
      if (event.status === 'truncated') {
        // The server's hard ceiling (2.0.0-alpha.3): the partial text stands,
        // structured outputs that had not finished are discarded — never
        // half-shown. The persisted row (refetched after the reply) keeps
        // whatever the server completed.
        return { ...message, status: 'truncated', cards: [], proposals: [], followUps: [], completedAt: now() }
      }
      return { ...message, status: event.status, completedAt: now() }
    case 'error':
      // The partial text already streamed is kept (contract): only the status changes.
      return { ...message, status: 'failed', error: event.error, completedAt: now() }
    default:
      return message
  }
}

// ---------------------------------------------------------------------------
// One connection
// ---------------------------------------------------------------------------

export interface AssistantStreamTarget {
  conversationId: string
  messageId: string
}

export interface OpenAssistantStreamOptions extends AssistantStreamTarget {
  /** Opaque SSE id of the last frame received; `null` replays from the start. */
  lastEventId: string | null
  /** Renew the bearer before connecting — the server just answered 401. */
  forceRefresh?: boolean
  onOpen: () => void
  onEvent: (event: AssistantStreamEvent, id: string | null) => void
  /** The connection ended; `status` is null when it never answered. */
  onClose: (reason: { status: number | null; retryAfterMs?: number }) => void
}

export type OpenAssistantStream = (options: OpenAssistantStreamOptions) => { close: () => void }

export function assistantStreamUrl({ conversationId, messageId }: AssistantStreamTarget): string {
  const base = env.apiUrl.replace(/\/+$/, '')
  return `${base}/assistant/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/stream`
}

/**
 * The real opener: bearer from `currentAccessGrant` (never a second
 * rotator), `Last-Event-ID` when resuming, frames decoded on the way out.
 */
export function createHttpAssistantStreamOpener(
  connector: SseConnector = xhrSseConnector,
  grant: typeof currentAccessGrant = currentAccessGrant,
): OpenAssistantStream {
  return options => {
    let closed = false
    let connection: { close: () => void } | null = null
    void grant({ force: options.forceRefresh === true })
      .then(access => {
        if (closed) return
        if (!access) {
          options.onClose({ status: 401 })
          return
        }
        const headers: Record<string, string> = { authorization: `Bearer ${access.token}` }
        if (options.lastEventId) headers['last-event-id'] = options.lastEventId
        connection = connector({
          url: assistantStreamUrl(options),
          headers,
          onOpen: options.onOpen,
          onEvent: frame => {
            const event = decodeAssistantFrame(frame)
            if (event) options.onEvent(event, frame.id)
          },
          onClose: options.onClose,
        })
      })
      .catch(() => {
        if (!closed) options.onClose({ status: null })
      })
    return {
      close() {
        closed = true
        connection?.close()
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Following one reply across dropped connections
// ---------------------------------------------------------------------------

export type AssistantReplyConnection = 'connecting' | 'live' | 'reconnecting' | 'lost'

/** Attempts after a drop before the reply is reported lost and the screen offers Retry. */
export const ASSISTANT_STREAM_MAX_RECONNECTS = 3
export const ASSISTANT_STREAM_RECONNECT_BASE_MS = 1_000

export interface FollowAssistantReplyOptions extends AssistantStreamTarget {
  open: OpenAssistantStream
  onEvent: (event: AssistantStreamEvent) => void
  onConnection?: (state: AssistantReplyConnection) => void
  /** `403` / `404` before the stream opened: the reply is not this caller's to read. */
  onRefused?: (status: number) => void
  /** Injected so tests drive the backoff without real time. */
  schedule?: (run: () => void, ms: number) => () => void
}

export interface AssistantReplyFollower {
  /** Stop following (screen closed, logout). Nothing is called afterwards. */
  close: () => void
  /** After `lost`: try again from the last frame received. */
  retry: () => void
}

const defaultSchedule = (run: () => void, ms: number) => {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

/**
 * Keeps one reply attached until its `done` or `error` frame.
 *
 * - A drop resumes from the last SSE id with a doubling backoff (or the
 *   server's `Retry-After`), at most `ASSISTANT_STREAM_MAX_RECONNECTS` times
 *   in a row; then `lost`, and `retry()` starts over.
 * - Frames are applied once: a resumed or replayed stream may repeat frames
 *   the client already has, and `seq` (one per frame of this message) drops
 *   them.
 * - A 401 renews the bearer once through the shared refresh and reconnects.
 */
export function followAssistantReply(options: FollowAssistantReplyOptions): AssistantReplyFollower {
  const schedule = options.schedule ?? defaultSchedule
  let lastEventId: string | null = null
  let lastSeq = 0
  let attempts = 0
  let authRenewed = false
  let ended = false
  let stopped = false
  let connection: { close: () => void } | null = null
  let cancelTimer: (() => void) | null = null

  const report = (state: AssistantReplyConnection) => {
    if (!stopped) options.onConnection?.(state)
  }

  const connect = (forceRefresh = false) => {
    if (stopped || ended) return
    connection = options.open({
      conversationId: options.conversationId,
      messageId: options.messageId,
      lastEventId,
      forceRefresh,
      onOpen: () => {
        attempts = 0
        report('live')
      },
      onEvent: (event, id) => {
        if (stopped || ended) return
        if (id) lastEventId = id
        if (event.seq <= lastSeq) return
        lastSeq = event.seq
        options.onEvent(event)
        if (isTerminalEvent(event)) {
          ended = true
          connection?.close()
        }
      },
      onClose: ({ status, retryAfterMs }) => {
        if (stopped || ended) return
        connection = null
        if (status === 401 && !authRenewed) {
          authRenewed = true
          connect(true)
          return
        }
        if (status === 403 || status === 404) {
          ended = true
          options.onRefused?.(status)
          return
        }
        if (attempts >= ASSISTANT_STREAM_MAX_RECONNECTS) {
          report('lost')
          return
        }
        attempts += 1
        report('reconnecting')
        const wait = retryAfterMs ?? ASSISTANT_STREAM_RECONNECT_BASE_MS * 2 ** (attempts - 1)
        cancelTimer = schedule(() => {
          cancelTimer = null
          connect()
        }, wait)
      },
    })
  }

  report('connecting')
  connect()

  return {
    close() {
      stopped = true
      cancelTimer?.()
      connection?.close()
      connection = null
    },
    retry() {
      if (stopped || ended || connection) return
      attempts = 0
      report('reconnecting')
      connect()
    },
  }
}
