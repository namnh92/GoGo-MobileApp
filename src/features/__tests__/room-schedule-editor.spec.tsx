import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderScreen, roomFor } from './harness'
const mockMutate = jest.fn(async (body: Record<string, unknown>) => ({ ...roomFor('group-host'), constraintVersion: 8, constraints: body }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useUpdateRoomConstraints: () => ({ mutateAsync: mockMutate, isPending: false }),
}))
import { RoomScheduleEditor } from '@/features/gogo-room/room-schedule-editor.view'
import { localScheduleToIso } from '@/features/gogo-room/room-schedule'

beforeEach(() => mockMutate.mockClear())

it('sends an explicit local schedule with the version being edited', async () => {
  const room = roomFor('group-host', { constraintVersion: 7 })
  const view = await renderScreen(<RoomScheduleEditor room={room} />)
  await fireEvent.changeText(view.getByLabelText('Bắt đầu'), '12/09/2026 19:00')
  await fireEvent.press(view.getByText('Lưu'))
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
    startAt: localScheduleToIso('12/09/2026 19:00'), expectedConstraintVersion: 7,
    budgetAmount: room.constraints!.budgetAmount,
  })))
})

it('rejects an end before the start without sending a request', async () => {
  const view = await renderScreen(<RoomScheduleEditor room={roomFor('group-host', { constraintVersion: 7 })} />)
  await fireEvent.changeText(view.getByLabelText('Bắt đầu'), '12/09/2026 19:00')
  await fireEvent.changeText(view.getByLabelText('Kết thúc (không bắt buộc)'), '12/09/2026 18:00')
  await fireEvent.press(view.getByText('Lưu'))
  await waitFor(() => expect(view.getByText(/Kiểm tra ngày giờ hợp lệ/)).toBeTruthy())
  expect(mockMutate).not.toHaveBeenCalled()
})

it('does not allow an active room to be rescheduled', async () => {
  const view = await renderScreen(<RoomScheduleEditor room={roomFor('group-host', { status: 'active' })} />)
  expect(view.getByLabelText('Bắt đầu').props.editable).toBe(false)
  expect(view.getByText('Không thể sửa lịch ở trạng thái hiện tại.')).toBeTruthy()
})
