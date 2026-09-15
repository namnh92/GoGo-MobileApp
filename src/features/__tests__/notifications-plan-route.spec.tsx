import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderScreen } from './harness'
import { ApiError } from '@/shared/api/errors'

/**
 * GoGo-MobileApp#198 — DEV's "Kế hoạch đã sẵn sàng" payload is
 * `{ eventType, roomId, resourceId: roomId }`, with no plan id, so the inbox
 * opened the lobby. A plan notification that names only its room opens that
 * room's current plan, as a tapped push does (#256). With no plan to open it
 * still opens the room, and says why.
 */
const ROOM_ID = '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f'
const PLAN_ID = '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const PAYLOAD_PLAN_ID = 'c172a3df-1a2b-4c3d-8e4f-5a6b7c8d9e0f'

const mockPush = jest.fn()
const mockGetCurrentPlan = jest.fn()
const mockMarkRead = jest.fn()
const mockItems: { value: unknown[] } = { value: [] }

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  getCurrentPlan: (...args: unknown[]) => mockGetCurrentPlan(...args),
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
  useMarkNotificationRead: () => ({ mutate: mockMarkRead }),
}))

import NotificationsScreen from '@/features/notifications/notifications.view'

const planReady = (payload: Record<string, unknown>) => ({
  id: 'n-plan-ready',
  kind: 'plan_ready',
  payload,
  createdAt: '2026-09-15T14:09:27Z',
  readAt: null,
})
/** What DEV sends. */
const DEV_PAYLOAD = { eventType: 'plan_ready', roomId: ROOM_ID, resourceId: ROOM_ID }

async function tap(view: Awaited<ReturnType<typeof renderScreen>>, label: string) {
  await act(async () => {
    fireEvent.press(view.getByText(label))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockItems.value = [planReady(DEV_PAYLOAD)]
})

describe('inbox: a plan notification without a plan id', () => {
  it("opens the room's current plan, not the lobby", async () => {
    mockGetCurrentPlan.mockResolvedValue({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' })
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, 'Kế hoạch đã sẵn sàng')

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/plans/${PLAN_ID}`))
    expect(mockGetCurrentPlan).toHaveBeenCalledWith(ROOM_ID)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockMarkRead).toHaveBeenCalledWith('n-plan-ready')
  })

  it('opens the room, saying why, when the room has no plan', async () => {
    mockGetCurrentPlan.mockRejectedValue(
      new ApiError(404, { code: 'NOT_FOUND', message: 'no plan', field_errors: [], request_id: 'test', retryable: false }),
    )
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, 'Kế hoạch đã sẵn sàng')

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM_ID}?notice=plan_unavailable`))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('opens one plan for a double tap', async () => {
    let answer!: (plan: unknown) => void
    mockGetCurrentPlan.mockReturnValue(new Promise(resolve => { answer = resolve }))
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, 'Kế hoạch đã sẵn sàng')
    await tap(view, 'Kế hoạch đã sẵn sàng')
    await act(async () => answer({ id: PLAN_ID, roomId: ROOM_ID }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/plans/${PLAN_ID}`))
    expect(mockGetCurrentPlan).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })
})

describe('inbox: what already routed keeps routing', () => {
  it('opens the plan a payload names without asking for the current one', async () => {
    mockItems.value = [planReady({ ...DEV_PAYLOAD, planId: PAYLOAD_PLAN_ID })]
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, 'Kế hoạch đã sẵn sàng')

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/plans/${PAYLOAD_PLAN_ID}`))
    expect(mockGetCurrentPlan).not.toHaveBeenCalled()
  })

  it('opens the room for an invite', async () => {
    mockItems.value = [{ id: 'n-invite', kind: 'invite', payload: { roomId: ROOM_ID }, createdAt: '2026-09-15T14:00:00Z', readAt: null }]
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, 'Lời mời vào phòng')

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM_ID}`))
    expect(mockGetCurrentPlan).not.toHaveBeenCalled()
  })
})
