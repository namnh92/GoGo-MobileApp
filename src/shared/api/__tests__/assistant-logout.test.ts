import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { purgeCachedUserData } from '../query-client'
import { queryKeys } from '../query-keys'
import { useAssistantDraftStore } from '@/shared/store/assistantDraftStore'

// Hoisted by Vitest above the imports.

vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'ios' } }))
vi.mock('@tanstack/query-async-storage-persister', () => ({
  createAsyncStoragePersister: () => ({ removeClient: vi.fn(async () => {}) }),
}))
vi.mock('@/shared/navigation/room-steps', () => ({ forgetRoomSteps: vi.fn() }))


/**
 * GoGo-MobileApp#378 — logout leaves no GoGo AI data behind: no conversation
 * or message in memory, no unsent question or draft for the next account.
 */
describe('logout purges GoGo AI', () => {
  it('drops the assistant cache and every draft', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.assistantMessages('c1'), { pages: [], pageParams: [] })
    client.setQueryData(queryKeys.assistantStatus(), { state: 'enabled' })
    useAssistantDraftStore.getState().setDraft('c1', 'half a question')
    useAssistantDraftStore.getState().addOutgoing({
      localId: 'l1',
      conversationId: 'c1',
      text: 'Not sent',
      images: [],
      idempotencyKey: 'k1',
      createKey: 'k2',
      status: 'failed',
      createdAt: '2026-10-26T00:00:00Z',
    })

    await purgeCachedUserData(client)

    expect(client.getQueryCache().findAll({ queryKey: queryKeys.assistant() })).toEqual([])
    expect(useAssistantDraftStore.getState()).toMatchObject({ drafts: {}, outgoing: [] })
  })

  it('never persists a conversation to disk', async () => {
    const { shouldPersistQuery } = await import('../persist-policy')
    expect(shouldPersistQuery(queryKeys.assistantMessages('c1'))).toBe(false)
    expect(shouldPersistQuery(queryKeys.assistantConversationList(''))).toBe(false)
  })
})
