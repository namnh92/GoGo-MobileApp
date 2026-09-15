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
const mockBack = jest.fn()
const mockHistory = { canGoBack: false }
const mockJoinAsGuest = jest.fn()
const mockJoinRoom = jest.fn()
const mockForget = jest.fn()
const mockSession = { status: 'user' }

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: mockBack,
    canGoBack: () => mockHistory.canGoBack,
  }),
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

function apiError(status: number): ApiError {
  return new ApiError(status, { code: 'X', message: 'x', field_errors: [], request_id: 'test', retryable: false })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.status = 'user'
  mockHistory.canGoBack = false
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
    [410, 'Lời mời này không còn dùng được. Hỏi người tạo phòng gửi link mới nhé.'],
    [404, 'Link mời không đúng hoặc phòng đã bị xoá.'],
    [429, 'Thử quá nhiều lần. Đợi một chút rồi thử lại.'],
  ])('tells a signed-in user what HTTP %s means and stays put', async (status, message) => {
    mockJoinRoom.mockRejectedValue(apiError(status))
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

  it('offers no join while a cold start is still reading the session', async () => {
    mockSession.status = 'hydrating'
    const view = await renderScreen(<GuestJoinScreen />)
    expect(view.queryByText(JOIN)).toBeNull()
    expect(mockJoinRoom).not.toHaveBeenCalled()
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
  })
})

/**
 * GoGo-MobileApp#203 (regression #218, iPhone 11 Pro Max): an unknown or revoked
 * invite left the person on this screen with no back or close control and no
 * edge swipe, until they relaunched the app.
 */
describe('leaving the invite screen', () => {
  const BACK = 'Quay lại'

  it('cold start: a dead invite has a way out, and it goes Home', async () => {
    mockHistory.canGoBack = false
    mockJoinRoom.mockRejectedValue(apiError(404))
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.press(view.getByText(JOIN))
    expect(await view.findByText('Link mời không đúng hoặc phòng đã bị xoá.')).toBeTruthy()

    await fireEvent.press(view.getByLabelText(BACK))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('warm start: a revoked invite goes back to where the person came from', async () => {
    mockHistory.canGoBack = true
    mockJoinRoom.mockRejectedValue(apiError(410))
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.press(view.getByText(JOIN))
    expect(await view.findByText('Lời mời này không còn dùng được. Hỏi người tạo phòng gửi link mới nhé.')).toBeTruthy()

    await fireEvent.press(view.getByLabelText(BACK))
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('offers the way out on the guest path too, before anything is typed', async () => {
    mockSession.status = 'anonymous'
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.press(view.getByLabelText(BACK))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
  })

  it('offers the way out while a cold start is still reading the session', async () => {
    mockSession.status = 'hydrating'
    const view = await renderScreen(<GuestJoinScreen />)

    await fireEvent.press(view.getByLabelText(BACK))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  })
})
