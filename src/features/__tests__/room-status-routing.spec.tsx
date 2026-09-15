import { router, Stack, useLocalSearchParams } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { useEffect } from 'react'
import { AccessibilityInfo, Share, Text } from 'react-native'

import { roomFor } from './harness'
import { viMessages } from '@/shared/i18n/vi'
import { planStep, resetRoomStepsForTests, runStep, useRoomStepShown } from '@/shared/navigation/room-steps'

/**
 * GoGo-MobileApp#198 — after the host started matching, voted and finalized, a
 * member's room screen stayed on the lobby for more than 99 s while the API
 * already returned the run and the plan (DEV 07c4911, Samsung A22 + iPhone 11).
 *
 * The router here is expo-router's own, so a push, Back and a replace behave as
 * they do on a phone: what is asserted is where the person actually is.
 * `renderRouter` switches to fake timers and hands back RNTL 14's pending
 * render, so the render is awaited and time is advanced by hand.
 *
 * The room, run and plan come from a store the test changes the way a poll
 * would. Every binding a jest.mock factory touches is `mock`-prefixed.
 */

type MockState = { room: unknown; suggestions: unknown; plan: unknown }
const mockStore = {
  state: { room: undefined, suggestions: undefined, plan: undefined } as MockState,
  listeners: new Set<() => void>(),
  set(patch: Partial<MockState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(listener => listener())
  },
}
const mockMounts = { matching: 0, swipe: 0, result: 0, plan: 0 }
const mockStart = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, isError: false, error: null }
const mockInvite: Record<string, unknown> = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({})),
  isPending: false,
  isError: false,
  error: null,
  data: undefined,
}
const mockRealtime = jest.fn()

// The testing library's custom matchers need jest's `expect` internals, which
// pnpm does not expose to expo-router. Nothing here uses those matchers — paths
// are read with `getPathname()` — so that one file is stubbed instead of adding
// a dependency.
jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))

jest.mock('@/shared/api', () => {
  const { useSyncExternalStore } = jest.requireActual('react')
  const useMockState = (pick: (state: MockState) => unknown) =>
    useSyncExternalStore(
      (listener: () => void) => {
        mockStore.listeners.add(listener)
        return () => mockStore.listeners.delete(listener)
      },
      () => pick(mockStore.state),
    )
  const query = (data: unknown) => ({ isPending: false, isError: false, data, error: null, refetch: jest.fn() })
  return {
    ...jest.requireActual('@/shared/api'),
    useRoom: () => query(useMockState(state => state.room)),
    // A disabled query (no id) has no data, as in TanStack Query.
    useCurrentSuggestions: (id?: string) => {
      const data = useMockState(state => state.suggestions)
      return query(id ? data : undefined)
    },
    useCurrentPlan: (id?: string) => {
      const data = useMockState(state => state.plan)
      return query(id ? data : undefined)
    },
    useRoomRealtime: (...args: unknown[]) => mockRealtime(...args),
    useCreateRoomInvite: () => mockInvite,
    useStartMatching: () => mockStart,
  }
})

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

const ROOM_ID = '311f5bd8-f853-4ced-af68-e04398d1451a'
const RUN_ID = '88c56032-0f4e-4d1a-9b7c-2e5d6f7a8b9c'
const RUN_2 = '9d2f7a41-3c6b-4e8d-a1f0-5b4c3d2e1f0a'
const PLAN_ID = 'e2ac4207-6b5a-4c3d-8e9f-0a1b2c3d4e5f'
const LOBBY = `/room/${ROOM_ID}`

// Stand-ins for the destinations. Each records the step it shows, as the real
// swipe, match-result and plan screens do.
function MatchingStub() {
  useEffect(() => { mockMounts.matching += 1 }, [])
  return <Text>matching</Text>
}
function SwipeStub() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  useRoomStepShown(roomId, runStep(RUN_ID))
  useEffect(() => { mockMounts.swipe += 1 }, [])
  return <Text>deck</Text>
}
function ResultStub() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  useRoomStepShown(roomId, runStep(RUN_ID))
  useEffect(() => { mockMounts.result += 1 }, [])
  return <Text>result</Text>
}
function PlanStub() {
  const { planId } = useLocalSearchParams<{ planId: string }>()
  useRoomStepShown(ROOM_ID, planStep(planId))
  useEffect(() => { mockMounts.plan += 1 }, [])
  return <Text>plan</Text>
}

async function renderRoom(initialUrl = LOBBY) {
  const view = renderRouter(
    {
      _layout: () => <Stack />,
      'room/[roomId]/index': GoGoRoomScreen,
      'room/[roomId]/matching': MatchingStub,
      'room/[roomId]/swipe': SwipeStub,
      'room/[roomId]/match-result': ResultStub,
      'plans/[planId]/index': PlanStub,
    },
    { initialUrl },
  )
  await view
  // The lobby's first move is deferred a tick past the navigator's mount.
  await settle()
  // Not `return view`: an async function would unwrap the pending render and
  // drop the router accessors expo-router attached to it.
  return { pathname: () => view.getPathname() }
}

type Mode = 'match' | 'vote' | 'host'

const member = (overrides: Record<string, unknown> = {}) =>
  roomFor('group-guest', { id: ROOM_ID, status: 'collecting', decisionMode: 'vote', ...overrides }, { everyonePicked: true })
const host = (overrides: Record<string, unknown> = {}, everyonePicked = true) =>
  roomFor('group-host', { id: ROOM_ID, status: 'collecting', decisionMode: 'vote', ...overrides }, { everyonePicked })

const run = (mine: Record<string, string> = {}, runId = RUN_ID, stale = false) => ({
  run: { id: runId, stale },
  candidates: [
    { placeId: 'place-1', rank: 1 },
    { placeId: 'place-2', rank: 2 },
  ],
  votes: { mine, progress: [] },
})
const plan = { id: PLAN_ID, roomId: ROOM_ID, status: 'current' }

/** Lets effects and navigation state settle. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(50)
  })
}

/** What a poll does: new facts arrive, and the screens re-render. */
async function poll(patch: Partial<MockState>) {
  await act(async () => mockStore.set(patch))
  await settle()
}

async function navigate(move: () => void) {
  await act(async () => move())
  await settle()
}

beforeEach(() => {
  resetRoomStepsForTests()
  mockStore.state = { room: undefined, suggestions: undefined, plan: undefined }
  Object.assign(mockMounts, { matching: 0, swipe: 0, result: 0, plan: 0 })
  mockStart.mutateAsync.mockReset()
  mockInvite.data = undefined
  mockRealtime.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('a member on the lobby when the host starts matching', () => {
  it.each<[Mode, Record<string, string>, string]>([
    ['vote', {}, '/swipe'],
    ['match', {}, '/swipe'],
    ['host', {}, '/match-result'],
    // A ballot already filled goes to the result, as the matching screen does.
    ['vote', { 'place-1': 'yes', 'place-2': 'no' }, '/match-result'],
  ])('%s mode, my votes %j → %s', async (mode, mine, suffix) => {
    mockStore.set({ room: member({ decisionMode: mode }) })
    const view = await renderRoom()
    expect(view.pathname()).toBe(LOBBY)

    await poll({ room: member({ decisionMode: mode, status: 'matching' }), suggestions: run(mine) })

    expect(view.pathname()).toBe(`${LOBBY}${suffix}`)
  })

  it('stays while there is nothing to decide: collecting, matching with no run, a stale run', async () => {
    mockStore.set({ room: member() })
    const view = await renderRoom()

    // The room flips to matching once everyone has picked, before the host runs it.
    await poll({ room: member({ status: 'matching' }), suggestions: { run: null, candidates: [], votes: {} } })
    await poll({ suggestions: run({}, RUN_ID, true) })

    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.swipe + mockMounts.result).toBe(0)
  })
})

describe('a member on the lobby when the host finalizes', () => {
  it.each(['ready', 'active'])('%s → the room\'s current plan', async status => {
    mockStore.set({ room: member({ status: 'matching' }) })
    const view = await renderRoom()

    await poll({ room: member({ status }), plan })

    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
    expect(mockMounts.plan).toBe(1)
  })

  it('stays when the room says ready but has no plan to open', async () => {
    mockStore.set({ room: member({ status: 'matching' }) })
    const view = await renderRoom()

    await poll({ room: member({ status: 'ready' }), plan: undefined })

    expect(view.pathname()).toBe(LOBBY)
  })
})

describe('routing once per change', () => {
  it('never pushes the same step twice, and Back or "Về phòng chờ" stay in the lobby', async () => {
    mockStore.set({ room: member() })
    const view = await renderRoom()

    await poll({ room: member({ status: 'matching' }), suggestions: run() })
    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
    // The next poll brings the same run again.
    await poll({ suggestions: run() })
    expect(mockMounts.swipe).toBe(1)

    await navigate(() => router.back())
    await poll({ suggestions: run() })
    expect(view.pathname()).toBe(LOBBY)

    // The deck's "Về phòng chờ" replaces it with a fresh lobby.
    await navigate(() => router.push(`${LOBBY}/swipe`))
    await navigate(() => router.replace(LOBBY))
    await poll({ suggestions: run() })
    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.swipe).toBe(2)
  })

  it('moves a member again when the host regenerates: a new run is a new change', async () => {
    mockStore.set({ room: member() })
    const view = await renderRoom()
    await poll({ room: member({ status: 'matching' }), suggestions: run() })
    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
    await navigate(() => router.back())

    await poll({ suggestions: run({}, RUN_2) })

    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
  })

  it('opens a room already decided on its plan, once', async () => {
    mockStore.set({ room: member({ status: 'ready' }), plan })
    const view = await renderRoom()

    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
    await navigate(() => router.back())
    await poll({ plan: { ...plan } })

    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.plan).toBe(1)
  })
})

describe('the host', () => {
  it('starts matching with one push, to the matching screen, and nothing is pushed over it', async () => {
    mockStore.set({ room: host() })
    mockStart.mutateAsync.mockImplementation(async () => {
      // What useStartMatching writes to the cache before it resolves.
      mockStore.set({ room: host({ status: 'matching' }), suggestions: run() })
      return run()
    })
    const view = await renderRoom()

    await act(async () => {
      fireEvent.press(screen.getByText(viMessages['gogoRoom.startMatching']))
    })
    await settle()

    expect(view.pathname()).toBe(`${LOBBY}/matching`)
    expect(mockStart.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mockMounts).toEqual({ matching: 1, swipe: 0, result: 0, plan: 0 })

    await navigate(() => router.back())
    await poll({ suggestions: run() })
    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.swipe + mockMounts.result).toBe(0)
  })

  it('is not sent back to the plan they finalized when they go Back to the lobby', async () => {
    mockStore.set({ room: host() })
    const view = await renderRoom()

    // match-result replaces itself with the plan after finalize.
    await navigate(() => router.push(`/plans/${PLAN_ID}`))
    await poll({ room: host({ status: 'ready' }), plan })
    await navigate(() => router.back())
    await poll({ plan: { ...plan } })

    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.plan).toBe(1)
  })

  it('is not moved out from under the share sheet; the move waits for it to close', async () => {
    let close!: () => void
    jest.spyOn(Share, 'share').mockImplementation(
      () => new Promise(resolve => { close = () => resolve({ action: 'sharedAction' }) }),
    )
    mockInvite.data = { code: 'ABC123', inviteId: 'invite-1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }
    mockStore.set({ room: host({}, false) })
    const view = await renderRoom()

    await act(async () => {
      fireEvent.press(screen.getByText(viMessages['gogoRoom.invite']))
    })
    await poll({ room: host({ status: 'ready' }, false), plan })
    expect(view.pathname()).toBe(LOBBY)

    await act(async () => close())
    await settle()
    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
  })
})

describe('the lobby opened by a plan notification that had no plan', () => {
  it('says why the room opened instead, on screen and to a screen reader', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
    mockStore.set({ room: member() })
    await renderRoom(`${LOBBY}?notice=plan_unavailable`)

    expect(screen.getByText(viMessages['gogoRoom.planUnavailable'])).toBeTruthy()
    expect(announce).toHaveBeenCalledWith(viMessages['gogoRoom.planUnavailable'])
  })
})
