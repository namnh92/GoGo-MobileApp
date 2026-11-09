import { render, renderHook, screen } from '@testing-library/react-native'

import '@/shared/i18n'
import { useUnreadInbox } from '@/features/notifications/unread-count'

jest.unmock('@/features/notifications/unread-count')

const mockRefetch = jest.fn(async () => undefined)
beforeEach(() => { mockRefetch.mockClear(); mockSession.status = 'user' })
const mockSummary = { data: undefined as unknown, enabled: undefined as boolean | undefined }
const mockSession = { status: 'user' }
jest.mock('@/shared/api', () => ({
  useNotificationSummary: (options: { enabled: boolean }) => {
    mockSummary.enabled = options.enabled
    return { data: mockSummary.data, refetch: mockRefetch }
  },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))

it('uses the authoritative summary total rather than any loaded page length', async () => {
  mockSummary.data = { unreadCount: 203, readThroughCursor: 'opaque' }
  const { result } = await renderHook(() => useUnreadInbox())
  expect(result.current).toMatchObject({ count: 203, more: false })
})

it('does not invent a count while summary is unavailable', async () => {
  mockSummary.data = undefined
  const { result } = await renderHook(() => useUnreadInbox())
  expect(result.current).toMatchObject({ count: 0, more: false })
})

it('never asks for a guest, who gets 403 on the inbox', async () => {
  mockSession.status = 'guest'
  mockSummary.data = { unreadCount: 2 } // what a previous account left in the cache
  const { result } = await renderHook(() => useUnreadInbox())
  expect(mockSummary.enabled).toBe(false)
  expect(result.current).toMatchObject({ count: 0, more: false })
  mockSession.status = 'user'
})

it('refreshes the same summary query used by the badge', async () => {
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

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'

it.each([0, 203])('summary count %s determines the shared header bell dot', async count => {
  mockSummary.data = { unreadCount: count }
  await render(<HeaderNotificationButton testID="bell" unreadDotTestID="bell-dot" />)
  expect(!!screen.queryByTestId('bell-dot')).toBe(count > 0)
})
