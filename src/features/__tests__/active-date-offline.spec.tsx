import { act } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'

import { loaded, pausedOffline, renderScreen, type QueryLike } from './harness'

import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

/**
 * GoGo-MobileApp#253 — the active date is where a flaky connection is most
 * likely (Mobile CLAUDE.md: the current plan is cached for it). The cached plan
 * stays usable offline, and the screen says it is the saved copy.
 */
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'

const mockPlan: { query: QueryLike } = { query: loaded(null) }
const mockIdleMutation = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, isError: false, error: null }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 3' }]]),
    isPending: false,
  }),
  useCompletePlanStop: () => mockIdleMutation,
  useCheckinPlanStop: () => mockIdleMutation,
}))
jest.mock('@/shared/ui/map-canvas.view', () => ({ MapCanvas: () => null }))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/features/active-date/checkin-sheet.view', () => ({ CheckinSheet: () => null }))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))

import ActiveDateScreen from '@/features/active-date/active-date.view'

const PLAN = {
  id: 'plan-1',
  roomId: 'room-1',
  status: 'current',
  version: 1,
  totals: { costMin: 0, costMax: 0, currency: 'VND', durationMinutes: 60, travelDistanceM: 0, overBudget: false, uncertain: false },
  stops: [{ id: 'stop-1', placeId: 'place-1', position: 0, durationMinutes: 60, isLocked: false, status: 'planned' }],
}

beforeEach(() => {
  jest.useFakeTimers()
  mockPlan.query = loaded(PLAN)
})

afterEach(async () => {
  await act(async () => {
    onlineManager.setOnline(true)
  })
  jest.useRealTimers()
})

describe('active date × connectivity', () => {
  it('keeps the cached plan on screen offline and says it is the saved copy', async () => {
    onlineManager.setOnline(false)
    const view = await renderScreen(<ActiveDateScreen />)
    await act(async () => {
      jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
    })
    expect(view.queryAllByText('Quán A').length).toBeGreaterThan(0)
    expect(view.getByText(OFFLINE)).toBeTruthy()

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(OFFLINE)).toBeNull()
    expect(view.queryAllByText('Quán A').length).toBeGreaterThan(0)
  })

  it('says nothing about a fresh plan online', async () => {
    const view = await renderScreen(<ActiveDateScreen />)
    expect(view.queryByText(/bản đã lưu trên máy/)).toBeNull()
  })

  it('shows the offline state instead of an endless skeleton when nothing is cached, and keeps loading online', async () => {
    const NO_CONNECTION = 'Không có kết nối'
    mockPlan.query = pausedOffline()
    const view = await renderScreen(<ActiveDateScreen />)
    await act(async () => {
      jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
    })
    // Paused while online means the app was only in the background: still loading.
    expect(view.queryByText(NO_CONNECTION)).toBeNull()

    await act(async () => {
      onlineManager.setOnline(false)
      jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
    })
    expect(view.getByText(NO_CONNECTION)).toBeTruthy()
    expect(view.queryAllByText('Quán A')).toHaveLength(0)
    expect(view.queryByText('Thử lại')).toBeNull()

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(NO_CONNECTION)).toBeNull()
  })
})
