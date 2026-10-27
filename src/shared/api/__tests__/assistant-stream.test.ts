import { describe, expect, it, vi } from 'vitest'

import {
  ASSISTANT_STREAM_MAX_RECONNECTS,
  applyAssistantEvent,
  assistantStreamUrl,
  createHttpAssistantStreamOpener,
  decodeAssistantFrame,
  followAssistantReply,
  isTerminalEvent,
  type OpenAssistantStreamOptions,
} from '../realtime/assistant-stream'
import { parseSseChunk, type SseConnectOptions } from '../realtime/sse-connection'
import type { AssistantMessage, AssistantStreamEvent } from '../types'

/**
 * GoGo-MobileApp#378 — the GoGo AI reply stream. Frames come through the
 * repo's own SSE reader (#286), are decoded against the contract, folded into
 * the message, and a dropped connection resumes from `Last-Event-ID` without
 * applying a frame twice.
 */

const MESSAGE = '3c1d2e4f-5555-4000-8000-000000000001'

function frame(event: string, data: unknown, id = '1') {
  return `event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`
}

function message(): AssistantMessage {
  return { id: MESSAGE, conversationId: 'c', role: 'assistant', status: 'streaming', text: '', createdAt: '2026-10-26T02:00:00Z' }
}

describe('decoding frames', () => {
  it('reads the contract frames through the shared SSE parser, and skips pings', () => {
    const { events } = parseSseChunk(
      ': ping\n\n' +
        frame('step', { type: 'step', seq: 1, messageId: MESSAGE, step: 'searching_places' }) +
        frame('delta', { type: 'delta', seq: 2, messageId: MESSAGE, text: 'I found 3 cafés. ' }, '2'),
    )
    expect(events.map(decodeAssistantFrame)).toEqual([
      { type: 'step', seq: 1, messageId: MESSAGE, step: 'searching_places' },
      { type: 'delta', seq: 2, messageId: MESSAGE, text: 'I found 3 cafés. ' },
    ])
  })

  it('drops what it cannot trust: an unknown event, bad JSON, a type that disagrees with the event name', () => {
    expect(decodeAssistantFrame({ type: 'usage', id: '1', data: '{"type":"usage","seq":1}' })).toBeNull()
    expect(decodeAssistantFrame({ type: 'delta', id: '1', data: '{nope' })).toBeNull()
    expect(decodeAssistantFrame({ type: 'delta', id: '1', data: '{"type":"done","seq":1,"status":"complete"}' })).toBeNull()
  })
})

describe('folding events into the message', () => {
  const at = () => '2026-10-26T02:00:05Z'

  it('appends text, replaces sources, appends cards, upserts proposals, sets follow-ups and notice', () => {
    const events: AssistantStreamEvent[] = [
      { type: 'delta', seq: 1, messageId: MESSAGE, text: 'Yes. ' },
      { type: 'delta', seq: 2, messageId: MESSAGE, text: 'Open late.[1]' },
      { type: 'sources', seq: 3, messageId: MESSAGE, sources: [{ index: 1, kind: 'guide_document', title: 'A' }] },
      { type: 'sources', seq: 4, messageId: MESSAGE, sources: [{ index: 1, kind: 'place_data', title: 'B' }] },
      { type: 'card', seq: 5, messageId: MESSAGE, card: { kind: 'place', placeId: 'p1', available: true, facts: { name: 'Nhà Lá' } } },
      {
        type: 'proposal',
        seq: 6,
        messageId: MESSAGE,
        proposal: { id: 'x', kind: 'create_room', status: 'pending', values: [], createdAt: at(), expiresAt: at() },
      },
      {
        type: 'proposal',
        seq: 7,
        messageId: MESSAGE,
        proposal: { id: 'x', kind: 'create_room', status: 'expired', values: [], createdAt: at(), expiresAt: at() },
      },
      { type: 'follow_ups', seq: 8, messageId: MESSAGE, groups: [{ field: 'date', label: 'Which day?', options: [] }] },
      { type: 'notice', seq: 9, messageId: MESSAGE, notice: { kind: 'empty' } },
      { type: 'done', seq: 10, messageId: MESSAGE, status: 'complete' },
    ]
    const folded = events.reduce((current, event) => applyAssistantEvent(current, event, at), message())
    expect(folded).toMatchObject({
      text: 'Yes. Open late.[1]',
      sources: [{ title: 'B' }],
      cards: [{ placeId: 'p1' }],
      proposals: [{ id: 'x', status: 'expired' }],
      followUps: [{ field: 'date' }],
      notice: { kind: 'empty' },
      status: 'complete',
      completedAt: at(),
    })
  })

  it('an error frame fails the reply and keeps the partial text', () => {
    const partial = applyAssistantEvent(message(), { type: 'delta', seq: 1, messageId: MESSAGE, text: 'To vote, open ' })
    const failed = applyAssistantEvent(partial, {
      type: 'error',
      seq: 2,
      messageId: MESSAGE,
      error: { code: 'ASSISTANT_DISABLED', message: 'off', field_errors: [], request_id: 'r', retryable: false },
    })
    expect(failed).toMatchObject({ status: 'failed', text: 'To vote, open ', error: { code: 'ASSISTANT_DISABLED' } })
  })

  it('done{truncated} (2.0.0-alpha.3): decoded, the partial text and sources kept, unfinished cards / proposals / follow-ups dropped', () => {
    const [done] = parseSseChunk(frame('done', { type: 'done', seq: 5, messageId: MESSAGE, status: 'truncated' }, '5')).events
    const decoded = decodeAssistantFrame(done!)
    expect(decoded).toEqual({ type: 'done', seq: 5, messageId: MESSAGE, status: 'truncated' })
    const events: AssistantStreamEvent[] = [
      { type: 'delta', seq: 1, messageId: MESSAGE, text: 'Two cafés are open late:' },
      { type: 'sources', seq: 2, messageId: MESSAGE, sources: [{ index: 1, kind: 'place_data', title: 'B' }] },
      { type: 'card', seq: 3, messageId: MESSAGE, card: { kind: 'place', placeId: 'p1', available: true, facts: { name: 'Nhà Lá' } } },
      {
        type: 'proposal',
        seq: 4,
        messageId: MESSAGE,
        proposal: { id: 'x', kind: 'create_room', status: 'pending', values: [], createdAt: at(), expiresAt: at() },
      },
      { type: 'follow_ups', seq: 5, messageId: MESSAGE, groups: [{ field: 'next', label: 'Ask next', options: [] }] },
      decoded!,
    ]
    const folded = events.reduce((current, event) => applyAssistantEvent(current, event, at), message())
    expect(folded).toMatchObject({ status: 'truncated', text: 'Two cafés are open late:', sources: [{ title: 'B' }], completedAt: at() })
    expect(folded.cards).toEqual([])
    expect(folded.proposals).toEqual([])
    expect(folded.followUps).toEqual([])
    expect(isTerminalEvent(decoded!)).toBe(true)
  })

  it('a step changes nothing stored', () => {
    const before = message()
    expect(applyAssistantEvent(before, { type: 'step', seq: 1, messageId: MESSAGE, step: 'writing' })).toEqual(before)
  })
})

describe('the HTTP opener', () => {
  it('connects with the shared bearer, resumes with Last-Event-ID, and decodes frames', async () => {
    let options: SseConnectOptions | undefined
    const connector = vi.fn((given: SseConnectOptions) => {
      options = given
      return { close: vi.fn() }
    })
    const grant = vi.fn(async () => ({ token: 'tok', expiresAt: Date.now() + 60_000 }))
    const onEvent = vi.fn()
    createHttpAssistantStreamOpener(connector, grant)({
      conversationId: 'c1',
      messageId: 'm1',
      lastEventId: 'm1:4',
      onOpen: vi.fn(),
      onEvent,
      onClose: vi.fn(),
    })
    await vi.waitFor(() => expect(connector).toHaveBeenCalled())
    expect(options!.url).toBe(assistantStreamUrl({ conversationId: 'c1', messageId: 'm1' }))
    expect(options!.url).toMatch(/\/assistant\/conversations\/c1\/messages\/m1\/stream$/)
    expect(options!.headers).toEqual({ authorization: 'Bearer tok', 'last-event-id': 'm1:4' })
    options!.onEvent({ type: 'delta', id: 'm1:5', data: JSON.stringify({ type: 'delta', seq: 5, messageId: 'm1', text: 'x' }) })
    options!.onEvent({ type: 'ping', id: null, data: '' })
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({ type: 'delta', seq: 5, messageId: 'm1', text: 'x' }, 'm1:5')
  })

  it('reports 401 when there is no session to stream with', async () => {
    const onClose = vi.fn()
    createHttpAssistantStreamOpener(vi.fn(), async () => null)({
      conversationId: 'c1',
      messageId: 'm1',
      lastEventId: null,
      onOpen: vi.fn(),
      onEvent: vi.fn(),
      onClose,
    })
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ status: 401 }))
  })
})

describe('following one reply', () => {
  /** A fake opener that records each connection so the test can play the server. */
  function harness() {
    const connections: OpenAssistantStreamOptions[] = []
    const timers: { run: () => void; ms: number }[] = []
    const events: AssistantStreamEvent[] = []
    const states: string[] = []
    const refused: number[] = []
    const follower = followAssistantReply({
      conversationId: 'c1',
      messageId: MESSAGE,
      open: options => {
        connections.push(options)
        return { close: vi.fn() }
      },
      onEvent: event => events.push(event),
      onConnection: state => states.push(state),
      onRefused: status => refused.push(status),
      schedule: (run, ms) => {
        timers.push({ run, ms })
        return () => {}
      },
    })
    const delta = (seq: number): AssistantStreamEvent => ({ type: 'delta', seq, messageId: MESSAGE, text: `${seq}` })
    return { connections, timers, events, states, refused, follower, delta }
  }

  it('resumes from the last frame id after a drop, and never applies a replayed frame twice', () => {
    const h = harness()
    h.connections[0]!.onOpen()
    h.connections[0]!.onEvent(h.delta(1), 'id-1')
    h.connections[0]!.onEvent(h.delta(2), 'id-2')
    h.connections[0]!.onClose({ status: null })
    expect(h.states).toEqual(['connecting', 'live', 'reconnecting'])
    expect(h.timers[0]!.ms).toBe(1_000)
    h.timers[0]!.run()
    expect(h.connections[1]!.lastEventId).toBe('id-2')
    h.connections[1]!.onOpen()
    // The server replays one frame the client already had.
    h.connections[1]!.onEvent(h.delta(2), 'id-2')
    h.connections[1]!.onEvent(h.delta(3), 'id-3')
    h.connections[1]!.onEvent({ type: 'done', seq: 4, messageId: MESSAGE, status: 'complete' }, 'id-4')
    expect(h.events.map(event => event.seq)).toEqual([1, 2, 3, 4])
    // After done, a late close changes nothing.
    h.connections[1]!.onClose({ status: 200 })
    expect(h.timers).toHaveLength(1)
  })

  it('gives up after a few drops in a row, then Retry starts again from the last id', () => {
    const h = harness()
    h.connections[0]!.onEvent(h.delta(1), 'id-1')
    for (let attempt = 0; attempt <= ASSISTANT_STREAM_MAX_RECONNECTS; attempt += 1) {
      const scheduled = h.timers.length
      h.connections.at(-1)!.onClose({ status: 502 })
      if (h.timers.length > scheduled) h.timers.at(-1)!.run()
    }
    expect(h.states.at(-1)).toBe('lost')
    expect(h.timers.map(timer => timer.ms)).toEqual([1_000, 2_000, 4_000])
    const before = h.connections.length
    h.follower.retry()
    expect(h.connections).toHaveLength(before + 1)
    expect(h.connections.at(-1)!.lastEventId).toBe('id-1')
  })

  it('waits as long as Retry-After says', () => {
    const h = harness()
    h.connections[0]!.onClose({ status: 429, retryAfterMs: 20_000 })
    expect(h.timers[0]!.ms).toBe(20_000)
  })

  it('renews the bearer once on 401, and stops on 403/404', () => {
    const h = harness()
    h.connections[0]!.onClose({ status: 401 })
    expect(h.connections[1]!.forceRefresh).toBe(true)
    h.connections[1]!.onClose({ status: 403 })
    expect(h.refused).toEqual([403])
    expect(h.connections).toHaveLength(2)
  })

  it('closing stops everything: no reconnect, no event', () => {
    const h = harness()
    h.follower.close()
    h.connections[0]!.onEvent(h.delta(1), 'id-1')
    h.connections[0]!.onClose({ status: null })
    expect(h.events).toEqual([])
    expect(h.timers).toEqual([])
  })
})
