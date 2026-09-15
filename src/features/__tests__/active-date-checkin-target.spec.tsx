import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'

import { renderScreen, roomFor } from './harness'

/**
 * #278 — completing a stop refetches the plan, and the first `planned` stop
 * moves on to the next one while the check-in sheet is still open. The screen
 * read that live stop, so the check-in was filed against the next stop, and at
 * the second-to-last stop "Bỏ qua" finished the date one stop early.
 *
 * The real plan, room and mutation hooks run here against a faked HTTP client
 * whose plan answers change when a stop is completed, the way the server's do.
 */

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
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
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([
      ['place-1', { id: 'place-1', name: 'Cà phê Sáng' }],
      ['place-2', { id: 'place-2', name: 'Quán Trưa' }],
      ['place-3', { id: 'place-3', name: 'Công viên Chiều' }],
    ]),
    isPending: false,
  }),
  useUploadImage: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))

import { ApiError, NetworkError } from '@/shared/api/errors'
import ActiveDateScreen from '@/features/active-date/active-date.view'

const DONE_STEP = 'Xong bước này ✓'
const FINISH = 'Kết thúc date 🎉'
const SAVE = 'Lưu check-in ✓'
const SKIP = 'Bỏ qua'
const ALL_DONE = 'Đã đi hết các điểm'
const CHECKIN_FAILED = 'Chưa lưu được check-in. Thử lại, hoặc bỏ qua để đi tiếp.'
const COMPLETE_PATH = '/plans/{id}/stops/{stopId}/complete'
const CHECKIN_PATH = '/plans/{id}/stops/{stopId}/checkin'
const PLACE_IDS = ['place-1', 'place-2', 'place-3']

type Call = [string, unknown, { pathParams: { id: string; stopId: string } }]

/** Stop statuses as the server holds them; a completion changes them. */
const server: { statuses: string[] } = { statuses: [] }

function planNow() {
  return {
    id: 'plan-1',
    roomId: 'room-1',
    status: 'current',
    version: 1,
    currency: 'VND',
    stops: PLACE_IDS.map((placeId, index) => ({
      id: `stop-${index + 1}`,
      placeId,
      position: index,
      durationMinutes: 60,
      isLocked: false,
      status: server.statuses[index],
    })),
  }
}

async function serverPost(path: string, _body: unknown, options: Call[2]) {
  if (path === COMPLETE_PATH) {
    const index = Number(options.pathParams.stopId.replace('stop-', '')) - 1
    server.statuses[index] = 'completed'
    return { id: options.pathParams.stopId, status: 'completed' }
  }
  if (path === CHECKIN_PATH) return { id: `checkin-${options.pathParams.stopId}` }
  throw new Error(`unexpected POST ${path}`)
}

const calls = (path: string) => (mockPost.mock.calls as Call[]).filter(([called]) => called === path)
const stopIds = (path: string) => calls(path).map(([, , options]) => options.pathParams.stopId)
const planReads = () => mockGet.mock.calls.filter(([path]) => path === '/plans/{id}').length

let client: QueryClient

async function renderActive() {
  await renderScreen(
    <QueryClientProvider client={client}>
      <ActiveDateScreen />
    </QueryClientProvider>,
  )
}

/** Mutation and query state reach the screen asynchronously, so find, then press. */
async function press(label: string) {
  await fireEvent.press(await screen.findByText(label))
}

/**
 * Two taps that both land before the button re-renders as busy, which is what a
 * quick double tap does on a slow phone. `fireEvent` cannot do this: it checks
 * the button again before the second press and finds it disabled.
 */
async function doubleTap(label: string) {
  type Fiber = { memoizedProps?: { onPress?: unknown }; return: Fiber | null }
  let fiber = (await screen.findByText(label) as unknown as { unstable_fiber: Fiber | null }).unstable_fiber
  while (fiber && typeof fiber.memoizedProps?.onPress !== 'function') fiber = fiber.return
  const onPress = fiber?.memoizedProps?.onPress as () => void
  await act(async () => {
    onPress()
    onPress()
  })
}

/** Completes the stop on screen and waits until the plan refetch has moved the screen on. */
async function completeStop(label: string, movedOnTo: string) {
  const before = planReads()
  await press(label)
  await waitFor(() => expect(planReads()).toBeGreaterThan(before))
  expect(await screen.findByText(movedOnTo)).toBeTruthy()
}

// Deliver TanStack's observer notifications inside the act that caused them.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  mockPost.mockReset()
  mockGet.mockReset()
  mockPost.mockImplementation(serverPost)
  mockGet.mockImplementation(async (path: string) =>
    path === '/rooms/{id}' ? roomFor('group-host', { status: 'active' } as never) : planNow(),
  )
})
afterEach(() => client.clear())

describe('checking in after completing a stop', () => {
  it('files the check-in against the stop just completed, and names that stop', async () => {
    server.statuses = ['planned', 'planned', 'planned']
    await renderActive()
    expect(await screen.findByText('Điểm 1 / 3')).toBeTruthy()

    await completeStop(DONE_STEP, 'Điểm 2 / 3')
    // The plan has moved on behind the sheet; the sheet is still about stop 1.
    expect(screen.getByText(SAVE)).toBeTruthy()
    expect(screen.getAllByText('Cà phê Sáng')).toHaveLength(1)

    await press(SAVE)
    await waitFor(() => expect(stopIds(CHECKIN_PATH)).toEqual(['stop-1']))
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())
    expect(screen.getByText('Điểm 2 / 3')).toBeTruthy()
    expect(stopIds(COMPLETE_PATH)).toEqual(['stop-1'])
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it.each([
    ['skipping', SKIP],
    ['saving', SAVE],
  ])('moves on to the last stop after %s the check-in at the second-to-last stop', async (_, action) => {
    server.statuses = ['completed', 'planned', 'planned']
    await renderActive()
    expect(await screen.findByText('Điểm 2 / 3')).toBeTruthy()

    await completeStop(DONE_STEP, 'Điểm 3 / 3')
    expect(screen.getAllByText('Quán Trưa')).toHaveLength(1)

    await press(action)
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.getByText('Điểm 3 / 3')).toBeTruthy()
    expect(screen.getByText(FINISH)).toBeTruthy()
    expect(stopIds(CHECKIN_PATH)).toEqual(action === SAVE ? ['stop-2'] : [])
  })

  it.each([
    ['skipping', SKIP],
    ['saving', SAVE],
  ])('finishes the date after %s the check-in at the last stop', async (_, action) => {
    server.statuses = ['completed', 'completed', 'planned']
    await renderActive()
    expect(await screen.findByText('Điểm 3 / 3')).toBeTruthy()

    // No stop is left once the plan refetch lands; the sheet still has to be there.
    await completeStop(FINISH, ALL_DONE)
    expect(screen.getByText(SAVE)).toBeTruthy()
    expect(screen.getAllByText('Công viên Chiều')).toHaveLength(1)

    await press(action)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished'))
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(stopIds(CHECKIN_PATH)).toEqual(action === SAVE ? ['stop-3'] : [])
  })
})

describe('when a write fails', () => {
  it.each([
    ['first', ['planned', 'planned', 'planned'], DONE_STEP, 'Điểm 1 / 3'],
    ['last', ['completed', 'completed', 'planned'], FINISH, 'Điểm 3 / 3'],
  ])('opens no check-in and stays on the %s stop when its completion fails', async (_, statuses, label, counter) => {
    server.statuses = [...statuses]
    mockPost.mockRejectedValue(new NetworkError())
    await renderActive()
    expect(await screen.findByText(counter)).toBeTruthy()

    await press(label)
    expect(await screen.findByText('Chưa lưu được. Kiểm tra kết nối rồi thử lại.')).toBeTruthy()
    expect(screen.queryByText(SAVE)).toBeNull()
    expect(screen.getByText(counter)).toBeTruthy()
    expect(screen.getByText(label)).toBeTruthy()
    expect(calls(CHECKIN_PATH)).toHaveLength(0)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('keeps the sheet and the draft open on a failed check-in, moves nowhere, and saves on retry', async () => {
    server.statuses = ['completed', 'planned', 'planned']
    let failures = 1
    mockPost.mockImplementation(async (path: string, body: unknown, options: Call[2]) => {
      if (path === CHECKIN_PATH && failures > 0) {
        failures -= 1
        throw new ApiError(500, { code: 'INTERNAL', message: 'boom' })
      }
      return serverPost(path, body, options)
    })
    await renderActive()
    expect(await screen.findByText('Điểm 2 / 3')).toBeTruthy()

    await completeStop(DONE_STEP, 'Điểm 3 / 3')
    await fireEvent.press(screen.getByLabelText('3 sao'))
    await press(SAVE)

    expect(await screen.findByText(CHECKIN_FAILED)).toBeTruthy()
    // Still the sheet for stop 2, and the date has not moved on or finished.
    expect(screen.getByText(SAVE)).toBeTruthy()
    expect(screen.getAllByText('Quán Trưa')).toHaveLength(1)
    expect(mockReplace).not.toHaveBeenCalled()

    await press(SAVE)
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())
    expect(stopIds(CHECKIN_PATH)).toEqual(['stop-2', 'stop-2'])
    // The retry sends the draft the user had, not a reset one.
    const [first, retry] = calls(CHECKIN_PATH).map(([, body]) => body)
    expect(first).toMatchObject({ rating: 3 })
    expect(retry).toEqual(first)
    expect(screen.queryByText(CHECKIN_FAILED)).toBeNull()
    expect(screen.getByText('Điểm 3 / 3')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('a double tap on "Xong bước này"', () => {
  it('sends one completion and opens one check-in for that stop', async () => {
    server.statuses = ['planned', 'planned', 'planned']
    await renderActive()
    expect(await screen.findByText('Điểm 1 / 3')).toBeTruthy()

    await doubleTap(DONE_STEP)
    expect(await screen.findByText('Điểm 2 / 3')).toBeTruthy()
    expect(await screen.findByText(SAVE)).toBeTruthy()
    expect(stopIds(COMPLETE_PATH)).toEqual(['stop-1'])
    expect(screen.getAllByText('Cà phê Sáng')).toHaveLength(1)
  })
})
