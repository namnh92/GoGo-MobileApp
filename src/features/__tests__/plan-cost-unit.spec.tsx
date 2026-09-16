import { loaded, pending, roomFor, renderScreen, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#249 (PX-9; regression #218 I21 on the iPhone 11 Pro Max): the
 * plan screen labelled a per-person sum as a group total and divided it by the
 * people in the room, and printed "0 tổng nhóm · ~0/người" for a plan with no
 * price. Amounts now arrive scoped (GoGo-BE#593) and are rendered scoped.
 */
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
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  useRoom: () => mockRoom.query,
  useRoomRealtime: jest.fn(),
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Landmark 81', addressText: 'Bình Thạnh' }]]),
    isPending: false,
  }),
  useStartDate: () => mockIdleMutation,
  useLockPlanStop: () => mockIdleMutation,
  useRegeneratePlan: () => mockIdleMutation,
}))

import DatePlanScreen from '@/features/date-plan/date-plan.view'

function planCosting(costMin: number | null, costMax: number | null, uncertain = false) {
  return {
    id: 'plan-1',
    roomId: 'room-1',
    status: 'current',
    version: 1,
    totals: {
      costMin: costMin ?? 0,
      costMax: costMax ?? 0,
      costScope: 'per_person',
      currency: 'VND',
      durationMinutes: 90,
      overBudget: false,
      uncertain,
    },
    stops: [
      {
        id: 'stop-1',
        placeId: 'place-1',
        position: 0,
        durationMinutes: 90,
        isLocked: false,
        status: 'planned',
        costMin,
        costMax,
        costScope: 'per_person',
      },
    ],
  }
}

beforeEach(() => {
  mockRoom.query = loaded(roomFor('group-host'))
})

describe('plan cost × unit', () => {
  it('shows a group of three the per-person price and the multiplied group total (PX-9)', async () => {
    mockRoom.query = loaded(roomFor('group-host', { participantCount: 3 }))
    mockPlan.query = loaded(planCosting(250_000, 450_000))
    const view = await renderScreen(<DatePlanScreen />)

    // Amount and scope are separate texts, so the scope can wrap, not truncate.
    expect(view.getByText('450k')).toBeTruthy()
    expect(view.getByText('/người')).toBeTruthy()
    expect(view.getByText('1,4tr tổng nhóm 3 người')).toBeTruthy()
    expect(view.getByText('250k–450k/người')).toBeTruthy()
    expect(view.queryByText(/450k tổng nhóm/)).toBeNull()
    expect(view.queryByText(/150k/)).toBeNull()
  })

  it('shows a couple the total for two, not the per-person sum as that total (PX-9)', async () => {
    mockRoom.query = loaded(roomFor('couple'))
    mockPlan.query = loaded(planCosting(90_000, 180_000))
    const view = await renderScreen(<DatePlanScreen />)

    expect(view.getByText('360k')).toBeTruthy()
    expect(view.getByText('cho 2 người')).toBeTruthy()
    expect(view.queryByText('180k')).toBeNull()
    expect(view.getByText('90k–180k/người')).toBeTruthy()
  })

  it('says there is no price for a plan with none, never 0 (I21)', async () => {
    mockPlan.query = loaded(planCosting(null, null, true))
    const view = await renderScreen(<DatePlanScreen />)

    // Once for the total, once for the stop.
    expect(view.getAllByText('Chưa có thông tin giá')).toHaveLength(2)
    expect(view.queryByText(/0 tổng nhóm/)).toBeNull()
    expect(view.queryByText(/~0/)).toBeNull()
  })

  it('claims no audience while the room is still loading', async () => {
    mockRoom.query = pending()
    mockPlan.query = loaded(planCosting(250_000, 450_000))
    const view = await renderScreen(<DatePlanScreen />)

    expect(view.getByText('450k')).toBeTruthy()
    expect(view.getByText('/người')).toBeTruthy()
    expect(view.queryByText(/cho 2 người|tổng nhóm/)).toBeNull()
  })

  it('reads a plan stored before GoGo-BE#593 with an unpriced stop as a floor (uncertain: false)', async () => {
    mockRoom.query = loaded(roomFor('group-host', { participantCount: 4 }))
    const plan = planCosting(250_000, 250_000)
    plan.totals.uncertain = false
    plan.stops.push({ ...plan.stops[0], id: 'stop-2', placeId: 'place-2', position: 1, costMin: null, costMax: null })
    mockPlan.query = loaded(plan)
    const view = await renderScreen(<DatePlanScreen />)

    expect(view.getByText('từ 250k')).toBeTruthy()
    expect(view.getByText('từ 1tr tổng nhóm 4 người')).toBeTruthy()
    expect(view.getByText('Chưa có thông tin giá')).toBeTruthy()
    expect(view.queryByText(/~/)).toBeNull()
  })
})
