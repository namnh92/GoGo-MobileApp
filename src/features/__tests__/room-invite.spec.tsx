import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'

const mockCreate = jest.fn()
const mockRevoke = jest.fn()
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  createRoomInvite: (...args: unknown[]) => mockCreate(...args),
  revokeRoomInvite: (...args: unknown[]) => mockRevoke(...args),
}))
import { ApiError } from '@/shared/api/errors'
import { useCreateRoomInvite, useRevokeRoomInvite } from '@/shared/api/queries/use-rooms'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { loadInviteCode, purgeInviteCodes, saveInviteCode } from '@/shared/storage/invite-codes'

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: 2 }, queries: { retry: false } } })
  jest.clearAllMocks()
  await purgeInviteCodes()
})
afterEach(() => client.clear())
const invite = { inviteId: 'invite-1', code: 'code-1', expiresAt: '2099-01-01T00:00:00Z' }

it('creates only on demand and keeps the code after remount, polling and foreground', async () => {
  mockCreate.mockResolvedValue(invite)
  const first = await renderHook(() => useCreateRoomInvite('room-1'), { wrapper })
  expect(mockCreate).not.toHaveBeenCalled()
  await act(async () => { await first.result.current.mutateAsync({ maxUses: 20 }) })
  await first.unmount()
  const second = await renderHook(() => useCreateRoomInvite('room-1'), { wrapper })
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['rooms', 'room-1'] })
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  expect(second.result.current.data?.code).toBe(invite.code)
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(shouldPersistQuery(['session-invite-code', 'room-1'])).toBe(false)
})

it.each([409, 429])('does not retry HTTP %s during five minutes of polling', async status => {
  const error = new ApiError(status, { code: 'FAULT', message: 'fault', retryable: true })
  mockCreate.mockRejectedValue(error)
  const { result } = await renderHook(() => useCreateRoomInvite('room-1'), { wrapper })
  await act(async () => { await result.current.mutateAsync({}).catch(() => {}) })
  jest.useFakeTimers()
  try {
    for (let second = 0; second < 300; second += 5) {
      await act(async () => {
        jest.advanceTimersByTime(5000)
        await client.invalidateQueries({ queryKey: ['rooms', 'room-1'] })
        focusManager.setFocused(second % 10 === 0)
      })
    }
    expect(mockCreate).toHaveBeenCalledTimes(1)
  } finally { jest.useRealTimers() }
})

it('honors Retry-After on manual retry and reuses the request key', async () => {
  const error = new ApiError(429, { code: 'RATE_LIMITED', message: 'wait' }, '60')
  mockCreate.mockRejectedValueOnce(error).mockResolvedValue(invite)
  const { result } = await renderHook(() => useCreateRoomInvite('room-1'), { wrapper })
  await act(async () => {
    await result.current.mutateAsync({}).catch(() => {})
    await result.current.mutateAsync({}).catch(() => {})
  })
  expect(mockCreate).toHaveBeenCalledTimes(1)
  const now = jest.spyOn(Date, 'now').mockReturnValue(error.retryAt + 1)
  try {
    await act(async () => { await result.current.mutateAsync({}) })
    expect(mockCreate.mock.calls[1][2]).toBe(mockCreate.mock.calls[0][2])
  } finally { now.mockRestore() }
})

it('clears a revoked code and keeps rooms isolated', async () => {
  mockCreate.mockResolvedValue(invite)
  mockRevoke.mockResolvedValue(undefined)
  const { result } = await renderHook(() => ({
    first: useCreateRoomInvite('room-1'), second: useCreateRoomInvite('room-2'),
    revoke: useRevokeRoomInvite('room-1'),
  }), { wrapper })
  await act(async () => { await result.current.first.mutateAsync({}) })
  expect(result.current.second.data).toBeUndefined()
  await act(async () => { await result.current.revoke.mutateAsync(invite.inviteId) })
  await waitFor(() => expect(result.current.first.data).toBeUndefined())
})

// #199: the code must survive a cold start, which an in-memory cache never did.
it('keeps a created code in secure storage and reads it back with a fresh cache', async () => {
  mockCreate.mockResolvedValue(invite)
  const first = await renderHook(() => useCreateRoomInvite('room-1'), { wrapper })
  await act(async () => { await first.result.current.mutateAsync({ maxUses: 20 }) })
  expect((await loadInviteCode('room-1'))?.code).toBe(invite.code)
  await first.unmount()
  client.clear()

  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const cold = await renderHook(() => useCreateRoomInvite('room-1'), { wrapper })
  await waitFor(() => expect(cold.result.current.data?.code).toBe(invite.code))
  expect(mockCreate).toHaveBeenCalledTimes(1)
})

it('deletes a stored code when its invite is revoked, even from another screen', async () => {
  await saveInviteCode({ roomId: 'room-1', inviteId: invite.inviteId, code: invite.code, expiresAt: invite.expiresAt, savedAt: 1 })
  mockRevoke.mockResolvedValue(undefined)
  const { result } = await renderHook(() => useRevokeRoomInvite('room-1'), { wrapper })
  await act(async () => { await result.current.mutateAsync('another-invite') })
  expect(await loadInviteCode('room-1')).not.toBeNull()
  await act(async () => { await result.current.mutateAsync(invite.inviteId) })
  expect(await loadInviteCode('room-1')).toBeNull()
})
