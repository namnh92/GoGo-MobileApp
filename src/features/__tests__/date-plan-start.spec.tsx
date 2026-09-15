import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { failed, loaded, roomFor, renderScreen, type Audience, type QueryLike } from './harness'

/**
 * #251 — on the plan screen "Bắt đầu đi" only navigated, so the room stayed
 * `ready` and the active date could not save anything. The screen now runs the
 * real start hook against a faked HTTP client: the host starts the room before
 * the active date opens, and members wait until the room is active.
 */

const mockPush = jest.fn()
const mockPatch = jest.fn()
const mockGet = jest.fn()
const mockRefetchRoom = jest.fn()

const mockPlan: { query: QueryLike } = { query: loaded(null) }
const mockRoom: { query: QueryLike } = { query: loaded(null) }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      patch: (...args: unknown[]) => mockPatch(...args),
      get: (...args: unknown[]) => mockGet(...args),
    },
  }
})

const mockIdleMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
}

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  useRoom: () => mockRoom.query,
  useRoomRealtime: jest.fn(),
  usePlanStopPlaces: () => ({ byPlaceId: new Map(), isPending: false }),
  useLockPlanStop: () => mockIdleMutation,
  useRegeneratePlan: () => mockIdleMutation,
}))

import { ApiError, NetworkError } from '@/shared/api/errors'
import DatePlanScreen from '@/features/date-plan/date-plan.view'

const GO = 'Bắt đầu đi →'
const ENTER = 'Vào buổi date →'
const RETRY = 'Thử lại'
const WAITING = /Đang đợi chủ phòng bắt đầu buổi date/
const CONNECTIVITY = /Kiểm tra kết nối/

const plan = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: [{ id: 'stop-1', placeId: 'place-1', order: 1, durationMinutes: 60, isLocked: false, status: 'planned' }],
}

let client: QueryClient

function roomAs(audience: Audience, status: string, overrides: Record<string, unknown> = {}) {
  return { ...loaded(roomFor(audience, { status, ...overrides } as never)), refetch: mockRefetchRoom }
}

async function renderPlan() {
  return renderScreen(
    <QueryClientProvider client={client}>
      <DatePlanScreen />
    </QueryClientProvider>,
  )
}

/** Mutation state reaches the screen on a scheduled notify, so find, then press. */
async function press(view: Awaited<ReturnType<typeof renderPlan>>, label: string) {
  const target = await view.findByText(label)
  await act(async () => {
    fireEvent.press(target)
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  // clearAllMocks keeps queued once-answers; reset so none leak between tests.
  mockPatch.mockReset()
  mockGet.mockReset()
  mockPlan.query = loaded(plan)
  mockRoom.query = roomAs('group-host', 'ready')
})
afterEach(() => client.clear())

describe('host starts the date', () => {
  it('moves the room to active, shows it working, then opens the active date', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    const view = await renderPlan()

    await press(view, GO)
    expect(mockPatch).toHaveBeenCalledWith('/rooms/{id}/status', { status: 'active' }, { pathParams: { id: 'room-1' } })
    // In flight: busy and disabled, and nothing has navigated yet.
    expect((await view.findByRole('button', { busy: true })).props.accessibilityState).toMatchObject({ disabled: true })
    expect(mockPush).not.toHaveBeenCalled()

    await act(async () => {
      answer.resolve({ ...roomFor('group-host'), status: 'active' })
      await answer.promise
    })
    expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active')
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('sends one request and navigates once for a rapid double tap', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    const view = await renderPlan()

    await act(async () => {
      const button = view.getByText(GO)
      fireEvent.press(button)
      fireEvent.press(button)
    })
    await act(async () => {
      answer.resolve({ ...roomFor('group-host'), status: 'active' })
      await answer.promise
    })

    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('says why a start failed and retries from the same button', async () => {
    mockPatch.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce({ ...roomFor('group-host'), status: 'active' })
    const view = await renderPlan()

    await press(view, GO)
    expect(await view.findByText('Chưa bắt đầu được. Kiểm tra kết nối rồi thử lại.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()

    await press(view, RETRY)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active'))
    expect(mockPatch).toHaveBeenCalledTimes(2)
  })

  it('never reports a room-state conflict as a connection problem', async () => {
    mockPatch.mockRejectedValue(new ApiError(409, { code: 'INVALID_ROOM_TRANSITION', message: 'no' }))
    mockGet.mockResolvedValue({ ...roomFor('group-host'), status: 'matching' })
    const view = await renderPlan()

    await press(view, GO)
    expect(await view.findByText(/Trạng thái phòng vừa thay đổi/)).toBeTruthy()
    expect(view.queryByText(CONNECTIVITY)).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('counts a room another device already started as started', async () => {
    mockPatch.mockRejectedValue(new ApiError(409, { code: 'INVALID_ROOM_TRANSITION', message: 'no' }))
    mockGet.mockResolvedValue({ ...roomFor('group-host'), status: 'active' })
    const view = await renderPlan()

    await press(view, GO)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active'))
    expect(mockGet).toHaveBeenCalledWith('/rooms/{id}', { pathParams: { id: 'room-1' } })
    expect(view.queryByText(/Chưa bắt đầu được|Trạng thái phòng vừa thay đổi/)).toBeNull()
  })

  it('opens a room that is already active without sending a transition', async () => {
    mockRoom.query = roomAs('group-host', 'active')
    const view = await renderPlan()

    expect(view.queryByText(GO)).toBeNull()
    await press(view, ENTER)
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active')
  })
})

describe('members wait for the host', () => {
  it.each([
    ['a group member', roomAs('group-guest', 'ready')],
    ['the other person in a couple', roomAs('couple', 'ready', { myRole: 'member' })],
  ])('%s sees no start action and a waiting state', async (_who, query) => {
    mockRoom.query = query
    const view = await renderPlan()

    expect(view.queryByText(GO)).toBeNull()
    expect(view.queryByText(ENTER)).toBeNull()
    expect(view.getByText(WAITING)).toBeTruthy()
    // RULE-CORE-003: the wait names the host, never "both of you".
    expect(view.queryByText(/cả hai|hai đứa/)).toBeNull()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('lets a member in once the room is active', async () => {
    mockRoom.query = roomAs('group-guest', 'ready')
    const view = await renderPlan()
    expect(view.getByText(WAITING)).toBeTruthy()

    // What the room's realtime poll delivers when the host starts.
    mockRoom.query = roomAs('group-guest', 'active')
    await view.rerender(
      <QueryClientProvider client={client}>
        <DatePlanScreen />
      </QueryClientProvider>,
    )
    expect(view.queryByText(WAITING)).toBeNull()
    await press(view, ENTER)
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active')
  })
})

describe('room status the date cannot start from', () => {
  it('offers no start while the room is still matching', async () => {
    mockRoom.query = roomAs('group-host', 'matching')
    const view = await renderPlan()
    expect(view.queryByText(GO)).toBeNull()
    expect(view.getByText(/Phòng chưa ở bước sẵn sàng/)).toBeTruthy()
  })

  it('offers a retry when the room itself failed to load', async () => {
    mockRoom.query = { ...failed(new NetworkError()), refetch: mockRefetchRoom }
    const view = await renderPlan()
    expect(view.queryByText(GO)).toBeNull()
    await press(view, RETRY)
    expect(mockRefetchRoom).toHaveBeenCalled()
  })
})
