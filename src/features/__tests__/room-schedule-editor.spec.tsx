import * as DialogModule from '@/shared/ui/dialog.view'
const mockDialog = jest.spyOn(DialogModule, 'Dialog')
import { StyleSheet } from 'react-native'
import i18n from '@/shared/i18n'
import { spacing, type } from '@/shared/ui/tokens'
import { RoomTitleEditor } from '@/features/gogo-room/room-title-editor.view'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { styles as editStyles } from '@/features/gogo-room/room-edit-sheet.style'
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
async function press(node: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(node) }) }
async function confirmSave(view: Awaited<ReturnType<typeof renderScreen>>) {
  expect(await view.findByText('Đổi điều kiện phòng?')).toBeTruthy()
  await press(view.getAllByRole('button', { name: 'Xác nhận' }).at(-1)!)
}

it('sends an explicit local schedule with the version being edited', async () => {
  const room = roomFor('group-host', { constraintVersion: 7 })
  const view = await renderScreen(<RoomScheduleEditor room={room} />)
  await fireEvent.changeText(view.getByLabelText('Bắt đầu'), '12/09/2026 19:00')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  await confirmSave(view)
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
    startAt: localScheduleToIso('12/09/2026 19:00'), expectedConstraintVersion: 7,
    budgetAmount: room.constraints!.budgetAmount,
  })))
})

it('rejects an end before the start without sending a request', async () => {
  const view = await renderScreen(<RoomScheduleEditor room={roomFor('group-host', { constraintVersion: 7 })} />)
  await fireEvent.changeText(view.getByLabelText('Bắt đầu'), '12/09/2026 19:00')
  await fireEvent.changeText(view.getByLabelText('Kết thúc (không bắt buộc)'), '12/09/2026 18:00')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
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
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  await confirmSave(view)
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
  expect(mockMutate.mock.calls[0][0]).toMatchObject({ startAt: '2026-09-10T13:00:00.000Z', endAt: '2026-09-10T15:00:00.000Z' })

  await fireEvent.changeText(view.getByLabelText('Kết thúc (không bắt buộc)'), '')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  await confirmSave(view)
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
    await press(view.getByText('Sửa'))
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
      await press(view.getByRole('button', { name: 'Xác nhận' }))
      await confirmSave(view)
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

// Owner simulator feedback 2026-11-12: structure guarantees equal input tops;
// Jest does not measure native text geometry or substitute for a 320pt sim check.
describe.each(['vi', 'en'] as const)('595 owner sim layout / %s', language => {
  afterEach(async () => { await act(async () => { await i18n.changeLanguage('vi') }) })
  it.each(['orange', 'orangeDark'] as const)('single-line equal-height labels and compact token spacing / %s', async theme => {
    await act(async () => { await i18n.changeLanguage(language) })
    const view = await renderScreen(<ThemeScopeProvider name={theme}>
      <RoomEditSheet label="edit" value="">
        {close => <><RoomTitleEditor room={roomFor('group-host')} /><RoomScheduleEditor room={roomFor('group-host')} onCancel={close} /></>}
      </RoomEditSheet>
    </ThemeScopeProvider>)
    await press(view.getByText(i18n.t('roomLobby.edit')))
    const start = view.getByText(i18n.t('roomSchedule.start'))
    const end = view.getByText(language === 'vi' ? 'Kết thúc' : 'End')
    expect(start.props.numberOfLines).toBe(1)
    expect(end.props.numberOfLines).toBe(1)
    expect(StyleSheet.flatten(start.props.style).height).toBe(type.label.lineHeight)
    expect(StyleSheet.flatten(end.props.style).height).toBe(type.label.lineHeight)
    for (const name of ['start', 'end']) {
      const column = view.getByTestId(`room-schedule-${name}`)
      expect(StyleSheet.flatten(column.props.style)).toMatchObject({ flex: 1, minWidth: 0, gap: spacing[2] })
      // The same label box and gap precede each input; optional copy follows it.
      expect(column.children[0]).toBe(name === 'start' ? start : end)
      expect(within(column).getByLabelText(i18n.t(`roomSchedule.${name}`))).toBeTruthy()
    }
    const endColumn = view.getByTestId('room-schedule-end')
    expect(within(endColumn).getByText(i18n.t('common.optional'))).toBeTruthy()
    expect(StyleSheet.flatten(view.getByTestId('room-edit-body').props.style)).toMatchObject({ gap: spacing[4], paddingTop: spacing[2] })
    for (const id of ['room-title-section', 'room-schedule-section']) {
      expect(StyleSheet.flatten(view.getByTestId(id).props.style)).toMatchObject({ gap: spacing[2], padding: spacing[0], marginBottom: spacing[0] })
    }
    expect(StyleSheet.flatten(view.getByTestId('room-title-field').props.style).gap).toBe(spacing[2])
    expect(view.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  })
})

it('595 owner sim layout spacing uses section and field tokens without card insets', () => {
  expect(editStyles.editorBody).toEqual({ gap: spacing[4], paddingTop: spacing[2] })
  expect(editStyles.editorSection).toEqual({ padding: spacing[0], marginBottom: spacing[0], gap: spacing[2] })
  expect(editStyles.fieldGroup).toEqual({ gap: spacing[2] })
})

it('confirms schedule changes before mutating and preserves the draft on cancel', async () => {
  const view = await renderScreen(<RoomScheduleEditor room={roomFor('group-host')} />)
  expect(view.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  await act(async () => { await fireEvent.changeText(view.getByLabelText('Bắt đầu'), '12/09/2026 19:00') })
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  expect(await view.findByText('Đổi điều kiện phòng?')).toBeTruthy()
  expect(view.getByText(i18n.t('roomManage.staleWarning'))).toBeTruthy()
  expect(mockMutate).not.toHaveBeenCalled()
  await press(view.getByRole('button', { name: 'Huỷ' }))
  expect(mockMutate).not.toHaveBeenCalled()
  expect(view.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  expect(view.getByLabelText('Bắt đầu').props.value).toBe('12/09/2026 19:00')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  await confirmSave(view)
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
})

it('shows ResultSheet inside the existing editor Modal and retains the schedule on dismiss', async () => {
  const view = await renderScreen(<RoomEditSheet label="edit" value="">
    {close => <RoomScheduleEditor room={roomFor('group-host')} onCancel={close} />}
  </RoomEditSheet>)
  await press(view.getByRole('button', { name: 'Sửa' }))
  await fireEvent.changeText(view.getByLabelText('Bắt đầu'), '12/09/2026 19:00')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  expect(view.getByTestId('room-conditions-confirmation')).toBeTruthy()
  expect(view.queryByTestId('room-conditions-confirmation-modal', { includeHiddenElements: true })).toBeNull()
  expect(mockDialog).not.toHaveBeenCalled()
  await fireEvent(view.getByTestId('room-edit-sheet-modal'), 'requestClose')
  expect(mockMutate).not.toHaveBeenCalled()
  expect(view.getByLabelText('Bắt đầu').props.value).toBe('12/09/2026 19:00')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  await press(within(view.getByTestId('room-conditions-confirmation')).getByRole('button', { name: 'Huỷ' }))
  expect(mockMutate).not.toHaveBeenCalled()
  expect(view.getByLabelText('Bắt đầu').props.value).toBe('12/09/2026 19:00')
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  await confirmSave(view)
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
})
