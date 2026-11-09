import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderScreen, roomFor, type Audience } from './harness'

let mockPending = false
const mockRename = jest.fn()
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRenameRoom: () => ({ mutateAsync: (...args: unknown[]) => mockRename(...args), isPending: mockPending }),
}))
import { ApiError } from '@/shared/api/errors'
import { RoomTitleEditor } from '@/features/gogo-room/room-title-editor.view'

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}
async function type(element: Parameters<typeof fireEvent.changeText>[0], text: string) {
  await act(async () => {
    await fireEvent.changeText(element, text)
  })
}

beforeEach(() => { mockRename.mockReset(); mockPending = false })

it('sends a trimmed name and confirms the rename', async () => {
  mockRename.mockResolvedValue({ ...roomFor('group-host'), title: 'Cà phê cuối tuần' })
  const view = await renderScreen(<RoomTitleEditor room={roomFor('group-host', { title: 'Tên cũ' })} />)
  await type(view.getByLabelText('Tên kèo'), '  Cà phê cuối tuần  ')
  await press(view.getByText('Lưu'))
  await waitFor(() => expect(mockRename).toHaveBeenCalledWith('Cà phê cuối tuần'))
  expect(await view.findByText('✓ Đã đổi tên kèo')).toBeTruthy()
})

it('removes the name when the field is emptied', async () => {
  mockRename.mockResolvedValue({ ...roomFor('group-host'), title: undefined })
  const view = await renderScreen(<RoomTitleEditor room={roomFor('group-host', { title: 'Tên cũ' })} />)
  await type(view.getByLabelText('Tên kèo'), '   ')
  await press(view.getByText('Lưu'))
  await waitFor(() => expect(mockRename).toHaveBeenCalledWith(null))
  expect(await view.findByText('✓ Đã bỏ tên kèo')).toBeTruthy()
})

it('refuses more than 80 characters before sending', async () => {
  const view = await renderScreen(<RoomTitleEditor room={roomFor('group-host')} />)
  await type(view.getByLabelText('Tên kèo'), 'a'.repeat(81))
  await press(view.getByText('Lưu'))
  expect(await view.findByText('Tên kèo tối đa 80 ký tự.')).toBeTruthy()
  expect(mockRename).not.toHaveBeenCalled()
})

it('stays read-only once the plan is past planning', async () => {
  const view = await renderScreen(<RoomTitleEditor room={roomFor('group-host', { status: 'active', title: 'Đang đi' })} />)
  expect(view.getByLabelText('Tên kèo').props.editable).toBe(false)
  expect(view.getByText('Không thể đổi tên ở trạng thái hiện tại.')).toBeTruthy()
  await press(view.getByText('Lưu'))
  expect(mockRename).not.toHaveBeenCalled()
})

it('explains a server refusal instead of a generic failure', async () => {
  mockRename.mockRejectedValue(new ApiError(409, { code: 'ROOM_NOT_EDITABLE', message: 'locked' }))
  const view = await renderScreen(<RoomTitleEditor room={roomFor('group-host')} />)
  await type(view.getByLabelText('Tên kèo'), 'Muộn rồi')
  await press(view.getByText('Lưu'))
  expect(await view.findByText('Không thể đổi tên ở trạng thái hiện tại.')).toBeTruthy()
  expect(view.queryByText('Chưa lưu được. Thử lại nhé.')).toBeNull()
})


describe('595 title editor audience × state', () => {
  const audiences: Audience[] = ['couple', 'group-host', 'group-guest']
  it.each(audiences.flatMap(audience => ['default', 'loading', 'empty', 'error'].map(state => [audience, state] as const)))('%s × %s', async (audience, state) => {
    mockPending = state === 'loading'
    const room = roomFor(audience, { title: state === 'empty' ? undefined : 'Tên cũ' })
    const view = await renderScreen(<RoomTitleEditor room={room} onCancel={jest.fn()} />)
    const input = view.getByLabelText('Tên kèo')
    expect(input.props.editable).toBe(audience !== 'group-guest' && state !== 'loading')
    if (state === 'empty') expect(input.props.value).toBe('')
    if (state === 'error' && audience !== 'group-guest') {
      mockRename.mockRejectedValueOnce(new Error('offline'))
      await type(input, 'Tên mới')
      await press(view.getByText('Lưu'))
      expect(await view.findByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
    } else expect(mockRename).not.toHaveBeenCalled()
    expect(view.getByText('Huỷ')).toBeTruthy()
  })
})
