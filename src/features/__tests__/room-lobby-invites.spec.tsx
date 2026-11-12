import { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { Share, StyleSheet } from 'react-native'
import { render } from '@/shared/ui/__tests__/query-render'
import { loaded as mockLoaded, roomFor } from './harness'
import i18n from '@/shared/i18n'
import { env } from '@/shared/config/env'
import { prepareRoomInvite } from '@/features/gogo-room/prepare-room-invite'

const mockList = jest.fn()
const mockCreate = jest.fn()
const mockRevoke = jest.fn()
let mockRoom = roomFor('group-host')
jest.mock('@/shared/navigation/deep-link', () => ({ ...jest.requireActual('@/shared/navigation/deep-link'), isUuid: () => true }))
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => ({ isReady: () => true }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
  useFocusEffect: () => undefined,
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  listRoomInvites: (...args: unknown[]) => mockList(...args),
  createRoomInvite: (...args: unknown[]) => mockCreate(...args),
  revokeRoomInvite: (...args: unknown[]) => mockRevoke(...args),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoomRealtime: () => ({ status: 'live' }),
  useCurrentSuggestions: () => mockLoaded(undefined),
  useCurrentPlan: () => mockLoaded(undefined),
  useRoom: () => mockLoaded(mockRoom),
  useSeedPlaceDetails: () => ({ byPlaceId: new Map(), refetchAll: jest.fn() }),
}))
import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

type Row = { inviteId: string; expiresAt: string; revoked?: boolean; useCount?: number; maxUses?: number }
const expiry = '2099-11-12T10:25:00.000Z'
const row = (overrides: Partial<Row> = {}): Row => ({ inviteId: 'old', expiresAt: expiry, revoked: false, useCount: 3, maxUses: 20, ...overrides })
let server: Row[]
let client: QueryClient
let share: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockRoom = roomFor('group-host')
  server = [row()]
  mockList.mockImplementation(async () => server)
  mockRevoke.mockImplementation(async (_id: string, inviteId: string) => {
    server = server.map(invite => invite.inviteId === inviteId ? { ...invite, revoked: true } : invite)
  })
  mockCreate.mockImplementation(async () => {
    server = [...server, row({ inviteId: 'new', useCount: 0 })]
    return { inviteId: 'new', code: 'new-secret', expiresAt: expiry, maxUses: 20 }
  })
  share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction })
})
afterEach(async () => {
  await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
  client.clear()
  share.mockRestore()
})
async function open() {
  await render(<GoGoRoomScreen />, client)
  await waitFor(() => expect(client.isFetching()).toBe(0))
}
async function press(label: string) {
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: label })) })
}
async function replaceFromShare() {
  await press('Mời người tham gia')
  await waitFor(() => expect(screen.getByTestId('room-lobby-invite-confirm')).toBeTruthy())
  await press('Đổi link')
}

it.each([{ invites: [] }, { invites: [row()] }, { invites: [row({ expiresAt: '2000-01-01T00:00:00Z' })] }])('keeps only the standalone host cancel button regardless of invite metadata (%j)', async ({ invites }) => {
  server = invites
  await open()
  expect(screen.queryByTestId('room-lobby-management')).toBeNull()
  expect(screen.queryByTestId('room-lobby-invite-status')).toBeNull()
  expect(screen.queryByText(/Link mời đang dùng|Chưa có link mời|Link mời đã hết hạn/)).toBeNull()
  expect(screen.getByTestId('room-lobby-cancel')).toBeTruthy()
  expect(screen.queryByText('Quản lý')).toBeNull()
})
it('creates from the empty state and shares the new canonical link', async () => {
  server = []
  await open()
  await press('Mời người tham gia')
  await waitFor(() => expect(share).toHaveBeenCalledWith({ url: `${env.webBaseUrl}/r/new-secret`, message: expect.stringContaining(`${env.webBaseUrl}/r/new-secret`) }))
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(mockCreate).toHaveBeenCalledTimes(1)
})
it('opens the warning from header share for an active link without a code and cancels without mutations', async () => {
  await open()
  await press('Mời người tham gia')
  await waitFor(() => expect(screen.getByTestId('room-lobby-invite-confirm')).toBeTruthy())
  const sheet = screen.getByTestId('room-lobby-invite-confirm')
  expect(within(sheet).getByText('Đổi link mời?')).toBeTruthy()
  expect(within(sheet).getByText('Link cũ sẽ không dùng được nữa. Người đã vào phòng không bị ảnh hưởng.')).toBeTruthy()
  await press('Huỷ')
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(mockCreate).not.toHaveBeenCalled()
  expect(share).not.toHaveBeenCalled()
})
it('refetches and revokes ALL active links before creating, then shares once', async () => {
  await open()
  server = [...server, row({ inviteId: 'other-device' }), row({ inviteId: 'revoked', revoked: true })]
  await replaceFromShare()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(mockRevoke.mock.calls).toEqual([['room-1', 'old'], ['room-1', 'other-device']])
  expect(mockRevoke.mock.invocationCallOrder[1]).toBeLessThan(mockCreate.mock.invocationCallOrder[0])
  expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0])
  expect(share).toHaveBeenCalledWith({ url: `${env.webBaseUrl}/r/new-secret`, message: expect.stringContaining('/r/new-secret') })
})
it('refetches to the empty state if create fails after revocation, and allows retry', async () => {
  mockCreate.mockRejectedValueOnce(new Error('offline'))
  await open()
  await replaceFromShare()
  await waitFor(() => expect(screen.getByText(i18n.t('gogoRoom.inviteFailed'))).toBeTruthy())
  expect(screen.getByText(i18n.t('gogoRoom.inviteFailed'))).toBeTruthy()
  expect(share).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Mời người tham gia' }).props.accessibilityState.disabled).toBe(false))
  await press('Mời người tham gia')
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(mockRevoke).toHaveBeenCalledTimes(1)
})
it('does not create or share after a revoke failure', async () => {
  mockRevoke.mockRejectedValueOnce(new Error('offline'))
  await open()
  await replaceFromShare()
  await waitFor(() => expect(screen.getByText(i18n.t('gogoRoom.reissueFailed'))).toBeTruthy())
  expect(mockCreate).not.toHaveBeenCalled()
  expect(share).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull())
})
it('draws dividers only between member rows, including a one-member card', async () => {
  mockRoom = { ...mockRoom, members: mockRoom.members?.slice(0, 1) }
  await open()
  expect(StyleSheet.flatten(screen.getByTestId('room-lobby-member-0').props.style)?.borderTopWidth ?? 0).toBe(0)
  mockRoom = roomFor('group-host')
  await screen.rerender(<GoGoRoomScreen />)
  expect(StyleSheet.flatten(screen.getByTestId('room-lobby-member-0').props.style)?.borderTopWidth ?? 0).toBe(0)
  expect(StyleSheet.flatten(screen.getByTestId('room-lobby-member-1').props.style).borderTopWidth).toBe(1)
})
it('provides English invite copy', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  try {
    await open()
    expect(screen.queryByText('Current invite link')).toBeNull()
    await press('Invite people')
    await waitFor(() => expect(screen.getByTestId('room-lobby-invite-confirm')).toBeTruthy())
    expect(screen.getByText('Change invite link?')).toBeTruthy()
    await press('Cancel')
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
it('blocks interaction while creating and shares only after creation finishes', async () => {
  server = []
  let finish!: (value: { inviteId: string; code: string; expiresAt: string }) => void
  mockCreate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open()
  await press('Mời người tham gia')
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  expect(share).not.toHaveBeenCalled()
  await act(async () => { finish({ inviteId: 'new', code: 'new-secret', expiresAt: expiry }) })
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
})
it('does not offer creation when the invite list cannot be read', async () => {
  mockList.mockRejectedValue(new Error('offline'))
  await render(<GoGoRoomScreen />, client)
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.getByTestId('room-lobby-cancel')).toBeTruthy()
  expect(screen.queryByText('Chưa có link mời')).toBeNull()
  expect(screen.getByRole('button', { name: 'Mời người tham gia' })).toBeDisabled()
  expect(mockCreate).not.toHaveBeenCalled()
})

it('waits for background preparation on a quick header tap, then shares that invite once', async () => {
  server = []
  let finish!: (value: { inviteId: string; code: string; expiresAt: string }) => void
  mockCreate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const task = prepareRoomInvite(client, 'room-1')
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
  await open()
  await press('Mời người tham gia')
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(share).not.toHaveBeenCalled()
  await act(async () => {
    server = [row({ inviteId: 'prepared' })]
    finish({ inviteId: 'prepared', code: 'prepared-secret', expiresAt: expiry })
    await task
  })
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(share.mock.calls[0][0].url).toContain('/r/prepared-secret')
  expect(mockCreate).toHaveBeenCalledTimes(1)
})
