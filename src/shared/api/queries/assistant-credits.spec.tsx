import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAssistantConversation, useSendAssistantMessage } from './use-assistant'
import { setAssistantBackend } from '../assistant-backend'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'
import { queryKeys } from '../query-keys'
import { NetworkError } from '../errors'
import { clearSession } from '../session'
import { useAssistantDraftStore } from '@/shared/store/assistantDraftStore'

let mockActive = true
const mockActivityListeners = new Set<(active: boolean) => void>()
jest.mock('../realtime/app-activity', () => ({ appActivity: {
  isActive: () => mockActive,
  subscribe: (listener: (active: boolean) => void) => { mockActivityListeners.add(listener); return () => mockActivityListeners.delete(listener) },
} }))

const credits = { creditsUsed: 2, creditsReserved: 10, pendingTurns: 1, state: 'pending', asOf: '2026-11-11T00:00:00Z' }
const conversation = { id: 'c', title: null, credits, createdAt: credits.asOf, lastMessageAt: credits.asOf, expiresAt: credits.asOf, messageCount: 2 }
let client: QueryClient
let unmount: (() => Promise<void>) | undefined
beforeEach(() => {
  jest.useFakeTimers()
  mockActive = true
  notifyManager.setScheduler(callback => callback())
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  useAssistantDraftStore.getState().reset()
})
afterEach(async () => {
  if (unmount) await unmount()
  unmount = undefined
  client.clear()
  setAssistantBackend(null)
  mockActivityListeners.clear()
  jest.clearAllTimers()
  jest.useRealTimers()
  notifyManager.setScheduler(callback => setTimeout(callback, 0))
})
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

it('polls pending totals only three times', async () => {
  const read = jest.fn(async () => conversation)
  setAssistantBackend({ ...createMockAssistantBackend(), getConversation: read })
  const hook = await renderHook(() => useAssistantConversation('c'), { wrapper })
  unmount = hook.unmount
  await waitFor(() => expect(hook.result.current.data).toEqual(conversation))
  for (const delay of [2000, 5000, 15000]) await act(async () => { await jest.advanceTimersByTimeAsync(delay) })
  expect(read).toHaveBeenCalledTimes(4)
  await act(async () => { await jest.advanceTimersByTimeAsync(60000) })
  expect(read).toHaveBeenCalledTimes(4)
})
it.each(['background', 'logout'])('cancels pending credit polling on %s', async reason => {
  const read = jest.fn(async () => conversation)
  setAssistantBackend({ ...createMockAssistantBackend(), getConversation: read })
  const hook = await renderHook(() => useAssistantConversation('c'), { wrapper })
  unmount = hook.unmount
  await waitFor(() => expect(hook.result.current.data).toEqual(conversation))
  await act(async () => {
    if (reason === 'logout') await clearSession()
    else { mockActive = false; mockActivityListeners.forEach(listener => listener(false)) }
    await jest.advanceTimersByTimeAsync(30000)
  })
  expect(read).toHaveBeenCalledTimes(1)
})
it('blocks direct send and retry at known insufficient status without checking balance locally', async () => {
  const backend = createMockAssistantBackend()
  const create = jest.fn(backend.createConversation)
  const post = jest.fn(backend.sendMessage)
  setAssistantBackend({ ...backend, createConversation: create, sendMessage: post })
  client.setQueryData(queryKeys.assistantStatus(), { state: 'insufficient_credit', paidCreditsRequired: 12,
    creditBalance: 8, creditReserved: 5, creditAvailable: 3, resetsAt: '2026-11-11T17:00:00Z' })
  const hook = await renderHook(() => useSendAssistantMessage(null, jest.fn()), { wrapper })
  unmount = hook.unmount
  await act(async () => { await hook.result.current.send({ text: 'draft', locale: 'vi' }) })
  const draft = useAssistantDraftStore.getState().outgoing[0]!
  expect(draft).toMatchObject({ text: 'draft', status: 'failed', error: { code: 'ASSISTANT_INSUFFICIENT_CREDIT', details: { requiredCredits: 12, creditAvailable: 3 } } })
  await act(async () => { await hook.result.current.retry(draft.localId) })
  expect(create).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
})

it('stops polling when settled facts arrive, including a refund', async () => {
  const settled = { ...conversation, credits: { ...credits, creditsUsed: 1, creditsReserved: 0, pendingTurns: 0, state: 'settled' } }
  const read = jest.fn().mockResolvedValueOnce(conversation).mockResolvedValue(settled)
  setAssistantBackend({ ...createMockAssistantBackend(), getConversation: read })
  const hook = await renderHook(() => useAssistantConversation('c'), { wrapper })
  unmount = hook.unmount
  await waitFor(() => expect(hook.result.current.data).toEqual(conversation))
  await act(async () => { await jest.advanceTimersByTimeAsync(2000) })
  expect(hook.result.current.data?.credits).toEqual(settled.credits)
  await act(async () => { await jest.advanceTimersByTimeAsync(30000) })
  expect(read).toHaveBeenCalledTimes(2)
})
it('a composer retry of uncertain acceptance reuses the original key and frozen locale', async () => {
  const post = jest.fn(async () => { throw new NetworkError() })
  setAssistantBackend({ ...createMockAssistantBackend(), sendMessage: post })
  const hook = await renderHook(() => useSendAssistantMessage('c', jest.fn()), { wrapper })
  unmount = hook.unmount
  await act(async () => { await hook.result.current.send({ text: 'draft', locale: 'vi' }) })
  await act(async () => { await hook.result.current.send({ text: 'draft', locale: 'en' }) })
  expect(post).toHaveBeenCalledTimes(2)
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
  expect(useAssistantDraftStore.getState().outgoing).toHaveLength(1)
})
