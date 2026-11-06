import { renderHook } from '@testing-library/react-native'

import { useUnreadInbox } from '@/features/notifications/unread-count'

jest.unmock('@/features/notifications/unread-count')

const mockRefetch = jest.fn(async () => undefined)
beforeEach(() => { mockRefetch.mockClear(); mockSession.status = 'user' })
const mockInbox = { data: undefined as unknown, enabled: undefined as boolean | undefined }
const mockSession = { status: 'user' }
jest.mock('@/shared/api', () => ({
  useNotifications: (options: { enabled: boolean }) => {
    mockInbox.enabled = options.enabled
    return { data: mockInbox.data, refetch: mockRefetch }
  },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))

const page = (unread: number, read: number, nextCursor: string | null) => ({
  pages: [
    {
      nextCursor,
      notifications: [
        ...Array.from({ length: unread }, () => ({ readAt: null })),
        ...Array.from({ length: read }, () => ({ readAt: '2026-11-05T00:00:00Z' })),
      ],
    },
  ],
})

it('counts only unread rows on the first page', async () => {
  mockInbox.data = page(2, 3, null)
  const { result } = await renderHook(() => useUnreadInbox())
  expect(result.current).toMatchObject({ count: 2, more: false })
})

it('says more may exist when another page does', async () => {
  mockInbox.data = page(2, 0, 'next')
  const { result } = await renderHook(() => useUnreadInbox())
  expect(result.current).toMatchObject({ count: 2, more: true })
})

it('never asks for a guest, who gets 403 on the inbox', async () => {
  mockSession.status = 'guest'
  mockInbox.data = page(2, 0, null) // what a previous account left in the cache
  const { result } = await renderHook(() => useUnreadInbox())
  expect(mockInbox.enabled).toBe(false)
  expect(result.current).toMatchObject({ count: 0, more: false })
  mockSession.status = 'user'
})

it('refreshes the same inbox query used by the badge', async () => {
  const { result } = await renderHook(() => useUnreadInbox())
  await result.current.refetch()
  expect(mockRefetch).toHaveBeenCalledTimes(1)
})
it.each(['guest', 'anonymous', 'hydrating'])('never refetches a disabled inbox for %s', async status => {
  mockSession.status = status
  const { result } = await renderHook(() => useUnreadInbox())
  await result.current.refetch()
  expect(mockRefetch).not.toHaveBeenCalled()
})
