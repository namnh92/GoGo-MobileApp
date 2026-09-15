import { fireEvent, waitFor } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#203 — `/r/[inviteCode]`, the screen every invite lands on.
 *
 * It used to call `joinAsGuest` for everyone. For a signed-in user that purges
 * local data and replaces the account session with a room-scoped guest one, so
 * what is worth asserting is which join each session takes, and that an
 * expired, revoked or unknown invite reads as its own sentence.
 */
const mockReplace = jest.fn()
const mockJoinAsGuest = jest.fn()
const mockJoinRoom = jest.fn()
const mockForget = jest.fn()
const mockSession = { status: 'user' }

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ inviteCode: 'YDi_00PB1z4FSQZjpLbgdw' }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({
    status: mockSession.status,
    joinAsGuest: (...args: unknown[]) => mockJoinAsGuest(...args),
  }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useJoinRoom: () => ({ mutateAsync: (...args: unknown[]) => mockJoinRoom(...args), isPending: false }),
}))

jest.mock('@/shared/store/recentRoomsStore', () => ({
  useRecentRoomsStore: (select: (state: { forget: (id: string) => void }) => unknown) =>
    select({ forget: (id: string) => mockForget(id) }),
}))

jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))

import { ApiError } from '@/shared/api/errors'
import GuestJoinScreen from '@/features/gogo-room/guest-join.view'

const CODE = 'YDi_00PB1z4FSQZjpLbgdw'
const ROOM = '311f5bd8-f853-4ced-af68-e04398d1451a'
const JOIN = 'Tham gia 🙌'
const NAME = 'Tên hiển thị'

function apiError(status: number, code = 'X'): ApiError {
  return new ApiError(status, { code, message: 'x', field_errors: [], request_id: 'test', retryable: false })
}

const INVITE_GONE = 'Lời mời này không còn dùng được. Hỏi người tạo phòng gửi link mới nhé.'
const ROOM_CLOSED = 'Phòng này không nhận thêm người nữa, nên link mới cũng không giúp được. Hỏi chủ phòng nếu bạn cần vào.'

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.status = 'user'
})

describe('invite screen × session', () => {
  it('joins a signed-in user as themselves — never through the guest path', async () => {
    mockJoinRoom.mockResolvedValue({ roomId: ROOM })
    const view = await renderScreen(<GuestJoinScreen />)
    expect(view.queryByLabelText(NAME)).toBeNull()
    expect(view.getByText('Bạn sẽ vào phòng bằng tài khoản đang đăng nhập.')).toBeTruthy()

    await fireEvent.press(view.getByText(JOIN))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}`))
    expect(mockJoinRoom).toHaveBeenCalledWith({ inviteCode: CODE })
    expect(mockForget).toHaveBeenCalledWith(ROOM)
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
  })

  it.each(['anonymous', 'guest'])('joins a %s session as a guest with the name they give', async status => {
    mockSession.status = status
    mockJoinAsGuest.mockResolvedValue({ kind: 'guest', roomId: ROOM })
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.changeText(view.getByLabelText(NAME), '  Lan  ')
    await fireEvent.press(view.getByText(JOIN))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}/preference`))
    expect(mockJoinAsGuest).toHaveBeenCalledWith({ inviteCode: CODE, displayName: 'Lan' })
    expect(mockJoinRoom).not.toHaveBeenCalled()
  })

  it('never navigates to a room it was not told about', async () => {
    mockSession.status = 'anonymous'
    mockJoinAsGuest.mockResolvedValue({ kind: 'guest' })
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.changeText(view.getByLabelText(NAME), 'Lan')
    await fireEvent.press(view.getByText(JOIN))

    expect(await view.findByText('Không tham gia được. Thử lại nhé.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it.each([
    [410, 'INVITE_NOT_USABLE', INVITE_GONE],
    // GoGo-MobileApp#248: a room that stopped taking members is not an expired invite.
    [410, 'ROOM_NOT_JOINABLE', ROOM_CLOSED],
    [410, 'SOMETHING_ELSE_GONE', INVITE_GONE],
    [404, 'INVITE_NOT_FOUND', 'Link mời không đúng hoặc phòng đã bị xoá.'],
    [429, 'RATE_LIMITED', 'Thử quá nhiều lần. Đợi một chút rồi thử lại.'],
  ])('tells a signed-in user what HTTP %s %s means and stays put', async (status, code, message) => {
    mockJoinRoom.mockRejectedValue(apiError(status, code))
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.press(view.getByText(JOIN))

    expect(await view.findByText(message)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('reports an expired invite on the guest path too', async () => {
    mockSession.status = 'anonymous'
    mockJoinAsGuest.mockRejectedValue(apiError(410))
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.changeText(view.getByLabelText(NAME), 'Lan')
    await fireEvent.press(view.getByText(JOIN))

    expect(await view.findByText('Lời mời này không còn dùng được. Hỏi người tạo phòng gửi link mới nhé.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('tells a guest when the room no longer takes members, not that the invite expired (#248)', async () => {
    mockSession.status = 'anonymous'
    mockJoinAsGuest.mockRejectedValue(apiError(410, 'ROOM_NOT_JOINABLE'))
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.changeText(view.getByLabelText(NAME), 'Lan')
    await fireEvent.press(view.getByText(JOIN))

    expect(await view.findByText(ROOM_CLOSED)).toBeTruthy()
    expect(view.queryByText(INVITE_GONE)).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('takes a member who reopens the invite of a finalised room straight into it (#248)', async () => {
    // What the backend answers an existing member once it recognises them.
    mockJoinRoom.mockResolvedValue({ roomId: ROOM, memberId: 'member-1', role: 'member' })
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.press(view.getByText(JOIN))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}`))
    expect(view.queryByText(ROOM_CLOSED)).toBeNull()
    expect(view.queryByText(INVITE_GONE)).toBeNull()
  })

  it('offers no join while a cold start is still reading the session', async () => {
    mockSession.status = 'hydrating'
    const view = await renderScreen(<GuestJoinScreen />)
    expect(view.queryByText(JOIN)).toBeNull()
    expect(mockJoinRoom).not.toHaveBeenCalled()
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
  })
})
