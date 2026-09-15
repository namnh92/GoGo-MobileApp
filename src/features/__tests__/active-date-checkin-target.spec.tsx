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
const mockTrack = jest.fn()
let mockParams: Record<string, string> = { planId: 'plan-1' }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

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
import { queryKeys } from '@/shared/api/query-keys'
import ActiveDateScreen from '@/features/active-date/active-date.view'

const DONE_STEP = 'Xong bước này ✓'
const FINISH = 'Kết thúc date 🎉'
const SAVE = 'Lưu check-in ✓'
const SKIP = 'Bỏ qua'
const ALL_DONE = 'Đã đi hết các điểm'
const CHECKIN_FAILED = 'Chưa lưu được check-in. Thử lại, hoặc bỏ qua để đi tiếp.'
const VIEW_SUMMARY = 'Xem tổng kết →'
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

/** Another phone changed the plan; this one reads it on its next refetch. */
async function refetchPlan() {
  await act(async () => {
    await client.invalidateQueries({ queryKey: queryKeys.plan('plan-1') })
  })
}

/** Plan reads stay unanswered until released, the way a slow refetch lands after the user moved on. */
function holdPlanReads() {
  const held: (() => void)[] = []
  mockGet.mockImplementation((path: string) =>
    path === '/rooms/{id}'
      ? Promise.resolve(roomFor('group-host', { status: 'active' } as never))
      : new Promise(resolve => held.push(() => resolve(planNow()))),
  )
  return () =>
    act(async () => {
      held.splice(0).forEach(release => release())
    })
}

const dateCompletedEvents = () => mockTrack.mock.calls.filter(([name]) => name === 'date_completed')

// Deliver TanStack's observer notifications inside the act that caused them.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  mockParams = { planId: 'plan-1' }
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

describe('when every stop is already done', () => {
  it('offers the summary rather than a screen with no way on', async () => {
    server.statuses = ['completed', 'completed', 'completed']
    await renderActive()
    expect(await screen.findByText(ALL_DONE)).toBeTruthy()
    expect(screen.queryByText(SAVE)).toBeNull()

    await press(VIEW_SUMMARY)
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
    expect(calls(COMPLETE_PATH)).toHaveLength(0)
  })

  it('keeps the open check-in and its draft when the other phone finishes the remaining stops', async () => {
    server.statuses = ['completed', 'planned', 'planned']
    await renderActive()
    await completeStop(DONE_STEP, 'Điểm 3 / 3')
    await fireEvent.press(screen.getByLabelText('3 sao'))

    server.statuses[2] = 'completed'
    await refetchPlan()
    expect(await screen.findByText(ALL_DONE)).toBeTruthy()

    await press(SAVE)
    await waitFor(() => expect(stopIds(CHECKIN_PATH)).toEqual(['stop-2']))
    expect(calls(CHECKIN_PATH)[0]![1]).toMatchObject({ rating: 3 })
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())
    // Stop 2 was not the last when this phone completed it; the summary is one tap on.
    expect(mockReplace).not.toHaveBeenCalled()
    await press(VIEW_SUMMARY)
    expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished')
  })
})

describe('when the room stops being active under an open check-in', () => {
  it('keeps the sheet and its draft, since an ended room still takes check-ins', async () => {
    server.statuses = ['completed', 'planned', 'planned']
    await renderActive()
    await completeStop(DONE_STEP, 'Điểm 3 / 3')
    await fireEvent.press(screen.getByLabelText('3 sao'))

    mockGet.mockImplementation(async (path: string) =>
      path === '/rooms/{id}' ? roomFor('group-host', { status: 'completed' } as never) : planNow(),
    )
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.room('room-1') })
    })
    expect(await screen.findByText(VIEW_SUMMARY)).toBeTruthy()

    await press(SAVE)
    await waitFor(() => expect(stopIds(CHECKIN_PATH)).toEqual(['stop-2']))
    expect(calls(CHECKIN_PATH)[0]![1]).toMatchObject({ rating: 3 })
  })
})

describe('when the plan refetch after a completion is slow', () => {
  it('moves on at once, so the stop just completed is not offered again', async () => {
    server.statuses = ['completed', 'planned', 'planned']
    await renderActive()
    expect(await screen.findByText('Điểm 2 / 3')).toBeTruthy()
    const release = holdPlanReads()

    await press(DONE_STEP)
    expect(await screen.findByText(SAVE)).toBeTruthy()
    expect(screen.getByText('Điểm 3 / 3')).toBeTruthy()
    await press(SKIP)
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())

    await press(FINISH)
    expect(await screen.findByText(ALL_DONE)).toBeTruthy()
    expect(stopIds(COMPLETE_PATH)).toEqual(['stop-2', 'stop-3'])
    await press(SKIP)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished'))

    await release()
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(dateCompletedEvents()).toHaveLength(1)
  })
})

describe('closing the last check-in while it saves', () => {
  it('finishes the date once when "Bỏ qua" is tapped during the save', async () => {
    server.statuses = ['completed', 'completed', 'planned']
    let answer = () => undefined as void
    mockPost.mockImplementation((path: string, body: unknown, options: Call[2]) =>
      path === CHECKIN_PATH
        ? new Promise(resolve => {
            answer = () => resolve({ id: 'checkin-stop-3' })
          })
        : serverPost(path, body, options),
    )
    await renderActive()
    expect(await screen.findByText('Điểm 3 / 3')).toBeTruthy()
    await completeStop(FINISH, ALL_DONE)

    await press(SAVE)
    // The save is in flight: its button shows a spinner, and "Bỏ qua" is off.
    await waitFor(() => expect(calls(CHECKIN_PATH)).toHaveLength(1))
    await press(SKIP)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.getByText(SKIP)).toBeTruthy()

    await act(async () => answer())
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1/finished'))
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(dateCompletedEvents()).toHaveLength(1)
    expect(stopIds(CHECKIN_PATH)).toEqual(['stop-3'])
  })
})

describe('a check-in opened from a link', () => {
  it('stays with the stop it opened on when the plan moves on underneath', async () => {
    mockParams = { planId: 'plan-1', checkin: '1' }
    server.statuses = ['planned', 'planned', 'planned']
    await renderActive()
    expect(await screen.findByText(SAVE)).toBeTruthy()
    expect(screen.getAllByText('Cà phê Sáng')).toHaveLength(2)
    await fireEvent.press(screen.getByLabelText('4 sao'))

    // The other phone completes stop 1 while this sheet is open.
    server.statuses[0] = 'completed'
    await refetchPlan()
    expect(await screen.findByText('Điểm 2 / 3')).toBeTruthy()

    await press(SAVE)
    await waitFor(() => expect(stopIds(CHECKIN_PATH)).toEqual(['stop-1']))
    expect(calls(CHECKIN_PATH)[0]![1]).toMatchObject({ rating: 4 })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not end the date when closed at the last stop, which is not completed yet', async () => {
    mockParams = { planId: 'plan-1', checkin: '1' }
    server.statuses = ['completed', 'completed', 'planned']
    await renderActive()
    expect(await screen.findByText(SAVE)).toBeTruthy()

    await press(SKIP)
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.getByText(FINISH)).toBeTruthy()
    expect(calls(COMPLETE_PATH)).toHaveLength(0)
  })
})

describe('a check-in no retry can save', () => {
  it.each([
    ['refused for this account', new ApiError(403, { code: 'NOT_A_MEMBER', message: 'no' }), 'Bạn không có quyền thực hiện thao tác này.'],
    ['rejected as invalid', new ApiError(400, { code: 'VALIDATION_FAILED', message: 'bad' }), 'Không lưu được check-in này. Bỏ qua để đi tiếp.'],
  ])('does not ask for a retry when %s', async (_, failure, message) => {
    server.statuses = ['completed', 'planned', 'planned']
    mockPost.mockImplementation(async (path: string, body: unknown, options: Call[2]) => {
      if (path === CHECKIN_PATH) throw failure
      return serverPost(path, body, options)
    })
    await renderActive()
    expect(await screen.findByText('Điểm 2 / 3')).toBeTruthy()
    await completeStop(DONE_STEP, 'Điểm 3 / 3')

    await press(SAVE)
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByText(CHECKIN_FAILED)).toBeNull()
    expect(screen.getByText(SAVE)).toBeTruthy()

    await press(SKIP)
    await waitFor(() => expect(screen.queryByText(SAVE)).toBeNull())
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
