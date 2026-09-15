import { dehydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client'
import { Stack, useLocalSearchParams } from 'expo-router'
import { act, renderRouter } from 'expo-router/testing-library'
import { useEffect, type ReactNode } from 'react'
import { Text } from 'react-native'

import { roomFor } from './harness'
import { queryKeys, type RoomStatus } from '@/shared/api'
import { forgetRoomSteps } from '@/shared/navigation/room-steps'

/**
 * GoGo-MobileApp#198 review — the query cache is persisted for a day. A room
 * that moved on while the app was closed comes back as it was: still
 * `matching` with a run whose votes now 409 `ROOM_NOT_MATCHING`, or `ready`
 * with a plan that has since been replaced. The lobby must move no one on what
 * it only remembers.
 *
 * On a cold start from a link the app renders the lobby while
 * `PersistQueryClientProvider` is still restoring; the restore then copies the
 * old read's `dataUpdateCount` into the query the lobby already observes, which
 * made that hour-old room look "fetched after mount". Freshness is judged by
 * the clock instead.
 *
 * Real hooks and a real QueryClient; only the endpoints are faked, and each
 * answers when the test says so.
 */

jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))
// #275 — the lobby reads the session status; the real provider imports native OneSignal.
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))

const mockGetRoom = jest.fn()
const mockGetSuggestions = jest.fn()
const mockGetCurrentPlan = jest.fn()
const mockOpened: string[] = []

jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  getRoom: (...args: unknown[]) => mockGetRoom(...args),
}))
jest.mock('@/shared/api/endpoints/suggestions', () => ({
  ...jest.requireActual('@/shared/api/endpoints/suggestions'),
  getCurrentSuggestions: (...args: unknown[]) => mockGetSuggestions(...args),
}))
jest.mock('@/shared/api/endpoints/plans', () => ({
  ...jest.requireActual('@/shared/api/endpoints/plans'),
  getCurrentPlan: (...args: unknown[]) => mockGetCurrentPlan(...args),
}))
// Freshness is the transport's business; this spec answers the reads by hand.
jest.mock('@/shared/api/queries/use-room-realtime', () => ({ useRoomRealtime: () => ({ status: 'polling' }) }))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

const ROOM_ID = '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f'
const RUN_ID = '88c56032-0f4e-4d1a-9b7c-2e5d6f7a8b9c'
const PLAN_OLD = 'c172a3df-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const PLAN_NEW = '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const LOBBY = `/room/${ROOM_ID}`
const HOUR = 60 * 60 * 1000

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

const member = (status: RoomStatus) =>
  roomFor('group-guest', { id: ROOM_ID, status, decisionMode: 'vote' }, { everyonePicked: true })
const run = { run: { id: RUN_ID, stale: false }, candidates: [{ placeId: 'place-1', rank: 1 }], votes: { mine: {}, progress: [] } }
const planNew = { id: PLAN_NEW, roomId: ROOM_ID, status: 'current' }

function DestinationStub({ label }: { label: string }) {
  const params = useLocalSearchParams()
  useEffect(() => { mockOpened.push(`${label}:${String(params.planId ?? params.roomId)}`) }, [label, params.planId, params.roomId])
  return <Text>{label}</Text>
}

let client: QueryClient

/** The app's query defaults (query-client.ts), without retries so a failure shows at once. */
function appClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 24 * HOUR, retry: false } } })
}

/** What was saved to disk an hour ago. */
function savedCache(entries: [readonly unknown[], unknown][]): PersistedClient {
  const previousLaunch = appClient()
  for (const [key, data] of entries) previousLaunch.setQueryData(key, data, { updatedAt: Date.now() - HOUR })
  return { timestamp: Date.now(), buster: '', clientState: dehydrate(previousLaunch) }
}

/** A disk read that finishes when the test says: after the lobby has mounted. */
function slowDisk(restored: Promise<PersistedClient | undefined>): Persister {
  return {
    persistClient: async () => undefined,
    restoreClient: () => restored,
    removeClient: async () => undefined,
  }
}

async function settle(times = 1) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50)
    })
  }
}

async function renderLobby(persister?: Persister) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    persister ? (
      <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: 24 * HOUR }}>
        {children}
      </PersistQueryClientProvider>
    ) : (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  const view = renderRouter(
    {
      _layout: () => <Stack />,
      'room/[roomId]/index': GoGoRoomScreen,
      'room/[roomId]/swipe': () => <DestinationStub label="swipe" />,
      'room/[roomId]/match-result': () => <DestinationStub label="result" />,
      'plans/[planId]/index': () => <DestinationStub label="plan" />,
    },
    { initialUrl: LOBBY, wrapper },
  )
  await view
  await settle()
  return { pathname: () => view.getPathname() }
}

beforeEach(() => {
  forgetRoomSteps()
  mockOpened.length = 0
  mockGetRoom.mockReset()
  mockGetSuggestions.mockReset()
  mockGetCurrentPlan.mockReset()
})

afterEach(() => {
  client.clear()
  jest.useRealTimers()
})

describe('a cold start from a link, restoring the cache after the lobby mounted', () => {
  it('does not send a member to the remembered vote while the room has not been read', async () => {
    client = appClient()
    const disk = deferred<PersistedClient | undefined>()
    // The room read never answers; the run read does.
    mockGetRoom.mockReturnValue(new Promise(() => undefined))
    mockGetSuggestions.mockResolvedValue(run)
    mockGetCurrentPlan.mockResolvedValue(planNew)
    const view = await renderLobby(slowDisk(disk.promise))

    await act(async () =>
      disk.resolve(savedCache([
        [queryKeys.room(ROOM_ID), member('matching')],
        [queryKeys.roomSuggestions(ROOM_ID), run],
      ])),
    )
    await settle(3)

    expect(mockGetSuggestions).toHaveBeenCalled()
    expect(view.pathname()).toBe(LOBBY)
    expect(mockOpened).toEqual([])
  })

  it('moves no one while the room read fails, and moves the member once a later read succeeds', async () => {
    client = appClient()
    const disk = deferred<PersistedClient | undefined>()
    mockGetRoom.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(member('ready'))
    mockGetSuggestions.mockResolvedValue(run)
    mockGetCurrentPlan.mockResolvedValue(planNew)
    const view = await renderLobby(slowDisk(disk.promise))

    await act(async () =>
      disk.resolve(savedCache([
        [queryKeys.room(ROOM_ID), member('matching')],
        [queryKeys.roomSuggestions(ROOM_ID), run],
      ])),
    )
    await settle(3)
    expect(view.pathname()).toBe(LOBBY)
    expect(mockOpened).toEqual([])

    // The next poll tick: the room finished while the app was closed.
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.room(ROOM_ID) })
    })
    await settle(3)

    expect(view.pathname()).toBe(`/plans/${PLAN_NEW}`)
    expect(mockOpened).toEqual([`plan:${PLAN_NEW}`])
  })
})

describe('a warm cache from before', () => {
  it('does not send a member to a vote that closed while the app was away', async () => {
    client = appClient()
    for (const [key, data] of [
      [queryKeys.room(ROOM_ID), member('matching')],
      [queryKeys.roomSuggestions(ROOM_ID), run],
    ] as const) client.setQueryData(key, data, { updatedAt: Date.now() - HOUR })
    const room = deferred<unknown>()
    const suggestions = deferred<unknown>()
    mockGetRoom.mockReturnValue(room.promise)
    mockGetSuggestions.mockReturnValue(suggestions.promise)
    mockGetCurrentPlan.mockResolvedValue(planNew)
    const view = await renderLobby()

    // The run is still there on the server, but the room has not been read.
    await act(async () => suggestions.resolve(run))
    await settle()
    expect(view.pathname()).toBe(LOBBY)

    await act(async () => room.resolve(member('ready')))
    await settle(2)

    expect(view.pathname()).toBe(`/plans/${PLAN_NEW}`)
    expect(mockOpened).toEqual([`plan:${PLAN_NEW}`])
  })

  it('does not open a plan remembered from before it was replaced', async () => {
    client = appClient()
    client.setQueryData(queryKeys.room(ROOM_ID), member('ready'), { updatedAt: Date.now() - HOUR })
    client.setQueryData(queryKeys.roomCurrentPlan(ROOM_ID), { id: PLAN_OLD, roomId: ROOM_ID, status: 'current' }, { updatedAt: Date.now() - HOUR })
    const current = deferred<unknown>()
    mockGetRoom.mockResolvedValue(member('ready'))
    mockGetCurrentPlan.mockReturnValue(current.promise)
    const view = await renderLobby()

    // The room is confirmed ready; the plan is only remembered.
    expect(view.pathname()).toBe(LOBBY)

    await act(async () => current.resolve(planNew))
    await settle()

    expect(view.pathname()).toBe(`/plans/${PLAN_NEW}`)
    expect(mockOpened).toEqual([`plan:${PLAN_NEW}`])
  })
})
