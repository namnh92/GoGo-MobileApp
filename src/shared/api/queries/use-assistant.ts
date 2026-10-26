import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getAssistantBackend } from '../assistant-backend'
import { isApiError, isForbidden, isRetryable } from '../errors'
import { newIdempotencyKey } from '../idempotency'
import { queryKeys } from '../query-keys'
import {
  applyAssistantEvent,
  followAssistantReply,
  isTerminalEvent,
  type AssistantReplyConnection,
  type AssistantReplyFollower,
} from '../realtime/assistant-stream'
import type {
  AssistantContext,
  AssistantConversation,
  AssistantConversationPage,
  AssistantMessage,
  AssistantMessagePage,
  AssistantProposal,
  AssistantTurn,
} from '../types'
import { useIntentKey } from './use-intent-key'
import {
  useAssistantDraftStore,
  type OutgoingImage,
  type OutgoingMessage,
} from '@/shared/store/assistantDraftStore'

/**
 * GoGo AI server state (GoGo-MobileApp#378). TanStack Query owns every
 * conversation and message the server has; the draft store only holds what
 * has not reached it. Nothing here is persisted to disk, and logout drops the
 * whole `['assistant']` tree and every open reply stream.
 */

type MessagesData = InfiniteData<AssistantMessagePage, string | null>
type ConversationsData = InfiniteData<AssistantConversationPage, string | null>

/** Never retry a refusal: a guest stays a guest, a spent limit stays spent. */
function retryAssistant(failureCount: number, error: unknown): boolean {
  if (isForbidden(error)) return false
  if (isApiError(error) && (error.status === 429 || error.status === 503)) return false
  return failureCount < 2 && isRetryable(error)
}

// ---------------------------------------------------------------------------
// Open reply streams — closed together on logout
// ---------------------------------------------------------------------------

const followers = new Set<AssistantReplyFollower>()

/** Logout: no reply keeps streaming another account's conversation into the cache. */
export function closeAssistantStreams(): void {
  for (const follower of followers) follower.close()
  followers.clear()
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function patchMessage(
  client: QueryClient,
  conversationId: string,
  messageId: string,
  change: (message: AssistantMessage) => AssistantMessage,
): void {
  client.setQueryData<MessagesData>(queryKeys.assistantMessages(conversationId), data =>
    data
      ? {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            items: page.items.map(item => (item.id === messageId ? change(item) : item)),
          })),
        }
      : data,
  )
}

function patchProposal(client: QueryClient, conversationId: string, proposal: AssistantProposal): void {
  client.setQueryData<MessagesData>(queryKeys.assistantMessages(conversationId), data =>
    data
      ? {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            items: page.items.map(item =>
              item.proposals?.some(existing => existing.id === proposal.id)
                ? { ...item, proposals: item.proposals.map(existing => (existing.id === proposal.id ? { ...existing, ...proposal } : existing)) }
                : item,
            ),
          })),
        }
      : data,
  )
}

/** The 202's two turns, newest first: the assistant's streaming reply above the question. */
function insertTurn(client: QueryClient, conversationId: string, turn: AssistantTurn): void {
  const fresh = [turn.assistantMessage, turn.userMessage]
  client.setQueryData<MessagesData>(queryKeys.assistantMessages(conversationId), data => {
    if (!data || data.pages.length === 0) return { pages: [{ items: fresh, nextCursor: null }], pageParams: [null] }
    const ids = new Set(fresh.map(message => message.id))
    const [first, ...rest] = data.pages
    return {
      ...data,
      pages: [{ ...first!, items: [...fresh, ...first!.items.filter(item => !ids.has(item.id))] }, ...rest],
    }
  })
}

function patchConversationLists(
  client: QueryClient,
  change: (items: AssistantConversation[]) => AssistantConversation[],
): void {
  client.setQueriesData<ConversationsData>({ queryKey: queryKeys.assistantConversations() }, data =>
    data ? { ...data, pages: data.pages.map(page => ({ ...page, items: change(page.items) })) } : data,
  )
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Availability for the composer — a hint, the server still decides on every send. */
export function useAssistantStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.assistantStatus(),
    queryFn: () => getAssistantBackend().getStatus(),
    enabled,
    staleTime: 60_000,
    retry: retryAssistant,
  })
}

/** History, newest activity first; `q` (2+ characters) searches titles and messages. */
export function useAssistantConversations(q: string, enabled = true) {
  const query = q.trim().length >= 2 ? q.trim() : ''
  return useInfiniteQuery({
    queryKey: queryKeys.assistantConversationList(query),
    queryFn: ({ pageParam }) =>
      getAssistantBackend().listConversations({ ...(query ? { q: query } : {}), ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    enabled,
    retry: retryAssistant,
  })
}

/**
 * A conversation's messages, newest first — the order the inverted thread
 * draws. Never refetched behind a live reply: the stream is folded into this
 * cache frame by frame, and a refetch landing mid-reply would apply the same
 * text twice. A finished reply invalidates it instead.
 */
export function useAssistantMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.assistantMessages(conversationId ?? 'none'),
    queryFn: ({ pageParam }) =>
      getAssistantBackend().listMessages(conversationId!, pageParam ? { cursor: pageParam } : {}),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    enabled: conversationId !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: retryAssistant,
  })
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface SendAssistantInput {
  text: string
  context?: AssistantContext
  images?: OutgoingImage[]
  locale: 'vi' | 'en'
}

let localIds = 0

/**
 * Send and retry. A message is a draft until the server answers 202: it
 * shows in the thread straight away, stays there marked "Not sent" when the
 * send fails, and its retry reuses the same `Idempotency-Key` (and, for a
 * first message, the same conversation key), so a retry after a lost answer
 * never sends the question twice or opens a second conversation.
 */
export function useSendAssistantMessage(conversationId: string | null, onConversation: (id: string) => void) {
  const client = useQueryClient()
  const onConversationRef = useRef(onConversation)
  useEffect(() => {
    onConversationRef.current = onConversation
  }, [onConversation])
  const localeRef = useRef<'vi' | 'en'>('vi')

  const deliver = useCallback(
    async (localId: string) => {
      const store = useAssistantDraftStore.getState()
      const item = store.outgoing.find(candidate => candidate.localId === localId)
      if (!item) return
      store.updateOutgoing(localId, { status: 'sending', error: undefined })
      const backend = getAssistantBackend()
      try {
        let target = item.conversationId
        if (!target) {
          const conversation = await backend.createConversation(item.context ? { context: item.context } : {}, item.createKey)
          target = conversation.id
          useAssistantDraftStore.getState().updateOutgoing(localId, { conversationId: target })
          client.setQueryData<MessagesData>(queryKeys.assistantMessages(target), data =>
            data ?? { pages: [{ items: [], nextCursor: null }], pageParams: [null] },
          )
          onConversationRef.current(target)
        }
        const turn = await backend.sendMessage(
          target,
          {
            text: item.text,
            locale: localeRef.current,
            ...(item.context ? { context: item.context } : {}),
            ...(item.images.length > 0 ? { attachments: item.images.map(image => ({ uploadKey: image.uploadKey })) } : {}),
          },
          item.idempotencyKey,
        )
        insertTurn(client, target, turn)
        useAssistantDraftStore.getState().removeOutgoing(localId)
        void client.invalidateQueries({ queryKey: queryKeys.assistantConversations() })
      } catch (error) {
        useAssistantDraftStore.getState().updateOutgoing(localId, { status: 'failed', error })
        if (isApiError(error) && (error.status === 429 || error.status === 503)) {
          void client.invalidateQueries({ queryKey: queryKeys.assistantStatus() })
        }
      }
    },
    [client],
  )

  const send = useCallback(
    (input: SendAssistantInput) => {
      localeRef.current = input.locale
      localIds += 1
      const message: OutgoingMessage = {
        localId: `local-${Date.now().toString(36)}-${localIds}`,
        conversationId,
        text: input.text.trim(),
        ...(input.context ? { context: input.context } : {}),
        images: input.images ?? [],
        idempotencyKey: newIdempotencyKey(),
        createKey: newIdempotencyKey(),
        status: 'sending',
        createdAt: new Date().toISOString(),
      }
      useAssistantDraftStore.getState().addOutgoing(message)
      return deliver(message.localId)
    },
    [conversationId, deliver],
  )

  const retry = useCallback((localId: string) => deliver(localId), [deliver])

  return { send, retry }
}

/** Drafts not accepted yet, for one conversation (or Welcome's, `null`), newest first. */
export function useOutgoingAssistantMessages(conversationId: string | null): OutgoingMessage[] {
  const outgoing = useAssistantDraftStore(state => state.outgoing)
  return outgoing.filter(item => item.conversationId === conversationId).reverse()
}

// ---------------------------------------------------------------------------
// The live reply
// ---------------------------------------------------------------------------

/**
 * Follows the conversation's streaming reply into the cache: text, cards,
 * sources, proposals and follow-ups as they arrive. `step` is the live
 * "Checking GoGo guides…" line; `connection` says whether the stream is
 * attached, resuming, or lost (then `retry`).
 */
export function useAssistantReply(conversationId: string | null, message: AssistantMessage | null) {
  const client = useQueryClient()
  // Keyed by the message, so a new reply never shows the last one's step.
  const [live, setLive] = useState<{ id: string; step: string | null; connection: AssistantReplyConnection | null } | null>(null)
  const follower = useRef<AssistantReplyFollower | null>(null)
  const streamingId = message?.status === 'streaming' ? message.id : null

  useEffect(() => {
    if (!conversationId || !streamingId) return
    const update = (change: { step?: string | null; connection?: AssistantReplyConnection | null }) =>
      setLive(current => {
        const base = current?.id === streamingId ? current : { id: streamingId, step: null, connection: null }
        return { ...base, ...change }
      })
    const current = followAssistantReply({
      conversationId,
      messageId: streamingId,
      open: getAssistantBackend().openStream,
      onConnection: state => update({ connection: state }),
      onEvent: event => {
        if (event.type === 'step') update({ step: event.step })
        patchMessage(client, conversationId, streamingId, existing => applyAssistantEvent(existing, event))
        if (isTerminalEvent(event)) {
          update({ step: null, connection: null })
          void client.invalidateQueries({ queryKey: queryKeys.assistantConversations() })
          void client.invalidateQueries({ queryKey: queryKeys.assistantStatus() })
        }
      },
      onRefused: () => {
        patchMessage(client, conversationId, streamingId, existing => ({ ...existing, status: 'failed' }))
      },
    })
    follower.current = current
    followers.add(current)
    return () => {
      current.close()
      followers.delete(current)
      if (follower.current === current) follower.current = null
    }
  }, [client, conversationId, streamingId])

  const retry = useCallback(() => follower.current?.retry(), [])
  const mine = streamingId !== null && live?.id === streamingId ? live : null
  return { step: mine?.step ?? null, connection: mine?.connection ?? null, retry }
}

/** The composer's Stop: the server keeps what was written, and so does the thread. */
export function useStopAssistantReply(conversationId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => getAssistantBackend().stopMessage(conversationId!, messageId),
    onSuccess: stopped => {
      if (conversationId) patchMessage(client, conversationId, stopped.id, existing => ({ ...existing, ...stopped }))
    },
  })
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function useRenameAssistantConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => getAssistantBackend().renameConversation(id, title),
    onSuccess: renamed => {
      patchConversationLists(client, items => items.map(item => (item.id === renamed.id ? { ...item, title: renamed.title } : item)))
    },
  })
}

export function useDeleteAssistantConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => getAssistantBackend().deleteConversation(id),
    onSuccess: (_nothing, id) => {
      patchConversationLists(client, items => items.filter(item => item.id !== id))
      client.removeQueries({ queryKey: queryKeys.assistantMessages(id) })
    },
  })
}

// ---------------------------------------------------------------------------
// Proposals and feedback
// ---------------------------------------------------------------------------

/**
 * The `ConfirmationCard` button — the only assistant call that writes GoGo
 * data. One `Idempotency-Key` per proposal for as long as the confirm runs, so
 * an automatic retry cannot create the room twice. The answer is the server's
 * saved values, which the `TaskSummary` shows.
 */
export function useConfirmAssistantProposal(conversationId: string) {
  const client = useQueryClient()
  const intent = useIntentKey()
  return useMutation({
    mutationFn: ({ proposalId, values }: { proposalId: string; values?: Record<string, unknown> }) =>
      getAssistantBackend().confirmProposal(proposalId, values, intent.keyFor(proposalId)),
    onSuccess: (result, { proposalId }) => {
      client.setQueryData<MessagesData>(queryKeys.assistantMessages(conversationId), data =>
        data
          ? {
              ...data,
              pages: data.pages.map(page => ({
                ...page,
                items: page.items.map(item =>
                  item.proposals?.some(proposal => proposal.id === proposalId)
                    ? {
                        ...item,
                        proposals: item.proposals.map(proposal =>
                          proposal.id === proposalId ? { ...proposal, status: 'confirmed', result } : proposal,
                        ),
                      }
                    : item,
                ),
              })),
            }
          : data,
      )
    },
    onError: async (error, { proposalId }) => {
      // Already confirmed, dismissed or expired: show what the server holds.
      if (isApiError(error) && error.status === 409) {
        try {
          patchProposal(client, conversationId, await getAssistantBackend().getProposal(proposalId))
        } catch {
          // The card keeps its error line; nothing else to do.
        }
      }
    },
    onSettled: (_result, _error, { proposalId }) => intent.release(proposalId),
  })
}

/** "Not now": the proposal is declined and nothing is written. */
export function useDismissAssistantProposal(conversationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (proposalId: string) => getAssistantBackend().dismissProposal(proposalId),
    onSuccess: proposal => patchProposal(client, conversationId, proposal),
  })
}

/** Thumbs up / down (contract `setAssistantMessageFeedback`); `null` withdraws it. */
export function useAssistantFeedback(conversationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: string; rating: 'up' | 'down' | null }) => {
      const backend = getAssistantBackend()
      if (rating === null) {
        await backend.clearFeedback(conversationId, messageId)
        return { messageId, feedback: null }
      }
      return { messageId, feedback: await backend.setFeedback(conversationId, messageId, { rating }) }
    },
    onSuccess: ({ messageId, feedback }) =>
      patchMessage(client, conversationId, messageId, existing => ({ ...existing, feedback })),
  })
}
