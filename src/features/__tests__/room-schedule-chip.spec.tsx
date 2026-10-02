import { loaded, loaded as mockLoaded, roomFor, renderScreen, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#201 — the room's "Điều kiện phòng" card showed only the start
 * time. `constraints.endAt` is in the contract (`RoomConstraints`), the create
 * flow writes it and the schedule editor reads and clears it, but nothing ever
 * rendered it: a room booked 19:00–22:00 read as "19:00".
 *
 * Every binding a jest.mock factory touches must be `mock`-prefixed; the
 * factories are hoisted above the imports.
 */

const mockIdleMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({ code: 'ABC123' })),
  isPending: false,
  isError: false,
  error: null,
}

const mockRoom: { query: QueryLike } = { query: loaded(roomFor('couple')) }
const mockParams = { roomId: '311f5bd8-f853-4ced-af68-e04398d1451a' }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useNavigationContainerRef: () => ({ isReady: () => true }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  useRoomMembers: () => mockLoaded([]),
  useCurrentSuggestions: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useCurrentPlan: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useRoomRealtime: jest.fn(() => ({ status: 'live' })),
  useCreateRoomInvite: () => ({ ...mockIdleMutation, stored: null, forget: jest.fn() }),
  useRoomInvites: () => ({ isPending: false, isError: false, isFetching: false, status: 'success', data: [], dataUpdatedAt: 1, refetch: jest.fn() }),
  useRevokeRoomInvite: () => mockIdleMutation,
  useStartMatching: () => mockIdleMutation,
}))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

/**
 * Built from local wall-clock times so "same local day" is a fact of the
 * fixture in whatever zone jest runs: 19:00–22:00 stays on one day, 22:00 to
 * 01:00 crosses midnight. Fixed UTC instants would flip between the two cases
 * depending on the machine's offset.
 */
const local = (day: number, hour: number) => new Date(2026, 8, day, hour, 0, 0).toISOString()
const START = local(10, 19)
const SAME_DAY_END = local(10, 22)
const LATE_START = local(10, 22)
const NEXT_DAY_END = local(11, 1)

/**
 * Written from the i18n key (`roomSchedule.range`) and the format the room
 * schedule has always used, not from the function under test.
 */
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })

const withSchedule = (startAt?: string, endAt?: string) =>
  loaded(
    roomFor('couple', {
      constraints: {
        budgetMode: 'total',
        budgetAmount: 600_000,
        currency: 'VND',
        administrativeArea: null,
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
      },
    }),
  )

it('shows the end of the outing next to its start', async () => {
  mockRoom.query = withSchedule(START, SAME_DAY_END)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText(`${dateTime(START)} – ${timeOnly(SAME_DAY_END)}`)).toBeTruthy()
})

it('carries the date on the end when the outing crosses midnight', async () => {
  mockRoom.query = withSchedule(LATE_START, NEXT_DAY_END)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText(`${dateTime(LATE_START)} – ${dateTime(NEXT_DAY_END)}`)).toBeTruthy()
})

it('shows the start alone when the room stores no end', async () => {
  mockRoom.query = withSchedule(START)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText(dateTime(START))).toBeTruthy()
})

it('says the room is unscheduled rather than inventing a date from an end', async () => {
  mockRoom.query = withSchedule(undefined, SAME_DAY_END)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText('Chưa đặt lịch')).toBeTruthy()
})
