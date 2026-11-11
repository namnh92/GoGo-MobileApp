import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, QueryClientProvider, dehydrate, onlineManager } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, Share, type AlertButton } from 'react-native'

import { loaded, roomFor, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#199: the API returns an invite code once and lists invites
 * without codes, so the host's own device must bring the code back after a
 * reopen or a cold start — and a device without it must say an invite is
 * active instead of offering to mint a second one.
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
import { ApiError, NetworkError } from '@/shared/api/errors'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { loadInviteCode, purgeInviteCodes, saveInviteCode } from '@/shared/storage/invite-codes'
import { track } from '@/shared/analytics'
import { env } from '@/shared/config/env'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'

jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const ROOM_ID = '311f5bd8-f853-4ced-af68-e04398d1451a'
const USER = 'user-1'
const CODE = 'Qm9vZ2llLWNvZGUtMTk5ab'
const EXPIRES = '2099-01-01T00:00:00.000Z'
const INVITES_KEY = ['rooms', ROOM_ID, 'invites']
const SHARE = 'Mời người tham gia'
const ACTIVE_NOTE = /Phòng đang có mã mời còn hạn đến/
const CLOSED = 'Phòng đã ngừng nhận thêm người, nên mã mời không còn dùng để vào phòng được.'

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

function spyAlert() {
  return jest.spyOn(Alert, 'alert').mockImplementation(() => {})
}
async function answer(alert: jest.SpyInstance, style: 'cancel' | 'destructive') {
  const buttons = alert.mock.calls[0][2] as AlertButton[]
  await act(async () => { buttons.find(button => button.style === style)?.onPress?.() })
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

describe('host invite after reopen (#199)', () => {
  it('keeps the invite link this device created after the room is reopened, creating it once', async () => {
    const first = await open()
    const create = await screen.findByText('Tạo mã mời')
    await act(async () => { await fireEvent.press(create) })
    await expectLinkReady()
    await first.unmount()

    await open()
    await expectLinkReady()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(mockCreate).toHaveBeenCalledTimes(1)
    await finish()
  })

  it('reads the code back from secure storage on a cold start', async () => {
    await saveInviteCode(storedInvite())
    serve([row()])
    await open()
    await expectLinkReady()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    await finish()
  })

  it('enables sharing the stored link on an offline cold start, with the list paused', async () => {
    await saveInviteCode(storedInvite())
    onlineManager.setOnline(false)
    await open()
    await expectLinkReady()
    expect(mockList).not.toHaveBeenCalled()
    await finish()
  })

  it('says the invites could not be checked when offline with nothing stored', async () => {
    onlineManager.setOnline(false)
    await open()
    expect(await screen.findByText('Chưa kiểm tra được mã mời của phòng.')).toBeTruthy()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    await finish()
  })

  it('shows a placeholder, not a masked code or a create button, while the list loads', async () => {
    await saveInviteCode(storedInvite())
    mockList.mockReturnValue(new Promise(() => {}))
    await open()
    await act(async () => { await loadInviteCode(ROOM_ID, USER) })
    expect(screen.queryByText('·····')).toBeNull()
    expect(screen.queryByText(CODE)).toBeNull()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    await act(async () => { await screen.unmount() })
  })

  it('waits for the session on a cold start, so its own live code is never offered for re-issue', async () => {
    await saveInviteCode(storedInvite())
    serve([row()])
    mockSession.status = 'hydrating'
    const view = await open()
    await waitFor(() => expect(client.getQueryData(INVITES_KEY)).toBeDefined())
    // Query results reach the screen on a later tick; flush it, or the checks
    // below would pass before the card had a chance to render anything.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    expect(screen.queryByText('Mã GoGo Room')).toBeNull()
    expect(screen.queryByText('Tạo mã mới')).toBeNull()
    expect(screen.queryByText(ACTIVE_NOTE)).toBeNull()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(screen.queryByText(CODE)).toBeNull()

    mockSession.status = 'user'
    await view.rerender(
      <QueryClientProvider client={client}>
        <GoGoRoomScreen />
      </QueryClientProvider>,
    )
    await expectLinkReady()
    expect(mockRevoke).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
    expect((await loadInviteCode(ROOM_ID, USER))?.code).toBe(CODE)
    await finish()
  })

  it("never shows a code another account stored on this device", async () => {
    await saveInviteCode(storedInvite({ userId: 'someone-else' }))
    serve([row()])
    await open()
    expect(await screen.findByText(ACTIVE_NOTE)).toBeTruthy()
    expect(screen.queryByText(CODE)).toBeNull()
    expect(await loadInviteCode(ROOM_ID, 'someone-else')).toBeNull()
    await finish()
  })

  it('re-issues an invite from another device: confirm, one revoke, then one create', async () => {
    serve([row({ inviteId: 'invite-other' })])
    const alert = spyAlert()
    try {
      await open()
      expect(await screen.findByText(ACTIVE_NOTE)).toBeTruthy()
      expect(screen.queryByText('Tạo mã mời')).toBeNull()
      await act(async () => { await fireEvent.press(screen.getByText('Tạo mã mới')) })
      // Revoking is destructive: nothing happens before the host confirms.
      expect(mockRevoke).not.toHaveBeenCalled()
      expect(alert.mock.calls[0][1]).toBe('Mã đang dùng sẽ ngừng hoạt động. Người đã vào phòng không bị ảnh hưởng; ai chưa vào cần mã mới.')
      await answer(alert, 'destructive')

      await expectLinkReady()
      expect(mockRevoke).toHaveBeenCalledTimes(1)
      expect(mockRevoke).toHaveBeenCalledWith(ROOM_ID, 'invite-other')
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockRevoke.mock.invocationCallOrder[0]).toBeLessThan(mockCreate.mock.invocationCallOrder[0])
      expect((await loadInviteCode(ROOM_ID, USER))?.code).toBe(CODE)
      await finish()
    } finally {
      alert.mockRestore()
    }
  })

  it('revokes every usable invite before creating one, and the confirmation says so', async () => {
    serve([
      row({ inviteId: 'invite-a' }),
      row({ inviteId: 'invite-b', expiresAt: '2098-01-01T00:00:00.000Z' }),
      row({ inviteId: 'invite-old', revoked: true }),
    ])
    const alert = spyAlert()
    try {
      await open()
      const reissue = await screen.findByText('Tạo mã mới')
      await act(async () => { await fireEvent.press(reissue) })
      expect(alert.mock.calls[0][1]).toBe('Cả 2 mã đang dùng sẽ ngừng hoạt động. Người đã vào phòng không bị ảnh hưởng; ai chưa vào cần mã mới.')
      await answer(alert, 'destructive')

      await expectLinkReady()
      expect(mockRevoke.mock.calls.map(call => call[1]).sort()).toEqual(['invite-a', 'invite-b'])
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(Math.max(...mockRevoke.mock.invocationCallOrder)).toBeLessThan(mockCreate.mock.invocationCallOrder[0])
      expect(server.filter(entry => !entry.revoked).map(entry => entry.inviteId)).toEqual(['invite-new'])
      await finish()
    } finally {
      alert.mockRestore()
    }
  })

  it('revokes the usable set as the server has it at confirmation, not as first shown', async () => {
    serve([row({ inviteId: 'invite-a' })])
    const alert = spyAlert()
    try {
      await open()
      const reissue = await screen.findByText('Tạo mã mới')
      await act(async () => { await fireEvent.press(reissue) })
      // Another phone creates an invite while the confirmation is open.
      server = [...server, row({ inviteId: 'invite-b' })]
      await answer(alert, 'destructive')

      await expectLinkReady()
      expect(mockRevoke.mock.calls.map(call => call[1]).sort()).toEqual(['invite-a', 'invite-b'])
      expect(mockCreate).toHaveBeenCalledTimes(1)
      await finish()
    } finally {
      alert.mockRestore()
    }
  })

  it('revokes and creates nothing when the host cancels the re-issue', async () => {
    serve([row({ inviteId: 'invite-other' })])
    const alert = spyAlert()
    try {
      await open()
      const reissue = await screen.findByText('Tạo mã mới')
      await act(async () => { await fireEvent.press(reissue) })
      await answer(alert, 'cancel')
      expect(mockRevoke).not.toHaveBeenCalled()
      expect(mockCreate).not.toHaveBeenCalled()
      await finish()
    } finally {
      alert.mockRestore()
    }
  })

  it('falls back to create when the new code fails after a revoke, and retries with the same key', async () => {
    serve([row({ inviteId: 'invite-other' })])
    mockCreate.mockRejectedValueOnce(new NetworkError()).mockImplementationOnce(async () => {
      server = [...server, row()]
      return created()
    })
    const alert = spyAlert()
    try {
      await open()
      const reissue = await screen.findByText('Tạo mã mới')
      await act(async () => { await fireEvent.press(reissue) })
      await answer(alert, 'destructive')

      expect(await screen.findByText('Chưa tạo được mã mời. Bạn vẫn có thể quản lý phòng và chọn sở thích.')).toBeTruthy()
      expect(screen.queryByText(ACTIVE_NOTE)).toBeNull()
      await act(async () => { await fireEvent.press(screen.getByText('Tạo mã mời')) })

      await expectLinkReady()
      expect(mockRevoke).toHaveBeenCalledTimes(1)
      expect(mockCreate).toHaveBeenCalledTimes(2)
      expect(mockCreate.mock.calls[1][2]).toBe(mockCreate.mock.calls[0][2])
      await finish()
    } finally {
      alert.mockRestore()
    }
  })

  it('drops the re-issue error once the card moves on', async () => {
    serve([row({ inviteId: 'invite-other' })])
    mockRevoke.mockRejectedValue(new ApiError(500, { code: 'INTERNAL', message: 'boom' }))
    const alert = spyAlert()
    try {
      await open()
      const reissue = await screen.findByText('Tạo mã mới')
      await act(async () => { await fireEvent.press(reissue) })
      await answer(alert, 'destructive')
      expect(await screen.findByText('Chưa thu hồi được mã cũ. Thử lại nhé.')).toBeTruthy()
      expect(mockCreate).not.toHaveBeenCalled()

      server = []
      await act(async () => { await client.invalidateQueries({ queryKey: INVITES_KEY }) })
      expect(await screen.findByText('Tạo mã mời')).toBeTruthy()
      expect(screen.queryByText('Chưa thu hồi được mã cũ. Thử lại nhé.')).toBeNull()
      await finish()
    } finally {
      alert.mockRestore()
    }
  })

  it('says the room no longer takes members instead of offering a re-issue', async () => {
    mockRoom.query = loaded(roomFor('group-host', { status: 'matching' }))
    serve([row({ inviteId: 'invite-other' })])
    await open()
    expect(await screen.findByText('Phòng đã ngừng nhận thêm người, nên mã mời không còn dùng để vào phòng được.')).toBeTruthy()
    expect(screen.queryByText(ACTIVE_NOTE)).toBeNull()
    expect(screen.queryByText('Tạo mã mới')).toBeNull()
    await finish()
  })

  it('offers no create button in a room that no longer takes members', async () => {
    mockRoom.query = loaded(roomFor('group-host', { status: 'matching' }))
    await open()
    expect(await screen.findByText(CLOSED)).toBeTruthy()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    await finish()
  })

  it('hides the token and disables sharing once the room no longer takes members', async () => {
    mockRoom.query = loaded(roomFor('group-host', { status: 'ready' }))
    await saveInviteCode(storedInvite())
    serve([row()])
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
    try {
      await open()
      await waitFor(() => expect(client.isFetching()).toBe(0))
      expect(screen.queryByText(CODE)).toBeNull()
      expect(screen.getByText(CLOSED)).toBeTruthy()
      expect(screen.queryByLabelText('Copy')).toBeNull()
      expect(screen.getByRole('button', { name: SHARE })).toBeDisabled()
      await act(async () => { await fireEvent.press(screen.getByText(SHARE)) })
      expect(share).not.toHaveBeenCalled()
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
      await finish()
    } finally {
      share.mockRestore()
    }
  })

  it('rechecks the list before sharing, so a code revoked on another phone is never shared', async () => {
    await saveInviteCode(storedInvite())
    serve([row()])
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
    try {
      await open()
      await expectLinkReady()
      await act(async () => { await fireEvent.press(screen.getByText(SHARE)) })
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
      expect(JSON.stringify(share.mock.calls[0][0])).toContain(CODE)

      server = [row({ revoked: true })]
      const listCalls = mockList.mock.calls.length
      await act(async () => { await fireEvent.press(screen.getByText(SHARE)) })
      expect(await screen.findByText('Tạo mã mời')).toBeTruthy()
      expect(mockList.mock.calls.length).toBeGreaterThan(listCalls)
      expect(share).toHaveBeenCalledTimes(1)
      await waitFor(async () => expect(await loadInviteCode(ROOM_ID, USER)).toBeNull())
      await finish()
    } finally {
      share.mockRestore()
    }
  })

  it.each([
    ['revoked', { list: [row({ revoked: true })], stored: {} }],
    ['expired', { list: [row({ expiresAt: '2000-01-01T00:00:00.000Z' })], stored: { expiresAt: '2000-01-01T00:00:00.000Z' } }],
    ['no longer listed', { list: [], stored: {} }],
  ])('clears the stored code of a %s invite', async (_label, { list, stored }) => {
    await saveInviteCode(storedInvite(stored))
    serve(list)
    await open()
    expect(await screen.findByText('Tạo mã mời')).toBeTruthy()
    expect(screen.queryByText(CODE)).toBeNull()
    await waitFor(async () => expect(await loadInviteCode(ROOM_ID, USER)).toBeNull())
    expect(mockCreate).not.toHaveBeenCalled()
    await finish()
  })

  it.each([
    ['member', roomFor('group-guest')],
    ['guest', roomFor('group-guest', { myRole: 'guest' } as never)],
  ])('never shows a %s invite controls, lists invites or reads a stored code', async (_label, room) => {
    await saveInviteCode(storedInvite())
    mockRoom.query = loaded(room)
    await open()
    expect(await screen.findByText('Chọn sở thích của bạn')).toBeTruthy()
    expect(screen.queryByText('Mã GoGo Room')).toBeNull()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(screen.queryByText('Tạo mã mới')).toBeNull()
    expect(screen.queryByText(CODE)).toBeNull()
    expect(mockList).not.toHaveBeenCalled()
    await finish()
  })

  it('never writes a code to AsyncStorage or to the persisted query cache', async () => {
    const first = await open()
    const create = await screen.findByText('Tạo mã mời')
    await act(async () => { await fireEvent.press(create) })
    await expectLinkReady()
    await first.unmount()
    await open()
    await expectLinkReady()

    const asyncStorage = AsyncStorage as unknown as { setItem: jest.Mock; multiSet: jest.Mock; mergeItem: jest.Mock }
    const written = JSON.stringify([asyncStorage.setItem.mock.calls, asyncStorage.multiSet.mock.calls, asyncStorage.mergeItem.mock.calls])
    expect(written).not.toContain(CODE)
    const keys = await AsyncStorage.getAllKeys()
    expect(JSON.stringify(await AsyncStorage.multiGet(keys))).not.toContain(CODE)

    // What the app's persister would write (app-providers.tsx).
    const persisted = JSON.stringify(dehydrate(client, {
      shouldDehydrateQuery: query => query.state.data !== undefined && shouldPersistQuery(query.queryKey),
    }))
    expect(persisted).toContain('invite-1')
    expect(persisted).not.toContain(CODE)
    await finish()
  })
})


/** The token remains private while its verified invite link can be shared. */
async function expectLinkReady() {
  await waitFor(() => {
    expect(screen.queryByText(CODE)).toBeNull()
    expect(screen.getByRole('button', { name: SHARE })).toBeEnabled()
  })
  expect(screen.queryByTestId('invite-code')).toBeNull()
  expect(screen.queryByText('Mã GoGo Room')).toBeNull()
  expect(screen.queryByLabelText('Copy')).toBeNull()
}

describe.each(['orange', 'orangeDark'] as const)('595 owner sim invite / %s', theme => {
  it.each(['couple', 'group-host'] as const)('hides the opaque token and shares the verified LINK from one invite button / %s', async audience => {
    mockRoom.query = loaded(roomFor(audience))
    await saveInviteCode(storedInvite())
    serve([row()])
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
    try {
      await render(<QueryClientProvider client={client}><ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider></QueryClientProvider>)
      await expectLinkReady()
      expect(screen.getAllByRole('button', { name: SHARE })).toHaveLength(1)
      await fireEvent.press(screen.getByRole('button', { name: SHARE }))
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
      const url = `${env.webBaseUrl}/r/${CODE}`
      expect(share.mock.calls[0][0]).toMatchObject({ url, message: expect.stringContaining(url) })
      expect(track).toHaveBeenCalledWith('gogo_invite_shared', { channel: 'native_share', roomType: audience === 'couple' ? 'couple' : 'group' })
      await finish()
    } finally { share.mockRestore() }
  })
})


describe('595 future six-digit room code prop', () => {
  it.each([undefined, null, '', '12345', '1234567', 'ABC123', '１２３４５６', CODE])('hides the code row for %s', async roomCode => {
    await saveInviteCode(storedInvite())
    serve([row()])
    await render(<QueryClientProvider client={client}><GoGoRoomScreen roomCode={roomCode} /></QueryClientProvider>)
    await expectLinkReady()
    await finish()
  })

  it('renders and copies only the dedicated six digits, retaining leading zeroes', async () => {
    await saveInviteCode(storedInvite())
    serve([row()])
    await render(<QueryClientProvider client={client}><GoGoRoomScreen roomCode="012345" /></QueryClientProvider>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled())
    expect(screen.getByTestId('invite-code')).toHaveTextContent('012345', { exact: true })
    expect(screen.queryByText(CODE)).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('012345'))
    expect(track).toHaveBeenCalledWith('gogo_invite_copied', { channel: 'code' })
    // The prop only affects the display; link sharing still uses the opaque token.
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
    try {
      await fireEvent.press(screen.getByRole('button', { name: SHARE }))
      await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${env.webBaseUrl}/r/${CODE}` })))
      await finish()
    } finally { share.mockRestore() }
  })

  it('keeps the six-digit copy behind invite revocation verification', async () => {
    await saveInviteCode(storedInvite())
    serve([row()])
    await render(<QueryClientProvider client={client}><GoGoRoomScreen roomCode="012345" /></QueryClientProvider>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled())
    server = [row({ revoked: true })]
    await fireEvent.press(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Tạo mã mời')).toBeTruthy()
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    await finish()
  })
})
