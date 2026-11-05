import { act } from '@testing-library/react-native'

import { renderScreen } from './harness'
import i18n from '@/shared/i18n'
import { viMessages } from '@/shared/i18n/vi'

/**
 * GoGo-MobileApp#470 — an inbox row says more: a body line written per kind, a
 * kind icon, and the room's name when the room can be read. A failed read, or
 * a kind this build does not know, must never break the list.
 */
const ROOMS = [
  '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f',
  '6e1d2c3b-4a59-4876-8a5b-4c3d2e1f0a9b',
  '1f2e3d4c-5b6a-4798-8a6b-5c4d3e2f1a0b',
  'c172a3df-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
  '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5e',
]

const mockItems: { value: unknown[] } = { value: [] }
const mockRoomRead = jest.fn<{ data?: { title?: string }; isError?: boolean }, [string | undefined]>()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: (id: string | undefined) => mockRoomRead(id),
  useNotifications: () => ({
    data: { pages: [{ notifications: mockItems.value }] },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
  }),
  useMarkNotificationRead: () => ({ mutate: jest.fn() }),
}))

import NotificationsScreen from '@/features/notifications/notifications.view'

const row = (id: string, kind: string | undefined, payload: Record<string, unknown> = {}, readAt: string | null = null) => ({
  id,
  kind,
  payload,
  createdAt: '2026-09-15T14:09:27Z',
  readAt,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockRoomRead.mockReturnValue({ data: undefined })
})

describe('body text per kind', () => {
  const kinds = [
    'campaign',
    'invite',
    'preference_reminder',
    'plan_ready',
    'plan_changed',
    'date_reminder',
    'moderation_update',
  ] as const

  it.each(kinds)('%s shows its own title and body line', async kind => {
    mockItems.value = [row(`n-${kind}`, kind)]
    const view = await renderScreen(<NotificationsScreen />)

    expect(view.getByText(viMessages[`notifications.kind.${kind}`])).toBeTruthy()
    expect(view.getByText(viMessages[`notifications.body.${kind}`])).toBeTruthy()
  })

  it('every kind has a different body', () => {
    const bodies = kinds.map(kind => viMessages[`notifications.body.${kind}`])
    expect(new Set(bodies).size).toBe(kinds.length)
  })

  it('reads in English when the language is English', async () => {
    mockItems.value = [row('n-invite', 'invite')]
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    try {
      const view = await renderScreen(<NotificationsScreen />)
      expect(view.getByText('You were invited to a room. Tap to see the room.')).toBeTruthy()
    } finally {
      await act(async () => {
        await i18n.changeLanguage('vi')
      })
    }
  })
})

describe('an unknown kind', () => {
  it.each([['a_kind_from_the_future'], [undefined]])('renders safely: %s', async kind => {
    mockItems.value = [row('n-x', kind), row('n-ok', 'plan_ready')]
    const view = await renderScreen(<NotificationsScreen />)

    // The list around it is intact, and no body line is invented for it.
    expect(view.getByText(viMessages['notifications.body.plan_ready'])).toBeTruthy()
    if (kind) expect(view.getByText(kind)).toBeTruthy()
    expect(view.getAllByRole('button')).toHaveLength(3) // back + two rows
  })
})

describe('the room line', () => {
  it("shows the room's name when the room can be read", async () => {
    mockItems.value = [row('n-1', 'invite', { roomId: ROOMS[0] })]
    mockRoomRead.mockReturnValue({ data: { title: 'Kèo cà phê' } })
    const view = await renderScreen(<NotificationsScreen />)

    expect(view.getByText('Phòng "Kèo cà phê"')).toBeTruthy()
    expect(mockRoomRead).toHaveBeenCalledWith(ROOMS[0])
  })

  it('is omitted, and the row still renders, when the read failed', async () => {
    mockItems.value = [row('n-1', 'invite', { roomId: ROOMS[0] })]
    mockRoomRead.mockReturnValue({ data: undefined, isError: true })
    const view = await renderScreen(<NotificationsScreen />)

    expect(view.queryByText(/^Phòng "/)).toBeNull()
    expect(view.getByText(viMessages['notifications.body.invite'])).toBeTruthy()
  })

  it('is omitted when the room has no name or the payload has no valid room id', async () => {
    mockItems.value = [row('n-1', 'invite', { roomId: ROOMS[0] }), row('n-2', 'invite', { roomId: 'not-a-uuid' })]
    mockRoomRead.mockReturnValue({ data: {} })
    const view = await renderScreen(<NotificationsScreen />)

    expect(view.queryByText(/^Phòng "/)).toBeNull()
    expect(mockRoomRead).not.toHaveBeenCalledWith('not-a-uuid')
  })

  it('only the first five rows ask for a room', async () => {
    mockItems.value = ROOMS.map((roomId, i) => row(`n-${i}`, 'invite', { roomId }))
    await renderScreen(<NotificationsScreen />)

    const asked = new Set(mockRoomRead.mock.calls.map(([id]) => id))
    expect(asked).toEqual(new Set(ROOMS.slice(0, 5)))
  })
})
