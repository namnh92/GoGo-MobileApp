import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { act, screen } from '@testing-library/react-native'

import { renderScreen, roomFor } from './harness'

/**
 * #285 — the date screen read stop progress from the server and then never
 * asked the server again. On a date that is two people and two phones: one taps
 * "Xong bước này", the other's phone keeps showing the stop they have both
 * walked away from. Measured on real devices before this fix, the second phone
 * stood still for over three minutes, and deep-linking straight into the screen
 * opened no room subscription at all.
 *
 * The screen must subscribe to the room like every other live surface, and it
 * must re-render from what that subscription refreshes.
 */

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockFocused = { value: true }
/** Every subscription the screen opened, with the cache it handed over. */
const subscriptions: {
  roomId: string
  phase: string
  planId?: string
  active: boolean
  queryClient: QueryClient
}[] = []

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/hooks/use-screen-focused', () => ({
  useScreenFocused: () => mockFocused.value,
}))

jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
    },
  }
})

jest.mock('@/shared/api/realtime/transport', () => {
  const actual = jest.requireActual('@/shared/api/realtime/transport')
  return {
    ...actual,
    roomRealtimeTransport: {
      kind: 'polling',
      subscribe({
        roomId,
        phase,
        queryClient,
        planId,
      }: {
        roomId: string
        phase: string
        queryClient: QueryClient
        planId?: string
      }) {
        const record = { roomId, phase, planId, active: true, queryClient }
        subscriptions.push(record)
        return () => {
          record.active = false
        }
      },
    },
  }
})

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([
      ['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 1' }],
      ['place-2', { id: 'place-2', name: 'Quán B', addressText: 'Quận 3' }],
    ]),
    isPending: false,
  }),
  useUploadImage: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))

import ActiveDateScreen from '@/features/active-date/active-date.view'
import { applyRoomEvent } from '@/shared/api/realtime/room-events'

const stop = (id: string, placeId: string, order: number, status: string) => ({
  id,
  placeId,
  order,
  durationMinutes: 60,
  isLocked: false,
  status,
})

/** What `GET /plans/{id}` answers right now — the server's view of progress. */
const server = {
  stops: [stop('stop-1', 'place-1', 1, 'planned'), stop('stop-2', 'place-2', 2, 'planned')],
}

const plan = () => ({
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: server.stops,
})

let client: QueryClient

const live = () => subscriptions.filter(s => s.active)

async function renderActive() {
  return renderScreen(
    <QueryClientProvider client={client}>
      <ActiveDateScreen />
    </QueryClientProvider>,
  )
}

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  subscriptions.length = 0
  mockFocused.value = true
  server.stops = [stop('stop-1', 'place-1', 1, 'planned'), stop('stop-2', 'place-2', 2, 'planned')]
  jest.clearAllMocks()
  mockGet.mockReset()
  mockGet.mockImplementation((path: string) =>
    path === '/rooms/{id}'
      ? Promise.resolve(roomFor('group-host', { status: 'active' } as never))
      : Promise.resolve(plan()),
  )
})
afterEach(() => client.clear())

describe('active date · staying level with the other phone (#285)', () => {
  it('subscribes to the room it is showing', async () => {
    await renderActive()
    await screen.findByText('Quán A')

    expect(live()).toHaveLength(1)
    // The plan id travels with it: without it the transport refreshes the
    // room's current plan and never the plan this screen is routed by (#285).
    expect(live()[0]).toMatchObject({ roomId: 'room-1', phase: 'date', planId: 'plan-1' })
  })

  it('moves to the next stop when the other phone completes this one', async () => {
    await renderActive()
    expect(await screen.findByText('Quán A')).toBeTruthy()

    // The other phone taps "done" and the server moves on.
    server.stops = [stop('stop-1', 'place-1', 1, 'completed'), stop('stop-2', 'place-2', 2, 'planned')]

    // The event goes in the only way it ever reaches a screen: through the
    // subscription that screen opened. A screen that subscribed to nothing has
    // no cache to deliver it to, which is exactly the bug.
    const subscription = live()[0]
    expect(subscription).toBeDefined()
    await act(async () => {
      applyRoomEvent(subscription.queryClient, {
        type: 'plan.updated',
        roomId: 'room-1',
        planId: 'plan-1',
      })
    })

    expect(await screen.findByText('Quán B')).toBeTruthy()
    expect(screen.queryByText('Điểm 1 / 2')).toBeNull()
  })

  it('lets go while the screen is not on top, and takes it up again on return', async () => {
    const view = await renderActive()
    await screen.findByText('Quán A')
    expect(live()).toHaveLength(1)

    const again = async () => {
      await act(async () => {
        view.rerender(
          <QueryClientProvider client={client}>
            <ActiveDateScreen />
          </QueryClientProvider>,
        )
      })
    }

    mockFocused.value = false
    await again()
    expect(live()).toHaveLength(0)

    mockFocused.value = true
    await again()
    expect(live()).toHaveLength(1)
  })
})
