import { failed, loaded, pending, roomFor, renderScreen, type Audience, type QueryLike } from './harness'

/**
 * The plan screen is where two release-gate rules become visible: a member must
 * never get the host's regenerate action, and a plan the server has replaced
 * must say so instead of silently accepting edits that will 409.
 */

const mockReplace = jest.fn()

const mockIdleMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({ id: 'plan-2', stops: [] })),
  isPending: false,
  isError: false,
  error: null,
}

const mockPlan: { query: QueryLike } = { query: loaded(null) }
const mockRoom: { query: QueryLike } = { query: loaded(roomFor('group-host')) }

jest.mock('expo-router', () => ({
  // A screen under test is the one on top; the focus effect is a no-op.
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  useRoom: () => mockRoom.query,
  useRoomRealtime: jest.fn(),
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 3' }]]),
    isPending: false,
  }),
  useLockPlanStop: () => mockIdleMutation,
  useRegeneratePlan: () => mockIdleMutation,
}))

import DatePlanScreen from '@/features/date-plan/date-plan.view'

function planWith(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    roomId: 'room-1',
    status: 'current',
    version: 1,
    currency: 'VND',
    stops: [
      {
        id: 'stop-1',
        placeId: 'place-1',
        order: 1,
        durationMinutes: 60,
        isLocked: false,
        status: 'planned',
      },
    ],
    ...overrides,
  }
}

const REGENERATE = /Tạo lại kế hoạch/
const SUPERSEDED = /đã bị thay bằng bản mới/

beforeEach(() => {
  mockPlan.query = loaded(planWith())
  mockRoom.query = loaded(roomFor('group-host'))
  mockReplace.mockClear()
})

describe('plan × state', () => {
  it('renders loading, error and loaded as three different screens', async () => {
    const trees = new Set<string>()
    for (const state of [pending(), failed(), loaded(planWith())]) {
      mockPlan.query = state
      trees.add(JSON.stringify((await renderScreen(<DatePlanScreen />)).toJSON()))
    }
    expect(trees.size).toBe(3)
  })

  it('offers a retry when the plan fails to load', async () => {
    mockPlan.query = failed()
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.queryAllByText(/Thử lại/).length).toBeGreaterThan(0)
  })

  it('warns when the plan has been superseded', async () => {
    mockPlan.query = loaded(planWith({ status: 'superseded' }))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.queryAllByText(SUPERSEDED).length).toBeGreaterThan(0)
  })

  it('stays quiet about supersession on a current plan', async () => {
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.queryAllByText(SUPERSEDED)).toHaveLength(0)
  })
})

describe('plan × audience', () => {
  const AUDIENCES: Audience[] = ['couple', 'group-host', 'group-guest']

  it('renders every audience', async () => {
    for (const audience of AUDIENCES) {
      mockRoom.query = loaded(roomFor(audience))
      expect((await renderScreen(<DatePlanScreen />)).toJSON()).not.toBeNull()
    }
  })

  it('offers regenerate to the host', async () => {
    mockRoom.query = loaded(roomFor('group-host'))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.queryAllByText(REGENERATE).length).toBeGreaterThan(0)
  })

  it('never offers regenerate to a member', async () => {
    mockRoom.query = loaded(roomFor('group-guest'))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.queryAllByText(REGENERATE)).toHaveLength(0)
  })
})

/**
 * #254, RULE-CORE-003 — the title said "Date tối nay" for every plan, a group
 * room's included. It now comes from the room's audience and when the plan
 * starts.
 */
describe('plan title × room facts', () => {
  const pad = (value: number) => String(value).padStart(2, '0')

  /** Noon keeps the day stable wherever in the day the suite runs. */
  function noonIn(days: number): Date {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() + days)
    return date
  }

  function planStarting(at: Date) {
    const [stop] = planWith().stops
    return planWith({ stops: [{ ...stop, arriveAt: at.toISOString() }] })
  }

  it('titles a couple plan for today', async () => {
    mockRoom.query = loaded(roomFor('couple'))
    mockPlan.query = loaded(planStarting(noonIn(0)))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.getByText('Date · hôm nay 12:00')).toBeTruthy()
  })

  it('titles a group plan by its size, for host and member alike', async () => {
    mockPlan.query = loaded(planStarting(noonIn(0)))
    for (const audience of ['group-host', 'group-guest'] as const) {
      mockRoom.query = loaded(roomFor(audience))
      const view = await renderScreen(<DatePlanScreen />)
      expect(view.getByText('Nhóm 4 người · hôm nay 12:00')).toBeTruthy()
      expect(view.queryByText(/^Date/)).toBeNull()
    }
  })

  it('says tomorrow for the next day', async () => {
    mockRoom.query = loaded(roomFor('couple'))
    mockPlan.query = loaded(planStarting(noonIn(1)))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.getByText('Date · ngày mai 12:00')).toBeTruthy()
  })

  it('names another day by its date', async () => {
    const start = noonIn(3)
    mockRoom.query = loaded(roomFor('group-host', { participantCount: 6 }))
    mockPlan.query = loaded(planStarting(start))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.getByText(`Nhóm 6 người · ${pad(start.getDate())}/${pad(start.getMonth() + 1)} 12:00`)).toBeTruthy()
    expect(view.queryByText(/hôm nay/)).toBeNull()
  })

  it('uses the room schedule when the stops carry no time', async () => {
    const start = noonIn(0)
    mockRoom.query = loaded(
      roomFor('couple', {
        constraints: { budgetMode: 'total', budgetAmount: 300_000, currency: 'VND', startAt: start.toISOString() },
      } as never),
    )
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.getByText('Date · hôm nay 12:00')).toBeTruthy()
  })

  it('drops the date, not the audience, when nothing carries one', async () => {
    mockRoom.query = loaded(roomFor('group-host'))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.getByText('Kế hoạch nhóm 4 người')).toBeTruthy()
  })

  it('stays neutral until the room is known', async () => {
    mockRoom.query = pending()
    mockPlan.query = loaded(planStarting(noonIn(0)))
    const view = await renderScreen(<DatePlanScreen />)
    expect(view.getByText('Kế hoạch')).toBeTruthy()
  })

  it('never claims tonight', async () => {
    mockPlan.query = loaded(planStarting(noonIn(0)))
    for (const audience of ['couple', 'group-host', 'group-guest'] as const) {
      mockRoom.query = loaded(roomFor(audience))
      const view = await renderScreen(<DatePlanScreen />)
      expect(view.queryByText(/tối nay/)).toBeNull()
    }
  })
})
