import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react-native'

import { ApiError, NetworkError } from '@/shared/api/errors'

import { NotificationClickRouter } from '../notification-click-router'
import { createNotificationClicks, type NotificationClicks } from '../notification-clicks'
import { startNotificationClicks } from '../notification-clicks-bootstrap'
import { PUSH_UNAVAILABLE_ROUTE } from '../notification-open'

/**
 * GoGo-MobileApp#256 — a tapped push opens what it is about.
 *
 * Physical regression #218 (Mobile `8269c3d`, DEV BE `07c4911`): tapping a real
 * `plan_ready` push on the iPhone 11 Pro Max opened Home, because nothing in
 * `src/` listened for a click. These drive the shipped wiring — the SDK
 * listener, the queue, the refetch and the deep-link router — with only the
 * OneSignal native module, the navigator, the session and the two reads faked.
 */

type Listener = (event: unknown) => void
const mockClickListeners: Listener[] = []
jest.mock('react-native-onesignal', () => ({
  OneSignal: {
    Notifications: {
      addEventListener: (event: string, listener: Listener) => {
        if (event === 'click') mockClickListeners.push(listener)
      },
      removeEventListener: (event: string, listener: Listener) => {
        const index = mockClickListeners.indexOf(listener)
        if (event === 'click' && index >= 0) mockClickListeners.splice(index, 1)
      },
    },
  },
}))

const mockPush = jest.fn()
const mockRouter = { push: mockPush, replace: jest.fn(), back: jest.fn() }
const mockNavigation: { state: unknown } = { state: undefined }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useRootNavigationState: () => mockNavigation.state,
}))

const mockSession = { status: 'user' }
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status }),
}))

const mockGetRoom = jest.fn()
const mockGetPlan = jest.fn()
jest.mock('@/shared/api/endpoints/rooms', () => ({ getRoom: (id: string) => mockGetRoom(id) }))
jest.mock('@/shared/api/endpoints/plans', () => ({ getPlan: (id: string) => mockGetPlan(id) }))

const mockTrack = jest.fn()
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

const ROOM = '0b7c1f0e-3a55-4d1c-9a5e-2f6d8c4b1a01'
const PLAN = '5e2a9d7c-8b41-4f0a-b6e3-9c1d2a7f4e02'
/** The root stack while the splash (`index`) is up, and once it has replaced itself. */
const ON_SPLASH = { key: 'root', index: 0, routes: [{ name: 'index' }] }
const ON_TABS = { key: 'root', index: 0, routes: [{ name: '(tabs)' }] }

let clicks: NotificationClicks
let stopClicks: () => void
let client: QueryClient

beforeEach(() => {
  mockPush.mockReset()
  mockGetRoom.mockReset()
  mockGetPlan.mockReset()
  mockTrack.mockReset()
  mockSession.status = 'user'
  mockNavigation.state = ON_TABS
  clicks = createNotificationClicks()
  stopClicks = startNotificationClicks(clicks)
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
})

afterEach(() => {
  stopClicks()
  client.clear()
})

function app() {
  return (
    <QueryClientProvider client={client}>
      <NotificationClickRouter clicks={clicks} />
    </QueryClientProvider>
  )
}

/** A tap, as the SDK hands it to every registered click listener. */
function tap(additionalData: unknown, notificationId = 'onesignal-1') {
  for (const listener of [...mockClickListeners]) {
    listener({ result: {}, notification: { notificationId, additionalData } })
  }
}

/** What GoGo-BE#594 sends for `plan_ready` once the room has a plan. */
function contractPayload() {
  return {
    type: 'plan_ready',
    version: '1',
    notificationId: 'evt-plan-ready',
    route: `gogo://plan/${PLAN}`,
    entityType: 'plan',
    entityId: PLAN,
    kind: 'plan_ready',
    roomId: ROOM,
    eventType: 'plan.published',
  }
}

describe('tapping a push', () => {
  it('opens data.route through the deep-link router after refetching it', async () => {
    mockGetPlan.mockResolvedValue({ id: PLAN })
    await render(app())

    await act(async () => tap(contractPayload()))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/plans/${PLAN}`))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockGetPlan).toHaveBeenCalledWith(PLAN)
    // Push is only a trigger: the read happens before the screen opens.
    expect(mockGetPlan.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]!)
    expect(mockTrack).toHaveBeenCalledWith('deep_link_opened', { kind: 'plan', source: 'push' })
  })

  it('routes a payload without route from kind + roomId, as DEV sends today', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM })
    await render(app())

    await act(async () => tap({ kind: 'plan_ready', roomId: ROOM, eventType: 'plan.published' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM}`))
    expect(mockGetRoom).toHaveBeenCalledWith(ROOM)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('holds a cold-start tap until navigation, the launch redirect and the session are ready', async () => {
    mockSession.status = 'hydrating'
    mockNavigation.state = undefined
    mockGetRoom.mockResolvedValue({ id: ROOM })

    // The SDK delivers the launch tap before React has mounted anything.
    tap({ kind: 'invite', roomId: ROOM, eventType: 'member.joined' }, 'launch-tap')
    const view = await render(app())
    await act(async () => {})
    expect(mockPush).not.toHaveBeenCalled()

    // Session settled while the splash is still up: it is about to replace
    // itself with the tabs, and would take a pushed screen with it.
    mockSession.status = 'user'
    mockNavigation.state = ON_SPLASH
    await view.rerender(app())
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockGetRoom).not.toHaveBeenCalled()

    mockNavigation.state = ON_TABS
    await view.rerender(app())

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM}`))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('sends an unroutable payload to the notifications screen with a message', async () => {
    await render(app())

    await act(async () => tap({ route: 'gogo://r/INVITECODE42', type: 'mystery', roomId: 'not-a-uuid' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(PUSH_UNAVAILABLE_ROUTE))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockGetRoom).not.toHaveBeenCalled()
    expect(mockTrack).toHaveBeenCalledWith(
      'deep_link_opened',
      expect.objectContaining({ source: 'push', reason: 'invalid' }),
    )
  })

  it('falls back to the notifications screen when the API refuses the room', async () => {
    mockGetRoom.mockRejectedValue(new ApiError(403, { code: 'NOT_A_MEMBER', message: 'forbidden' }))
    await render(app())

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(PUSH_UNAVAILABLE_ROUTE))
    expect(mockPush).not.toHaveBeenCalledWith(`/room/${ROOM}`)
  })

  it('does not read a room for a signed-out device, and says why', async () => {
    mockSession.status = 'anonymous'
    await render(app())

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(PUSH_UNAVAILABLE_ROUTE))
    expect(mockGetRoom).not.toHaveBeenCalled()
  })

  it('still opens the room when the refetch fails offline, where the screen has its own state', async () => {
    mockGetRoom.mockRejectedValue(new NetworkError())
    await render(app())

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/room/${ROOM}`))
  })

  it('navigates once when one notification is clicked repeatedly or heard by two listeners', async () => {
    mockGetPlan.mockResolvedValue({ id: PLAN })
    const secondListener = startNotificationClicks(clicks)
    await render(app())

    await act(async () => {
      tap(contractPayload())
      tap(contractPayload())
      // The provider id differs, the notification does not.
      tap(contractPayload(), 'onesignal-redelivered')
    })

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockGetPlan).toHaveBeenCalledTimes(1)
    secondListener()
  })
})
