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
jest.mock('@/features/gogo-room/guest-replace-notice.view', () => ({ useConfirmReplaceGuest: () => ({ confirmReplaceGuest: jest.fn(), dialog: null }) }))
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
it.each([[404, 'INVITE_NOT_FOUND'], [410, 'INVITE_NOT_USABLE'], [410, 'ROOM_NOT_JOINABLE'], [410, 'ROOM_EXPIRED'], [429, 'RATE_LIMITED']])('retains typed-code error handling %s %s', async (status, code) => {
  mockJoin.mockRejectedValue(new ApiError(status as number, { code, message: 'generic' }))
  await render(<JoinByCodeScreen />)
  await fireEvent.changeText(screen.getByLabelText('Mã mời'), 'valid-code')
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  expect(screen.getByRole('button', { name: 'Vào phòng' })).not.toBeDisabled()
  expect(mockGuest).not.toHaveBeenCalled()
})
