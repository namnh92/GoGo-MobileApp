import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'

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
}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  createRoomInvite: (...args: unknown[]) => mockCreate(...args),
  listRoomInvites: (...args: unknown[]) => mockList(...args),
  revokeRoomInvite: (...args: unknown[]) => mockRevoke(...args),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  useRoomRealtime: jest.fn(),
  useStartMatching: () => ({ mutateAsync: jest.fn(), isPending: false, isError: false, error: null }),
}))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { loadInviteCode, purgeInviteCodes, saveInviteCode } from '@/shared/storage/invite-codes'

const ROOM_ID = '311f5bd8-f853-4ced-af68-e04398d1451a'
const CODE = 'Qm9vZ2llLWNvZGUtMTk5'
const EXPIRES = '2099-01-01T00:00:00.000Z'
const row = (overrides: Record<string, unknown> = {}) => ({
  inviteId: 'invite-1', expiresAt: EXPIRES, revoked: false, useCount: 0, maxUses: 20, ...overrides,
})
const storedInvite = (overrides: Record<string, unknown> = {}) => ({
  roomId: ROOM_ID, inviteId: 'invite-1', code: CODE, expiresAt: EXPIRES, savedAt: 1, ...overrides,
})

let client: QueryClient
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
async function open(queryClient = client) {
  return render(
    <QueryClientProvider client={queryClient}>
      <GoGoRoomScreen />
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  jest.clearAllMocks()
  await purgeInviteCodes()
  await AsyncStorage.clear()
  client = newClient()
  mockRoom.query = loaded(roomFor('group-host'))
  mockList.mockResolvedValue([])
  mockRevoke.mockResolvedValue({ revoked: true })
  mockCreate.mockImplementation(async () => {
    mockList.mockResolvedValue([row()])
    return { inviteId: 'invite-1', code: CODE, expiresAt: EXPIRES, maxUses: 20 }
  })
})
afterEach(() => client.clear())

describe('host invite after reopen (#199)', () => {
  it('shows the code this device created after the room is reopened, creating it once', async () => {
    const first = await open()
    await act(async () => { fireEvent.press(await screen.findByText('Tạo mã mời')) })
    expect(await screen.findByText(CODE)).toBeTruthy()
    await first.unmount()

    await open()
    expect(await screen.findByText(CODE)).toBeTruthy()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('reads the code back from secure storage on a cold start', async () => {
    await saveInviteCode(storedInvite())
    mockList.mockResolvedValue([row()])
    await open(newClient())
    expect(await screen.findByText(CODE)).toBeTruthy()
    expect(screen.queryByText('Tạo mã mời')).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('reports an active invite from another device and re-issues it: one revoke, then one create', async () => {
    mockList.mockResolvedValue([row({ inviteId: 'invite-other' })])
    mockRevoke.mockImplementation(async () => {
      mockList.mockResolvedValue([row({ inviteId: 'invite-other', revoked: true })])
    })
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    try {
      await open()
      expect(await screen.findByText(/Phòng đang có mã mời còn hạn đến/)).toBeTruthy()
      expect(screen.queryByText('Tạo mã mời')).toBeNull()
      expect(screen.queryByText(CODE)).toBeNull()

      await act(async () => { fireEvent.press(screen.getByText('Tạo mã mới')) })
      // Revoking is destructive: nothing happens before the host confirms.
      expect(mockRevoke).not.toHaveBeenCalled()
      const buttons = alert.mock.calls[0][2] as AlertButton[]
      await act(async () => { buttons.find(button => button.style === 'destructive')?.onPress?.() })

      expect(await screen.findByText(CODE)).toBeTruthy()
      expect(mockRevoke).toHaveBeenCalledTimes(1)
      expect(mockRevoke).toHaveBeenCalledWith(ROOM_ID, 'invite-other')
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockRevoke.mock.invocationCallOrder[0]).toBeLessThan(mockCreate.mock.invocationCallOrder[0])
      expect((await loadInviteCode(ROOM_ID))?.code).toBe(CODE)
    } finally {
      alert.mockRestore()
    }
  })

  it('revokes and creates nothing when the host cancels the re-issue', async () => {
    mockList.mockResolvedValue([row({ inviteId: 'invite-other' })])
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    try {
      await open()
      await act(async () => { fireEvent.press(await screen.findByText('Tạo mã mới')) })
      const buttons = alert.mock.calls[0][2] as AlertButton[]
      await act(async () => { buttons.find(button => button.style === 'cancel')?.onPress?.() })
      expect(mockRevoke).not.toHaveBeenCalled()
      expect(mockCreate).not.toHaveBeenCalled()
    } finally {
      alert.mockRestore()
    }
  })

  it('does not offer a re-issue once the room no longer takes members', async () => {
    mockRoom.query = loaded(roomFor('group-host', { status: 'matching' }))
    mockList.mockResolvedValue([row({ inviteId: 'invite-other' })])
    await open()
    expect(await screen.findByText(/Phòng đang có mã mời còn hạn đến/)).toBeTruthy()
    expect(screen.queryByText('Tạo mã mới')).toBeNull()
  })

  it.each([
    ['revoked', { list: [row({ revoked: true })], stored: {} }],
    ['expired', { list: [row({ expiresAt: '2000-01-01T00:00:00.000Z' })], stored: { expiresAt: '2000-01-01T00:00:00.000Z' } }],
    ['no longer listed', { list: [], stored: {} }],
  ])('clears the stored code of a %s invite', async (_label, { list, stored }) => {
    await saveInviteCode(storedInvite(stored))
    mockList.mockResolvedValue(list)
    await open()
    expect(await screen.findByText('Tạo mã mời')).toBeTruthy()
    expect(screen.queryByText(CODE)).toBeNull()
    await waitFor(async () => expect(await loadInviteCode(ROOM_ID)).toBeNull())
    expect(mockCreate).not.toHaveBeenCalled()
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
  })

  it('never writes a code to AsyncStorage or to the persisted query cache', async () => {
    const first = await open()
    await act(async () => { fireEvent.press(await screen.findByText('Tạo mã mời')) })
    expect(await screen.findByText(CODE)).toBeTruthy()
    await first.unmount()
    await open()
    expect(await screen.findByText(CODE)).toBeTruthy()

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
  })
})
