import { QueryClient, QueryClientProvider, notifyManager, onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'

import { renderScreen, roomFor } from './harness'

/**
 * #269 — SRS §7.2 has `active --> completed: finish` and the backend has let the
 * host make that move all along. The app never asked: every stop `completed`,
 * the summary saying the date was over, and `rooms.status` still `active`.
 * Reproduced twice on DEV `a9da62d` on 2026-09-22. The Plans history tab filters
 * `completed,cancelled,expired` (#213), so a date people had been on never
 * appeared anywhere.
 *
 * Two things the first attempt got wrong, both found in review on 2026-09-23:
 *
 * - It fired from the screen that completed the last stop and threw the error
 *   away, so a timeout or a 500 left the room active while the summary claimed
 *   the date was done — the original defect, now invisible.
 * - It only ran on that one path. A member completing the last stop, or a
 *   relaunch between completing it and closing its sheet, left the host with no
 *   way to close the room at all.
 *
 * So the room is closed here, on the summary, by whoever arrives at it — with
 * the attempt visible, and a retry when it fails.
 */

const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client')
  return {
    ...actual,
    api: { ...actual.api, get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
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
}))

import DateFinishedScreen from '@/features/active-date/date-finished.view'
import { ApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'

const CLOSING = 'Đang khép lại kèo…'
const CLOSE_FAILED = 'Chưa khép lại được kèo, nên nó vẫn đang diễn ra.'
const RETRY = 'Thử lại'

const stop = (id: string, placeId: string, order: number, status: string) => ({
  id,
  placeId,
  order,
  durationMinutes: 60,
  isLocked: false,
  status,
})

const server = {
  audience: 'group-host' as 'group-host' | 'group-guest',
  roomStatus: 'active',
  stops: [stop('stop-1', 'place-1', 1, 'completed'), stop('stop-2', 'place-2', 2, 'completed')],
}

const plan = () => ({
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: server.stops,
})

const statusCalls = () => mockPatch.mock.calls.filter(([path]) => path === '/rooms/{id}/status')


/**
 * The review CTA's own disabled state, wherever the label sits inside it.
 *
 * The label follows the room type, and before the room answers the screen falls
 * back to the couple wording — so the CTA is found by what it is, not by which
 * of the two sentences it happens to be showing.
 */
const REVIEW_CTA = /thấy sao\? 💬/

function reviewCta() {
  return screen.getByText(REVIEW_CTA)
}

interface Walkable {
  parent: Walkable | null
  props: { accessibilityState?: { disabled?: boolean } }
}

function reviewDisabled(): boolean {
  let node = reviewCta() as unknown as Walkable | null
  while (node) {
    const disabled = node.props?.accessibilityState?.disabled
    if (typeof disabled === 'boolean') return disabled
    node = node.parent
  }
  throw new Error('review CTA has no accessibilityState')
}

/**
 * The closing mutation retries on its own for a few seconds (#269 review): a
 * person can walk away from the summary and take the retry button with them, so
 * a transient failure must not depend on them being there. The failed state only
 * appears once that runs out, which these tests fast-forward through.
 */
async function letRetriesRunOut() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000)
  })
}

let client: QueryClient

async function openSummary() {
  return renderScreen(
    <QueryClientProvider client={client}>
      <DateFinishedScreen />
    </QueryClientProvider>,
  )
}

jest.useFakeTimers()
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  mockGet.mockReset()
  mockPatch.mockReset()
  server.audience = 'group-host'
  server.roomStatus = 'active'
  server.stops = [stop('stop-1', 'place-1', 1, 'completed'), stop('stop-2', 'place-2', 2, 'completed')]
  mockGet.mockImplementation((path: string) =>
    path === '/rooms/{id}'
      ? Promise.resolve(roomFor(server.audience, { status: server.roomStatus } as never))
      : Promise.resolve(plan()),
  )
  mockPatch.mockImplementation(() => Promise.resolve(roomFor('group-host', { status: 'completed' } as never)))
})
afterEach(() => client.clear())

describe('closing the room from the summary (#269)', () => {
  it('closes a room whose stops are all done when the host arrives', async () => {
    await openSummary()

    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    expect(statusCalls()[0][1]).toEqual({ status: 'completed' })
  })

  /**
   * The path the first attempt had no answer for: this host never completed the
   * last stop and never saw its sheet — a member did it, or the app was
   * relaunched. Reaching the summary is the only thing that happened here, and
   * it has to be enough. The reviewer's regression measured 0 PATCH calls.
   */
  it('closes it for a host who only ever opened the summary', async () => {
    await openSummary()
    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    // Nothing on this screen was pressed, and no check-in sheet was involved.
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('leaves the room alone for anyone who is not the host', async () => {
    server.audience = 'group-guest'
    await openSummary()

    expect(await screen.findByText('Quán A')).toBeTruthy()
    expect(statusCalls()).toHaveLength(0)
    expect(screen.queryByText(CLOSING)).toBeNull()
    expect(screen.queryByText(CLOSE_FAILED)).toBeNull()
  })

  it('does nothing for a room that is already closed', async () => {
    server.roomStatus = 'completed'
    await openSummary()

    expect(await screen.findByText('Quán A')).toBeTruthy()
    expect(statusCalls()).toHaveLength(0)
  })

  it('does nothing while a stop is still to come', async () => {
    server.stops = [stop('stop-1', 'place-1', 1, 'completed'), stop('stop-2', 'place-2', 2, 'planned')]
    await openSummary()

    expect(await screen.findByText('Quán A')).toBeTruthy()
    expect(statusCalls()).toHaveLength(0)
  })

  /**
   * The failure the first attempt hid. The summary must not claim a date is
   * over while the room says otherwise.
   */
  it('says so when the room could not be closed, and retries on demand', async () => {
    mockPatch.mockRejectedValue(new ApiError(500, { code: 'INTERNAL', message: 'boom' }))
    await openSummary()
    await letRetriesRunOut()

    expect(await screen.findByText(CLOSE_FAILED)).toBeTruthy()
    const attempts = statusCalls().length
    expect(attempts).toBeGreaterThanOrEqual(1)

    mockPatch.mockResolvedValue(roomFor('group-host', { status: 'completed' } as never))
    await fireEvent.press(screen.getByText(RETRY))

    await waitFor(() => expect(statusCalls().length).toBeGreaterThan(attempts))
  })

  it('keeps saying so while the device is offline', async () => {
    mockPatch.mockRejectedValue(new ApiError(0, { code: 'NETWORK_UNREACHABLE', message: 'offline' }))
    await openSummary()
    await letRetriesRunOut()

    expect(await screen.findByText(CLOSE_FAILED)).toBeTruthy()
    expect(screen.getByText(RETRY)).toBeTruthy()
  })

  it('takes a room that has already moved for an answer, not a failure', async () => {
    mockPatch.mockRejectedValue(
      new ApiError(409, { code: 'INVALID_ROOM_TRANSITION', message: 'Room already moved' }),
    )
    await openSummary()

    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    // The conflict is resolved by re-reading the room, so nothing is reported.
    await waitFor(() => expect(mockGet.mock.calls.filter(([p]) => p === '/rooms/{id}').length).toBeGreaterThan(1))
    expect(screen.queryByText(CLOSE_FAILED)).toBeNull()
  })

  it('tries once on its own, however often the screen re-renders', async () => {
    const view = await openSummary()
    await waitFor(() => expect(statusCalls()).toHaveLength(1))

    view.rerender(
      <QueryClientProvider client={client}>
        <DateFinishedScreen />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(statusCalls()).toHaveLength(1))
  })

  /**
   * Review findings, 2026-09-23. Review is the one way off this screen and
   * neither it nor the shared result closes a room, so following it while the
   * room is unknown or still open strands the date outside history — the very
   * defect this patch exists to fix.
   */
  it('keeps the way out shut until the room has answered', async () => {
    let answer!: (room: unknown) => void
    mockGet.mockImplementation((path: string) =>
      path === '/rooms/{id}'
        ? new Promise(resolve => {
            answer = resolve
          })
        : Promise.resolve(plan()),
    )

    await openSummary()
    await screen.findByText(REVIEW_CTA)
    expect(screen.getByText('Đang đọc trạng thái kèo…')).toBeTruthy()
    expect(reviewDisabled()).toBe(true)

    await act(async () => {
      answer(roomFor('group-host', { status: 'active' } as never))
    })
    await waitFor(() => expect(statusCalls()).toHaveLength(1))
  })

  it('says so and offers a retry when the room cannot be read at all', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/rooms/{id}' ? Promise.reject(new ApiError(500, { code: 'INTERNAL', message: 'boom' })) : Promise.resolve(plan()),
    )

    await openSummary()
    console.log('HAS_LOADING', !!screen.queryByText('Đang đọc trạng thái kèo…'), 'HAS_ERR', !!screen.queryByText('Chưa đọc được trạng thái kèo, nên chưa biết kèo đã khép lại chưa.'), 'HAS_CTA', !!screen.queryByText('Các bạn thấy sao? 💬'))
    expect(await screen.findByText('Chưa đọc được trạng thái kèo, nên chưa biết kèo đã khép lại chưa.')).toBeTruthy()
    expect(reviewDisabled()).toBe(true)
    expect(screen.getByText(RETRY)).toBeTruthy()
  })

  it('keeps the way out shut while a failed closing is still failed', async () => {
    mockPatch.mockRejectedValue(new ApiError(500, { code: 'INTERNAL', message: 'boom' }))
    await openSummary()
    await letRetriesRunOut()

    expect(await screen.findByText(CLOSE_FAILED)).toBeTruthy()
    expect(reviewDisabled()).toBe(true)
  })

  it('opens the way out for someone who has nothing to close', async () => {
    server.audience = 'group-guest'
    await openSummary()

    await screen.findByText(REVIEW_CTA)
    await waitFor(() => expect(reviewDisabled()).toBe(false))
  })

  /**
   * Second-pass review findings, 2026-09-23.
   */
  it('does not trust a cached room from before the date', async () => {
    // What a host can be holding: the room as it was when they last looked,
    // before another device started the date and walked every stop.
    client.setQueryData(queryKeys.room('room-1'), roomFor('group-host', { status: 'ready' } as never))

    await openSummary()

    // The cached `ready` says nothing to close; the read taken now says
    // otherwise, and that is the one that counts.
    await waitFor(() => expect(statusCalls()).toHaveLength(1))
  })

  it('closes the room on its own when the first attempt fails', async () => {
    let attempts = 0
    mockPatch.mockImplementation(() => {
      attempts += 1
      return attempts === 1
        ? Promise.reject(new ApiError(503, { code: 'UNAVAILABLE', message: 'later' }))
        : Promise.resolve(roomFor('group-host', { status: 'completed' } as never))
    })

    await openSummary()
    await letRetriesRunOut()

    // Nobody pressed anything: a person who walked away must not be the reason
    // the room stays open.
    expect(attempts).toBeGreaterThan(1)
    expect(screen.queryByText(CLOSE_FAILED)).toBeNull()
  })

  it('says it is offline and still lets the person leave', async () => {
    // The plan is the one thing this screen caches for offline use; the room
    // read is what pauses.
    client.setQueryData(queryKeys.plan('plan-1'), plan())
    onlineManager.setOnline(false)
    try {
      await openSummary()

      expect(await screen.findByText('Đang ngoại tuyến nên chưa khép lại kèo được. Mở lại màn này khi có mạng.')).toBeTruthy()
      expect(statusCalls()).toHaveLength(0)
      // Holding someone on this screen offline buys nothing: nothing can be
      // closed until the network is back.
      expect(reviewDisabled()).toBe(false)
    } finally {
      onlineManager.setOnline(true)
    }
  })
})
