import { render, screen } from '@testing-library/react-native'

import '@/shared/i18n'
import NotificationsScreen from '@/features/notifications/notifications.view'

/**
 * GoGo-MobileApp#256 — a tapped push that cannot be opened (payload invalid,
 * room gone, no longer a member) lands on the inbox, and the inbox says why
 * rather than looking like the tap did nothing.
 */

const mockParams: { value: Record<string, string> } = { value: {} }
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams.value,
}))

const mockSession = { status: 'user' }
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useNotifications: () => ({
    data: { pages: [{ notifications: [] }] },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useMarkNotificationRead: () => ({ mutate: jest.fn() }),
}))

const MESSAGE = 'Không mở được nội dung của thông báo này. Có thể nội dung đã bị xoá hoặc bạn không còn quyền xem.'

describe('notifications screen opened by an unusable push', () => {
  it.each(['user', 'anonymous'])('shows why it opened, for a %s session', async status => {
    mockSession.status = status
    mockParams.value = { notice: 'push_unavailable' }
    await render(<NotificationsScreen />)
    expect(screen.getByText(MESSAGE)).toBeTruthy()
  })

  it('shows no message when opened normally', async () => {
    mockSession.status = 'user'
    mockParams.value = {}
    await render(<NotificationsScreen />)
    expect(screen.queryByText(MESSAGE)).toBeNull()
  })
})
