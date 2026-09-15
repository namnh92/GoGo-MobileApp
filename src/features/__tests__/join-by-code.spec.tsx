import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#248 — the typed-code join reads the error code: a room that no
 * longer takes members is not an expired code, and an existing member the
 * backend recognises goes straight into their room.
 */
const mockReplace = jest.fn()
const mockJoinRoom = jest.fn()
const mockJoinAsGuest = jest.fn()
const mockSession = { status: 'user' }

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
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
  useRecentRoomsStore: (select: (state: { forget: (id: string) => void }) => unknown) => select({ forget: jest.fn() }),
}))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))

import { ApiError } from '@/shared/api/errors'
import JoinByCodeScreen from '@/features/gogo-room/join-by-code.view'

const CODE = 'YDi_00PB1z4FSQZjpLbgdw'
const ROOM = '311f5bd8-f853-4ced-af68-e04398d1451a'
const EXPIRED = 'Mã mời đã hết hạn hoặc bị thu hồi. Hỏi chủ phòng gửi mã mới nhé.'
const ROOM_CLOSED = 'Phòng này không nhận thêm người nữa, nên mã mới cũng không giúp được. Hỏi chủ phòng nếu bạn cần vào.'

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, { code, message: 'x', field_errors: [], request_id: 'test', retryable: false })
}

async function submitCode() {
  const view = await renderScreen(<JoinByCodeScreen />)
  await act(async () => {
    fireEvent.changeText(view.getByLabelText('Mã mời'), CODE)
  })
  await act(async () => {
    fireEvent.press(view.getByText('Tham gia 🙌'))
  })
  return view
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.status = 'user'
})

describe('join by code × error code', () => {
  it('says the room no longer takes members for ROOM_NOT_JOINABLE', async () => {
    mockJoinRoom.mockRejectedValue(apiError(410, 'ROOM_NOT_JOINABLE'))
    const view = await submitCode()
    expect(await view.findByText(ROOM_CLOSED)).toBeTruthy()
    expect(view.queryByText(EXPIRED)).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('keeps the expired-code copy for INVITE_NOT_USABLE', async () => {
    mockJoinRoom.mockRejectedValue(apiError(410, 'INVITE_NOT_USABLE'))
    const view = await submitCode()
    expect(await view.findByText(EXPIRED)).toBeTruthy()
    expect(view.queryByText(ROOM_CLOSED)).toBeNull()
  })

  it('takes an existing member into their room when the backend recognises them', async () => {
    mockJoinRoom.mockResolvedValue({ roomId: ROOM, memberId: 'member-1', role: 'member' })
    await submitCode()
    expect(mockJoinRoom).toHaveBeenCalledWith({ inviteCode: CODE })
    expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}`)
  })
})
