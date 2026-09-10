import { failed, loaded, pending, roomFor, renderScreen, type Audience, type QueryLike } from './harness'

/**
 * The quality gates ask for `screen × audience × state` to actually render —
 * "a selector that only swaps a query param without changing the render is a
 * bug". These tests assert the render differs, not just the input.
 *
 * Every binding a jest.mock factory touches must be `mock`-prefixed; the
 * factories are hoisted above the imports.
 */

const mockPush = jest.fn()
const mockReplace = jest.fn()

const mockIdleMutation = {
  mutate: jest.fn(),
  // The room hub chains off mutateAsync, so it has to resolve, not return void.
  mutateAsync: jest.fn(async () => ({ code: 'ABC123' })),
  isPending: false,
  isError: false,
  error: null,
}

const mockRoom: { query: QueryLike } = { query: loaded(roomFor('couple')) }
const mockMembers: { query: QueryLike } = { query: loaded([]) }

jest.mock('expo-router', () => ({
  // A screen under test is the one on top; the focus effect is a no-op.
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  useRoomMembers: () => mockMembers.query,
  useRoomRealtime: jest.fn(),
  // Inlined rather than pulled from the harness: a jest.mock factory is
  // hoisted, so it can only close over `mock`-prefixed bindings.
  useCreateRoomInvite: () => mockIdleMutation,
  useStartMatching: () => mockIdleMutation,
}))

// Imported after the mocks so the screen picks them up.
import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

const AUDIENCES: Audience[] = ['couple', 'group-host', 'group-guest']

/** The host-only affordance this screen must never show a member. */
const START_MATCHING = /Bắt đầu ghép|Tìm điểm chung|ghép/i

beforeEach(() => {
  mockRoom.query = loaded(roomFor('couple'))
  mockMembers.query = loaded([])
  mockPush.mockClear()
  mockReplace.mockClear()
})

describe('room hub × state', () => {
  it('renders a loading state, not room content', async () => {
    mockRoom.query = pending()
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.toJSON()).not.toBeNull()
    expect(view.queryAllByText(START_MATCHING)).toHaveLength(0)
  })

  it('renders an error state with a retry, not a blank screen', async () => {
    mockRoom.query = failed()
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.queryAllByText(/Thử lại/).length).toBeGreaterThan(0)
  })

  it('renders room content once loaded, with no retry showing', async () => {
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.toJSON()).not.toBeNull()
    expect(view.queryAllByText(/Thử lại/)).toHaveLength(0)
  })

  it('renders a different tree in each state', async () => {
    const trees = new Set<string>()
    for (const state of [pending(), failed(), loaded(roomFor('couple'))]) {
      mockRoom.query = state
      trees.add(JSON.stringify((await renderScreen(<GoGoRoomScreen />)).toJSON()))
    }
    expect(trees.size).toBe(3)
  })
})

describe('room hub × audience', () => {
  it('renders every audience without crashing', async () => {
    for (const audience of AUDIENCES) {
      mockRoom.query = loaded(roomFor(audience, {}, { everyonePicked: true }))
      expect((await renderScreen(<GoGoRoomScreen />)).toJSON()).not.toBeNull()
    }
  })

  it('gives a member a different screen than a host', async () => {
    mockRoom.query = loaded(roomFor('group-host', {}, { everyonePicked: true }))
    const host = JSON.stringify((await renderScreen(<GoGoRoomScreen />)).toJSON())

    mockRoom.query = loaded(roomFor('group-guest', {}, { everyonePicked: true }))
    const guest = JSON.stringify((await renderScreen(<GoGoRoomScreen />)).toJSON())

    expect(host).not.toEqual(guest)
  })

  it('never offers a member the host-only action to start matching', async () => {
    // Same room state as the host case — only the role differs.
    mockRoom.query = loaded(
      roomFor('group-guest', {}, { everyonePicked: true }),
    )
    expect((await renderScreen(<GoGoRoomScreen />)).queryAllByText(START_MATCHING)).toHaveLength(0)
  })

  it('offers the host that action once the room is ready', async () => {
    mockRoom.query = loaded(
      roomFor('group-host', {}, { everyonePicked: true }),
    )
    expect(
      (await renderScreen(<GoGoRoomScreen />)).queryAllByText(START_MATCHING).length,
    ).toBeGreaterThan(0)
  })
})

/**
 * APP-037 (#189) — the budget chip states the unit the room is actually in.
 * A couple room created before the fix holds a per-person amount, and calling
 * that "cho 2 người" would restate a wrong number in friendlier words.
 */
describe('room hub × budget unit', () => {
  it('says per person when that is what the API stored, even for a couple', async () => {
    const room = roomFor('couple')
    mockRoom.query = loaded({
      ...room,
      constraints: { ...room.constraints, budgetMode: 'per_person', budgetAmount: 300_000 },
    })
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText(/\/người/)).toBeTruthy()
    expect(view.queryByText(/cho 2 người/)).toBeNull()
  })

  it('phrases a couple total for two people, not as a group total', async () => {
    const room = roomFor('couple')
    mockRoom.query = loaded({
      ...room,
      constraints: { ...room.constraints, budgetMode: 'total', budgetAmount: 500_000 },
    })
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText(/cho 2 người/)).toBeTruthy()
    expect(view.queryByText(/tổng nhóm/)).toBeNull()
  })

  it('phrases a group total as a group total', async () => {
    const room = roomFor('group-host')
    mockRoom.query = loaded({
      ...room,
      constraints: { ...room.constraints, budgetMode: 'total', budgetAmount: 1_500_000 },
    })
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText(/tổng nhóm/)).toBeTruthy()
  })
})
