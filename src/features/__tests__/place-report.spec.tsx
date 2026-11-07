import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderScreen } from './harness'

let mockStatus = 'guest'
const mockMutate = jest.fn()
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useReportPlace: () => ({ mutate: mockMutate, isPending: false }),
}))
import { PlaceReport } from '@/features/date-plan/place-report.view'

beforeEach(() => { mockStatus = 'guest'; mockMutate.mockClear() })

it.each(['guest', 'user'])('allows a %s to submit a reason and optional note', async status => {
  mockStatus = status
  await renderScreen(<PlaceReport placeId="p" onClose={() => {}} />)
  await fireEvent.press(screen.getByText('Sai giờ mở cửa'))
  await fireEvent.changeText(screen.getByLabelText('Chi tiết bổ sung (không ghi thông tin liên hệ)'), '  Mở lúc 10 giờ  ')
  await fireEvent.press(screen.getByText('Gửi báo cáo'))
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith({ reasonCode: 'wrong_hours', note: 'Mở lúc 10 giờ' }, expect.any(Object)))
})

it('asks anonymous actors to sign in and exposes no send action', async () => {
  mockStatus = 'anonymous'
  await renderScreen(<PlaceReport placeId="p" onClose={() => {}} />)
  expect(screen.getByText('Đăng nhập để báo thông tin sai.')).toBeTruthy()
  expect(screen.queryByText('Gửi báo cáo')).toBeNull()
})

it('refuses control characters before sending a moderator note', async () => {
  await renderScreen(<PlaceReport placeId="p" onClose={() => {}} />)
  await fireEvent.changeText(screen.getByLabelText('Chi tiết bổ sung (không ghi thông tin liên hệ)'), 'note\u0001')
  await fireEvent.press(screen.getByText('Gửi báo cáo'))
  await waitFor(() => expect(screen.getByText('Tối đa 500 ký tự, không chứa ký tự điều khiển.')).toBeTruthy())
  expect(mockMutate).not.toHaveBeenCalled()
})
