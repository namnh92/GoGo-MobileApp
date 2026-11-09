import { fireEvent, waitFor, within } from '@testing-library/react-native'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { RoomEditSheet } from '@/features/gogo-room/room-edit-sheet.view'
import { renderScreen, roomFor, type Audience } from './harness'
let mockPending = false
const mockMutate = jest.fn(async (body: Record<string, unknown>) => ({ ...roomFor('group-host'), constraintVersion: 8, constraints: body }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useUpdateRoomConstraints: () => ({ mutateAsync: mockMutate, isPending: mockPending }),
}))
import { RoomScheduleEditor } from '@/features/gogo-room/room-schedule-editor.view'
import { isoToLocalSchedule, localScheduleToIso } from '@/features/gogo-room/room-schedule'

jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

beforeEach(() => { mockMutate.mockClear(); mockPending = false })

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
    constraints: { budgetMode: 'per_person', budgetAmount: 300_000, currency: 'VND', administrativeArea: null, startAt: '2026-09-10T12:00:00Z', endAt: '2026-09-10T15:00:00Z' },
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
  // GoGo-BE#576: RoomConstraintPatch keeps a field that is omitted, so only an
  // explicit null clears the end. Omitting it silently kept the old end.
  expect(mockMutate.mock.calls[1][0]).toHaveProperty('endAt', null)
})

it('does not allow an active room to be rescheduled', async () => {
  const view = await renderScreen(<RoomScheduleEditor room={roomFor('group-host', { status: 'active' })} />)
  expect(view.getByLabelText('Bắt đầu').props.editable).toBe(false)
  expect(view.getByText('Không thể sửa lịch ở trạng thái hiện tại.')).toBeTruthy()
})



describe.each(['orange', 'orangeDark'] as const)('595 schedule through real sheet / %s', theme => {
  const audiences: Audience[] = ['couple', 'group-host', 'group-guest']
  it.each(audiences.flatMap(audience => ['default', 'pending', 'empty', 'error'].map(state => [audience, state] as const)))('%s × %s', async (audience, state) => {
    const base = roomFor(audience)
    const room = roomFor(audience, { constraints: { ...base.constraints!,
      startAt: state === 'empty' ? undefined : '2026-11-14T11:30:00Z',
      endAt: state === 'empty' ? undefined : '2026-11-14T15:00:00Z',
    } })
    const element = <ThemeScopeProvider name={theme}>
      <RoomEditSheet label="Ngày giờ kèo" value="" pending={mockPending}>
        {close => <RoomScheduleEditor room={room} onCancel={close} />}
      </RoomEditSheet>
    </ThemeScopeProvider>
    const view = await renderScreen(element)
    await fireEvent.press(view.getByText('Sửa'))
    const input = view.getByLabelText('Bắt đầu')
    expect(input.props.value).toBe(state === 'empty' ? '' : isoToLocalSchedule('2026-11-14T11:30:00Z'))
    expect(view.getByLabelText('Kết thúc (không bắt buộc)').props.value).toBe(state === 'empty' ? '' : isoToLocalSchedule('2026-11-14T15:00:00Z'))
    expect(input.props.editable).toBe(audience !== 'group-guest')
    if (state === 'pending') {
      mockPending = true
      // Rerender the actual sheet with its pending close guard too.
      await view.rerender(<ThemeScopeProvider name={theme}>
        <RoomEditSheet label="Ngày giờ kèo" value="" pending>
          {close => <RoomScheduleEditor room={room} onCancel={close} />}
        </RoomEditSheet>
      </ThemeScopeProvider>)
      expect(view.getByLabelText('Bắt đầu', { includeHiddenElements: true }).props.editable).toBe(false)
      expect(within(view.getByTestId('room-edit-sheet-modal')).getByTestId('blocking-loading-overlay')).toBeTruthy()
      await fireEvent(view.getByTestId('room-edit-sheet-modal'), 'requestClose')
      expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
    } else if (state === 'error' && audience !== 'group-guest') {
      mockMutate.mockRejectedValueOnce(new Error('offline'))
      await fireEvent.changeText(input, isoToLocalSchedule('2026-11-14T12:00:00Z'))
      await fireEvent.press(view.getByText('Lưu'))
      expect(await view.findByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
      expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
      expect(input.props.value).toBe(isoToLocalSchedule('2026-11-14T12:00:00Z'))
    } else {
      expect(mockMutate).not.toHaveBeenCalled()
      if (audience === 'group-guest') expect(view.getByText('Không thể sửa lịch ở trạng thái hiện tại.')).toBeTruthy()
    }
    expect(view.getByText('Huỷ', { includeHiddenElements: true })).toBeTruthy()
  })
})
