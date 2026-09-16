import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'

import { loaded, renderScreen, roomFor, type QueryLike } from './harness'

/**
 * #251 — the active date showed LIVE for a room that was not active, and a
 * refused stop completion said "Kiểm tra kết nối". The real room query and the
 * real mutation hooks run here against a faked HTTP client, so what is under
 * test is what the server's answers actually produce.
 */

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)
const mockParams: { value: Record<string, string> } = { value: { planId: 'plan-1' } }
const mockPlan: { query: QueryLike } = { query: loaded(null) }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: mockCanGoBack }),
  useLocalSearchParams: () => mockParams.value,
}))

jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      post: (...args: unknown[]) => mockPost(...args),
      get: (...args: unknown[]) => mockGet(...args),
    },
  }
})

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 3' }]]),
    isPending: false,
  }),
  useUploadImage: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))

import { ApiError, NetworkError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import ActiveDateScreen from '@/features/active-date/active-date.view'

const DONE = 'Kết thúc date 🎉'
const SAVE_CHECKIN = 'Lưu check-in ✓'
const BACK_TO_PLAN = 'Về kế hoạch'
const NOT_STARTED = 'Buổi đi chơi chưa bắt đầu'
const CONNECTIVITY = /Kiểm tra kết nối/
const notActive = new ApiError(409, { code: 'ROOM_NOT_ACTIVE', message: 'Stops complete during the active date' })

const plan = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: [{ id: 'stop-1', placeId: 'place-1', order: 1, durationMinutes: 60, isLocked: false, status: 'planned' }],
}

/** What `GET /rooms/{id}` answers right now. */
const server: { status: string; room: () => Promise<unknown> } = {
  status: 'active',
  room: async () => roomFor('group-host', { status: server.status } as never),
}
const roomReads = () => mockGet.mock.calls.filter(([path]) => path === '/rooms/{id}').length

let client: QueryClient

async function renderActive() {
  const view = await renderScreen(
    <QueryClientProvider client={client}>
      <ActiveDateScreen />
    </QueryClientProvider>,
  )
  return view
}

/** Mutation and query state reach the screen asynchronously, so find, then press. */
async function press(label: string) {
  await fireEvent.press(await screen.findByText(label))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

// Deliver TanStack's observer notifications inside the act that caused them.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  // The screen's plan query is faked; the refusal handler reads the room id from this cache.
  client.setQueryData(queryKeys.plan('plan-1'), plan)
  jest.clearAllMocks()
  // mockReset also drops queued once-answers, so none leak between tests.
  mockPost.mockReset()
  mockGet.mockReset()
  mockGet.mockImplementation((path: string) => (path === '/rooms/{id}' ? server.room() : Promise.resolve(plan)))
  server.status = 'active'
  mockCanGoBack.mockReturnValue(true)
  mockParams.value = { planId: 'plan-1' }
  mockPlan.query = loaded(plan)
})
afterEach(() => client.clear())

describe('a room that is not active', () => {
  it('never shows the live screen, and makes the way back to the plan the one action', async () => {
    server.status = 'ready'
    const answer = deferred<unknown>()
    mockGet.mockImplementationOnce(() => answer.promise)
    await renderActive()

    // Waiting for the room: neither live nor not-active yet.
    expect(screen.queryByText(DONE)).toBeNull()
    expect(screen.queryByText(NOT_STARTED)).toBeNull()

    await act(async () => {
      answer.resolve(roomFor('group-host', { status: 'ready' } as never))
      await answer.promise
    })
    expect(await screen.findByText(NOT_STARTED)).toBeTruthy()
    expect(screen.queryByText(DONE)).toBeNull()
    expect(screen.queryByText(CONNECTIVITY)).toBeNull()

    await press(BACK_TO_PLAN)
    expect(mockBack).toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('opens the plan when the active date was the first screen', async () => {
    server.status = 'ready'
    mockCanGoBack.mockReturnValue(false)
    await renderActive()

    await press(BACK_TO_PLAN)
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1')
  })

  it('offers the finished summary for a completed room', async () => {
    server.status = 'completed'
    await renderActive()

    expect(await screen.findByText('Buổi đi chơi đã kết thúc')).toBeTruthy()
    expect(screen.queryByText(DONE)).toBeNull()
    await press('Xem tổng kết →')
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
  })

  it.each([
    ['cancelled', 'Đã huỷ', 'Phòng này đã bị huỷ nên không bắt đầu được nữa.'],
    ['expired', 'Đã hết hạn', 'Phòng này đã hết hạn nên không bắt đầu được nữa.'],
  ])('names a %s room for what it is', async (status, title, body) => {
    server.status = status
    await renderActive()

    expect(await screen.findByText(title)).toBeTruthy()
    expect(screen.getByText(body)).toBeTruthy()
    expect(screen.queryByText(NOT_STARTED)).toBeNull()
    expect(screen.queryByText(DONE)).toBeNull()
  })
})

describe('completing a stop', () => {
  it('turns a ROOM_NOT_ACTIVE refusal into the not-active state, with no second try on offer', async () => {
    mockPost.mockRejectedValue(notActive)
    await renderActive()
    const before = roomReads()

    // The server has since moved on; the refusal is how the screen finds out.
    server.status = 'ready'
    await press(DONE)

    expect(await screen.findByText(NOT_STARTED)).toBeTruthy()
    expect(screen.queryByText(DONE)).toBeNull()
    expect(screen.queryByText(CONNECTIVITY)).toBeNull()
    expect(roomReads()).toBeGreaterThan(before)
    await press(BACK_TO_PLAN)
    expect(mockBack).toHaveBeenCalled()
  })

  it('goes back to the live screen when the room turns out to be active after all', async () => {
    mockPost.mockRejectedValue(notActive)
    await renderActive()

    await press(DONE)
    // The refetch says active: the host started in the meantime, so retrying makes sense.
    expect(await screen.findByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
    expect(screen.queryByText(NOT_STARTED)).toBeNull()
    expect(screen.getByText(DONE)).toBeTruthy()
  })

  it('still reports a real connectivity failure as one', async () => {
    mockPost.mockRejectedValue(new NetworkError())
    await renderActive()

    await press(DONE)
    expect(await screen.findByText('Chưa lưu được. Kiểm tra kết nối rồi thử lại.')).toBeTruthy()
    expect(screen.queryByText(NOT_STARTED)).toBeNull()
  })

  it('does not blame the connection for another server refusal', async () => {
    mockPost.mockRejectedValue(new ApiError(404, { code: 'STOP_NOT_FOUND', message: 'Stop not found' }))
    await renderActive()

    await press(DONE)
    expect(await screen.findByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
    expect(screen.queryByText(CONNECTIVITY)).toBeNull()
  })

  it('clears a failed completion once a check-in lands', async () => {
    mockParams.value = { planId: 'plan-1', checkin: '1' }
    mockPost.mockImplementation(async (path: string) => {
      if (path.includes('checkin')) return { id: 'checkin-1' }
      throw new NetworkError()
    })
    await renderActive()

    await press(DONE)
    expect(await screen.findByText('Chưa lưu được. Kiểm tra kết nối rồi thử lại.')).toBeTruthy()

    await press(SAVE_CHECKIN)
    await waitFor(() => expect(screen.queryByText(CONNECTIVITY)).toBeNull())
  })
})

describe('check-in', () => {
  it('stays on the stop and shows the not-active state when refused', async () => {
    mockParams.value = { planId: 'plan-1', checkin: '1' }
    mockPost.mockRejectedValue(notActive)
    await renderActive()

    server.status = 'ready'
    await press(SAVE_CHECKIN)
    expect(mockPost).toHaveBeenCalledWith(
      '/plans/{id}/stops/{stopId}/checkin',
      expect.anything(),
      expect.objectContaining({ pathParams: { id: 'plan-1', stopId: 'stop-1' } }),
    )
    expect(await screen.findByText(NOT_STARTED)).toBeTruthy()
    expect(screen.queryByText(CONNECTIVITY)).toBeNull()
    // The last stop's check-in would otherwise advance to the finished screen.
    expect(mockReplace).not.toHaveBeenCalledWith('/plans/plan-1/finished')
  })

  it('forgets a refused check-in once a stop completion lands', async () => {
    mockParams.value = { planId: 'plan-1', checkin: '1' }
    mockPost.mockImplementation(async (path: string) => {
      if (path.includes('checkin')) throw notActive
      return { completed: true }
    })
    await renderActive()

    // Refused, but the room refetch says active: the live screen comes back.
    await press(SAVE_CHECKIN)
    await waitFor(() => expect(screen.getByText(DONE)).toBeTruthy())
    await waitFor(() => expect(screen.queryByText(NOT_STARTED)).toBeNull())

    await press(DONE)
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/plans/{id}/stops/{stopId}/complete', undefined, expect.anything()))

    // A later room refresh must not resurrect the old refusal while it is out.
    const answer = deferred<unknown>()
    mockGet.mockImplementationOnce(() => answer.promise)
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.room('room-1'), exact: true })
    })
    expect(screen.queryByText(NOT_STARTED)).toBeNull()
    await act(async () => {
      answer.resolve(roomFor('group-host', { status: 'active' } as never))
      await answer.promise
    })
  })
})
