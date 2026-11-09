import { act, fireEvent, render, screen } from '@testing-library/react-native'
import '@/shared/i18n'
import { ApiError, NetworkError } from '@/shared/api/errors'
import JoinByCodeScreen from '@/features/gogo-room/join-by-code.view'
import * as Clipboard from 'expo-clipboard'
const mockJoin = jest.fn()
const mockGuest = jest.fn()
let mockStatus = 'user'
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus, joinAsGuest: mockGuest }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useJoinRoom: () => ({ mutateAsync: mockJoin }) }))
beforeEach(() => { jest.clearAllMocks(); mockStatus = 'user' })
it('pastes and clears the full credential without joining or restricting its format', async () => {
  jest.mocked(Clipboard.getStringAsync).mockResolvedValue('Ab_c-very-long-invite-code')
  await render(<JoinByCodeScreen />)
  expect(screen.getByRole('button', { name: 'Vào phòng' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Dán' }))
  expect(screen.getByLabelText('Mã mời').props.value).toBe('Ab_c-very-long-invite-code')
  expect(mockJoin).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Xoá nội dung' }))
  expect(screen.getByLabelText('Mã mời').props.value).toBe('')
})
it('clipboard denial keeps the input usable', async () => {
  jest.mocked(Clipboard.getStringAsync).mockRejectedValue(new Error('denied'))
  await render(<JoinByCodeScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Dán' }))
  expect(await screen.findByText(/Chưa đọc được bộ nhớ tạm/)).toBeTruthy()
  await fireEvent.changeText(screen.getByLabelText('Mã mời'), 'valid-code')
  expect(screen.getByRole('button', { name: 'Vào phòng' })).not.toBeDisabled()
})
it('shows loading, suppresses repeated join, then renders a failed submission', async () => {
  let reject!: (error: Error) => void
  mockJoin.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
  await render(<JoinByCodeScreen />)
  await fireEvent.changeText(screen.getByLabelText('Mã mời'), 'valid-code')
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  expect(screen.getByRole('button', { name: 'Đang tham gia…' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Đang tham gia…' }))
  expect(mockJoin).toHaveBeenCalledTimes(1)
  await act(async () => { reject(new NetworkError()) })
  expect(screen.getByText('Bạn đang ngoại tuyến. Một số thông tin có thể chưa cập nhật.')).toBeTruthy()
})
describe.each(['user', 'anonymous', 'guest'])('typed-code content: %s session', session => {
  it.each([
    [400, 'VALIDATION_ERROR', 'Chưa vào được phòng. Thử lại nhé.'],
    [404, 'INVITE_NOT_FOUND', 'Không tìm thấy phòng với mã này.'],
    [410, 'INVITE_NOT_USABLE', 'Mã mời đã hết hạn hoặc bị thu hồi. Hỏi chủ phòng gửi mã mới nhé.'],
    [410, 'ROOM_NOT_JOINABLE', 'Phòng này không nhận thêm người nữa, nên mã mới cũng không giúp được. Hỏi chủ phòng nếu bạn cần vào.'],
    [410, 'ROOM_EXPIRED', 'Phòng này đã hết hạn, nên mã mới cũng không giúp được. Hỏi chủ phòng tạo phòng mới nhé.'],
    [429, 'RATE_LIMITED', 'Thử quá nhiều lần. Đợi một chút rồi thử lại.'],
  ] as const)('retains %s %s content and the entered code', async (status, code, message) => {
    mockStatus = session
    const join = session === 'user' ? mockJoin : mockGuest
    join.mockRejectedValue(new ApiError(status, { code, message: 'generic' }))
    await render(<JoinByCodeScreen />)
    await fireEvent.changeText(screen.getByLabelText('Mã mời'), 'valid-code')
    if (session !== 'user') await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan')
    await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
    if (session === 'guest') await fireEvent.press(screen.getByRole('button', { name: 'Thay và tham gia' }))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.getByLabelText('Mã mời').props.value).toBe('valid-code')
    expect(screen.getByRole('button', { name: 'Vào phòng' })).not.toBeDisabled()
    expect(screen.queryByTestId('invite-expired')).toBeNull()
    expect(screen.queryByTestId('invite-unusable')).toBeNull()
    if (session === 'user') {
      expect(mockJoin).toHaveBeenCalledWith({ inviteCode: 'valid-code' })
      expect(mockGuest).not.toHaveBeenCalled()
    } else {
      expect(mockGuest).toHaveBeenCalledWith({ inviteCode: 'valid-code', displayName: 'Lan' })
      expect(mockJoin).not.toHaveBeenCalled()
    }
  })
})
