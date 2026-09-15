import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'
import { ApiError } from '@/shared/api/errors'
import { viMessages } from '@/shared/i18n/vi'

/**
 * GoGo-MobileApp#198 — DEV's "Kế hoạch đã sẵn sàng" payload is
 * `{ eventType, roomId, resourceId: roomId }`, with no plan id, so the inbox
 * opened the lobby. An inbox row now opens what a tapped push opens (#264's
 * rule): the room's current plan, the running date for a date reminder, the
 * room with a reason when there is no plan, and a message instead of a wrong
 * screen when nothing could be read.
 */
const ROOM_ID = '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f'
const ROOM_2 = '6e1d2c3b-4a59-4876-8a5b-4c3d2e1f0a9b'
const PLAN_ID = '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const PLAN_2 = '1f2e3d4c-5b6a-4798-8a6b-5c4d3e2f1a0b'
const NAMED_PLAN = 'c172a3df-1a2b-4c3d-8e4f-5a6b7c8d9e0f'

const mockPush = jest.fn()
const mockGetPlan = jest.fn()
const mockGetCurrentPlan = jest.fn()
const mockGetRoom = jest.fn()
const mockMarkRead = jest.fn()
const mockItems: { value: unknown[] } = { value: [] }
const mockFocus: { blur: (() => void) | null } = { blur: null }

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    // Focused on mount; the test blurs it the way leaving the screen would.
    useFocusEffect: (effect: () => (() => void) | void) => {
      useEffect(() => {
        const cleanup = effect()
        mockFocus.blur = typeof cleanup === 'function' ? cleanup : null
        return cleanup
      }, [effect])
    },
  }
})
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  getPlan: (...args: unknown[]) => mockGetPlan(...args),
  getCurrentPlan: (...args: unknown[]) => mockGetCurrentPlan(...args),
  getRoom: (...args: unknown[]) => mockGetRoom(...args),
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

const PLAN_READY = 'Kế hoạch đã sẵn sàng'
const PLAN_CHANGED = 'Kế hoạch có thay đổi'
const DATE_REMINDER = 'Nhắc lịch đi chơi'

const item = (id: string, kind: string, payload: Record<string, unknown>) => ({
  id,
  kind,
  payload,
  createdAt: '2026-09-15T14:09:27Z',
  readAt: null,
})
/** What DEV sends. */
const devPayload = (roomId = ROOM_ID) => ({ eventType: 'plan_ready', roomId, resourceId: roomId })

const refused = (status: number) =>
  new ApiError(status, { code: 'REFUSED', message: 'no', field_errors: [], request_id: 'test', retryable: false })
const offline = () => new Error('Network request failed')
const room = (status: string, id = ROOM_ID) => ({ id, status })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

async function tap(view: Awaited<ReturnType<typeof renderScreen>>, label: string, index = 0) {
  await act(async () => {
    fireEvent.press(view.getAllByText(label)[index])
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFocus.blur = null
  mockItems.value = [item('n-plan-ready', 'plan_ready', devPayload())]
  mockGetRoom.mockResolvedValue(room('ready'))
})

afterEach(() => {
  jest.useRealTimers()
})

describe('a plan notification without a plan id', () => {
  it("opens the room's current plan, not the lobby", async () => {
    mockGetCurrentPlan.mockResolvedValue({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' })
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)

    expect(mockGetCurrentPlan).toHaveBeenCalledWith(ROOM_ID)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith(`/plans/${PLAN_ID}`)
    expect(mockMarkRead).toHaveBeenCalledWith('n-plan-ready')
  })

  it.each([
    ['active', `/plans/${PLAN_ID}/active`],
    ['ready', `/plans/${PLAN_ID}`],
  ])('a date reminder for a room that is %s opens %s', async (status, route) => {
    mockItems.value = [item('n-date', 'date_reminder', { roomId: ROOM_ID })]
    mockGetCurrentPlan.mockResolvedValue({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' })
    mockGetRoom.mockResolvedValue(room(status))
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, DATE_REMINDER)

    expect(mockPush).toHaveBeenCalledWith(route)
  })

  it('opens the room, saying there is no plan, when the room has none', async () => {
    mockGetCurrentPlan.mockRejectedValue(refused(404))
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)

    expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM_ID}?notice=plan_unavailable`)
  })

  it('opens the room with a different reason when the plan could not be read', async () => {
    mockGetCurrentPlan.mockRejectedValue(offline())
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)

    expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM_ID}?notice=plan_retry`)
  })
})

describe('a plan notification that names its plan', () => {
  it('opens that plan', async () => {
    mockItems.value = [item('n-named', 'plan_ready', { ...devPayload(), planId: NAMED_PLAN })]
    mockGetPlan.mockResolvedValue({ id: NAMED_PLAN, roomId: ROOM_ID, status: 'current' })
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)

    expect(mockPush).toHaveBeenCalledWith(`/plans/${NAMED_PLAN}`)
    expect(mockGetCurrentPlan).not.toHaveBeenCalled()
  })

  it("opens the room's current plan when the named one was superseded", async () => {
    mockItems.value = [item('n-named', 'plan_changed', { roomId: ROOM_ID, planId: NAMED_PLAN })]
    mockGetPlan.mockResolvedValue({ id: NAMED_PLAN, roomId: ROOM_ID, status: 'superseded' })
    mockGetCurrentPlan.mockResolvedValue({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' })
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_CHANGED)

    expect(mockPush).toHaveBeenCalledWith(`/plans/${PLAN_ID}`)
  })
})

describe('when it cannot be opened', () => {
  it.each([401, 403, 404, 410])('says it was removed or is no longer yours when the room answers %i', async status => {
    mockGetCurrentPlan.mockRejectedValue(refused(404))
    mockGetRoom.mockRejectedValue(refused(status))
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)

    expect(mockPush).not.toHaveBeenCalled()
    expect(view.getByText(viMessages['notifications.openRefused'])).toBeTruthy()
  })

  it('asks for another tap when nothing could be read', async () => {
    mockGetCurrentPlan.mockRejectedValue(offline())
    mockGetRoom.mockRejectedValue(offline())
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)

    expect(mockPush).not.toHaveBeenCalled()
    expect(view.getByText(viMessages['notifications.openRetry'])).toBeTruthy()
    expect(view.queryByText(viMessages['notifications.openRefused'])).toBeNull()
  })
})

describe('taps while a row resolves', () => {
  it('the latest tap wins, and an earlier answer arriving later opens nothing', async () => {
    mockItems.value = [
      item('n-first', 'plan_ready', devPayload(ROOM_ID)),
      item('n-second', 'plan_changed', { roomId: ROOM_2 }),
    ]
    const first = deferred<unknown>()
    mockGetCurrentPlan.mockImplementation((roomId: string) =>
      roomId === ROOM_ID ? first.promise : Promise.resolve({ id: PLAN_2, roomId: ROOM_2, status: 'current' }))
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)
    await tap(view, PLAN_CHANGED)
    await act(async () => first.resolve({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' }))

    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith(`/plans/${PLAN_2}`)
  })

  it('a second tap on the same row is the same intent: one read, one screen', async () => {
    const answer = deferred<unknown>()
    mockGetCurrentPlan.mockReturnValue(answer.promise)
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)
    await tap(view, PLAN_READY)
    await act(async () => answer.resolve({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' }))

    expect(mockGetCurrentPlan).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('opens nothing once the person has left the inbox', async () => {
    const answer = deferred<unknown>()
    mockGetCurrentPlan.mockReturnValue(answer.promise)
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)
    await act(async () => mockFocus.blur?.())
    await act(async () => answer.resolve({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' }))

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('opens nothing once Back has closed the inbox (the screen unmounts)', async () => {
    const answer = deferred<unknown>()
    mockGetCurrentPlan.mockReturnValue(answer.promise)
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)
    await act(async () => view.unmount())
    await act(async () => answer.resolve({ id: PLAN_ID, roomId: ROOM_ID, status: 'current' }))

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not hold a slow answer past the budget: the room opens, saying the plan is still loading', async () => {
    jest.useFakeTimers()
    mockGetCurrentPlan.mockReturnValue(new Promise(() => undefined))
    const view = await renderScreen(<NotificationsScreen />)

    await tap(view, PLAN_READY)
    await act(async () => {
      jest.advanceTimersByTime(4_000)
    })

    expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM_ID}?notice=plan_retry`)
  })
})

it('an invite opens its room without reading anything', async () => {
  mockItems.value = [item('n-invite', 'invite', { roomId: ROOM_ID })]
  const view = await renderScreen(<NotificationsScreen />)

  await tap(view, 'Lời mời vào phòng')

  expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM_ID}`)
  expect(mockGetCurrentPlan).not.toHaveBeenCalled()
  expect(mockGetRoom).not.toHaveBeenCalled()
})
