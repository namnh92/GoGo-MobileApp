import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { loaded, renderScreen, roomFor, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#334 — a place with an approved photo shows it on the match
 * result, the plan and the active date, as it already does on the swipe card;
 * a place without one keeps the pin fallback. Every screen reads the detail it
 * already loads, so the photo costs no extra request.
 */
const PHOTO_1 = 'https://assets.example/places/place-1.jpg'

const mockPlan: { query: QueryLike } = { query: loaded(null) }
const mockRoom: { query: QueryLike } = { query: loaded(null) }
const mockDetail: { query: QueryLike } = { query: loaded(null) }
const mockIdleMutation = { mutate: jest.fn(), mutateAsync: jest.fn(), reset: jest.fn(), isPending: false, isError: false, error: null }
const mockPhotos: { placeId: string; uri: string | null }[] = []

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ planId: 'plan-1', roomId: 'room-1' }),
}))
jest.mock('@/shared/ui/place-photo.view', () => ({
  PlacePhoto: (props: { placeId: string; uri?: string | null }) => {
    mockPhotos.push({ placeId: props.placeId, uri: props.uri ?? null })
    return null
  },
}))
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
      ['place-1', { id: 'place-1', name: 'Tràng Tiền Plaza', addressText: 'Hoàn Kiếm', photoUrl: PHOTO_1 }],
      ['place-2', { id: 'place-2', name: 'Quán Nước', addressText: 'Quận 1', photoUrl: null }],
    ]),
    isPending: false,
  }),
  useCurrentSuggestions: () =>
    jest.requireActual('./harness').loaded({
      run: { id: 'run-1', stale: false },
      candidates: [{ placeId: 'place-1', name: 'Tràng Tiền Plaza', rank: 1 }],
      votes: { mine: {}, progress: [{ placeId: 'place-1', points: 3, yes: 3 }] },
    }),
  usePlaceDetail: () => mockDetail.query,
  useRoomRealtime: jest.fn(() => ({ status: 'live' })),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useCompletePlanStop: () => mockIdleMutation,
  useCheckinPlanStop: () => mockIdleMutation,
  useFinalizeVotes: () => mockIdleMutation,
  useGenerateSuggestions: () => mockIdleMutation,
  useLockPlanStop: () => mockIdleMutation,
  useRegeneratePlan: () => mockIdleMutation,
  useStartDate: () => mockIdleMutation,
}))

import ActiveDateScreen from '@/features/active-date/active-date.view'
import DatePlanScreen from '@/features/date-plan/date-plan.view'
import MatchResultScreen from '@/features/matching/match-result.view'

const PLAN = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  totals: { costMin: 0, costMax: 0, costScope: 'per_person', currency: 'VND', durationMinutes: 180, overBudget: false, uncertain: true },
  stops: [
    { id: 'stop-1', placeId: 'place-1', position: 0, durationMinutes: 90, isLocked: true, status: 'planned', costMin: null, costMax: null, costScope: 'per_person' },
    { id: 'stop-2', placeId: 'place-2', position: 1, durationMinutes: 90, isLocked: false, status: 'planned', costMin: null, costMax: null, costScope: 'per_person' },
  ],
}

const withCache = (element: ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{element}</QueryClientProvider>
)
const photoFor = (placeId: string) => mockPhotos.filter(photo => photo.placeId === placeId).at(-1)?.uri

beforeEach(() => {
  mockPhotos.length = 0
  mockPlan.query = loaded(PLAN)
  mockRoom.query = loaded(roomFor('group-host', { status: 'ready' }))
  mockDetail.query = loaded(null)
})

describe('place photo × screen', () => {
  it('match result: the winner shows its photo', async () => {
    mockDetail.query = loaded({ id: 'place-1', name: 'Tràng Tiền Plaza', photos: [{ id: 'm-1', url: PHOTO_1, source: 'manual' }] })
    await renderScreen(<MatchResultScreen />)
    expect(photoFor('place-1')).toBe(PHOTO_1)
  })

  it('match result: a winner without a photo keeps the fallback', async () => {
    mockDetail.query = loaded({ id: 'place-1', name: 'Tràng Tiền Plaza', photos: [] })
    await renderScreen(<MatchResultScreen />)
    expect(photoFor('place-1')).toBeNull()
  })

  it('plan: each stop shows its own photo, or the fallback when it has none', async () => {
    await renderScreen(withCache(<DatePlanScreen />))
    expect(photoFor('place-1')).toBe(PHOTO_1)
    expect(photoFor('place-2')).toBeNull()
  })

  it('active date: the stop in progress shows its photo', async () => {
    mockRoom.query = loaded(roomFor('group-host', { status: 'active' }))
    await renderScreen(withCache(<ActiveDateScreen />))
    expect(photoFor('place-1')).toBe(PHOTO_1)
  })

  it('active date: a stop without a photo keeps the fallback', async () => {
    mockRoom.query = loaded(roomFor('group-host', { status: 'active' }))
    mockPlan.query = loaded({ ...PLAN, stops: [{ ...PLAN.stops[0], status: 'completed' }, PLAN.stops[1]] })
    await renderScreen(withCache(<ActiveDateScreen />))
    expect(photoFor('place-2')).toBeNull()
  })
})
