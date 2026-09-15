import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import { act, renderRouter, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'

import SplashScreen from '@/features/onboarding/splash.view'
import { ApiError, NetworkError } from '@/shared/api/errors'

import { NotificationClickRouter } from '../notification-click-router'
import { createNotificationClicks, type NotificationClicks } from '../notification-clicks'
import { startNotificationClicks } from '../notification-clicks-bootstrap'
import { PUSH_UNAVAILABLE_NOTICE } from '../notification-target'

/**
 * GoGo-MobileApp#256 — a tapped push opens what it is about.
 *
 * Physical regression #218 (Mobile `8269c3d`, DEV BE `07c4911`): tapping a real
 * `plan_ready` push on the iPhone 11 Pro Max opened Home, because nothing in
 * `src/` listened for a click.
 *
 * These run the shipped wiring inside expo-router's real navigator
 * (`renderRouter`): the SDK listener, the queue, the readiness gate in the root
 * layout, the refetch, the deep-link router, and the real splash with its
 * 2.2 s `replace('/(tabs)')`. Only the OneSignal native module, the session,
 * the API reads and analytics are faked.
 */

// expo-router's matcher module imports `expect/build/matchers`, which this jest
// cannot load; the assertions below read the router store directly instead.
jest.mock('expo-router/build/testing-library/expect', () => ({}))

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

/** A session that re-renders its readers when it changes, like the real provider. */
const mockSession = { status: 'user', listeners: new Set<() => void>() }
jest.mock('@/shared/providers/session-provider', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react')
  const subscribe = (listener: () => void) => {
    mockSession.listeners.add(listener)
    return () => {
      mockSession.listeners.delete(listener)
    }
  }
  return { useSession: () => ({ status: useSyncExternalStore(subscribe, () => mockSession.status) }) }
})
function setSession(status: string) {
  mockSession.status = status
  mockSession.listeners.forEach(listener => listener())
}

jest.mock('@/shared/storage/onboarding', () => ({
  hasCompletedOnboarding: async () => true,
  markOnboardingComplete: async () => {},
}))

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { __esModule: true, default: View, Circle: View, Path: View }
})

const mockGetRoom = jest.fn()
const mockGetPlan = jest.fn()
const mockGetCurrentPlan = jest.fn()
jest.mock('@/shared/api/endpoints/rooms', () => ({ getRoom: (id: string) => mockGetRoom(id) }))
jest.mock('@/shared/api/endpoints/plans', () => ({
  getPlan: (id: string) => mockGetPlan(id),
  getCurrentPlan: (roomId: string) => mockGetCurrentPlan(roomId),
}))

const mockTrack = jest.fn()
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

const ROOM = '0b7c1f0e-3a55-4d1c-9a5e-2f6d8c4b1a01'
const OTHER_ROOM = '7d4c2b1a-0f9e-4d8c-b7a6-5e4d3c2b1a00'
const PLAN = '5e2a9d7c-8b41-4f0a-b6e3-9c1d2a7f4e02'
const OLD_PLAN = '3f2e1d0c-9b8a-4f7e-a6d5-c4b3a2918070'
const PLACE = '9a3e7c21-6b4d-4e8f-a1c2-3d4e5f6a7b8c'
const CAMPAIGN = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

let clicks: NotificationClicks
let stopClicks: () => void
let client: QueryClient

beforeEach(() => {
  for (const mock of [mockGetRoom, mockGetPlan, mockGetCurrentPlan, mockTrack]) mock.mockReset()
  mockSession.status = 'user'
  clicks = createNotificationClicks()
  stopClicks = startNotificationClicks(clicks)
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
})

afterEach(() => {
  stopClicks()
  client.clear()
  jest.useRealTimers()
})

/** The app's shape: the router mounted beside the root stack, the real splash at `/`. */
function app() {
  return {
    _layout: () => (
      <QueryClientProvider client={client}>
        <NotificationClickRouter clicks={clicks} />
        <Stack />
      </QueryClientProvider>
    ),
    index: SplashScreen,
    '(tabs)/_layout': () => <Stack />,
    '(tabs)/index': () => <Text>home</Text>,
    '(tabs)/saved': () => <Text>saved</Text>,
    'room/[roomId]/index': () => <Text>room</Text>,
    'plans/[planId]/index': () => <Text>plan</Text>,
    'plans/[planId]/active': () => <Text>active date</Text>,
    'places/[placeId]': () => <Text>place</Text>,
    notifications: () => <Text>inbox</Text>,
  }
}

type View = ReturnType<typeof renderRouter>

/** Cold launch at `/`. Returned wrapped: the render result is itself a thenable. */
async function mount(): Promise<{ view: View }> {
  const view = renderRouter(app(), { initialUrl: '/' })
  await view
  return { view }
}

/** Launch and let the splash hand over to the tabs, as a warm app already has. */
async function launch(): Promise<{ view: View }> {
  const mounted = await mount()
  await advance(2_300)
  expect(mounted.view.getSegments()).toEqual(['(tabs)'])
  return mounted
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** A tap, as the SDK hands it to every registered click listener. */
function tap(additionalData: unknown, notificationId = 'onesignal-1') {
  for (const listener of [...mockClickListeners]) {
    listener({ result: {}, notification: { notificationId, additionalData } })
  }
}

/** What GoGo-BE#594 sends once the room has a plan. */
function contract(overrides: Record<string, string> = {}) {
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
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}

describe('tapping a transactional push', () => {
  it('opens data.route only after the plan has been read again', async () => {
    const plan = deferred<unknown>()
    mockGetPlan.mockReturnValue(plan.promise)
    const { view } = await launch()

    await act(async () => tap(contract()))
    expect(mockGetPlan).toHaveBeenCalledWith(PLAN)
    expect(view.getPathname()).toBe('/')

    await act(async () => plan.resolve({ id: PLAN, status: 'current' }))
    await waitFor(() => expect(view.getPathname()).toBe(`/plans/${PLAN}`))
    expect(mockGetRoom).not.toHaveBeenCalled()
    expect(mockTrack).toHaveBeenCalledWith('deep_link_opened', { kind: 'plan', source: 'push' })
  })

  it('routes a payload without route from kind + roomId, as DEV sends today', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM, status: 'collecting' })
    const { view } = await launch()

    await act(async () => tap({ kind: 'invite', roomId: ROOM, eventType: 'member.joined' }))

    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))
    expect(mockGetRoom).toHaveBeenCalledWith(ROOM)
  })

  it('opens the current plan for a plan kind that names only its room', async () => {
    mockGetCurrentPlan.mockResolvedValue({ id: PLAN, status: 'current' })
    const { view } = await launch()

    await act(async () => tap({ kind: 'plan_ready', roomId: ROOM, eventType: 'plan.published' }))

    await waitFor(() => expect(view.getPathname()).toBe(`/plans/${PLAN}`))
    expect(mockGetCurrentPlan).toHaveBeenCalledWith(ROOM)
  })

  it('opens the room when a plan kind finds no plan yet', async () => {
    mockGetCurrentPlan.mockRejectedValue(new ApiError(404, { code: 'PLAN_NOT_FOUND', message: 'none' }))
    mockGetRoom.mockResolvedValue({ id: ROOM, status: 'matching' })
    const { view } = await launch()

    await act(async () => tap({ kind: 'plan_ready', roomId: ROOM }))

    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))
  })

  it('opens the current plan when the plan the push named was superseded', async () => {
    mockGetPlan.mockResolvedValue({ id: OLD_PLAN, status: 'superseded' })
    mockGetCurrentPlan.mockResolvedValue({ id: PLAN, status: 'current' })
    const { view } = await launch()

    await act(async () =>
      tap(contract({ type: 'plan_changed', kind: 'plan_changed', route: `gogo://plan/${OLD_PLAN}`, entityId: OLD_PLAN })),
    )

    await waitFor(() => expect(view.getPathname()).toBe(`/plans/${PLAN}`))
    expect(mockGetCurrentPlan).toHaveBeenCalledWith(ROOM)
  })

  it.each([
    ['active', `/plans/${PLAN}/active`],
    ['ready', `/plans/${PLAN}`],
  ])('a date reminder in a room that is %s opens %s', async (status, pathname) => {
    mockGetPlan.mockResolvedValue({ id: PLAN, status: 'current' })
    mockGetRoom.mockResolvedValue({ id: ROOM, status })
    const { view } = await launch()

    await act(async () => tap(contract({ type: 'date_reminder', kind: 'date_reminder', eventType: 'room.status_active' })))

    await waitFor(() => expect(view.getPathname()).toBe(pathname))
    expect(mockGetRoom).toHaveBeenCalledWith(ROOM)
  })
})

describe('cold start', () => {
  it('holds the launch tap until the splash has replaced itself, then keeps it', async () => {
    mockSession.status = 'hydrating'
    mockGetRoom.mockResolvedValue({ id: ROOM, status: 'collecting' })

    // The SDK delivers the launch tap before React has mounted anything.
    tap({ kind: 'invite', roomId: ROOM, eventType: 'member.joined' }, 'launch-tap')
    const { view } = await mount()
    await advance(1_000)
    expect(mockGetRoom).not.toHaveBeenCalled()

    // The session settles while the splash still holds (2.2 s). Opening now
    // would be undone by the splash's replace; the tap has to wait for it.
    await act(async () => setSession('user'))
    await advance(500)
    expect(view.getSegments()).toEqual([])
    expect(mockGetRoom).not.toHaveBeenCalled()

    await advance(1_000)
    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))

    // Nothing replaces it afterwards.
    await advance(5_000)
    expect(view.getPathname()).toBe(`/room/${ROOM}`)
    expect(mockGetRoom).toHaveBeenCalledTimes(1)

    // Back leads Home, not out of the app: the screen's back button is `router.back()`.
    expect(router.canGoBack()).toBe(true)
    await act(async () => router.back())
    expect(view.getPathname()).toBe('/')
    expect(view.getSegments()).toEqual(['(tabs)'])
  })

  it('puts Home under the target when the launch landed somewhere else', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM, status: 'collecting' })
    tap({ kind: 'invite', roomId: ROOM }, 'launch-tap')
    // The app launched straight onto the inbox (no splash in between).
    const view = renderRouter(app(), { initialUrl: '/notifications' })
    await view

    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))
    await act(async () => router.back())
    expect(view.getPathname()).toBe('/')
    expect(view.getSegments()).toEqual(['(tabs)'])
  })

  it('a warm tap keeps the stack the person built underneath', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM, status: 'collecting' })
    const { view } = await launch()
    await act(async () => router.push('/notifications'))

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))
    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))

    await act(async () => router.back())
    expect(view.getPathname()).toBe('/notifications')
  })
})

describe('when a push cannot be opened', () => {
  it('sends an unusable transactional payload to the inbox with a message', async () => {
    const { view } = await launch()

    await act(async () => tap({ route: 'gogo://r/INVITECODE42', type: 'mystery', roomId: 'not-a-uuid' }))

    await waitFor(() => expect(view.getPathname()).toBe('/notifications'))
    expect(view.getSearchParams()).toEqual({ notice: PUSH_UNAVAILABLE_NOTICE })
    expect(mockGetRoom).not.toHaveBeenCalled()
  })

  it('sends a room the API refuses to the inbox with a message', async () => {
    mockGetRoom.mockRejectedValue(new ApiError(403, { code: 'NOT_A_MEMBER', message: 'forbidden' }))
    const { view } = await launch()

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))

    await waitFor(() => expect(view.getPathname()).toBe('/notifications'))
    expect(view.getSearchParams()).toEqual({ notice: PUSH_UNAVAILABLE_NOTICE })
  })

  it('sends a signed-out device to the inbox sign-in state, with no notice and no read', async () => {
    mockSession.status = 'anonymous'
    const { view } = await launch()

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))

    await waitFor(() => expect(view.getPathname()).toBe('/notifications'))
    expect(view.getSearchParams()).toEqual({})
    expect(mockGetRoom).not.toHaveBeenCalled()
  })

  it('still opens the room when the refetch fails offline; the screen has its own state', async () => {
    mockGetRoom.mockRejectedValue(new NetworkError())
    const { view } = await launch()

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))

    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))
  })

  it('opens the named room once the refetch budget runs out', async () => {
    mockGetRoom.mockReturnValue(new Promise(() => {}))
    const { view } = await launch()

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))
    await advance(3_999)
    expect(view.getPathname()).toBe('/')

    await advance(1)
    await waitFor(() => expect(view.getPathname()).toBe(`/room/${ROOM}`))
  })
})

describe('campaign pushes', () => {
  it.each([
    [{ campaignId: CAMPAIGN, destinationType: 'home' }],
    [{ campaignId: CAMPAIGN, destinationType: 'external_url', destination: 'https://gogo.id.vn/uu-dai' }],
    [{}],
  ])('open Home with no notice and no API read: %j', async data => {
    const { view } = await launch()
    await act(async () => router.push('/notifications'))
    expect(view.getPathname()).toBe('/notifications')

    await act(async () => tap(data, 'onesignal-campaign'))

    await waitFor(() => expect(view.getPathname()).toBe('/'))
    expect(view.getSearchParams()).toEqual({})
    for (const read of [mockGetRoom, mockGetPlan, mockGetCurrentPlan]) expect(read).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalledWith('deep_link_opened', expect.objectContaining({ kind: 'unknown' }))
  })

  it('open the place a campaign names', async () => {
    const { view } = await launch()

    await act(async () =>
      tap({ campaignId: CAMPAIGN, destinationType: 'place', destination: PLACE }, 'onesignal-campaign'),
    )

    await waitFor(() => expect(view.getPathname()).toBe(`/places/${PLACE}`))
  })
})

describe('taps close together', () => {
  it('navigates once when one notification is clicked repeatedly or heard by two listeners', async () => {
    mockGetPlan.mockResolvedValue({ id: PLAN, status: 'current' })
    const secondListener = startNotificationClicks(clicks)
    const { view } = await launch()

    await act(async () => {
      tap(contract())
      tap(contract())
      // The provider id differs, the notification does not.
      tap(contract(), 'onesignal-redelivered')
    })

    await waitFor(() => expect(view.getPathname()).toBe(`/plans/${PLAN}`))
    await advance(0)
    expect(mockGetPlan).toHaveBeenCalledTimes(1)
    expect(mockTrack.mock.calls.filter(([event]) => event === 'deep_link_opened')).toHaveLength(1)
    secondListener()
  })

  it('lets the latest tap win when an older one finishes its refetch later', async () => {
    const reads = new Map<string, ReturnType<typeof deferred<unknown>>>()
    mockGetRoom.mockImplementation((id: string) => {
      const read = deferred<unknown>()
      reads.set(id, read)
      return read.promise
    })
    const { view } = await launch()

    await act(async () => {
      tap({ kind: 'invite', roomId: ROOM }, 'first')
      tap({ kind: 'invite', roomId: OTHER_ROOM }, 'second')
    })
    // The older read answers first: it must not open.
    await act(async () => reads.get(ROOM)!.resolve({ id: ROOM, status: 'collecting' }))
    await advance(0)
    expect(view.getPathname()).toBe('/')

    await act(async () => reads.get(OTHER_ROOM)!.resolve({ id: OTHER_ROOM, status: 'collecting' }))
    await waitFor(() => expect(view.getPathname()).toBe(`/room/${OTHER_ROOM}`))
    await advance(0)
    expect(view.getPathname()).toBe(`/room/${OTHER_ROOM}`)
  })

  it('leaves someone where they went while the refetch ran', async () => {
    const room = deferred<unknown>()
    mockGetRoom.mockReturnValue(room.promise)
    const { view } = await launch()

    await act(async () => tap({ kind: 'invite', roomId: ROOM }))
    await act(async () => router.push('/notifications'))
    await act(async () => room.resolve({ id: ROOM, status: 'collecting' }))
    await advance(0)

    expect(view.getPathname()).toBe('/notifications')
  })
})
