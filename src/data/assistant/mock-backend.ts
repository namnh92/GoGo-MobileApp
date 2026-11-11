import type { AssistantBackend } from '@/shared/api/assistant-backend'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { applyAssistantEvent } from '@/shared/api/realtime/assistant-stream'
import { getSession } from '@/shared/api/session'
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
  AssistantProposalResult,
  AssistantStatus,
  AssistantTurn,
  AssistantStreamEvent,
} from '@/shared/api/types'

import { fold, pickScenario, script, seedHistory, type Locale, type ScenarioName, type ScriptEvent } from './scenarios'

/**
 * An in-memory GoGo AI backend for dev builds while GoGo-BE#713 is not
 * served (GoGo-MobileApp#378). It answers the same port as the real one
 * (`AssistantBackend`) with contract-shaped data — 202 turns, SSE frames with
 * `seq` and opaque ids, `Last-Event-ID` resume, idempotent sends and confirms,
 * 403 / 429 / 503 envelopes with `Retry-After` — so the screens cannot tell
 * the difference. `scenarios.ts` lists what to type for each state.
 *
 * Never part of a stag or prod build's behaviour: `assistant-backend.ts`
 * loads it only when `isAssistantMockOn()` (dev flavour, `__DEV__`).
 */

export interface MockAssistantOptions {
  /** Multiplies every scripted wait; tests pass 0. */
  speed?: number
  now?: () => Date
  /** Who is asking; defaults to the app's session. */
  actor?: () => 'user' | 'guest' | null
  /** Start with seven conversations across Today / Yesterday / Earlier. */
  seed?: boolean
  locale?: Locale
}

interface StoredConversation {
  conversation: AssistantConversation
  /** Oldest first. */
  messages: AssistantMessage[]
}

interface LiveReply {
  conversationId: string
  events: AssistantStreamEvent[]
  /** Frames still to produce. */
  pending: { wait: number; event: ScriptEvent }[]
  dropAfter?: number
  dropped: boolean
  listeners: Set<(event: AssistantStreamEvent) => void>
  stopped: boolean
  finished: boolean
}

/**
 * The contract's defaults (2.0.0-alpha.3): 30 accepted messages a day, 5 in any
 * rolling minute. Mock server configuration only — the app reads both from
 * `getStatus`, never from here. The burst limit is not counted by the mock;
 * `nhieu qua` / `busy` answers its 429.
 */
const DAILY_LIMIT = 30
const VIETNAM_OFFSET_MS = 7 * 3600_000
const PER_MINUTE_LIMIT = 5

export function createMockAssistantBackend(options: MockAssistantOptions = {}): AssistantBackend {
  const speed = options.speed ?? 1
  const now = options.now ?? (() => new Date())
  const actor = options.actor ?? (() => getSession()?.kind ?? null)
  let ids = 0
  const id = (prefix = 0) => {
    ids += 1
    return `00000000-0000-4000-8${prefix}00-${ids.toString(16).padStart(12, '0')}`
  }

  const conversations = new Map<string, StoredConversation>()
  const replies = new Map<string, LiveReply>()
  const sends = new Map<string, { failedOnce: boolean; turn?: AssistantTurn }>()
  const creates = new Map<string, AssistantConversation>()
  const proposals = new Map<string, { proposal: AssistantProposal; conversationId: string }>()
  const confirms = new Map<string, AssistantProposalResult>()
  let remaining = DAILY_LIMIT
  let state: AssistantStatus['state'] = 'enabled'

  const later = <T,>(value: () => T, wait = 180): Promise<T> =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(value())
        } catch (error) {
          reject(error)
        }
      }, wait * speed)
    })

  const refuse = (status: number, code: string, message: string, retryAfter?: string) =>
    new ApiError(status, { code, message, field_errors: [], request_id: 'mock-request', retryable: false }, retryAfter)

  const guard = () => {
    if (actor() !== 'user') throw refuse(403, 'USER_ONLY', 'Registered users only')
  }

  const stored = (conversationId: string) => {
    const found = conversations.get(conversationId)
    if (!found) throw refuse(404, 'NOT_FOUND', 'Not found')
    return found
  }

  // Contract 2.0.0-alpha.3: the day resets at midnight Asia/Ho_Chi_Minh
  // (UTC+7, no daylight saving), whatever the device's own zone is.
  const resetsAt = () => {
    const vietnam = new Date(now().getTime() + VIETNAM_OFFSET_MS)
    vietnam.setUTCHours(24, 0, 0, 0)
    return new Date(vietnam.getTime() - VIETNAM_OFFSET_MS).toISOString()
  }
  // …and the daily 429's `Retry-After` points at that reset, not an arbitrary hour.
  const secondsToReset = () => String(Math.max(1, Math.ceil((Date.parse(resetsAt()) - now().getTime()) / 1000)))

  if (options.seed !== false) {
    for (const row of seedHistory(options.locale ?? 'vi')) {
      const at = new Date(now())
      if (row.hour < 0) {
        // Earlier today — never before today's midnight, so "Today" stays today.
        const midnight = new Date(at)
        midnight.setHours(0, 1 - row.hour, 0, 0)
        at.setTime(Math.max(at.getTime() + row.hour * 3600_000, midnight.getTime()))
      } else {
        at.setDate(at.getDate() - row.daysAgo)
        at.setHours(row.hour, 4, 0, 0)
      }
      const conversationId = id(1)
      const createdAt = at.toISOString()
      const user: AssistantMessage = { id: id(2), conversationId, role: 'user', status: 'complete', text: row.question, createdAt }
      const assistant: AssistantMessage = {
        id: id(2),
        conversationId,
        role: 'assistant',
        status: 'complete',
        text: row.answer,
        createdAt,
        completedAt: createdAt,
      }
      conversations.set(conversationId, {
        conversation: {
          credits: { creditsUsed: 0, creditsReserved: 0, pendingTurns: 0, state: 'settled', asOf: now().toISOString() },
          id: conversationId,
          title: row.title,
          context: null,
          createdAt,
          lastMessageAt: createdAt,
          expiresAt: new Date(at.getTime() + 90 * 86_400_000).toISOString(),
          messageCount: 2,
          preview: row.answer,
        },
        messages: [user, assistant],
      })
    }
  }

  /** Writes the frame into the stored message, as the server folds frames into the row. */
  const emit = (reply: LiveReply, messageId: string, partial: ScriptEvent) => {
    const event = { ...partial, seq: reply.events.length + 1, messageId } as AssistantStreamEvent
    reply.events.push(event)
    const conversation = conversations.get(reply.conversationId)
    if (conversation) {
      conversation.messages = conversation.messages.map(message =>
        message.id === messageId ? applyAssistantEvent(message, event, () => now().toISOString()) : message,
      )
      if (event.type === 'proposal') proposals.set(event.proposal.id, { proposal: event.proposal, conversationId: reply.conversationId })
      if (event.type === 'done' || event.type === 'error') {
        const final = conversation.messages.find(message => message.id === messageId)
        conversation.conversation = {
          ...conversation.conversation,
          preview: (final?.text ?? '').slice(0, 160),
          lastMessageAt: now().toISOString(),
        }
      }
    }
    if (event.type === 'done' || event.type === 'error') reply.finished = true
    for (const listener of reply.listeners) listener(event)
  }

  const run = (reply: LiveReply, messageId: string) => {
    const next = reply.pending.shift()
    if (!next || reply.finished) return
    setTimeout(() => {
      if (reply.finished) return
      if (reply.stopped) {
        emit(reply, messageId, { type: 'done', status: 'stopped' })
        return
      }
      emit(reply, messageId, next.event)
      run(reply, messageId)
    }, next.wait * speed)
  }

  const title = (text: string) => (text.length > 40 ? `${text.slice(0, 39)}…` : text)

  return {
    getConversation: conversationId => later(() => { guard(); return stored(conversationId).conversation }),
    getStatus: () =>
      later(() => {
        guard()
        return {
          state,
          creditBalance: 0, creditReserved: 0, creditAvailable: 0, creditPolicy: 'legacy_allowance_v1',
          paidCreditsRequired: null, paidSendEnabled: false, asOf: now().toISOString(),
          dailyMessageLimit: DAILY_LIMIT,
          messagesPerMinuteLimit: PER_MINUTE_LIMIT,
          remainingToday: remaining,
          resetsAt: resetsAt(),
        }
      }, 120),

    listConversations: ({ q, cursor, limit = 20 }) =>
      later(() => {
        guard()
        const needle = q ? fold(q) : null
        const rows = [...conversations.values()]
          .filter(row => row.conversation.messageCount > 0)
          .sort((a, b) => b.conversation.lastMessageAt.localeCompare(a.conversation.lastMessageAt))
          .flatMap(row => {
            if (!needle) return [row.conversation]
            if (fold(row.conversation.title ?? '').includes(needle)) {
              return [{ ...row.conversation, match: { field: 'title' as const, snippet: row.conversation.title ?? '' } }]
            }
            const hit = [...row.messages].reverse().find(message => fold(message.text).includes(needle))
            return hit ? [{ ...row.conversation, match: { field: 'message' as const, messageId: hit.id, snippet: hit.text.slice(0, 200) } }] : []
          })
        const start = cursor ? Number(cursor) : 0
        const items = rows.slice(start, start + limit)
        return { items, nextCursor: start + limit < rows.length ? String(start + limit) : null }
      }),

    createConversation: (body, key) =>
      later(() => {
        guard()
        if (state === 'disabled') throw refuse(503, 'ASSISTANT_DISABLED', 'Assistant is disabled')
        const replay = creates.get(key)
        if (replay) return replay
        const conversationId = id(1)
        const at = now().toISOString()
        const conversation: AssistantConversation = {
          credits: { creditsUsed: 0, creditsReserved: 0, pendingTurns: 0, state: 'settled', asOf: now().toISOString() },
          id: conversationId,
          title: body?.title ?? null,
          context:
            body?.context && 'placeId' in body.context
              ? { kind: 'place', id: body.context.placeId, label: 'Nhà Lá Café' }
              : null,
          createdAt: at,
          lastMessageAt: at,
          expiresAt: new Date(now().getTime() + 90 * 86_400_000).toISOString(),
          messageCount: 0,
        }
        conversations.set(conversationId, { conversation, messages: [] })
        creates.set(key, conversation)
        return conversation
      }),

    renameConversation: (conversationId, nextTitle) =>
      later(() => {
        guard()
        const row = stored(conversationId)
        const trimmed = nextTitle.trim()
        if (!trimmed) throw refuse(400, 'VALIDATION_FAILED', 'Title is blank')
        row.conversation = { ...row.conversation, title: trimmed.slice(0, 80) }
        return row.conversation
      }),

    deleteConversation: conversationId =>
      later(() => {
        guard()
        conversations.delete(conversationId)
      }),

    listMessages: (conversationId, { cursor, limit = 30 }) =>
      later(() => {
        guard()
        const newestFirst = [...stored(conversationId).messages].reverse()
        const start = cursor ? Number(cursor) : 0
        return {
          conversationCredits: stored(conversationId).conversation.credits,
          items: newestFirst.slice(start, start + limit),
          nextCursor: start + limit < newestFirst.length ? String(start + limit) : null,
        }
      }),

    sendMessage: (conversationId, body, key) =>
      later(() => {
        guard()
        const row = stored(conversationId)
        const known = sends.get(key)
        if (known?.turn) return known.turn
        const scenario: ScenarioName = pickScenario(body.text)
        if (scenario === 'disabled') throw refuse(503, 'ASSISTANT_DISABLED', 'Assistant is disabled')
        if (scenario === 'busy') throw refuse(429, 'RATE_LIMITED', 'Too many requests', '20')
        if (scenario === 'limit' || state === 'limit_reached' || remaining <= 0) {
          state = 'limit_reached'
          remaining = 0
          throw refuse(429, 'ASSISTANT_DAILY_LIMIT', 'Daily limit reached', secondsToReset())
        }
        if (row.messages.some(message => message.status === 'streaming')) {
          throw refuse(409, 'ASSISTANT_TURN_IN_PROGRESS', 'A reply is still streaming')
        }
        if (scenario === 'network' && !known?.failedOnce) {
          sends.set(key, { failedOnce: true })
          throw new NetworkError('NETWORK_UNREACHABLE')
        }
        const at = now().toISOString()
        const userMessage: AssistantMessage = {
          id: id(2),
          conversationId,
          role: 'user',
          status: 'complete',
          text: body.text.trim(),
          createdAt: at,
          ...(body.attachments?.length
            ? { attachments: body.attachments.map(() => ({ id: id(3), contentType: 'image/jpeg' as const })) }
            : {}),
        }
        const assistantMessage: AssistantMessage = {
          id: id(2),
          conversationId,
          role: 'assistant',
          credits: { policyKey: 'legacy_allowance_v1', fundingSource: 'free', state: 'settled', creditsCharged: 0, creditsReserved: 0, updatedAt: at },
          status: 'streaming',
          text: '',
          createdAt: at,
          completedAt: null,
        }
        row.messages.push(userMessage, assistantMessage)
        row.conversation = {
          ...row.conversation,
          title: row.conversation.title ?? title(userMessage.text),
          lastMessageAt: at,
          messageCount: row.conversation.messageCount + 2,
          preview: userMessage.text.slice(0, 160),
        }
        remaining = Math.max(0, remaining - 1)
        const plan = script(scenario, body.locale ?? options.locale ?? 'vi', now(), id(4))
        const reply: LiveReply = {
          conversationId,
          events: [],
          pending: plan.steps.slice(),
          ...(plan.dropAfter ? { dropAfter: plan.dropAfter } : {}),
          dropped: false,
          listeners: new Set(),
          stopped: false,
          finished: false,
        }
        replies.set(assistantMessage.id, reply)
        run(reply, assistantMessage.id)
        const turn = { userMessage, assistantMessage, conversationCredits: row.conversation.credits }
        sends.set(key, { failedOnce: known?.failedOnce ?? false, turn })
        return turn
      }, 260),

    stopMessage: (conversationId, messageId) =>
      later(() => {
        guard()
        const reply = replies.get(messageId)
        if (reply && !reply.finished) {
          reply.stopped = true
          emit(reply, messageId, { type: 'done', status: 'stopped' })
        }
        const message = stored(conversationId).messages.find(candidate => candidate.id === messageId)
        if (!message) throw refuse(404, 'NOT_FOUND', 'Not found')
        return message
      }, 80),

    setFeedback: (conversationId, messageId, body) =>
      later(() => {
        guard()
        const row = stored(conversationId)
        const feedback = { rating: body.rating, ...(body.reason ? { reason: body.reason } : {}), createdAt: now().toISOString() }
        row.messages = row.messages.map(message => (message.id === messageId ? { ...message, feedback } : message))
        return feedback
      }),

    clearFeedback: (conversationId, messageId) =>
      later(() => {
        guard()
        const row = stored(conversationId)
        row.messages = row.messages.map(message => (message.id === messageId ? { ...message, feedback: null } : message))
      }),

    getProposal: proposalId =>
      later(() => {
        guard()
        const found = proposals.get(proposalId)
        if (!found) throw refuse(404, 'NOT_FOUND', 'Not found')
        return found.proposal
      }),

    confirmProposal: (proposalId, values, key) =>
      later(() => {
        guard()
        const replay = confirms.get(key)
        if (replay) return replay
        const found = proposals.get(proposalId)
        if (!found) throw refuse(404, 'NOT_FOUND', 'Not found')
        if (found.proposal.status !== 'pending') throw refuse(409, 'PROPOSAL_NOT_PENDING', 'Proposal is not pending')
        const savedValues = found.proposal.values.map(value => ({
          field: value.field,
          value: values && value.field in values ? values[value.field] : value.value,
        }))
        const result: AssistantProposalResult = {
          proposalId,
          kind: found.proposal.kind,
          resource: { type: 'room', id: id(5) },
          savedValues,
          confirmedAt: now().toISOString(),
        }
        found.proposal = { ...found.proposal, status: 'confirmed', result }
        confirms.set(key, result)
        return result
      }, 400),

    dismissProposal: proposalId =>
      later(() => {
        guard()
        const found = proposals.get(proposalId)
        if (!found) throw refuse(404, 'NOT_FOUND', 'Not found')
        if (found.proposal.status === 'pending') found.proposal = { ...found.proposal, status: 'dismissed' }
        return found.proposal
      }),

    openStream: ({ messageId, lastEventId, onOpen, onEvent, onClose }) => {
      let closed = false
      let detach: (() => void) | null = null
      const timer = setTimeout(() => {
        if (closed) return
        if (actor() !== 'user') {
          onClose({ status: 403 })
          return
        }
        const reply = replies.get(messageId)
        if (!reply) {
          onClose({ status: 404 })
          return
        }
        onOpen()
        const after = lastEventId ? Number(lastEventId.split(':')[1] ?? 0) : 0
        let sent = 0
        const deliver = (event: AssistantStreamEvent) => {
          if (closed) return
          onEvent(event, `${messageId}:${event.seq}`)
          sent += 1
          if (event.type === 'done' || event.type === 'error') {
            closed = true
            reply.listeners.delete(deliver)
            onClose({ status: 200 })
            return
          }
          if (reply.dropAfter && !reply.dropped && sent >= reply.dropAfter) {
            reply.dropped = true
            closed = true
            reply.listeners.delete(deliver)
            onClose({ status: null })
          }
        }
        for (const event of reply.events.filter(candidate => candidate.seq > after)) {
          deliver(event)
          if (closed) return
        }
        reply.listeners.add(deliver)
        detach = () => reply.listeners.delete(deliver)
      }, 60 * speed)
      return {
        close() {
          closed = true
          clearTimeout(timer)
          detach?.()
        },
      }
    },
  }
}
