import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { api } from '@/shared/api/client'
import GuestJoinScreen from '@/features/gogo-room/guest-join.view'
import { InvitePreview } from '@/features/gogo-room/invite-preview.view'
import i18n from '@/shared/i18n'
import { track } from '@/shared/analytics'
import type { OpResponse } from '@/shared/api'

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
      const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
      expect(screen.getByText(`${date('2026-11-10T12:00:00Z')} – ${date('2026-11-10T14:00:00Z')}`)).toBeTruthy()
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
      expect(screen.getByText('Bạn được rủ chọn date')).toBeTruthy()
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
      if (failure.terminal && status !== 'user') {
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

  it.each(['INVITE_NOT_USABLE', 'ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'])('F-01: real preview 410 %s still permits server-confirmed re-entry', async code => {
    jest.mocked(api.post).mockRejectedValue(new ApiError(410, { code, message: 'generic' }))
    mockJoin.mockResolvedValue({ roomId: 'member-room', memberId: 'me', role: audience.role, alreadyMember: true })
    await mount()
    expect(await screen.findByText(previewFailures.find(failure => failure.code === code)!.message)).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }))
    expect(api.post).toHaveBeenCalledWith('/rooms/invites/preview', { inviteCode: mockCode }, expect.objectContaining({ anonymous: true }))
    expect(mockJoin).toHaveBeenCalledWith({ inviteCode: mockCode })
    expect(mockReplace).toHaveBeenCalledWith('/room/member-room')
    expect(mockGuest).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
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
