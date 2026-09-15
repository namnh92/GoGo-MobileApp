import { router, Stack, useLocalSearchParams } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { useEffect } from 'react'
import { AccessibilityInfo, Alert, AppState, Platform, Share, Text, type AlertButton } from 'react-native'

import { roomFor } from './harness'
import * as analytics from '@/shared/analytics'
import { useCurrentSuggestions } from '@/shared/api'
import { viMessages } from '@/shared/i18n/vi'
import { forgetRoomSteps, planStep, runStep, useRoomStepShown, wasRoomStepShown } from '@/shared/navigation/room-steps'

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
 * Room facts come from a store the test changes the way a poll would, each as a
 * successful read since the screen opened. What the lobby does with facts it
 * only remembers from a previous launch is room-status-cached.spec.tsx.
 * Every binding a jest.mock factory touches is `mock`-prefixed.
 */

type RoomFacts = { room?: unknown; suggestions?: unknown; plan?: unknown }
const mockStore = {
  rooms: {} as Record<string, RoomFacts>,
  listeners: new Set<() => void>(),
  set(roomId: string, patch: RoomFacts) {
    this.rooms = { ...this.rooms, [roomId]: { ...this.rooms[roomId], ...patch } }
    this.listeners.forEach(listener => listener())
  },
}
const mockMounts = { matching: 0, swipe: 0, result: 0, plan: 0 }
const mockStart = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, isError: false, error: null }
// #275 — the lobby's invite list; the code comes from the device's stored invite.
const mockInviteList: { data: unknown[] } = { data: [] }
const mockInvite: Record<string, unknown> = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({})),
  isPending: false,
  isError: false,
  error: null,
  data: undefined,
}

// The testing library's custom matchers need jest's `expect` internals, which
// pnpm does not expose to expo-router. Nothing here uses those matchers — paths
// are read with `getPathname()` — so that one file is stubbed instead of adding
// a dependency.
jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))

// #275 — the lobby reads the session status (hydration gate); the real
// provider imports native OneSignal. Same stand-in as #275's room-state-matrix spec.
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))

jest.mock('@/shared/api', () => {
  const { useSyncExternalStore } = jest.requireActual('react')
  const useFacts = (roomId: string | undefined, pick: (facts: RoomFacts) => unknown) =>
    useSyncExternalStore(
      (listener: () => void) => {
        mockStore.listeners.add(listener)
        return () => mockStore.listeners.delete(listener)
      },
      () => (roomId ? pick(mockStore.rooms[roomId] ?? {}) : undefined),
    )
  // A disabled query (no id) has no data; anything else here was just read.
  const query = (data: unknown) => ({
    isPending: false,
    isError: false,
    isSuccess: data !== undefined,
    dataUpdatedAt: data !== undefined ? Date.now() : 0,
    data,
    error: null,
    refetch: jest.fn(),
  })
  return {
    ...jest.requireActual('@/shared/api'),
    useRoom: (id?: string) => query(useFacts(id, facts => facts.room)),
    useCurrentSuggestions: (id?: string) => query(useFacts(id, facts => facts.suggestions)),
    useCurrentPlan: (id?: string) => query(useFacts(id, facts => facts.plan)),
    useRoomRealtime: () => ({ status: 'polling' }),
    useCreateRoomInvite: () => mockInvite,
    // #275 — the lobby lists and can re-issue invites.
    useRoomInvites: () => ({
      ...query(mockInviteList.data),
      isFetching: false,
      isPaused: false,
      status: 'success',
      dataUpdatedAt: 2,
      refetch: jest.fn(async () => ({ status: 'success', data: mockInviteList.data })),
    }),
    useRevokeRoomInvite: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), reset: jest.fn(), isPending: false, isError: false, error: null }),
    useStartMatching: () => mockStart,
  }
})

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

const ROOM_ID = '311f5bd8-f853-4ced-af68-e04398d1451a'
const ROOM_B = '7c2e4a1b-5d6f-4a8b-9c0d-1e2f3a4b5c6d'
const RUN_ID = '88c56032-0f4e-4d1a-9b7c-2e5d6f7a8b9c'
const RUN_2 = '9d2f7a41-3c6b-4e8d-a1f0-5b4c3d2e1f0a'
const PLAN_ID = 'e2ac4207-6b5a-4c3d-8e9f-0a1b2c3d4e5f'
const LOBBY = `/room/${ROOM_ID}`

// Stand-ins for the destinations. Each records the step it shows the way the
// real deck, result and plan screens do: from what it actually read.
function MatchingStub() {
  useEffect(() => { mockMounts.matching += 1 }, [])
  return <Text>matching</Text>
}
function useRecordRun(): void {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const runId = useCurrentSuggestions(roomId).data?.run?.id
  useRoomStepShown(roomId, runId ? runStep(runId) : null)
}
function SwipeStub() {
  useRecordRun()
  useEffect(() => { mockMounts.swipe += 1 }, [])
  return <Text>deck</Text>
}
function ResultStub() {
  useRecordRun()
  useEffect(() => { mockMounts.result += 1 }, [])
  return <Text>result</Text>
}
function PlanStub() {
  const { planId } = useLocalSearchParams<{ planId: string }>()
  const roomId = Object.entries(mockStore.rooms).find(([, facts]) => (facts.plan as { id?: string } | undefined)?.id === planId)?.[0]
  useRoomStepShown(roomId, planStep(planId))
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
  // The lobby waits for the navigator before its first move.
  await settle()
  // Not `return view`: an async function would unwrap the pending render and
  // drop the router accessors expo-router attached to it.
  return { pathname: () => view.getPathname() }
}

type Mode = 'match' | 'vote' | 'host'

const member = (overrides: Record<string, unknown> = {}, id = ROOM_ID) =>
  roomFor('group-guest', { id, status: 'collecting', decisionMode: 'vote', ...overrides }, { everyonePicked: true })
const host = (overrides: Record<string, unknown> = {}, everyonePicked = true) =>
  roomFor('group-host', { id: ROOM_ID, status: 'collecting', decisionMode: 'vote', ...overrides }, { everyonePicked })

const run = (mine: Record<string, string> = {}, runId = RUN_ID, stale = false, candidates = 2) => ({
  run: { id: runId, stale },
  candidates: [
    { placeId: 'place-1', rank: 1 },
    { placeId: 'place-2', rank: 2 },
  ].slice(0, candidates),
  votes: { mine, progress: [] },
})
const plan = { id: PLAN_ID, roomId: ROOM_ID, status: 'current' }

/** Lets effects and navigation settle. */
async function settle(ms = 50) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** What a poll does: new facts arrive, and the screens re-render. */
async function poll(patch: RoomFacts, roomId = ROOM_ID) {
  await act(async () => mockStore.set(roomId, patch))
  await settle()
}

async function navigate(move: () => void) {
  await act(async () => move())
  await settle()
}

beforeEach(() => {
  forgetRoomSteps()
  mockStore.rooms = {}
  Object.assign(mockMounts, { matching: 0, swipe: 0, result: 0, plan: 0 })
  mockStart.mutateAsync.mockReset()
  mockInvite.data = undefined
  mockInvite.stored = undefined
  mockInviteList.data = []
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
    mockStore.set(ROOM_ID, { room: member({ decisionMode: mode }) })
    const view = await renderRoom()
    expect(view.pathname()).toBe(LOBBY)

    await poll({ room: member({ decisionMode: mode, status: 'matching' }), suggestions: run(mine) })

    expect(view.pathname()).toBe(`${LOBBY}${suffix}`)
  })

  it.each<[Mode, string]>([
    ['vote', '/swipe'],
    ['host', '/match-result'],
  ])('a run that found nothing still goes to the %s decision screen (%s), which owns the empty state', async (mode, suffix) => {
    mockStore.set(ROOM_ID, { room: member({ decisionMode: mode }) })
    const view = await renderRoom()

    await poll({ room: member({ decisionMode: mode, status: 'matching' }), suggestions: run({}, RUN_ID, false, 0) })

    expect(view.pathname()).toBe(`${LOBBY}${suffix}`)
  })

  it('stays while there is nothing to decide: collecting, matching with no run, a stale run', async () => {
    mockStore.set(ROOM_ID, { room: member() })
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
    mockStore.set(ROOM_ID, { room: member({ status: 'matching' }) })
    const view = await renderRoom()

    await poll({ room: member({ status }), plan })

    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
    expect(mockMounts.plan).toBe(1)
  })

  it('stays when the room says ready but has no plan to open', async () => {
    mockStore.set(ROOM_ID, { room: member({ status: 'matching' }) })
    const view = await renderRoom()

    await poll({ room: member({ status: 'ready' }), plan: undefined })

    expect(view.pathname()).toBe(LOBBY)
  })
})

describe('routing once per change', () => {
  it('never pushes the same step twice, and Back or "Về phòng chờ" stay in the lobby', async () => {
    mockStore.set(ROOM_ID, { room: member() })
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

  it('moves a member again when the host regenerates, and the deck records the new run', async () => {
    mockStore.set(ROOM_ID, { room: member() })
    const view = await renderRoom()
    await poll({ room: member({ status: 'matching' }), suggestions: run() })
    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
    await navigate(() => router.back())

    await poll({ suggestions: run({}, RUN_2) })

    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
    expect(wasRoomStepShown(ROOM_ID, runStep(RUN_2))).toBe(true)
  })

  it('matching → collecting → a new run moves a member again', async () => {
    mockStore.set(ROOM_ID, { room: member() })
    const view = await renderRoom()
    await poll({ room: member({ status: 'matching' }), suggestions: run() })
    await navigate(() => router.back())

    // The host revised the constraints: the room collects again.
    await poll({ room: member({ status: 'collecting' }) })
    expect(view.pathname()).toBe(LOBBY)

    await poll({ room: member({ status: 'matching' }), suggestions: run({}, RUN_2) })
    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
    expect(mockMounts.swipe).toBe(2)
  })

  it('opens a room already decided on its plan, once', async () => {
    mockStore.set(ROOM_ID, { room: member({ status: 'ready' }), plan })
    const view = await renderRoom()

    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
    await navigate(() => router.back())
    await poll({ plan: { ...plan } })

    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.plan).toBe(1)
  })

  it('keeps each room\'s steps apart', async () => {
    mockStore.set(ROOM_ID, { room: member({ status: 'matching' }), suggestions: run() })
    mockStore.set(ROOM_B, { room: member({ status: 'matching' }, ROOM_B), suggestions: run() })
    const view = await renderRoom()
    expect(view.pathname()).toBe(`${LOBBY}/swipe`)

    // The same run id in another room is another room's change.
    await navigate(() => router.push(`/room/${ROOM_B}`))

    expect(view.pathname()).toBe(`/room/${ROOM_B}/swipe`)
    expect(wasRoomStepShown(ROOM_B, runStep(RUN_ID))).toBe(true)
  })
})

describe('when a push keeps failing', () => {
  it('gives up after a bounded number of tries, reports it without ids, and tries again once the lobby is shown again', async () => {
    const track = jest.spyOn(analytics, 'track')
    mockStore.set(ROOM_ID, { room: member() })
    const view = await renderRoom()
    const push = jest.spyOn(router, 'push').mockImplementation(() => {
      throw new Error('navigator busy')
    })

    await poll({ room: member({ status: 'matching' }), suggestions: run() })
    for (let i = 0; i < 30; i += 1) await settle()
    const tries = push.mock.calls.length
    for (let i = 0; i < 5; i += 1) await settle()

    expect(tries).toBeGreaterThan(1)
    expect(tries).toBeLessThanOrEqual(21)
    expect(push.mock.calls.length).toBe(tries)
    expect(view.pathname()).toBe(LOBBY)
    expect(track.mock.calls.filter(([event]) => event === 'room_route_gave_up')).toEqual([
      ['room_route_gave_up', { destination: 'decision', reason: 'push_failed' }],
    ])

    push.mockRestore()
    await navigate(() => router.push(`${LOBBY}/matching`))
    await navigate(() => router.back())

    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
  })
})

describe('the host', () => {
  it('starts matching with one push, to the matching screen, and nothing is pushed over it', async () => {
    mockStore.set(ROOM_ID, { room: host() })
    mockStart.mutateAsync.mockImplementation(async () => {
      // What useStartMatching writes to the cache before it resolves.
      mockStore.set(ROOM_ID, { room: host({ status: 'matching' }), suggestions: run() })
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

  it('is taken to the run once when the start failed on the phone after the server made it', async () => {
    mockStore.set(ROOM_ID, { room: host() })
    mockStart.mutateAsync.mockImplementation(async () => {
      // The run is read while the generate response is still out; then that
      // response is lost.
      mockStore.set(ROOM_ID, { room: host({ status: 'matching' }), suggestions: run() })
      await new Promise(resolve => setTimeout(resolve, 200))
      throw new Error('response lost')
    })
    const view = await renderRoom()

    await act(async () => {
      fireEvent.press(screen.getByText(viMessages['gogoRoom.startMatching']))
    })
    await settle()
    // Mid-start, the lobby leaves the host alone.
    expect(view.pathname()).toBe(LOBBY)
    await settle(200)
    await settle()

    expect(view.pathname()).toBe(`${LOBBY}/swipe`)
    expect(mockMounts).toEqual({ matching: 0, swipe: 1, result: 0, plan: 0 })
  })

  it('is not sent back to the plan they finalized when they go Back to the lobby', async () => {
    mockStore.set(ROOM_ID, { room: host() })
    const view = await renderRoom()

    // match-result replaces itself with the plan after finalize.
    await poll({ plan })
    await navigate(() => router.push(`/plans/${PLAN_ID}`))
    await poll({ room: host({ status: 'ready' }), plan })
    await navigate(() => router.back())
    await poll({ plan: { ...plan } })

    expect(view.pathname()).toBe(LOBBY)
    expect(mockMounts.plan).toBe(1)
  })

  it('is not moved out from under the iOS share sheet; the move waits for it to close', async () => {
    let close!: () => void
    jest.spyOn(Share, 'share').mockImplementation(
      () => new Promise(resolve => { close = () => resolve({ action: 'sharedAction' }) }),
    )
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
    mockInvite.data = { code: 'ABC123', inviteId: 'invite-1', expiresAt }
    // #275 — the shown code is the stored invite, confirmed by a current list.
    mockInvite.stored = { roomId: ROOM_ID, inviteId: 'invite-1', code: 'ABC123', expiresAt, userId: 'me', savedAt: 1 }
    mockInviteList.data = [{ inviteId: 'invite-1', expiresAt, revoked: false, useCount: 0, maxUses: 20 }]
    mockStore.set(ROOM_ID, { room: host({}, false) })
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

  it('on Android, keeps holding after the share call resolves while the chooser may still be up', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    // React Native's jest mock leaves `currentState` a jest.fn; a phone reports a status.
    const appState = AppState as unknown as { currentState: unknown }
    const mockedState = appState.currentState
    appState.currentState = 'active'
    try {
      jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
      const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
      mockInvite.data = { code: 'ABC123', inviteId: 'invite-1', expiresAt }
      // #275 — the shared code is the stored invite, confirmed by a current list.
      mockInvite.stored = { roomId: ROOM_ID, inviteId: 'invite-1', code: 'ABC123', expiresAt, userId: 'me', savedAt: 1 }
      mockInviteList.data = [{ inviteId: 'invite-1', expiresAt, revoked: false, useCount: 0, maxUses: 20 }]
      mockStore.set(ROOM_ID, { room: host({}, false) })
      const view = await renderRoom()

      await act(async () => {
        fireEvent.press(screen.getByText(viMessages['gogoRoom.invite']))
      })
      await poll({ room: host({ status: 'ready' }, false), plan })
      // The module already resolved; the chooser is another activity.
      expect(view.pathname()).toBe(LOBBY)

      // The app never left the foreground: the chooser did not open. A grace ends the hold.
      await settle(3_000)
      await settle()
      expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
    } finally {
      appState.currentState = mockedState
    }
  })

  it('is not moved while the partial-start confirmation is open', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    mockStore.set(ROOM_ID, {
      room: host({ matching: { canStart: false, canStartWithIncomplete: true, pendingCount: 1 } }, false),
    })
    const view = await renderRoom()

    await act(async () => {
      fireEvent.press(screen.getByText(viMessages['gogoRoom.partialContinue']))
    })
    await poll({ room: host({ status: 'ready' }, false), plan })
    expect(view.pathname()).toBe(LOBBY)

    const buttons = alert.mock.calls[0][2] as AlertButton[]
    await act(async () => buttons[0].onPress?.())
    await settle()
    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
  })
})

describe('the lobby opened by a plan notification that had no plan', () => {
  it.each([
    ['plan_unavailable', 'gogoRoom.planUnavailable'],
    ['plan_retry', 'gogoRoom.planRetry'],
  ] as const)('notice=%s says why, on screen and to a screen reader', async (notice, key) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
    mockStore.set(ROOM_ID, { room: member() })
    await renderRoom(`${LOBBY}?notice=${notice}`)

    expect(screen.getByText(viMessages[key])).toBeTruthy()
    expect(announce).toHaveBeenCalledWith(viMessages[key])
  })

  it('drops the notice once the plan is known', async () => {
    mockStore.set(ROOM_ID, { room: member({ status: 'matching' }) })
    const view = await renderRoom(`${LOBBY}?notice=plan_retry`)
    expect(screen.getByText(viMessages['gogoRoom.planRetry'])).toBeTruthy()

    await poll({ room: member({ status: 'ready' }), plan })
    expect(view.pathname()).toBe(`/plans/${PLAN_ID}`)
    await navigate(() => router.back())

    expect(view.pathname()).toBe(LOBBY)
    expect(screen.queryByText(viMessages['gogoRoom.planRetry'])).toBeNull()
  })
})
