import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, QueryClientProvider, dehydrate, onlineManager } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Share } from 'react-native'

import { loaded, roomFor, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#199: the API returns an invite code once and lists invites
 * without codes. Round 6h retains new codes in memory; legacy secure entries
 * can still be read, and an active link without a code requires confirmation
 * before replacement.
 */

const mockCreate = jest.fn()
const mockList = jest.fn()
const mockRevoke = jest.fn()
const mockRoom: { query: QueryLike } = { query: loaded(null) }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: '311f5bd8-f853-4ced-af68-e04398d1451a' }),
  // #276 — the lobby waits for a ready navigator before it routes.
  useNavigationContainerRef: () => ({ isReady: () => true }),
}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))
// A cold start: while the provider says 'hydrating' there is no session yet.
const mockSession = { status: 'user' as 'hydrating' | 'user' }
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockSession.status }) }))
jest.mock('@/shared/api/session', () => ({
  ...jest.requireActual('@/shared/api/session'),
  getSession: () =>
    mockSession.status === 'hydrating' ? null : { kind: 'user', accessToken: 'token', expiresAt: 0, userId: 'user-1' },
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  createRoomInvite: (...args: unknown[]) => mockCreate(...args),
  listRoomInvites: (...args: unknown[]) => mockList(...args),
  revokeRoomInvite: (...args: unknown[]) => mockRevoke(...args),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  useRoomRealtime: jest.fn(() => ({ status: 'live' })),
  // #276 — the lobby reads the run and the plan once the room has them.
  useCurrentSuggestions: () => ({ data: undefined, isPending: false, isError: false, error: null, isFetchedAfterMount: false, dataUpdatedAt: 0, refetch: jest.fn() }),
  useCurrentPlan: () => ({ data: undefined, isPending: false, isError: false, error: null, isFetchedAfterMount: false, dataUpdatedAt: 0, refetch: jest.fn() }),
  useStartMatching: () => ({ mutateAsync: jest.fn(), isPending: false, isError: false, error: null }),
}))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { loadInviteCode, purgeInviteCodes, saveInviteCode } from '@/shared/storage/invite-codes'

jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const ROOM_ID = '311f5bd8-f853-4ced-af68-e04398d1451a'
const USER = 'user-1'
const CODE = 'Qm9vZ2llLWNvZGUtMTk5ab'
const EXPIRES = '2099-01-01T00:00:00.000Z'
const SHARE = 'Mời người tham gia'

type Row = { inviteId: string; expiresAt: string; revoked: boolean; useCount: number; maxUses: number }
const row = (overrides: Partial<Row> = {}): Row => ({
  inviteId: 'invite-1', expiresAt: EXPIRES, revoked: false, useCount: 0, maxUses: 20, ...overrides,
})
const storedInvite = (overrides: Record<string, unknown> = {}) => ({
  roomId: ROOM_ID, inviteId: 'invite-1', code: CODE, expiresAt: EXPIRES, userId: USER, savedAt: 1, ...overrides,
})
const created = (inviteId = 'invite-1') => ({ inviteId, code: CODE, expiresAt: EXPIRES, maxUses: 20 })

/** A fake server: the list reflects every revoke and create made against it. */
let server: Row[] = []
function serve(rows: Row[]) {
  server = rows
  mockList.mockImplementation(async () => server)
  mockRevoke.mockImplementation(async (_roomId: string, inviteId: string) => {
    server = server.map(entry => (entry.inviteId === inviteId ? { ...entry, revoked: true } : entry))
  })
  mockCreate.mockImplementation(async () => {
    server = [...server, row({ inviteId: 'invite-new' })]
    return created('invite-new')
  })
}

let client: QueryClient
// gcTime Infinity schedules no garbage-collection timers: the default five
// minutes kept Jest alive after the last test (finished queries and mutations
// each arm one), which is what "did not exit one second after" was.
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })

async function open() {
  return render(
    <QueryClientProvider client={client}>
      <GoGoRoomScreen />
    </QueryClientProvider>,
  )
}

/** Lets fetches, the forget effect and the storage queue settle, then unmounts: nothing lands after the test. */
async function finish() {
  await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
  await act(async () => { await loadInviteCode(ROOM_ID, USER) })
  await act(async () => { await screen.unmount() })
}

beforeEach(async () => {
  jest.clearAllMocks()
  await purgeInviteCodes()
  await AsyncStorage.clear()
  client = newClient()
  mockSession.status = 'user'
  mockRoom.query = loaded(roomFor('group-host'))
  serve([])
  mockCreate.mockImplementation(async () => {
    server = [...server, row()]
    return created()
  })
})
afterEach(() => {
  onlineManager.setOnline(true)
  client.clear()
})

// Round 6h moves sharing to the header, with secrets retained in memory only.
async function press(label = SHARE) {
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: label })) })
}
async function ready() {
  await waitFor(() => expect(screen.getByRole('button', { name: SHARE })).toBeEnabled())
}
let share: jest.SpyInstance
beforeEach(() => { share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction }) })
afterEach(() => share.mockRestore())

it('shares a legacy stored active link through the header without creating', async () => {
  await saveInviteCode(storedInvite())
  serve([row()])
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(share.mock.calls[0][0].url).toContain(`/r/${CODE}`)
  expect(mockCreate).not.toHaveBeenCalled()
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(screen.queryByTestId('room-lobby-invite-confirm')).toBeNull()
  await finish()
})
it('creates on header press and shares, then reopens in the same session without duplicates', async () => {
  const first = await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  await first.unmount()
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(await loadInviteCode(ROOM_ID, USER)).toBeNull()
  await finish()
})
it('rechecks revocation before sharing and creates a usable replacement when none remain', async () => {
  await saveInviteCode(storedInvite())
  serve([row()])
  await open(); await ready()
  server = [row({ revoked: true })]
  await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(mockRevoke).not.toHaveBeenCalled()
  await finish()
})
it.each([
  { expiresAt: '2000-01-01T00:00:00Z' }, { revoked: true }, { useCount: 20 },
])('creates once for an unusable invite (%p), then shares', async overrides => {
  await saveInviteCode(storedInvite())
  serve([row(overrides)])
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(mockCreate).toHaveBeenCalledWith(ROOM_ID, { maxUses: 20 }, expect.any(String))
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(screen.queryByTestId('room-lobby-invite-confirm')).toBeNull()
  await finish()
})
it('automatically renews an expired stored code without confirmation and shares the new code', async () => {
  const expiresAt = '2000-01-01T00:00:00Z'
  await saveInviteCode(storedInvite({ expiresAt }))
  serve([row({ expiresAt })])
  mockCreate.mockImplementation(async () => {
    server = [...server, row({ inviteId: 'invite-new' })]
    return { ...created('invite-new'), code: 'renewed-secret' }
  })
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(share.mock.calls[0][0].url).toContain('/r/renewed-secret')
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(screen.queryByTestId('room-lobby-invite-confirm')).toBeNull()
  await finish()
})
it('asks to change an active link from another device without creating a duplicate', async () => {
  serve([row()])
  await open(); await ready(); await press()
  await waitFor(() => expect(screen.getByTestId('room-lobby-invite-confirm')).toBeTruthy())
  expect(mockCreate).not.toHaveBeenCalled()
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(share).not.toHaveBeenCalled()
  await press('Huỷ')
  await finish()
})
it('a cold cache with an active link also requires replacement confirmation', async () => {
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  await finish(); client.clear(); client = newClient()
  await open(); await ready(); await press()
  await waitFor(() => expect(screen.getByTestId('room-lobby-invite-confirm')).toBeTruthy())
  expect(mockCreate).toHaveBeenCalledTimes(1)
  await press('Huỷ'); await finish()
})
it('does not mint during hydration, refocus or list refresh', async () => {
  mockSession.status = 'hydrating'
  await open()
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.getByRole('button', { name: SHARE })).toBeDisabled()
  await act(async () => { await client.invalidateQueries() })
  expect(mockCreate).not.toHaveBeenCalled()
  await finish()
})
it.each(['error', 'malformed'] as const)('does not mint when the invite list is %s', async state => {
  if (state === 'error') mockList.mockRejectedValue(new Error('offline'))
  else mockList.mockResolvedValue({ invalid: true })
  await open()
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.getByRole('button', { name: SHARE })).toBeDisabled()
  expect(mockCreate).not.toHaveBeenCalled()
  await finish()
})
it.each(['matching', 'ready', 'active', 'completed', 'cancelled', 'expired'] as const)('does not create or share into a %s room', async status => {
  mockRoom.query = loaded(roomFor('group-host', { status }))
  await open()
  await waitFor(() => expect(client.isFetching()).toBe(0))
  const button = screen.queryByRole('button', { name: SHARE })
  if (button) expect(button).toBeDisabled()
  expect(mockCreate).not.toHaveBeenCalled()
  expect(share).not.toHaveBeenCalled()
  await finish()
})
it('keeps members away from invite APIs and every host control', async () => {
  mockRoom.query = loaded(roomFor('group-guest'))
  await open()
  expect(screen.queryByRole('button', { name: SHARE })).toBeNull()
  expect(screen.queryByTestId('room-lobby-management')).toBeNull()
  expect(mockList).not.toHaveBeenCalled()
  expect(mockCreate).not.toHaveBeenCalled()
  await finish()
})
it('keeps invite secrets out of the persisted cache and AsyncStorage', async () => {
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  const persisted = dehydrate(client, { shouldDehydrateQuery: query => shouldPersistQuery(query.queryKey), shouldDehydrateMutation: () => false })
  expect(JSON.stringify(persisted)).not.toContain(CODE)
  const pairs = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())
  expect(JSON.stringify(pairs)).not.toContain(CODE)
  expect(screen.queryByTestId('invite-code')).toBeNull()
  expect(screen.queryByText(CODE)).toBeNull()
  await finish()
})

it('keeps an unexpired device link shareable during an offline cold start without minting', async () => {
  await saveInviteCode(storedInvite())
  onlineManager.setOnline(false)
  await open(); await ready(); await press()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(share.mock.calls[0][0].url).toContain(`/r/${CODE}`)
  expect(mockList).not.toHaveBeenCalled()
  expect(mockCreate).not.toHaveBeenCalled()
  await finish()
})
