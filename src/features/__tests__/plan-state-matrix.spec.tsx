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
  useStartDate: () => ({ ...mockIdleMutation, start: jest.fn(async () => null) }),
}))

import DatePlanScreen from '@/features/date-plan/date-plan.view'
import { forgetRoomSteps, planStep, wasRoomStepShown } from '@/shared/navigation/room-steps'

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

describe('plan × the room it belongs to (#198)', () => {
  it("records itself for its room, so the lobby's routing never bounces back here", async () => {
    forgetRoomSteps()
    await renderScreen(<DatePlanScreen />)
    expect(wasRoomStepShown('room-1', planStep('plan-1'))).toBe(true)
  })
})
