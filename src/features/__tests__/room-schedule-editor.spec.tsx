import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderScreen, roomFor } from './harness'
const mockMutate = jest.fn(async (body: Record<string, unknown>) => ({ ...roomFor('group-host'), constraintVersion: 8, constraints: body }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useUpdateRoomConstraints: () => ({ mutateAsync: mockMutate, isPending: false }),
}))
import { RoomScheduleEditor } from '@/features/gogo-room/room-schedule-editor.view'
import { isoToLocalSchedule, localScheduleToIso } from '@/features/gogo-room/room-schedule'

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

it('clears an existing end when the host empties the field, and keeps it otherwise', async () => {
  const room = roomFor('group-host', {
    constraintVersion: 7,
    constraints: { budgetMode: 'per_person', budgetAmount: 300_000, currency: 'VND', startAt: '2026-09-10T12:00:00Z', endAt: '2026-09-10T15:00:00Z' },
  })
  const view = await renderScreen(<RoomScheduleEditor room={room} />)
  // Still before the prefilled end in any time zone the test may run in.
  await fireEvent.changeText(view.getByLabelText('Bắt đầu'), isoToLocalSchedule('2026-09-10T13:00:00Z'))
  await fireEvent.press(view.getByText('Lưu'))
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
  expect(mockMutate.mock.calls[0][0]).toMatchObject({ startAt: '2026-09-10T13:00:00.000Z', endAt: '2026-09-10T15:00:00.000Z' })

  await fireEvent.changeText(view.getByLabelText('Kết thúc (không bắt buộc)'), '')
  await fireEvent.press(view.getByText('Lưu'))
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(2))
  expect(mockMutate.mock.calls[1][0]).not.toHaveProperty('endAt')
})

it('does not allow an active room to be rescheduled', async () => {
  const view = await renderScreen(<RoomScheduleEditor room={roomFor('group-host', { status: 'active' })} />)
  expect(view.getByLabelText('Bắt đầu').props.editable).toBe(false)
  expect(view.getByText('Không thể sửa lịch ở trạng thái hiện tại.')).toBeTruthy()
})
