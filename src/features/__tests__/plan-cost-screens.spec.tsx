import { loaded, loaded as mockLoaded, renderScreen, roomFor, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#249 — every screen that shows what a plan costs renders it
 * scoped, from the one formatter: active date, date finished, the shared result
 * and the match result (spec §36.2 wants both scopes there).
 */
const mockPlan: { query: QueryLike } = { query: loaded(null) }
const mockRoom: { query: QueryLike } = { query: loaded(null) }
const mockIdleMutation = { mutate: jest.fn(), mutateAsync: jest.fn(), reset: jest.fn(), isPending: false, isError: false, error: null }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ planId: 'plan-1', roomId: 'room-1' }),
}))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/shared/ui/map-canvas.view', () => ({ MapCanvas: () => null }))
jest.mock('@/shared/ui/feedback', () => ({ haptic: jest.fn(), useReducedMotion: () => true }))
jest.mock('@/features/active-date/checkin-sheet.view', () => ({ CheckinSheet: () => null }))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  useCurrentPlan: () => mockPlan.query,
  useRoom: () => mockRoom.query,
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([
      ['place-1', { id: 'place-1', name: 'Landmark 81', addressText: 'Bình Thạnh' }],
      ['place-2', { id: 'place-2', name: 'Quán Nước', addressText: 'Quận 1' }],
    ]),
    isPending: false,
  }),
  useCurrentSuggestions: () =>
    mockLoaded({
      run: { id: 'run-1', stale: false },
      candidates: [{ placeId: 'place-1', name: 'Landmark 81', rank: 1 }],
      votes: { mine: {}, progress: [{ placeId: 'place-1', points: 3, yes: 3 }] },
    }),
  usePlaceDetail: () => mockLoaded(null),
  useRoomRealtime: jest.fn(),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useCompletePlanStop: () => mockIdleMutation,
  useCheckinPlanStop: () => mockIdleMutation,
  useFinalizeVotes: () => mockIdleMutation,
  useGenerateSuggestions: () => mockIdleMutation,
}))

import ActiveDateScreen from '@/features/active-date/active-date.view'
import DateFinishedScreen from '@/features/active-date/date-finished.view'
import MatchResultScreen from '@/features/matching/match-result.view'
import SharedResultScreen from '@/features/review/shared-result.view'

/** A group of four: 250k–450k per person at the first stop, up to 50k at the second. */
const PLAN = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  totals: {
    costMin: 250_000,
    costMax: 500_000,
    costScope: 'per_person',
    currency: 'VND',
    durationMinutes: 150,
    overBudget: false,
    uncertain: false,
  },
  stops: [
    { id: 'stop-1', placeId: 'place-1', position: 0, durationMinutes: 90, isLocked: false, status: 'planned', costMin: 250_000, costMax: 450_000, costScope: 'per_person' },
    { id: 'stop-2', placeId: 'place-2', position: 1, durationMinutes: 60, isLocked: false, status: 'planned', costMin: 0, costMax: 50_000, costScope: 'per_person' },
  ],
}

beforeEach(() => {
  mockPlan.query = loaded(PLAN)
  mockRoom.query = loaded(roomFor('group-host', { status: 'ready' }))
})

describe('plan cost × screen', () => {
  it('active date: each stop price carries its unit, and a range from 0 is an upper bound', async () => {
    const view = await renderScreen(<ActiveDateScreen />)
    expect(view.getAllByText(/250k–450k\/người/).length).toBeGreaterThan(0)
    expect(view.getByText(/≤ 50k\/người/)).toBeTruthy()
    expect(view.queryByText(/0–50k/)).toBeNull()
  })

  it('date finished: the per-person total and the group total, never divided', async () => {
    const view = await renderScreen(<DateFinishedScreen />)
    expect(view.getByText(/500k\/người · 2tr tổng nhóm 4 người/)).toBeTruthy()
    expect(view.queryByText(/125k/)).toBeNull()
  })

  it('shared result: the amount is the value and its scope the label', async () => {
    const view = await renderScreen(<SharedResultScreen />)
    expect(view.getByText('Tổng nhóm 4 người')).toBeTruthy()
    expect(view.getByText('2tr')).toBeTruthy()
    expect(view.getByText('Mỗi người')).toBeTruthy()
    expect(view.getByText('500k')).toBeTruthy()
  })

  it('match result: both the per-person figure and the group figure (spec §36.2)', async () => {
    const view = await renderScreen(<MatchResultScreen />)
    expect(view.getByText(/500k\/người · 2tr tổng nhóm 4 người/)).toBeTruthy()
  })

  it('match result: a plan with an unpriced stop reads as a floor, even stored as certain', async () => {
    mockPlan.query = loaded({
      ...PLAN,
      totals: { ...PLAN.totals, uncertain: false },
      stops: [PLAN.stops[0], { ...PLAN.stops[1], costMin: null, costMax: null }],
    })
    const view = await renderScreen(<MatchResultScreen />)
    expect(view.getByText(/từ 500k\/người · từ 2tr tổng nhóm 4 người/)).toBeTruthy()
  })
})
