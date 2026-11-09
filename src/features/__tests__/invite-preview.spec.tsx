import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { api } from '@/shared/api/client'
import GuestJoinScreen from '@/features/gogo-room/guest-join.view'
import { InvitePreview } from '@/features/gogo-room/invite-preview.view'
import i18n from '@/shared/i18n'

const mockJoin = jest.fn()
const mockGuest = jest.fn()
const mockReplace = jest.fn()
let mockStatus = 'user'
let mockCode = 'private-invite-credential'
jest.mock('@/shared/api/client', () => ({ api: { post: jest.fn() } }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useNavigation: () => ({ isFocused: () => true }),
  useLocalSearchParams: () => ({ inviteCode: mockCode }),
}))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useJoinRoom: () => ({ mutateAsync: mockJoin }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus, joinAsGuest: mockGuest }) }))
jest.mock('@/features/gogo-room/guest-replace-notice.view', () => ({ useConfirmReplaceGuest: () => ({ confirmReplaceGuest: jest.fn(), dialog: null }) }))
const facts = { inviter: { displayName: 'Mai', avatarUrl: null, emailVerified: true }, roomType: 'group' as const, participantCount: 7 }
beforeEach(async () => { jest.clearAllMocks(); mockStatus = 'user'; mockCode = 'private-invite-credential'; await i18n.changeLanguage('vi') })
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(<QueryClientProvider client={client}><GuestJoinScreen /></QueryClientProvider>)
  return client
}
it('loads facts and never joins on mount; query metadata contains no code', async () => {
  jest.mocked(api.post).mockResolvedValue(facts)
  const client = await mount()
  expect(await screen.findByText('Mai')).toBeTruthy()
  expect(screen.getByText('Nhóm · 7 người')).toBeTruthy()
  expect(screen.getByText('Đã xác minh email')).toBeTruthy()
  expect(screen.queryByText('Khu vực đề xuất')).toBeNull()
  expect(mockJoin).not.toHaveBeenCalled(); expect(mockGuest).not.toHaveBeenCalled()
  expect(JSON.stringify(client.getQueryCache().getAll().map(q => q.queryKey))).not.toContain(mockCode)
})
it('renders the preview skeleton without starting join', async () => {
  jest.mocked(api.post).mockReturnValue(new Promise(() => {}))
  await mount()
  expect(screen.getByTestId('invite-preview-loading')).toBeTruthy()
  expect(mockJoin).not.toHaveBeenCalled()
})
it.each([[404, 'INVITE_NOT_FOUND', 'invite-unusable'], [410, 'INVITE_NOT_USABLE', 'invite-expired'], [410, 'ROOM_NOT_JOINABLE', 'invite-unusable'], [410, 'ROOM_EXPIRED', 'invite-unusable']])('renders recovery for %s %s', async (status, code, testId) => {
  jest.mocked(api.post).mockRejectedValue(new ApiError(status as number, { code, message: 'generic' }))
  await mount()
  expect(await screen.findByTestId(testId)).toBeTruthy()
  expect(mockJoin).not.toHaveBeenCalled()
  if (['ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'].includes(code)) expect(screen.queryByText('Nhắn tin cho bạn bè để gửi lại link phòng mới')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Về trang chủ' }))
  expect(mockReplace).toHaveBeenCalledWith('/')
})
it.each([new ApiError(429, { code: 'RATE_LIMITED', message: 'generic' }), new NetworkError()])('shows a recoverable read failure without joining', async error => {
  jest.mocked(api.post).mockRejectedValue(error)
  await mount()
  const retry = await screen.findByRole('button', { name: 'Thử lại' })
  jest.mocked(api.post).mockResolvedValue(facts)
  await fireEvent.press(retry)
  expect(await screen.findByText('Mai')).toBeTruthy()
  expect(mockJoin).not.toHaveBeenCalled()
})
it('changes deep links without reusing the previous invitation facts', async () => {
  jest.mocked(api.post).mockResolvedValue(facts)
  const client = await mount()
  expect(await screen.findByText('Mai')).toBeTruthy()
  mockCode = 'another-secret'
  jest.mocked(api.post).mockResolvedValue({ ...facts, inviter: { ...facts.inviter, displayName: 'Lan' } })
  await screen.rerender(<QueryClientProvider client={client}><GuestJoinScreen /></QueryClientProvider>)
  expect(await screen.findByText('Lan')).toBeTruthy()
  expect(screen.queryByText('Mai')).toBeNull()
  await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1))
})
it('omits unavailable facts, never presents email verification as KYC, and formats budget with its unit in English', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  await render(<InvitePreview data={{ ...facts, inviter: { ...facts.inviter, emailVerified: false }, budget: { mode: 'total', amount: 12345, currency: 'USD' } }} />)
  expect(screen.getByText('$123.45 / group')).toBeTruthy()
  expect(screen.queryByText('Email verified')).toBeNull()
  expect(screen.queryByTestId('invite-avatar')).toBeNull()
})

it('waits for session hydration before preview or join', async () => {
  mockStatus = 'hydrating'
  await mount()
  expect(api.post).not.toHaveBeenCalled()
  expect(mockJoin).not.toHaveBeenCalled()
  expect(mockGuest).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Tên hiển thị')).toBeNull()
})
