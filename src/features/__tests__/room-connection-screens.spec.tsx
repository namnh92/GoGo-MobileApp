import { act } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'

import { fresh as mockFresh, loaded as mockLoaded, pausedOffline, renderScreen, roomFor, type QueryLike } from './harness'

import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'
import type { RoomRealtimeStatus } from '@/shared/api'

/**
 * GoGo-MobileApp#292 — `useRoomRealtime` reported `connecting | live |
 * polling | offline`, and all six room screens threw the value away: a phone
 * that fell back to polling looked exactly like one on a live stream, while
 * changes from the other phone took tens of seconds to show.
 *
 * The status is driven straight through the hook here; the hook's own lifecycle
 * is `use-room-realtime.spec.tsx`, and the notice's timing and announcements are
 * `room-connection-notice.spec.tsx`.
 */

const POLLING = 'Phòng cập nhật định kỳ; thay đổi có thể hiển thị chậm.'
const CONNECTING = 'Đang kết nối cập nhật phòng…'
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
const FAILED = 'Chưa cập nhật được — đây là bản đã lưu trên máy.'
const OFFLINE_TITLE = 'Không có kết nối'

const ROOM_ID = '311f5bd8-f853-4ced-af68-e04398d1451a'

const mockRealtime: { status: RoomRealtimeStatus } = { status: 'live' }
const mockState: {
  room: QueryLike
  suggestions: QueryLike
  plan: QueryLike
} = { room: mockLoaded(null), suggestions: mockLoaded(null), plan: mockLoaded(null) }

const mockIdleMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({ code: 'ABC123' })),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
}

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ roomId: '311f5bd8-f853-4ced-af68-e04398d1451a', planId: 'plan-1' }),
  useNavigationContainerRef: () => ({ isReady: () => true }),
}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/shared/ui/map-canvas.view', () => ({ MapCanvas: () => null }))
jest.mock('@/features/active-date/checkin-sheet.view', () => ({ CheckinSheet: () => null }))
jest.mock('@/shared/ui/feedback', () => ({ haptic: jest.fn(), useReducedMotion: () => true }))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoomRealtime: () => ({ status: mockRealtime.status }),
  useRoom: () => mockState.room,
  useRoomMembers: () => mockLoaded([]),
  useCurrentSuggestions: () => mockState.suggestions,
  useCurrentPlan: () => mockLoaded(null),
  usePlan: () => mockState.plan,
  usePlaceDetail: () => mockLoaded(null),
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 3' }]]),
    isPending: false,
  }),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useCreateRoomInvite: () => ({ ...mockIdleMutation, stored: null, forget: jest.fn() }),
  useRoomInvites: () => ({ isPending: false, isError: false, isFetching: false, status: 'success', data: [], dataUpdatedAt: 1, refetch: jest.fn() }),
  useRevokeRoomInvite: () => mockIdleMutation,
  useStartMatching: () => mockIdleMutation,
  useFinalizeVotes: () => mockIdleMutation,
  useGenerateSuggestions: () => mockIdleMutation,
  useCastVote: () => mockIdleMutation,
  useLockPlanStop: () => mockIdleMutation,
  useRegeneratePlan: () => mockIdleMutation,
  useStartDate: () => ({ ...mockIdleMutation, start: jest.fn(async () => null) }),
  useCompletePlanStop: () => mockIdleMutation,
  useCheckinPlanStop: () => mockIdleMutation,
}))

import ActiveDateScreen from '@/features/active-date/active-date.view'
import DatePlanScreen from '@/features/date-plan/date-plan.view'
import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'
import MatchResultScreen from '@/features/matching/match-result.view'
import MatchingScreen from '@/features/matching/matching.view'
import SwipeScreen from '@/features/matching/swipe.view'

const SUGGESTIONS = {
  run: { id: 'run-1', stale: false },
  candidates: [
    { placeId: 'place-1', name: 'Place One', rank: 1 },
    { placeId: 'place-2', name: 'Place Two', rank: 2 },
  ],
  votes: { mine: {}, progress: [] },
}

const PLAN = {
  id: 'plan-1',
  roomId: ROOM_ID,
  status: 'current',
  version: 1,
  currency: 'VND',
  stops: [{ id: 'stop-1', placeId: 'place-1', order: 1, durationMinutes: 60, isLocked: false, status: 'planned' }],
}

type ScreenCase = { name: string; render: () => React.ReactElement; setup: () => void; content: RegExp }

/** Each screen with cached content on it, the way the user meets it. */
const SCREENS: ScreenCase[] = [
  {
    name: 'lobby',
    render: () => <GoGoRoomScreen />,
    setup: () => {
      mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID }))
    },
    content: /Người 1/,
  },
  {
    name: 'matching',
    render: () => <MatchingScreen />,
    setup: () => {
      mockState.room = mockLoaded(roomFor('group-guest', { id: ROOM_ID, status: 'matching', decisionMode: 'vote' } as never))
      mockState.suggestions = mockFresh(SUGGESTIONS)
    },
    content: /🎉/,
  },
  {
    name: 'swipe',
    render: () => <SwipeScreen />,
    setup: () => {
      mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'matching', decisionMode: 'vote' } as never))
      mockState.suggestions = mockFresh(SUGGESTIONS)
    },
    content: /Place One/,
  },
  {
    name: 'match result',
    render: () => <MatchResultScreen />,
    setup: () => {
      mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'matching', decisionMode: 'host' } as never))
      mockState.suggestions = mockFresh(SUGGESTIONS)
    },
    content: /Place One/,
  },
  {
    name: 'date plan',
    render: () => <DatePlanScreen />,
    setup: () => {
      mockState.plan = mockLoaded(PLAN)
      mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'ready' } as never))
    },
    content: /Quán A/,
  },
  {
    name: 'active date',
    render: () => <ActiveDateScreen />,
    setup: () => {
      mockState.plan = mockLoaded(PLAN)
      mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'active' } as never))
    },
    content: /Quán A/,
  },
]

async function goOffline() {
  await act(async () => {
    onlineManager.setOnline(false)
  })
  await act(async () => {
    jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockRealtime.status = 'live'
  mockState.room = mockLoaded(null)
  mockState.suggestions = mockLoaded(null)
  mockState.plan = mockLoaded(null)
})

afterEach(async () => {
  await act(async () => {
    onlineManager.setOnline(true)
  })
  jest.useRealTimers()
})

describe.each(SCREENS)('$name × realtime status (#292)', ({ render, setup, content }) => {
  beforeEach(setup)

  it('says updates are periodic while polling, next to the content it qualifies', async () => {
    mockRealtime.status = 'polling'
    const view = await renderScreen(render())
    expect(view.getAllByText(content).length).toBeGreaterThan(0)
    expect(view.getByText(POLLING)).toBeTruthy()
  })

  it('says nothing on a live stream', async () => {
    const view = await renderScreen(render())
    await act(async () => {
      jest.advanceTimersByTime(5_000)
    })
    expect(view.queryByText(POLLING)).toBeNull()
    expect(view.queryByText(CONNECTING)).toBeNull()
    expect(view.queryByTestId('room-connection-notice')).toBeNull()
  })

  it('says it is still connecting once that has lasted', async () => {
    mockRealtime.status = 'connecting'
    const view = await renderScreen(render())
    expect(view.queryByText(CONNECTING)).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(1_500)
    })
    expect(view.getByText(CONNECTING)).toBeTruthy()
  })

  it('shows one notice offline — the saved copy — and not the realtime one', async () => {
    mockRealtime.status = 'polling'
    const view = await renderScreen(render())
    await goOffline()
    expect(view.getAllByText(OFFLINE)).toHaveLength(1)
    expect(view.queryByText(POLLING)).toBeNull()
  })
})

describe('matching screens × nothing cached offline (#292)', () => {
  it.each([
    ['matching', () => <MatchingScreen />],
    ['match result', () => <MatchResultScreen />],
    ['swipe', () => <SwipeScreen />],
  ] as const)('%s leaves its skeleton for the offline state', async (_name, render) => {
    mockState.room = pausedOffline()
    mockState.suggestions = pausedOffline()
    mockRealtime.status = 'offline'
    await goOffline()
    const view = await renderScreen(render())
    expect(view.getByText(OFFLINE_TITLE)).toBeTruthy()
    expect(view.queryByTestId('room-connection-notice')).toBeNull()
  })
})

describe('match result × a failed refresh of cached results (#292)', () => {
  it('keeps the ranking on screen, says it is the saved copy, and outranks polling', async () => {
    mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'matching', decisionMode: 'host' } as never))
    mockState.suggestions = { ...mockFresh(SUGGESTIONS), isError: true, error: new Error('500') }
    mockRealtime.status = 'polling'
    const view = await renderScreen(<MatchResultScreen />)
    expect(view.getAllByText(/Place One/).length).toBeGreaterThan(0)
    expect(view.getByText(FAILED)).toBeTruthy()
    expect(view.getByText('Thử lại')).toBeTruthy()
    expect(view.queryByText(POLLING)).toBeNull()
  })
})

describe('swipe × a failed refresh (#327 F-01)', () => {
  it('keeps a confirmed deck on screen and offers Retry in the notice', async () => {
    mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'matching', decisionMode: 'vote' } as never))
    mockState.suggestions = { ...mockFresh(SUGGESTIONS), isError: true, error: new Error('500') }
    mockRealtime.status = 'polling'
    const view = await renderScreen(<SwipeScreen />)
    expect(view.getByText('Place One')).toBeTruthy()
    expect(view.getByText(FAILED)).toBeTruthy()
    expect(view.getByText('Thử lại')).toBeTruthy()
    expect(view.queryByText(POLLING)).toBeNull()
  })

  it('still refuses to place an unconfirmed deck, and says why instead of loading forever', async () => {
    mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: 'matching', decisionMode: 'vote' } as never))
    mockState.suggestions = { ...mockLoaded(SUGGESTIONS), dataUpdatedAt: 0, isError: true, error: new Error('500') } as QueryLike
    const view = await renderScreen(<SwipeScreen />)
    expect(view.queryByText('Place One')).toBeNull()
    expect(view.getByText('Thử lại')).toBeTruthy()
    expect(view.queryByText(FAILED)).toBeNull()
  })
})

describe('active date early returns × a failed refresh (#327 F-02)', () => {
  it.each([
    ['not active yet', 'ready', 'planned'],
    ['every stop done', 'active', 'completed'],
  ])('%s keeps the saved-copy notice and Retry', async (_name, roomStatus, stopStatus) => {
    mockState.plan = {
      ...mockLoaded({ ...PLAN, stops: [{ ...PLAN.stops[0], status: stopStatus }] }),
      isError: true,
      error: new Error('500'),
    }
    mockState.room = mockLoaded(roomFor('group-host', { id: ROOM_ID, status: roomStatus } as never))
    const view = await renderScreen(<ActiveDateScreen />)
    expect(view.getByText(FAILED)).toBeTruthy()
    expect(view.getByText('Thử lại')).toBeTruthy()
  })
})
