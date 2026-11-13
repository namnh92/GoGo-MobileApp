import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { api } from '@/shared/api/client'
import GuestJoinScreen from '@/features/gogo-room/guest-join.view'
import { InvitePreview } from '@/features/gogo-room/invite-preview.view'
import { InviteExpired } from '@/features/gogo-room/invite-expired.view'
import i18n from '@/shared/i18n'
import { track } from '@/shared/analytics'
import type { OpResponse } from '@/shared/api'
import { StyleSheet } from 'react-native'
import { spacing, type } from '@/shared/ui/tokens'
import { roomScheduleLabel } from '@/features/gogo-room/room-schedule'
import { styles as wizardStyles } from '@/features/create-date/create-type.style'

const mockJoin = jest.fn()
const mockGuest = jest.fn()
const mockReplace = jest.fn()
let mockStatus = 'user'
let mockCode = 'private-invite-credential'
jest.mock('@/shared/api/client', () => ({ api: { post: jest.fn() } }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useNavigation: () => ({ isFocused: () => true }),
  useLocalSearchParams: () => ({ inviteCode: mockCode }),
}))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useJoinRoom: () => ({ mutateAsync: mockJoin }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus, joinAsGuest: mockGuest }) }))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
const facts = { inviter: { displayName: 'Mai', avatarUrl: null, emailVerified: true }, roomType: 'group' as const, participantCount: 7 }
beforeEach(async () => {
  jest.clearAllMocks()
  jest.mocked(api.post).mockReset()
  mockJoin.mockReset()
  mockGuest.mockReset()
  mockStatus = 'user'
  mockCode = 'private-invite-credential'
  await i18n.changeLanguage('vi')
})
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(<QueryClientProvider client={client}><GuestJoinScreen /></QueryClientProvider>)
  return client
}

describe('Owner sim feedback 2026-11-12', () => {
  it.each(['vi', 'en'])('loading copy stays neutral without room facts (%s)', async language => {
    await i18n.changeLanguage(language)
    jest.mocked(api.post).mockReturnValue(new Promise(() => {}))
    await mount()
    expect(screen.getByText(i18n.t('guestJoin.title'))).toBeTruthy()
    expect(screen.queryAllByText(/date/i)).toHaveLength(0)
  })
  it.each([['vi', false], ['vi', true], ['en', false], ['en', true]] as const)('terminal copy stays neutral without room facts (%s, unusable=%s)', async (language, unusable) => {
    await i18n.changeLanguage(language)
    await render(<InviteExpired unusable={unusable} />)
    expect(screen.getByRole('header', { name: i18n.t(unusable ? 'inviteState.unusableTitle' : 'guestJoin.expiredTitle') })).toBeTruthy()
    expect(screen.queryAllByText(/date|cả hai/i)).toHaveLength(0)
  })
  it.each([
    ['vi', 'group', 7, 'Lời mời nhóm', 'Bạn được rủ đi chơi cùng nhóm', 'Chi tiết buổi hẹn'],
    ['vi', 'group', 2, 'Lời mời nhóm', 'Bạn được rủ đi chơi cùng nhóm', 'Chi tiết buổi hẹn'],
    ['vi', 'couple', 2, 'Lời mời date', 'Bạn được rủ chọn date', 'Chi tiết buổi date'],
    ['en', 'group', 7, 'Group invite', "You're invited to go out with the group", 'Outing details'],
    ['en', 'couple', 2, 'Date invite', "You're invited\nto pick a date", 'Date details'],
  ] as const)('%s %s (%s people) uses room-aware copy', async (language, roomType, participantCount, badge, title, details) => {
    await i18n.changeLanguage(language)
    jest.mocked(api.post).mockResolvedValue({ ...facts, roomType, participantCount })
    await mount()
    expect(await screen.findByText('Mai')).toBeTruthy()
    for (const text of [badge, title, details]) expect(screen.getByText(text)).toBeTruthy()
    if (roomType === 'group') expect(screen.queryAllByText(/date/i)).toHaveLength(0)
  })

  it('keeps facts below the card heading on the existing lobby body scale', async () => {
    await render(<InvitePreview data={{ ...facts, startAt: new Date(2026, 10, 11, 20).toISOString(), endAt: new Date(2026, 10, 11, 22).toISOString(), area: { source: 'service_area', name: 'Thảo Điền', city: 'TP.HCM' }, budget: { mode: 'total', amount: 300000, currency: 'VND' } }} />)
    for (const label of ['Thành viên', 'Thời gian', 'Khu vực đề xuất', 'Dự kiến ngân sách']) {
      expect(StyleSheet.flatten(screen.getByText(label).props.style)).toMatchObject(type.caption)
    }
    const amount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(300000)
    for (const value of ['Nhóm · 7 người', '20:00 – 22:00 · T4, 11/11/2026', 'Thảo Điền, TP.HCM', `${amount} / nhóm`]) {
      expect(StyleSheet.flatten(screen.getByText(value).props.style)).toMatchObject(type.body)
    }
    expect(StyleSheet.flatten(screen.getByText('Mai').props.style)).toMatchObject(type.title2)
  })

  it('uses the wizard input surface, border and size for the preview name', async () => {
    mockStatus = 'anonymous'
    jest.mocked(api.post).mockResolvedValue(facts)
    await mount()
    const shell = StyleSheet.flatten((screen.queryByTestId('invite-name-field') ?? screen.getByLabelText('Tên hiển thị')).props.style)
    const wizard = wizardStyles.nameInput
    for (const key of ['backgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'minHeight'] as const) expect(shell[key]).toBe(wizard[key])
    expect(StyleSheet.flatten(screen.getByLabelText('Tên hiển thị').props.style)).toMatchObject({ ...type.body, lineHeight: undefined })
  })
})
it('loads facts and never joins on mount; query metadata contains no code', async () => {
  jest.mocked(api.post).mockResolvedValue(facts)
  const client = await mount()
  expect(await screen.findByText('Mai')).toBeTruthy()
  expect(screen.getByText('Nhóm · 7 người')).toBeTruthy()
  expect(screen.getByText('Đã xác minh email')).toBeTruthy()
  expect(screen.queryByText('Khu vực đề xuất')).toBeNull()
  expect(mockJoin).not.toHaveBeenCalled(); expect(mockGuest).not.toHaveBeenCalled()
  expect(JSON.stringify(client.getQueryCache().getAll().map(q => q.queryKey))).not.toContain(mockCode)
})
it('renders the preview skeleton without starting join', async () => {
  jest.mocked(api.post).mockReturnValue(new Promise(() => {}))
  await mount()
  expect(screen.getByTestId('invite-preview-loading')).toBeTruthy()
  expect(mockJoin).not.toHaveBeenCalled()
})
it.each([[404, 'INVITE_NOT_FOUND', 'invite-unusable'], [410, 'INVITE_NOT_USABLE', 'invite-expired'], [410, 'ROOM_NOT_JOINABLE', 'invite-unusable'], [410, 'ROOM_EXPIRED', 'invite-unusable']])('renders recovery for %s %s', async (status, code, testId) => {
  mockStatus = 'anonymous'
  jest.mocked(api.post).mockRejectedValue(new ApiError(status as number, { code, message: 'generic' }))
  await mount()
  expect(await screen.findByTestId(testId)).toBeTruthy()
  expect(mockJoin).not.toHaveBeenCalled()
  if (['ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'].includes(code)) expect(screen.queryByText('Nhắn tin cho bạn bè để gửi lại link phòng mới')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Về trang chủ' }))
  expect(mockReplace).toHaveBeenCalledWith('/')
})
it.each([new ApiError(429, { code: 'RATE_LIMITED', message: 'generic' }), new NetworkError()])('shows a recoverable read failure without joining', async error => {
  jest.mocked(api.post).mockRejectedValue(error)
  await mount()
  const retry = await screen.findByRole('button', { name: 'Thử lại' })
  jest.mocked(api.post).mockResolvedValue(facts)
  await fireEvent.press(retry)
  expect(await screen.findByText('Mai')).toBeTruthy()
  expect(mockJoin).not.toHaveBeenCalled()
})
it('changes deep links without reusing the previous invitation facts', async () => {
  jest.mocked(api.post).mockResolvedValue(facts)
  const client = await mount()
  expect(await screen.findByText('Mai')).toBeTruthy()
  mockCode = 'another-secret'
  jest.mocked(api.post).mockResolvedValue({ ...facts, inviter: { ...facts.inviter, displayName: 'Lan' } })
  await screen.rerender(<QueryClientProvider client={client}><GuestJoinScreen /></QueryClientProvider>)
  expect(await screen.findByText('Lan')).toBeTruthy()
  expect(screen.queryByText('Mai')).toBeNull()
  await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1))
})
it('omits unavailable facts, never presents email verification as KYC, and formats budget with its unit in English', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  await render(<InvitePreview data={{ ...facts, inviter: { ...facts.inviter, emailVerified: false }, budget: { mode: 'total', amount: 12345, currency: 'USD' } }} />)
  expect(screen.getByText('$123.45 / group')).toBeTruthy()
  expect(screen.queryByText('Email verified')).toBeNull()
  expect(screen.queryByTestId('invite-avatar')).toBeNull()
})

it('waits for session hydration before preview or join', async () => {
  mockStatus = 'hydrating'
  await mount()
  expect(api.post).not.toHaveBeenCalled()
  expect(mockJoin).not.toHaveBeenCalled()
  expect(mockGuest).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Tên hiển thị')).toBeNull()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function changeCode(client: QueryClient, code = 'invite-B') {
  mockCode = code
  await screen.rerender(<QueryClientProvider client={client}><GuestJoinScreen /></QueryClientProvider>)
}

const audiences = [
  { audience: 'couple', roomType: 'couple', participantCount: 2, role: 'member', people: 'Phòng đôi · 2 người' },
  { audience: 'group-host', roomType: 'group', participantCount: 7, role: 'host', people: 'Nhóm · 7 người' },
  { audience: 'group-guest', roomType: 'group', participantCount: 4, role: 'member', people: 'Nhóm · 4 người' },
] as const

const previewFailures = [
  { status: 400, code: 'VALIDATION_ERROR', message: 'Không tham gia được. Thử lại nhé.' },
  { status: 404, code: 'INVITE_NOT_FOUND', message: 'Link mời không đúng hoặc phòng đã bị xoá.', terminal: 'invite-unusable' },
  { status: 410, code: 'INVITE_NOT_USABLE', message: 'Lời mời này không còn dùng được. Hỏi chủ phòng gửi link mới nhé.', terminal: 'invite-expired' },
  { status: 410, code: 'ROOM_NOT_JOINABLE', message: 'Phòng này không nhận thêm người nữa, nên link mới cũng không giúp được. Hỏi chủ phòng nếu bạn cần vào.', terminal: 'invite-unusable' },
  { status: 410, code: 'ROOM_EXPIRED', message: 'Phòng này đã hết hạn, nên link mới cũng không giúp được. Hỏi chủ phòng tạo phòng mới nhé.', terminal: 'invite-unusable' },
  { status: 429, code: 'RATE_LIMITED', message: 'Thử quá nhiều lần. Đợi một chút rồi thử lại.' },
  { status: 0, code: 'OFFLINE', message: 'Bạn đang ngoại tuyến. Một số thông tin có thể chưa cập nhật.' },
]

// The anonymous DTO has no actor role. Host/member fixtures affect only the
// server's join response, never preview copy or pre-join permissions.
describe.each(audiences)('integrated preview: $audience', audience => {
  describe.each(['user', 'anonymous', 'guest'])('%s session', status => {
    beforeEach(() => { mockStatus = status })

    it.each(['total', 'per_person'] as const)('default facts with %s budget and unit', async mode => {
      jest.mocked(api.post).mockResolvedValue({
        ...facts, roomType: audience.roomType, participantCount: audience.participantCount,
        startAt: '2026-11-10T12:00:00Z', endAt: '2026-11-10T14:00:00Z',
        area: { source: 'service_area', name: 'Thảo Điền', city: 'TP.HCM' },
        budget: { mode, amount: 300000, currency: 'VND' },
      })
      await mount()
      expect(await screen.findByText('Mai')).toBeTruthy()
      expect(screen.getByText(audience.people)).toBeTruthy()
      expect(screen.getByText('Người mời')).toBeTruthy()
      expect(screen.getByText('Đã xác minh email')).toBeTruthy()
      expect(screen.getByText('Thảo Điền, TP.HCM')).toBeTruthy()
      expect(screen.getByText(roomScheduleLabel('2026-11-10T12:00:00Z', 'vi-VN', { compact: true, endAt: '2026-11-10T14:00:00Z' })!)).toBeTruthy()
      const amount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(300000)
      expect(screen.getByText(`${amount} / ${mode === 'total' ? 'nhóm' : 'người'}`)).toBeTruthy()
      expect(screen.queryByLabelText('Tên hiển thị') !== null).toBe(status !== 'user')
      expect(screen.getByRole('button', { name: 'Tham gia' }).props.accessibilityState.disabled).toBe(status !== 'user')
      expect(screen.queryByText(/Máy này đang giữ một phiên khách/) !== null).toBe(status === 'guest')
      expect(screen.queryByText('Chủ phòng')).toBeNull()
      expect(mockJoin).not.toHaveBeenCalled()
      expect(mockGuest).not.toHaveBeenCalled()
    })

    it('loading keeps the form available without joining', async () => {
      jest.mocked(api.post).mockReturnValue(new Promise(() => {}))
      await mount()
      expect(screen.getByTestId('invite-preview-loading')).toBeTruthy()
      expect(screen.getByText('Bạn được rủ đi chơi')).toBeTruthy()
      expect(screen.queryByText('Mai')).toBeNull()
      expect(screen.getByRole('button', { name: 'Tham gia' })).toBeTruthy()
      expect(mockJoin).not.toHaveBeenCalled()
      expect(mockGuest).not.toHaveBeenCalled()
    })

    it.each(previewFailures)('content for $status $code', async failure => {
      jest.mocked(api.post).mockRejectedValue(failure.status
        ? new ApiError(failure.status, { code: failure.code, message: 'generic' })
        : new NetworkError())
      await mount()
      expect(await screen.findByText(failure.message)).toBeTruthy()
      if (failure.terminal) {
        expect(screen.getByTestId(failure.terminal)).toBeTruthy()
        expect(screen.getByRole('header', { name: failure.terminal === 'invite-expired' ? 'Lời mời đã hết hạn' : 'Liên kết không còn dùng được' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Về trang chủ' })).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Tham gia' })).toBeNull()
        if (failure.code.startsWith('ROOM_')) expect(screen.queryByText('Nhắn tin cho bạn bè để gửi lại link phòng mới')).toBeNull()
      } else {
        expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Tham gia' })).toBeTruthy()
        expect(screen.queryByTestId('invite-expired')).toBeNull()
        expect(screen.queryByTestId('invite-unusable')).toBeNull()
      }
      expect(mockJoin).not.toHaveBeenCalled()
      expect(mockGuest).not.toHaveBeenCalled()
    })
  })
})

describe('warm links and delayed responses', () => {
  it.each(previewFailures.filter(failure => failure.terminal))('F-02: join A $status $code then valid preview B', async failure => {
    jest.mocked(api.post).mockResolvedValue(facts)
    mockJoin.mockRejectedValueOnce(new ApiError(failure.status, { code: failure.code, message: 'generic' }))
    const client = await mount()
    expect(await screen.findByText('Mai')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(await screen.findByTestId(failure.terminal!)).toBeTruthy()
    expect(screen.getByText(failure.message)).toBeTruthy()
    jest.mocked(api.post).mockResolvedValue({ ...facts, inviter: { ...facts.inviter, displayName: 'Lan' } })
    await changeCode(client)
    expect(await screen.findByText('Lan')).toBeTruthy()
    expect(screen.queryByText(failure.message)).toBeNull()
    mockJoin.mockResolvedValue({ roomId: 'room-B', alreadyMember: false })
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(mockJoin).toHaveBeenLastCalledWith({ inviteCode: 'invite-B' })
    expect(mockReplace).toHaveBeenCalledWith('/room/room-B')
  })

  it.each(['success', 'failure'] as const)('holds invite B until late join A %s settles, then joins B', async outcome => {
    const joinA = deferred<{ roomId: string }>()
    const joinB = deferred<{ roomId: string }>()
    jest.mocked(api.post).mockResolvedValue(facts)
    mockJoin.mockReturnValueOnce(joinA.promise).mockReturnValueOnce(joinB.promise)
    const client = await mount()
    expect(await screen.findByText('Mai')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    await changeCode(client)
    expect(await screen.findByText('Mai')).toBeTruthy()
    // One join at a time across a warm link (#596 F-05; same as base c87ed82).
    expect(screen.getByRole('button', { name: 'Đang tham gia…' })).toBeDisabled()
    await act(async () => {
      if (outcome === 'success') joinA.resolve({ roomId: 'room-A' })
      else joinA.reject(new ApiError(410, { code: 'ROOM_EXPIRED', message: 'generic' }))
    })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByTestId('invite-unusable')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(mockJoin).toHaveBeenCalledTimes(2)
    expect(mockJoin).toHaveBeenLastCalledWith({ inviteCode: 'invite-B' })
    expect(screen.getByRole('button', { name: 'Đang tham gia…' })).toBeDisabled()
    await act(async () => { joinB.resolve({ roomId: 'room-B' }) })
    expect(mockReplace).toHaveBeenCalledWith('/room/room-B')
  })

  it('does not reuse a delayed preview A after changing to B', async () => {
    const previewA = deferred<OpResponse<'previewRoomInvite'>>()
    jest.mocked(api.post).mockReturnValueOnce(previewA.promise).mockResolvedValueOnce({ ...facts, inviter: { ...facts.inviter, displayName: 'Lan' } })
    const client = await mount()
    await changeCode(client)
    expect(await screen.findByText('Lan')).toBeTruthy()
    await act(async () => { previewA.resolve(facts) })
    expect(screen.queryByText('Mai')).toBeNull()
    expect(screen.getByText('Lan')).toBeTruthy()
  })

  it('ignores a delayed preview A rejection after valid B', async () => {
    const previewA = deferred<OpResponse<'previewRoomInvite'>>()
    jest.mocked(api.post).mockReturnValueOnce(previewA.promise).mockResolvedValueOnce({ ...facts, inviter: { ...facts.inviter, displayName: 'Lan' } })
    const client = await mount()
    await changeCode(client)
    expect(await screen.findByText('Lan')).toBeTruthy()
    await act(async () => { previewA.reject(new ApiError(410, { code: 'ROOM_EXPIRED', message: 'generic' })) })
    expect(screen.queryByTestId('invite-unusable')).toBeNull()
    expect(screen.getByText('Lan')).toBeTruthy()
  })

  it.each(['success', 'failure'] as const)('ignores a delayed guest join A %s after valid B', async outcome => {
    mockStatus = 'anonymous'
    const joinA = deferred<{ roomId: string }>()
    jest.mocked(api.post).mockResolvedValue(facts)
    mockGuest.mockReturnValueOnce(joinA.promise)
    const client = await mount()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan')
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    await changeCode(client)
    expect(await screen.findByText('Mai')).toBeTruthy()
    await act(async () => {
      if (outcome === 'success') joinA.resolve({ roomId: 'room-A' })
      else joinA.reject(new ApiError(410, { code: 'ROOM_EXPIRED', message: 'generic' }))
    })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByTestId('invite-unusable')).toBeNull()
    expect(screen.getByLabelText('Tên hiển thị').props.value).toBe('')
    expect(track).not.toHaveBeenCalled()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Mai')
    expect(screen.getByRole('button', { name: 'Tham gia' })).not.toBeDisabled()
  })

  it('cancels the old guest confirmation when the invite changes', async () => {
    mockStatus = 'guest'
    jest.mocked(api.post).mockResolvedValue(facts)
    const client = await mount()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan')
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(screen.getByText('Thay phiên khách hiện tại?')).toBeTruthy()
    await changeCode(client)
    expect(await screen.findByText('Mai')).toBeTruthy()
    expect(screen.queryByText('Thay phiên khách hiện tại?')).toBeNull()
    expect(screen.getByLabelText('Tên hiển thị').props.value).toBe('')
    expect(mockGuest).not.toHaveBeenCalled()
  })

  describe.each([[404, 'INVITE_NOT_FOUND'], [410, 'INVITE_NOT_USABLE'], [410, 'ROOM_EXPIRED']] as const)('F-03: preview %s %s while confirming', (status, code) => {
    it.each(['keep', 'replace'] as const)('keeps the real dialog actionable: %s settles pending', async choice => {
      mockStatus = 'guest'
      const preview = deferred<OpResponse<'previewRoomInvite'>>()
      jest.mocked(api.post).mockReturnValue(preview.promise)
      mockGuest.mockResolvedValue({ roomId: 'guest-room' })
      const client = await mount()
      await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan')
      await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
      expect(screen.getByText('Thay phiên khách hiện tại?')).toBeTruthy()
      await act(async () => { preview.reject(new ApiError(status, { code, message: 'generic' })) })
      expect(await screen.findByTestId(code === 'INVITE_NOT_USABLE' ? 'invite-expired' : 'invite-unusable')).toBeTruthy()
      await fireEvent.press(screen.getByRole('button', { name: choice === 'keep' ? 'Giữ phiên hiện tại' : 'Thay và tham gia' }))
      expect(screen.queryByText('Thay phiên khách hiện tại?')).toBeNull()
      if (choice === 'keep') {
        expect(mockGuest).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
      } else {
        expect(mockGuest).toHaveBeenCalledWith({ inviteCode: mockCode, displayName: 'Lan' })
        expect(mockReplace).toHaveBeenCalledWith('/room/guest-room/preference')
      }
      // Recover the read on the same code: pending must have settled in finally.
      jest.mocked(api.post).mockResolvedValue(facts)
      await act(async () => { await client.refetchQueries({ queryKey: ['invite-preview'] }) })
      expect(await screen.findByText('Mai')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Tham gia' })).not.toBeDisabled()
    })
  })
})

describe('F-05: guest join A in flight across a warm link to B', () => {
  /**
   * Models the session lifecycle that `joinAsGuest` drives: landing a guest join
   * persists its session and bumps the generation, which cancels any request that
   * started under the previous generation (SessionCancelledError in the provider).
   */
  function sessionLifecycle() {
    let generation = 0
    const landed: string[] = []
    const calls: { inviteCode: string; settle: () => void; fail: (e: Error) => void }[] = []
    mockGuest.mockImplementation(({ inviteCode }: { inviteCode: string }) => {
      const started = generation
      return new Promise((resolve, reject) => {
        calls.push({
          inviteCode,
          settle: () => {
            if (generation !== started) { reject(new Error('SessionCancelledError')); return }
            generation += 1
            landed.push(inviteCode)
            resolve({ roomId: `room-${inviteCode}` })
          },
          fail: reject,
        })
      })
    })
    return { calls, landed }
  }

  it('does not let invite B submit until join A has settled', async () => {
    mockStatus = 'anonymous'
    jest.mocked(api.post).mockResolvedValue(facts)
    const life = sessionLifecycle()
    const client = await mount()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan')
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(life.calls).toHaveLength(1)

    await changeCode(client, 'invite-B')
    expect(await screen.findByText('Mai')).toBeTruthy()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Mai')
    // Press whatever join control invite B shows: on the buggy build it is an
    // idle "Tham gia" that starts a second, concurrent guest join.
    await fireEvent.press(screen.queryByRole('button', { name: 'Tham gia' }) ?? screen.getByRole('button', { name: 'Đang tham gia…' }))
    // B never starts while A holds the session lifecycle.
    expect(life.calls).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Đang tham gia…' })).toBeTruthy()

    await act(async () => { life.calls[0].settle() })
    expect(life.landed).toEqual(['private-invite-credential'])
    // A landed on a screen that has moved on: no navigation into room A.
    expect(mockReplace).not.toHaveBeenCalled()

    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Mai')
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(life.calls).toHaveLength(2)
    expect(life.calls[1].inviteCode).toBe('invite-B')
    await act(async () => { life.calls[1].settle() })
    expect(life.landed).toEqual(['private-invite-credential', 'invite-B'])
    expect(mockReplace).toHaveBeenCalledWith('/room/room-invite-B/preference')
  })

  it('releases the lock when join A fails after the switch', async () => {
    mockStatus = 'anonymous'
    jest.mocked(api.post).mockResolvedValue(facts)
    const life = sessionLifecycle()
    const client = await mount()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan')
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    await changeCode(client, 'invite-B')
    expect(await screen.findByText('Mai')).toBeTruthy()
    await act(async () => { life.calls[0].fail(new ApiError(410, { code: 'ROOM_EXPIRED', message: 'generic' })) })
    // A's failure belongs to A: B stays usable and unlocked.
    expect(screen.queryByTestId('invite-unusable')).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Mai')
    expect(screen.getByRole('button', { name: 'Tham gia' })).not.toBeDisabled()
  })
})

describe('G5 sim fixes 2026-11-13', () => {
  it.each([
    [404, 'INVITE_NOT_FOUND', 'invite-unusable', true],
    [410, 'INVITE_NOT_USABLE', 'invite-expired', true],
    [410, 'ROOM_NOT_JOINABLE', 'invite-unusable', false],
    [410, 'ROOM_EXPIRED', 'invite-unusable', false],
    [410, 'UNKNOWN_GONE', 'invite-expired', true],
  ] as const)('G5-01: signed-in preview %s %s renders recovery', async (status, code, state, canRequestLink) => {
    jest.mocked(api.post).mockRejectedValue(new ApiError(status, { code, message: 'generic' }))
    await mount()
    expect(await screen.findByTestId(state)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tham gia' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
    expect(screen.queryByText(i18n.t('inviteState.askLink')) !== null).toBe(state === 'invite-unusable' && canRequestLink)
    expect(mockJoin).not.toHaveBeenCalled()
    expect(mockGuest).not.toHaveBeenCalled()
  })

  it.each(['loading', 'network', 'couple', 'group'] as const)('G5-02: invitation header appears once (%s)', async state => {
    if (state === 'loading') jest.mocked(api.post).mockReturnValue(new Promise(() => {}))
    else if (state === 'network') jest.mocked(api.post).mockRejectedValue(new NetworkError())
    else jest.mocked(api.post).mockResolvedValue({ ...facts, roomType: state })
    await mount()
    if (state === 'network') await screen.findByRole('button', { name: 'Thử lại' })
    else if (state !== 'loading') await screen.findByText('Mai')
    expect(screen.getAllByText('Lời mời tham gia')).toHaveLength(1)
    if (state === 'couple' || state === 'group') expect(screen.getByText(i18n.t(`guestJoin.badge_${state}`))).toBeTruthy()
  })

  it('G5-02: transient preview banner has the standard gap before the join card', async () => {
    jest.mocked(api.post).mockRejectedValue(new NetworkError())
    await mount()
    const retry = await screen.findByRole('button', { name: 'Thử lại' })
    expect(retry).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tham gia' })).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('invite-preview-error').props.style).marginBottom).toBe(spacing[4])
  })
})
