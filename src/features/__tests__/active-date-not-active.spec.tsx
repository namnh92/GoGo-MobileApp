import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'

/**
 * #251 — completing a stop in a room that is not `active` answered
 * 409 ROOM_NOT_ACTIVE, and the screen said "Kiểm tra kết nối". The real
 * mutation hooks run here against a faked HTTP client, so the copy under test is
 * what a refused request actually produces.
 */

const mockPost = jest.fn()
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
  return { ...actual, api: { ...actual.api, post: (...args: unknown[]) => mockPost(...args) } }
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
import ActiveDateScreen from '@/features/active-date/active-date.view'

const DONE = 'Kết thúc date 🎉'
const NOT_ACTIVE = /Phòng chưa ở trạng thái đang diễn ra/
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

let client: QueryClient

async function renderActive() {
  return renderScreen(
    <QueryClientProvider client={client}>
      <ActiveDateScreen />
    </QueryClientProvider>,
  )
}

/** Mutation state reaches the screen on a scheduled notify, so find, then press. */
async function press(view: Awaited<ReturnType<typeof renderActive>>, label: string | RegExp) {
  const target = await view.findByText(label)
  await act(async () => {
    fireEvent.press(target)
  })
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  // clearAllMocks keeps queued once-answers; reset so none leak between tests.
  mockPost.mockReset()
  mockCanGoBack.mockReturnValue(true)
  mockParams.value = { planId: 'plan-1' }
  mockPlan.query = loaded(plan)
})
afterEach(() => client.clear())

describe('completing a stop', () => {
  it('explains a room that is not in progress and offers the way back to the plan', async () => {
    mockPost.mockRejectedValue(notActive)
    const view = await renderActive()

    await press(view, DONE)
    expect(await view.findByText(NOT_ACTIVE)).toBeTruthy()
    expect(view.queryByText(CONNECTIVITY)).toBeNull()

    await press(view, 'Về kế hoạch')
    expect(mockBack).toHaveBeenCalled()
  })

  it('opens the plan when the active date was the first screen', async () => {
    mockPost.mockRejectedValue(notActive)
    mockCanGoBack.mockReturnValue(false)
    const view = await renderActive()

    await press(view, DONE)
    await press(view, 'Về kế hoạch')
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1')
  })

  it('still reports a real connectivity failure as one', async () => {
    mockPost.mockRejectedValue(new NetworkError())
    const view = await renderActive()

    await press(view, DONE)
    expect(await view.findByText('Chưa lưu được. Kiểm tra kết nối rồi thử lại.')).toBeTruthy()
    expect(view.queryByText(NOT_ACTIVE)).toBeNull()
  })

  it('does not blame the connection for another server refusal', async () => {
    mockPost.mockRejectedValue(new ApiError(404, { code: 'STOP_NOT_FOUND', message: 'Stop not found' }))
    const view = await renderActive()

    await press(view, DONE)
    expect(await view.findByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
    expect(view.queryByText(CONNECTIVITY)).toBeNull()
  })
})

describe('check-in', () => {
  it('stays on the stop and explains a room that is not in progress', async () => {
    mockParams.value = { planId: 'plan-1', checkin: '1' }
    mockPost.mockRejectedValue(notActive)
    const view = await renderActive()

    await press(view, 'Lưu check-in ✓')
    expect(mockPost).toHaveBeenCalledWith(
      '/plans/{id}/stops/{stopId}/checkin',
      expect.anything(),
      expect.objectContaining({ pathParams: { id: 'plan-1', stopId: 'stop-1' } }),
    )
    expect(await view.findByText(NOT_ACTIVE)).toBeTruthy()
    expect(view.queryByText(CONNECTIVITY)).toBeNull()
    // The last stop's check-in would otherwise advance to the finished screen.
    expect(mockReplace).not.toHaveBeenCalledWith('/plans/plan-1/finished')
  })
})
