import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'

import { loaded, renderScreen, roomFor, type QueryLike } from './harness'

/**
 * #269 — SRS §7.2 has `active --> completed: finish`, and the backend lets the
 * host make that move. The app never did: "Kết thúc date 🎉" completed the last
 * stop and opened the summary, and the room stayed `active` for good. Verified
 * twice on DEV the same day — every stop `completed`, the app showing
 * "Date xong rồi!", `rooms.status` still `active` — so the Plans history tab
 * (#213), which filters `completed,cancelled,expired`, never showed a date
 * anyone had actually been on.
 *
 * Host-only on the server, so the member's copy of the same screen must not
 * send it.
 */

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockReplace = jest.fn()
const mockPlan: { query: QueryLike } = { query: loaded(null) }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/hooks/use-screen-focused', () => ({ useScreenFocused: () => true }))

jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      post: (...args: unknown[]) => mockPost(...args),
      get: (...args: unknown[]) => mockGet(...args),
      patch: (...args: unknown[]) => mockPatch(...args),
    },
  }
})

jest.mock('@/shared/api/realtime/transport', () => {
  const actual = jest.requireActual('@/shared/api/realtime/transport')
  return { ...actual, roomRealtimeTransport: { kind: 'polling', subscribe: () => () => undefined } }
})

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 1' }]]),
    isPending: false,
  }),
  useUploadImage: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))

import ActiveDateScreen from '@/features/active-date/active-date.view'
import { ApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'

const FINISH = 'Kết thúc date 🎉'
const SKIP = 'Bỏ qua'

/** One stop, so completing it is the end of the date. */
const plan = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: [{ id: 'stop-1', placeId: 'place-1', order: 1, durationMinutes: 60, isLocked: false, status: 'planned' }],
}

const audience: { value: 'group-host' | 'group-guest' } = { value: 'group-host' }

const statusCalls = () => mockPatch.mock.calls.filter(([path]) => path === '/rooms/{id}/status')

let client: QueryClient

async function endTheDate() {
  await renderScreen(
    <QueryClientProvider client={client}>
      <ActiveDateScreen />
    </QueryClientProvider>,
  )
  await fireEvent.press(await screen.findByText(FINISH))
  await fireEvent.press(await screen.findByText(SKIP))
}

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(queryKeys.plan('plan-1'), plan)
  jest.clearAllMocks()
  mockPost.mockReset()
  mockGet.mockReset()
  mockPatch.mockReset()
  audience.value = 'group-host'
  mockPlan.query = loaded(plan)
  mockPost.mockResolvedValue({ completed: true })
  mockGet.mockImplementation((path: string) =>
    path === '/rooms/{id}'
      ? Promise.resolve(roomFor(audience.value, { status: 'active' } as never))
      : Promise.resolve(plan),
  )
  mockPatch.mockResolvedValue(roomFor('group-host', { status: 'completed' } as never))
})
afterEach(() => client.clear())

describe('ending the date (#269)', () => {
  it('moves the room to completed when the host finishes', async () => {
    await endTheDate()

    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    expect(statusCalls()[0][1]).toEqual({ status: 'completed' })
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
  })

  it('leaves the room alone when a member closes the same sheet', async () => {
    audience.value = 'group-guest'
    await endTheDate()

    expect(statusCalls()).toHaveLength(0)
    // Their own screen still ends: the summary is theirs to see.
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
  })

  it('takes a room that has already moved for an answer, not an error', async () => {
    mockPatch.mockRejectedValue(
      new ApiError(409, { code: 'INVALID_ROOM_TRANSITION', message: 'Room already moved' }),
    )

    await endTheDate()

    // The transition was attempted, the conflict was resolved by re-reading the
    // room, and the summary opens either way.
    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    expect(mockGet.mock.calls.some(([path]) => path === '/rooms/{id}')).toBe(true)
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
  })

  it('still shows the summary when the room could not be closed', async () => {
    mockPatch.mockRejectedValue(new ApiError(500, { code: 'INTERNAL', message: 'boom' }))

    await endTheDate()

    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
  })

  it('sends one transition however many times the sheet closes', async () => {
    await renderScreen(
      <QueryClientProvider client={client}>
        <ActiveDateScreen />
      </QueryClientProvider>,
    )
    await fireEvent.press(await screen.findByText(FINISH))
    const skip = await screen.findByText(SKIP)
    await fireEvent.press(skip)
    await fireEvent.press(skip)

    await waitFor(() => expect(statusCalls()).toHaveLength(1))
  })
})
