import { act, fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen, roomFor } from './harness'

/**
 * GoGo-MobileApp#199: an empty deck used to read "wait for everyone to pick"
 * whether there was no run, a stale run, or a finished run that found nothing.
 * Each state × role now renders its own words and only the host its actions.
 */

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockRegenerate = jest.fn()
const mockState = {
  room: roomFor('group-host', { status: 'matching', decisionMode: 'vote' }),
  suggestions: {} as Record<string, unknown>,
  /** Overrides the room query, for a room that failed to load. */
  roomQuery: null as Record<string, unknown> | null,
}

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/shared/ui/feedback', () => ({ haptic: jest.fn(), useReducedMotion: () => true }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockState.roomQuery ?? mockLoaded(mockState.room),
  useCurrentSuggestions: () => mockLoaded(mockState.suggestions),
  useCurrentPlan: () => mockLoaded(null),
  usePlaceDetail: () => mockLoaded(null),
  useRoomRealtime: jest.fn(),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useCastVote: () => ({ mutateAsync: jest.fn(), isPending: false, isError: false }),
  useFinalizeVotes: () => ({ mutateAsync: jest.fn(), reset: jest.fn(), isPending: false, isError: false, error: null }),
  useGenerateSuggestions: () => ({ mutate: (...args: unknown[]) => mockRegenerate(...args), isPending: false, isError: false, error: null }),
}))

import MatchResult from '@/features/matching/match-result.view'
import Swipe from '@/features/matching/swipe.view'

const WAITING = /Đợi mọi người chọn xong|Cần mọi người chọn xong/
const EMPTY_TITLE = 'Không tìm được địa điểm phù hợp'
const REFRESH = 'Tạo lại gợi ý'
const ADJUST = 'Chỉnh điều kiện phòng'
const RUNS = {
  none: { run: null, candidates: [], votes: { mine: {}, progress: [] } },
  stale: { run: { id: 'run-1', stale: true }, candidates: [], votes: { mine: {}, progress: [] } },
  empty: { run: { id: 'run-1', stale: false }, candidates: [], votes: { mine: {}, progress: [] } },
}
const SCREENS = [
  ['swipe', () => <Swipe />, 'Đợi mọi người chọn xong, chủ phòng sẽ bắt đầu ghép.'],
  ['match result', () => <MatchResult />, 'Cần mọi người chọn xong rồi chủ phòng bắt đầu ghép.'],
] as const

function asRole(role: 'host' | 'member', type: 'group' | 'couple' = 'group') {
  const audience = type === 'couple' ? 'couple' : role === 'host' ? 'group-host' : 'group-guest'
  mockState.room = roomFor(audience, { status: 'matching', decisionMode: 'vote', myRole: role })
}

beforeEach(() => {
  jest.clearAllMocks()
  asRole('host')
  mockState.suggestions = RUNS.none
  mockState.roomQuery = null
})

describe.each(SCREENS)('%s × run state × role', (_name, element, waitingCopy) => {
  it.each(['host', 'member'] as const)('keeps the waiting copy when there is no run (%s)', async role => {
    asRole(role)
    const view = await renderScreen(element())
    expect(view.getByText(waitingCopy)).toBeTruthy()
    expect(view.queryByText(EMPTY_TITLE)).toBeNull()
  })

  it('tells the host a finished run found nothing and offers the existing recovery', async () => {
    mockState.suggestions = RUNS.empty
    const view = await renderScreen(element())
    expect(view.getByText(EMPTY_TITLE)).toBeTruthy()
    expect(view.getByText(/Thử chỉnh điều kiện phòng rồi tạo lại gợi ý/)).toBeTruthy()
    expect(view.queryByText(WAITING)).toBeNull()

    await act(async () => { fireEvent.press(view.getByText(REFRESH)) })
    expect(mockRegenerate).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.press(view.getByText(ADJUST)) })
    expect(mockPush).toHaveBeenCalledWith('/room/room-1/manage')
  })

  it('tells a member the run found nothing and to wait for the host, with no host actions', async () => {
    asRole('member')
    mockState.suggestions = RUNS.empty
    const view = await renderScreen(element())
    expect(view.getByText(EMPTY_TITLE)).toBeTruthy()
    expect(view.getByText(/Đợi chủ phòng chỉnh điều kiện hoặc tạo lại gợi ý/)).toBeTruthy()
    expect(view.queryByText(REFRESH)).toBeNull()
    expect(view.queryByText(ADJUST)).toBeNull()
    expect(view.queryByText(WAITING)).toBeNull()
  })

  it('uses room-wide copy, not two-person copy, in a couple room', async () => {
    asRole('host', 'couple')
    mockState.suggestions = RUNS.empty
    const view = await renderScreen(element())
    const text = JSON.stringify(view.toJSON())
    expect(text).toContain(EMPTY_TITLE)
    expect(text).not.toMatch(/cả hai|hai người|người kia/i)
  })

  it('shows the host the stale copy and a refresh', async () => {
    mockState.suggestions = RUNS.stale
    const view = await renderScreen(element())
    expect(view.getByText('Gợi ý đã cũ')).toBeTruthy()
    expect(view.getByText('Sở thích hoặc điều kiện phòng vừa đổi nên gợi ý này đã cũ.')).toBeTruthy()
    expect(view.getByText(REFRESH)).toBeTruthy()
    expect(view.queryByText(ADJUST)).toBeNull()
    expect(view.queryByText(WAITING)).toBeNull()
  })

  it('tells a member a stale run waits for the host', async () => {
    asRole('member')
    mockState.suggestions = RUNS.stale
    const view = await renderScreen(element())
    expect(view.getByText('Gợi ý đã cũ')).toBeTruthy()
    expect(view.getByText('Đợi chủ phòng tạo lại gợi ý.')).toBeTruthy()
    expect(view.queryByText(REFRESH)).toBeNull()
  })
})

it('swipe: a stale run with candidates left is still stale, not a deck', async () => {
  asRole('member')
  mockState.suggestions = { ...RUNS.stale, candidates: [{ placeId: 'place-1', name: 'Place One', rank: 1 }] }
  const view = await renderScreen(<Swipe />)
  expect(view.getByText('Gợi ý đã cũ')).toBeTruthy()
  expect(view.queryByText('Place One')).toBeNull()
})

it('swipe: never falls back to member copy when the room failed to load', async () => {
  mockState.suggestions = RUNS.empty
  const refetch = jest.fn()
  mockState.roomQuery = { isPending: false, isError: true, data: undefined, error: new Error('boom'), refetch }
  const view = await renderScreen(<Swipe />)
  expect(view.queryByText(EMPTY_TITLE)).toBeNull()
  expect(view.queryByText(/Đợi chủ phòng/)).toBeNull()
  await act(async () => { fireEvent.press(view.getByText('Thử lại')) })
  expect(refetch).toHaveBeenCalled()
})

it('swipe: keeps the cached role when a room refetch fails', async () => {
  mockState.suggestions = RUNS.empty
  mockState.roomQuery = { ...mockLoaded(mockState.room), isError: true, error: new Error('boom') }
  const view = await renderScreen(<Swipe />)
  expect(view.getByText(REFRESH)).toBeTruthy()
  expect(view.getByText(ADJUST)).toBeTruthy()
})
