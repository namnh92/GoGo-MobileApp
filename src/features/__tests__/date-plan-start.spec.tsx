import { QueryClientProvider, notifyManager, onlineManager, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'

import { failed, loaded, roomFor, renderScreen, type Audience, type QueryLike } from './harness'

/**
 * #251 — on the plan screen "Bắt đầu đi" only navigated, so the room stayed
 * `ready` and the active date could not save anything. The screen now runs the
 * real start hook, on the app's own query client, against a faked HTTP client:
 * the host starts the room before the active date opens, and members wait until
 * the room is active.
 */

const mockPush = jest.fn()
const mockPatch = jest.fn()
const mockGet = jest.fn()
const mockTrack = jest.fn()
const mockRefetchRoom = jest.fn()
const mockFocus: { blur: (() => void) | undefined } = { blur: undefined }

const mockPlan: { query: QueryLike } = { query: loaded(null) }
const mockRoom: { query: QueryLike } = { query: loaded(null) }

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react')
  return {
    // Focus follows mount here; a test blurs the screen through `mockFocus`.
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      useEffect(() => {
        const cleanup = effect()
        mockFocus.blur = cleanup ?? undefined
        return cleanup
      }, [effect])
    },
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ planId: 'plan-1' }),
  }
})

jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

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
import { createQueryClient } from '@/shared/api/query-client'
import DatePlanScreen from '@/features/date-plan/date-plan.view'

const GO = 'Bắt đầu đi →'
const ENTER = 'Vào buổi đi chơi →'
const SUMMARY = 'Xem tổng kết →'
const RETRY = 'Thử lại'
const WAITING = /Đang đợi chủ phòng bắt đầu buổi đi chơi/
const CONNECTIVITY = /Kiểm tra kết nối/

const plan = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: [{ id: 'stop-1', placeId: 'place-1', order: 1, durationMinutes: 60, isLocked: false, status: 'planned' }],
}

const startedRoom = () => ({ ...roomFor('group-host'), status: 'active' })

let client: QueryClient

function roomAs(audience: Audience, status: string, overrides: Record<string, unknown> = {}) {
  return { ...loaded(roomFor(audience, { status, ...overrides } as never)), refetch: mockRefetchRoom }
}

function tree() {
  return (
    <QueryClientProvider client={client}>
      <DatePlanScreen />
    </QueryClientProvider>
  )
}

async function renderPlan() {
  return renderScreen(tree())
}

/**
 * Mutation state reaches the screen asynchronously, so find, then press.
 * RNTL 14's `fireEvent` runs its own async act, so it is awaited, never wrapped.
 */
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

const tracked = (event: string) => mockTrack.mock.calls.filter(([name]) => name === event).length

// Deliver TanStack's observer notifications inside the act that caused them.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  // The app's own client: its default mutation retry is what the start must opt out of.
  client = createQueryClient()
  jest.clearAllMocks()
  // mockReset also drops queued once-answers, so none leak between tests.
  mockPatch.mockReset()
  mockGet.mockReset()
  mockFocus.blur = undefined
  mockPlan.query = loaded(plan)
  mockRoom.query = roomAs('group-host', 'ready')
})
afterEach(() => {
  onlineManager.setOnline(true)
  client.clear()
})

describe('host starts the date', () => {
  it('moves the room to active, shows it working, then opens the active date', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    await renderPlan()

    await press(GO)
    expect(mockPatch).toHaveBeenCalledWith('/rooms/{id}/status', { status: 'active' }, { pathParams: { id: 'room-1' } })
    // In flight: busy and disabled, and nothing has navigated yet.
    expect((await screen.findByRole('button', { busy: true })).props.accessibilityState).toMatchObject({ disabled: true })
    expect(mockPush).not.toHaveBeenCalled()

    await act(async () => {
      answer.resolve(startedRoom())
      await answer.promise
    })
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(tracked('date_plan_accepted')).toBe(1)
    expect(tracked('date_started')).toBe(1)
  })

  it('sends one request, counts one acceptance and navigates once for a rapid double tap', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    await renderPlan()

    // The Pressable itself, which stays mounted while its label becomes a spinner.
    const button = screen.getByRole('button', { name: GO })
    await fireEvent.press(button)
    await fireEvent.press(button)
    await act(async () => {
      answer.resolve(startedRoom())
      await answer.promise
    })

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(tracked('date_plan_accepted')).toBe(1)
  })

  it('says offline promptly, without retrying behind a spinner, and retries from the same button', async () => {
    onlineManager.setOnline(false)
    mockPatch.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(startedRoom())
    await renderPlan()

    await press(GO)
    // RNTL's default find timeout is 1 s; the client's default retries take longer.
    expect(await screen.findByText('Chưa bắt đầu được. Kiểm tra kết nối rồi thử lại.')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await press(RETRY)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active'))
    expect(mockPatch).toHaveBeenCalledTimes(2)
  })

  it('never reports a room-state conflict as a connection problem', async () => {
    mockPatch.mockRejectedValue(new ApiError(409, { code: 'INVALID_ROOM_TRANSITION', message: 'no' }))
    mockGet.mockResolvedValue({ ...roomFor('group-host'), status: 'matching' })
    await renderPlan()

    await press(GO)
    expect(await screen.findByText(/Trạng thái phòng vừa thay đổi/)).toBeTruthy()
    expect(screen.queryByText(CONNECTIVITY)).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it.each([
    ['HOST_ONLY', 'Chỉ chủ phòng bắt đầu được buổi đi chơi.'],
    ['NOT_A_MEMBER', 'Bạn không có quyền thực hiện thao tác này.'],
    ['ROOM_SCOPE_VIOLATION', 'Bạn không có quyền thực hiện thao tác này.'],
  ])('explains a 403 %s accurately', async (code, copy) => {
    mockPatch.mockRejectedValue(new ApiError(403, { code, message: 'no' }))
    await renderPlan()

    await press(GO)
    expect(await screen.findByText(copy)).toBeTruthy()
    expect(screen.queryByText(CONNECTIVITY)).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('counts a room another device already started as started', async () => {
    mockPatch.mockRejectedValue(new ApiError(409, { code: 'INVALID_ROOM_TRANSITION', message: 'no' }))
    mockGet.mockResolvedValue(startedRoom())
    await renderPlan()

    await press(GO)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active'))
    expect(mockGet).toHaveBeenCalledWith('/rooms/{id}', { pathParams: { id: 'room-1' } })
    expect(screen.queryByText(/Chưa bắt đầu được|Trạng thái phòng vừa thay đổi/)).toBeNull()
  })

  it('does not navigate when the start answers after the screen lost focus', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    await renderPlan()

    await press(GO)
    await act(async () => {
      mockFocus.blur?.()
    })
    await act(async () => {
      answer.resolve(startedRoom())
      await answer.promise
    })
    await waitFor(() => expect(tracked('date_started')).toBe(1))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not navigate when the start answers after the screen was closed', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    await renderPlan()

    await press(GO)
    await screen.unmount()
    await act(async () => {
      answer.resolve(startedRoom())
      await answer.promise
    })
    await waitFor(() => expect(tracked('date_started')).toBe(1))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('opens a room that is already active without sending a transition', async () => {
    mockRoom.query = roomAs('group-host', 'active')
    await renderPlan()

    expect(screen.queryByText(GO)).toBeNull()
    await press(ENTER)
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active')
  })
})

describe('members wait for the host', () => {
  it.each([
    ['a group member', roomAs('group-guest', 'ready')],
    ['the other person in a couple', roomAs('couple', 'ready', { myRole: 'member' })],
    // RoomSummary declares host | member; a `guest` role must read as non-host too.
    ['a caller reported as guest', roomAs('group-guest', 'ready', { myRole: 'guest' })],
  ])('%s sees no start action and a waiting state', async (_who, query) => {
    mockRoom.query = query
    await renderPlan()

    expect(screen.queryByText(GO)).toBeNull()
    expect(screen.queryByText(ENTER)).toBeNull()
    expect(screen.getByText(WAITING)).toBeTruthy()
    // RULE-CORE-003: the wait names the host, never "both of you" or a couple's date.
    expect(screen.queryByText(/cả hai|hai đứa|buổi date/)).toBeNull()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('lets a member in once the room is active', async () => {
    mockRoom.query = roomAs('group-guest', 'ready')
    await renderPlan()
    expect(screen.getByText(WAITING)).toBeTruthy()

    // What the room's realtime poll delivers when the host starts.
    mockRoom.query = roomAs('group-guest', 'active')
    await screen.rerender(tree())
    expect(screen.queryByText(WAITING)).toBeNull()
    await press(ENTER)
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/active')
  })
})

describe('room status the date cannot start from', () => {
  it('offers the finished summary, not the live screen, for a completed room', async () => {
    mockRoom.query = roomAs('group-guest', 'completed')
    await renderPlan()

    expect(screen.queryByText(GO)).toBeNull()
    expect(screen.queryByText(ENTER)).toBeNull()
    await press(SUMMARY)
    expect(mockPush).toHaveBeenCalledWith('/plans/plan-1/finished')
    expect(mockPush).not.toHaveBeenCalledWith('/plans/plan-1/active')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it.each([
    ['cancelled', 'Phòng này đã bị huỷ nên không bắt đầu được nữa.'],
    ['expired', 'Phòng này đã hết hạn nên không bắt đầu được nữa.'],
  ])('says a %s room can no longer start', async (status, copy) => {
    mockRoom.query = roomAs('group-host', status)
    await renderPlan()

    expect(screen.getByText(copy)).toBeTruthy()
    expect(screen.queryByText(GO)).toBeNull()
    expect(screen.queryByText(ENTER)).toBeNull()
    expect(screen.queryByText(/chưa ở bước sẵn sàng/)).toBeNull()
  })

  it('offers no start while the room is still matching', async () => {
    mockRoom.query = roomAs('group-host', 'matching')
    await renderPlan()
    expect(screen.queryByText(GO)).toBeNull()
    expect(screen.getByText(/Phòng chưa ở bước sẵn sàng/)).toBeTruthy()
  })

  it('offers a retry when the room itself failed to load', async () => {
    mockRoom.query = { ...failed(new NetworkError()), refetch: mockRefetchRoom }
    await renderPlan()
    expect(screen.queryByText(GO)).toBeNull()
    await press(RETRY)
    expect(mockRefetchRoom).toHaveBeenCalled()
  })
})
