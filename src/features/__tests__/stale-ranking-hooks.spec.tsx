import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

const mockFinalize = jest.fn()
const mockGenerate = jest.fn()
jest.mock('@/shared/api/endpoints/suggestions', () => ({
  ...jest.requireActual('@/shared/api/endpoints/suggestions'),
  finalizeVotes: (...args: unknown[]) => mockFinalize(...args),
  generateSuggestions: (...args: unknown[]) => mockGenerate(...args),
}))
import { ApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import { useFinalizeVotes, useGenerateSuggestions } from '@/shared/api/queries/use-suggestions'

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  jest.clearAllMocks()
})
afterEach(() => client.clear())

const stale = new ApiError(409, { code: 'STALE_SUGGESTIONS', message: 'stale' })

it('refetches the ranking and the room when finalize reports them stale', async () => {
  mockFinalize.mockRejectedValue(stale)
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const { result } = await renderHook(() => useFinalizeVotes('room-1'), { wrapper })
  await act(async () => { await result.current.mutateAsync({}).catch(() => {}) })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.roomSuggestions('room-1') })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1') })
})

it('treats NOT_A_CANDIDATE as the same stale ranking', async () => {
  mockFinalize.mockRejectedValue(new ApiError(400, { code: 'NOT_A_CANDIDATE', message: 'gone' }))
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const { result } = await renderHook(() => useFinalizeVotes('room-1'), { wrapper })
  await act(async () => { await result.current.mutateAsync({ placeId: 'place-9' }).catch(() => {}) })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.roomSuggestions('room-1') })
})

it('leaves the cache alone for an unrelated finalize failure', async () => {
  mockFinalize.mockRejectedValue(new ApiError(409, { code: 'NO_VOTES', message: 'none' }))
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const { result } = await renderHook(() => useFinalizeVotes('room-1'), { wrapper })
  await act(async () => { await result.current.mutateAsync({}).catch(() => {}) })
  expect(invalidate).not.toHaveBeenCalled()
})

it('refetches the ranking when a refresh loses a race with a preference change', async () => {
  mockGenerate.mockRejectedValue(stale)
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const { result } = await renderHook(() => useGenerateSuggestions('room-1'), { wrapper })
  await act(async () => { await result.current.mutateAsync().catch(() => {}) })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.roomSuggestions('room-1') })
})
