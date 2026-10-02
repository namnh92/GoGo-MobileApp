import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

/**
 * #315 F-01 — an automatic retry is the same intent, so it must carry the same
 * Idempotency-Key. These hooks let the endpoint default a fresh key on every
 * call, and TanStack calls `mutationFn` again on each retry: a 503 or timeout
 * after the server had committed sent the retry under a new key, and the server
 * applied it twice (a second regenerate, a duplicate check-in or review).
 *
 * A new tap is a new intent and gets a new key.
 */

const mockPost = jest.fn()
// The shared stub answers one constant UUID; distinct keys are what is tested.
const mockUuid = { next: 0 }
jest.mock('expo-crypto', () => ({ randomUUID: () => `key-${++mockUuid.next}` }))
jest.mock('@/shared/api/client', () => ({
  ...jest.requireActual('@/shared/api/client'),
  api: {
    ...jest.requireActual('@/shared/api/client').api,
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

import { ApiError } from '@/shared/api/errors'
import { useCreateReview } from '@/shared/api/queries/use-me'
import { useCheckinPlanStop, useCompletePlanStop, useRegeneratePlan } from '@/shared/api/queries/use-plans'

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** The four hooks take different variables; the test only needs to send them. */
type Mutation = { mutateAsync: (variables: unknown) => Promise<unknown> }

const UNAVAILABLE = new ApiError(503, { code: 'SERVICE_UNAVAILABLE', message: 'later' })

function keys(): unknown[] {
  return mockPost.mock.calls.map(call => (call[2] as { idempotencyKey?: string } | undefined)?.idempotencyKey)
}

beforeEach(() => {
  mockPost.mockReset()
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } })
})

const cases = [
  ['regenerate', () => useRegeneratePlan('plan-1'), undefined],
  ['complete stop', () => useCompletePlanStop('plan-1'), 'stop-1'],
  ['check-in', () => useCheckinPlanStop('plan-1'), { stopId: 'stop-1', note: 'ok' }],
  ['create review', () => useCreateReview(), { placeId: 'place-1', rating: 5 }],
] as const

describe.each(cases)('%s', (_name, useHook, variables) => {
  it('retries a 503 under the key of the first attempt', async () => {
    mockPost.mockRejectedValueOnce(UNAVAILABLE).mockResolvedValueOnce({})
    const { result } = await renderHook(() => useHook() as unknown as Mutation, { wrapper })
    await act(async () => {
      await result.current.mutateAsync(variables)
    })
    const [first, second] = keys()
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(typeof first).toBe('string')
    expect(second).toBe(first)
  })

  it('gives the next tap a new key', async () => {
    mockPost.mockResolvedValue({})
    const { result } = await renderHook(() => useHook() as unknown as Mutation, { wrapper })
    const mutate = () => result.current.mutateAsync(variables)
    await act(async () => { await mutate() })
    await act(async () => { await mutate() })
    const [first, second] = keys()
    expect(typeof first).toBe('string')
    expect(typeof second).toBe('string')
    expect(second).not.toBe(first)
  })
})
