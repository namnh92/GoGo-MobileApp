import { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { Share, StyleSheet } from 'react-native'
import { render } from '@/shared/ui/__tests__/query-render'
import { loaded as mockLoaded, roomFor } from './harness'
import i18n from '@/shared/i18n'
import { env } from '@/shared/config/env'
import { isoToLocalSchedule } from '@/features/gogo-room/room-schedule'

const mockList = jest.fn()
const mockCreate = jest.fn()
const mockRevoke = jest.fn()
let mockRoom = roomFor('group-host')
jest.mock('expo-router', () => ({
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
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockLoaded(mockRoom),
  useSeedPlaceDetails: () => ({ byPlaceId: new Map(), refetchAll: jest.fn() }),
}))
import RoomManageScreen from '@/features/gogo-room/room-manage.view'

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
  await render(<RoomManageScreen />, client)
  await waitFor(() => expect(screen.getByTestId('room-manage-invite-row')).toBeTruthy())
}
async function press(label: string) {
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: label })) })
}
async function change() {
  await press('Đổi link mời')
  await press('Đổi link')
}

it('renders one active row with remaining uses and the formatted expiry, without a top divider', async () => {
  await open()
  expect(screen.getByText('Link mời đang dùng')).toBeTruthy()
  const [date, time] = isoToLocalSchedule(expiry).split(' ')
  expect(screen.getByText(`còn 17 lượt · hết hạn ${time} ${date}`)).toBeTruthy()
  expect(StyleSheet.flatten(screen.getByTestId('room-manage-invite-row').props.style).borderTopWidth ?? 0).toBe(0)
  expect(screen.queryByText('Thu hồi')).toBeNull()
})
it('omits unavailable counts and shows a maximum only when useCount is absent', async () => {
  server = [row({ useCount: undefined })]
  await open()
  expect(screen.getByText(/tối đa 20 lượt/)).toBeTruthy()
  server = [row({ maxUses: undefined })]
  await act(async () => { await client.invalidateQueries() })
  expect(screen.queryByText(/lượt/)).toBeNull()
})
it('selects the newest usable row in server creation order, omitting expired, revoked and exhausted rows', async () => {
  server = [row({ expiresAt: '2099-12-01T00:00:00Z' }), row({ inviteId: 'newest', useCount: 5 }),
    row({ inviteId: 'expired', expiresAt: '2000-01-01T00:00:00Z' }), row({ inviteId: 'revoked', revoked: true }), row({ inviteId: 'used', useCount: 20 })]
  await open()
  expect(screen.getAllByText('Link mời đang dùng')).toHaveLength(1)
  expect(screen.getByText(/còn 15 lượt/)).toBeTruthy()
})
it('creates from the empty state and shares the new canonical link', async () => {
  server = []
  await open()
  expect(screen.getByText('Chưa có link mời')).toBeTruthy()
  await press('Tạo link mời')
  await waitFor(() => expect(share).toHaveBeenCalledWith({ url: `${env.webBaseUrl}/r/new-secret`, message: expect.stringContaining(`${env.webBaseUrl}/r/new-secret`) }))
  expect(mockRevoke).not.toHaveBeenCalled()
  expect(mockCreate).toHaveBeenCalledTimes(1)
})
it('opens the warning ResultSheet and cancels without mutations', async () => {
  await open()
  await press('Đổi link mời')
  const sheet = screen.getByTestId('room-manage-invite-confirm')
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
  await change()
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(mockRevoke.mock.calls).toEqual([['room-1', 'old'], ['room-1', 'other-device']])
  expect(mockRevoke.mock.invocationCallOrder[1]).toBeLessThan(mockCreate.mock.invocationCallOrder[0])
  expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0])
  expect(share).toHaveBeenCalledWith({ url: `${env.webBaseUrl}/r/new-secret`, message: expect.stringContaining('/r/new-secret') })
})
it('refetches to the empty state if create fails after revocation, and allows retry', async () => {
  mockCreate.mockRejectedValueOnce(new Error('offline'))
  await open()
  await change()
  await waitFor(() => expect(screen.getByText('Chưa có link mời')).toBeTruthy())
  expect(screen.getByText(i18n.t('gogoRoom.inviteFailed'))).toBeTruthy()
  expect(share).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo link mời' }).props.accessibilityState.disabled).toBe(false))
  await press('Tạo link mời')
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(mockRevoke).toHaveBeenCalledTimes(1)
})
it('does not create or share after a revoke failure', async () => {
  mockRevoke.mockRejectedValueOnce(new Error('offline'))
  await open()
  await change()
  await waitFor(() => expect(screen.getByText(i18n.t('gogoRoom.reissueFailed'))).toBeTruthy())
  expect(mockCreate).not.toHaveBeenCalled()
  expect(share).not.toHaveBeenCalled()
})
it('draws dividers only between member rows, including a one-member card', async () => {
  mockRoom = { ...mockRoom, members: mockRoom.members?.slice(0, 1) }
  await open()
  expect(StyleSheet.flatten(screen.getByTestId('room-manage-member-0').props.style).borderTopWidth ?? 0).toBe(0)
  mockRoom = roomFor('group-host')
  await screen.rerender(<RoomManageScreen />)
  expect(StyleSheet.flatten(screen.getByTestId('room-manage-member-0').props.style).borderTopWidth ?? 0).toBe(0)
  expect(StyleSheet.flatten(screen.getByTestId('room-manage-member-1').props.style).borderTopWidth).toBe(1)
})
it('provides English invite copy', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  try {
    await open()
    expect(screen.getByText('Current invite link')).toBeTruthy()
    expect(screen.getByText(/17 uses left · expires/)).toBeTruthy()
    await press('Change invite link')
    expect(screen.getByText('Change invite link?')).toBeTruthy()
    await press('Cancel')
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
it('blocks interaction while creating and shares only after creation finishes', async () => {
  server = []
  let finish!: (value: { inviteId: string; code: string; expiresAt: string }) => void
  mockCreate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open()
  await press('Tạo link mời')
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  expect(share).not.toHaveBeenCalled()
  await act(async () => { finish({ inviteId: 'new', code: 'new-secret', expiresAt: expiry }) })
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
})
it('does not offer creation when the invite list cannot be read', async () => {
  mockList.mockRejectedValue(new Error('offline'))
  await render(<RoomManageScreen />, client)
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('common.retry') })).toBeTruthy())
  expect(screen.queryByText('Chưa có link mời')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Tạo link mời' })).toBeNull()
  expect(mockCreate).not.toHaveBeenCalled()
})
