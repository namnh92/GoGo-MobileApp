import { act, fireEvent, render, screen } from '@testing-library/react-native'
import '@/shared/i18n'

const mockPush = jest.fn()
const mockJoin = jest.fn()
const mockGuest = jest.fn()
const mockConfirm = jest.fn(async () => true)
let mockStatus = 'user'
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus, joinAsGuest: mockGuest }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useJoinRoom: () => ({ mutateAsync: mockJoin }) }))
jest.mock('@/features/gogo-room/guest-replace-notice.view', () => ({ useConfirmReplaceGuest: () => ({ confirmReplaceGuest: mockConfirm, dialog: null }) }))
import { QuickJoin } from '@/features/home/quick-join.view'

beforeEach(() => { mockStatus = 'user'; jest.clearAllMocks(); mockJoin.mockResolvedValue({ roomId: 'room-1', alreadyMember: false }); mockGuest.mockResolvedValue({ roomId: 'room-2' }); mockConfirm.mockResolvedValue(true) })
async function code() { await fireEvent.changeText(screen.getByLabelText('Mã mời'), 'long-invite-code') }

it('joins on Home with unrestricted invite length and uses the canonical room resolver', async () => {
  await render(<QuickJoin />)
  await code()
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  expect(mockJoin).toHaveBeenCalledWith({ inviteCode: 'long-invite-code' })
  expect(mockPush).toHaveBeenCalledWith('/room/room-1')
})
it('reuses the known guest name and cancellation leaves the session untouched', async () => {
  mockStatus = 'guest'; mockConfirm.mockResolvedValue(false)
  await render(<QuickJoin knownName="Linh" />)
  await code()
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  expect(mockConfirm).toHaveBeenCalledTimes(1)
  expect(mockGuest).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
})
it('keeps the missing-name sheet until a name is supplied and waits for modal dismissal before confirmation', async () => {
  mockStatus = 'guest'
  await render(<QuickJoin />)
  await code()
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  expect(mockConfirm).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Mai')
  let modal = screen.getByLabelText('Tên hiển thị').parent
  while (modal && modal.type !== 'Modal') modal = modal.parent
  if (!modal) throw new Error('Name field must be inside a Modal')
  const dismissed = modal.props.onDismiss
  await fireEvent.press(screen.getAllByRole('button', { name: 'Vào phòng' }).at(-1)!)
  expect(mockConfirm).not.toHaveBeenCalled()
  await act(async () => { dismissed() })
  expect(mockGuest).toHaveBeenCalledWith({ inviteCode: 'long-invite-code', displayName: 'Mai' })
  expect(mockPush).toHaveBeenCalledWith('/room/room-2')
})
it('suppresses duplicate submissions and renders a failed invite without navigation', async () => {
  let reject!: (reason: Error) => void
  mockJoin.mockReturnValue(new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
  await render(<QuickJoin />)
  await code()
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }))
  expect(mockJoin).toHaveBeenCalledTimes(1)
  await act(async () => { reject(new Error('failed')) })
  expect(mockPush).not.toHaveBeenCalled()
  expect(screen.getByText('Chưa vào được phòng. Thử lại nhé.')).toBeTruthy()
})
