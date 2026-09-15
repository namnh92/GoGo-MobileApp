import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { act, renderRouter } from 'expo-router/testing-library'
import { useEffect, type ReactNode } from 'react'
import { Text } from 'react-native'

import { roomFor } from './harness'
import { queryKeys, type RoomStatus } from '@/shared/api'
import { forgetRoomSteps } from '@/shared/navigation/room-steps'

/**
 * GoGo-MobileApp#198 review — the query cache is persisted for a day. A room
 * that moved on while the app was closed hydrates as it was: still `matching`
 * with a run whose votes now 409 `ROOM_NOT_MATCHING`, or `ready` with a plan
 * that has since been replaced. The lobby must move no one on what it only
 * remembers; it waits for reads made since it opened.
 *
 * Real hooks and a real QueryClient here; only the endpoints are faked, and
 * each answers when the test says so.
 */

jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))

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

function DestinationStub({ label }: { label: string }) {
  const params = useLocalSearchParams()
  useEffect(() => { mockOpened.push(`${label}:${String(params.planId ?? params.roomId)}`) }, [label, params.planId, params.roomId])
  return <Text>{label}</Text>
}

let client: QueryClient

/** The app's query defaults, with a cache as hydration leaves it: an hour old. */
function hydrated(seed: [readonly unknown[], unknown][]): QueryClient {
  const created = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 24 * HOUR, retry: false } } })
  for (const [key, data] of seed) created.setQueryData(key, data, { updatedAt: Date.now() - HOUR })
  return created
}

async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(50)
  })
}

async function renderLobby() {
  const view = renderRouter(
    {
      _layout: () => <Stack />,
      'room/[roomId]/index': GoGoRoomScreen,
      'room/[roomId]/swipe': () => <DestinationStub label="swipe" />,
      'room/[roomId]/match-result': () => <DestinationStub label="result" />,
      'plans/[planId]/index': () => <DestinationStub label="plan" />,
    },
    {
      initialUrl: LOBBY,
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    },
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

it('does not send a member to a vote that closed while the app was away', async () => {
  client = hydrated([
    [queryKeys.room(ROOM_ID), member('matching')],
    [queryKeys.roomSuggestions(ROOM_ID), run],
  ])
  const room = deferred<unknown>()
  const suggestions = deferred<unknown>()
  mockGetRoom.mockReturnValue(room.promise)
  mockGetSuggestions.mockReturnValue(suggestions.promise)
  mockGetCurrentPlan.mockResolvedValue({ id: PLAN_NEW, roomId: ROOM_ID, status: 'current' })
  const view = await renderLobby()

  // Remembered: matching, with a run. Nothing read yet.
  expect(view.pathname()).toBe(LOBBY)
  // The run is still there on the server, but the room has not been read.
  await act(async () => suggestions.resolve(run))
  await settle()
  expect(view.pathname()).toBe(LOBBY)

  // The room finished while the app was closed.
  await act(async () => room.resolve(member('ready')))
  await settle()
  await settle()

  expect(view.pathname()).toBe(`/plans/${PLAN_NEW}`)
  expect(mockOpened).toEqual([`plan:${PLAN_NEW}`])
})

it('does not open a plan remembered from before it was replaced', async () => {
  client = hydrated([
    [queryKeys.room(ROOM_ID), member('ready')],
    [queryKeys.roomCurrentPlan(ROOM_ID), { id: PLAN_OLD, roomId: ROOM_ID, status: 'current' }],
  ])
  const current = deferred<unknown>()
  mockGetRoom.mockResolvedValue(member('ready'))
  mockGetCurrentPlan.mockReturnValue(current.promise)
  const view = await renderLobby()

  // The room is confirmed ready; the plan is only remembered.
  expect(view.pathname()).toBe(LOBBY)

  await act(async () => current.resolve({ id: PLAN_NEW, roomId: ROOM_ID, status: 'current' }))
  await settle()

  expect(view.pathname()).toBe(`/plans/${PLAN_NEW}`)
  expect(mockOpened).toEqual([`plan:${PLAN_NEW}`])
})
