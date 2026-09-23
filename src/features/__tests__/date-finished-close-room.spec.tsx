import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'

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

let client: QueryClient

async function openSummary() {
  return renderScreen(
    <QueryClientProvider client={client}>
      <DateFinishedScreen />
    </QueryClientProvider>,
  )
}

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

    expect(await screen.findByText(CLOSE_FAILED)).toBeTruthy()
    await waitFor(() => expect(statusCalls()).toHaveLength(1))

    mockPatch.mockResolvedValue(roomFor('group-host', { status: 'completed' } as never))
    await fireEvent.press(screen.getByText(RETRY))

    await waitFor(() => expect(statusCalls()).toHaveLength(2))
  })

  it('keeps saying so while the device is offline', async () => {
    mockPatch.mockRejectedValue(new ApiError(0, { code: 'NETWORK_UNREACHABLE', message: 'offline' }))
    await openSummary()

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
})
