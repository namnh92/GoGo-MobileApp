import { act, fireEvent, screen } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import { render } from '@/shared/ui/__tests__/query-render'
import { StyleSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import { loaded, pending, failed } from './harness'

const mockPush = jest.fn()
const mockRetry = jest.fn()
const mockMore = jest.fn()
let mockUser = 'user'
let mockOnline = true
let mockCapability: boolean | undefined = true
let mockSummary: any
let mockLedger: any
const mockSummaryEnabled = jest.fn()
const mockLedgerEnabled = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => false, replace: jest.fn() }), useFocusEffect: jest.fn() }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockUser }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => mockOnline, currentOfflineSpell: () => 0 }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: { actorType: mockUser, capabilities: { assistantCredits: mockCapability } } }),
  useMyCredits: (enabled: boolean) => { mockSummaryEnabled(enabled); return mockSummary },
  useMyCreditLedger: (enabled: boolean) => { mockLedgerEnabled(enabled); return mockLedger },
}))
import CreditsScreen from '@/features/credits/credits.view'
import { CreditBalanceRow } from '@/features/credits/credit-balance.view'

const facts = { balance: 12345, earned: 12400, spent: 55, reserved: 0, availableBalance: 12345, asOf: '2026-11-10T00:00:00Z', policyKey: 'legacy_allowance_v1' }
const entry = { id: 'entry-1', delta: -1, createdAt: '2026-11-10T01:00:00.123456Z', direction: 'spent', eventKey: 'assistant_usage', source: { type: 'assistant_usage' } }
beforeEach(async () => {
  await i18n.changeLanguage('vi')
  mockUser = 'user'; mockOnline = true; mockCapability = true
  mockSummary = loaded(facts)
  mockLedger = { ...loaded({ pages: [{ items: [entry], nextCursor: 'opaque' }] }), refresh: mockRetry, fetchNextPage: mockMore, hasNextPage: true }
  jest.clearAllMocks()
})
afterEach(() => StyleSheet.configure({ themes }))

it.each(['orange', 'orangeDark'] as const)('shows balance and signed ledger in %s with vi/en separators', async theme => {
  StyleSheet.configure({ themes: { [theme]: themes[theme] } as unknown as typeof themes })
  const view = await render(<CreditsScreen />)
  expect(screen.getByText('12.345')).toBeTruthy()
  expect(screen.getByText('-1')).toBeTruthy()
  expect(screen.getByText('Sử dụng GoGo AI')).toBeTruthy()
  await act(async () => { await i18n.changeLanguage('en') })
  expect(screen.getByText('12,345')).toBeTruthy()
  expect(screen.getByText('GoGo AI usage')).toBeTruthy()
  await view.unmount()
})
it('shows a number skeleton without inventing zero and opens history', async () => {
  mockSummary = pending()
  const view = await render(<CreditBalanceRow />)
  expect(screen.getByTestId('credit-balance-loading')).toBeTruthy()
  expect(screen.queryByText('0')).toBeNull()
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Credit GoGo' })) })
  expect(mockPush).toHaveBeenCalledWith('/me/credits')
  mockSummary = failed()
  await view.rerender(<CreditBalanceRow />)
  expect(screen.getByText('Chưa có thông tin credit')).toBeTruthy()
  expect(screen.queryByText('0')).toBeNull()
})
it('shows first-load skeleton, real zero/empty, and contribution navigation', async () => {
  mockSummary = pending(); mockLedger = { ...mockLedger, ...pending() }
  const view = await render(<CreditsScreen />)
  expect(screen.getByTestId('credits-loading')).toBeTruthy()
  mockSummary = loaded({ ...facts, balance: 0, earned: 0, spent: 0 })
  mockLedger = { ...mockLedger, ...loaded({ pages: [{ items: [], nextCursor: null }] }), hasNextPage: false }
  await view.rerender(<CreditsScreen />)
  expect(screen.getAllByText('0')).toHaveLength(3)
  expect(screen.getByText('Chưa có lịch sử credit')).toBeTruthy()
  await act(async () => { fireEvent.press(screen.getByText('Đóng góp địa điểm')) })
  expect(mockPush).toHaveBeenCalledWith('/places/contribution')
})
it('retries initial errors, preserves rows for footer failure and retries that page', async () => {
  mockSummary = { ...failed(), refetch: mockRetry }
  mockLedger = { ...mockLedger, ...failed(), refetch: mockRetry }
  const view = await render(<CreditsScreen />)
  expect(screen.queryByText('Chưa có lịch sử credit')).toBeNull()
  await act(async () => { fireEvent.press(screen.getAllByText('Thử lại')[0]) })
  expect(mockRetry).toHaveBeenCalled()
  mockSummary = loaded(facts)
  mockLedger = { ...mockLedger, ...loaded({ pages: [{ items: [entry], nextCursor: 'opaque' }] }), isFetchNextPageError: true }
  await view.rerender(<CreditsScreen />)
  expect(screen.getByText('-1')).toBeTruthy()
  expect(screen.getByTestId('credits-footer-error')).toBeTruthy()
  await act(async () => { fireEvent.press(screen.getByText('Thử lại')) })
  expect(mockMore).toHaveBeenCalledTimes(1)
})
it('loads more and refreshes both totals and the cursor chain', async () => {
  mockSummary.refetch = mockRetry
  await render(<CreditsScreen />)
  await act(async () => { fireEvent.press(screen.getByText('Xem thêm')) })
  expect(mockMore).toHaveBeenCalledTimes(1)
  const control = screen.getByTestId('credits-ledger').props.refreshControl
  await act(async () => { await control.props.onRefresh() })
  expect(mockRetry).toHaveBeenCalledTimes(2)
})
it('shows cold offline and visibly stale cached rows', async () => {
  mockOnline = false; mockSummary = { ...pending(), isPaused: true }; mockLedger = { ...mockLedger, ...pending(), isPaused: true }
  const view = await render(<CreditsScreen />)
  expect(screen.queryByTestId('credits-loading')).toBeNull()
  expect(screen.getAllByText(i18n.t('common.offlineTitle')).length).toBeGreaterThan(0)
  mockSummary = loaded(facts); mockLedger = { ...mockLedger, ...loaded({ pages: [{ items: [entry] }] }) }
  await view.rerender(<CreditsScreen />)
  expect(screen.getByText('-1')).toBeTruthy()
  expect(screen.getByText(i18n.t('common.staleOffline'))).toBeTruthy()
})
it.each([false, undefined])('hides entry and disables personal reads when capability is %s', async capability => {
  mockCapability = capability
  const view = await render(<CreditBalanceRow />)
  expect(screen.queryByTestId('credit-balance-row')).toBeNull()
  await view.rerender(<CreditsScreen />)
  expect(mockSummaryEnabled).toHaveBeenLastCalledWith(false)
  expect(mockLedgerEnabled).toHaveBeenLastCalledWith(false)
  expect(screen.queryByText('12.345')).toBeNull()
})
it('guest sees sign-in without rendering cached personal facts', async () => {
  mockUser = 'guest'
  await render(<CreditsScreen />)
  expect(mockSummaryEnabled).toHaveBeenLastCalledWith(false)
  expect(mockLedgerEnabled).toHaveBeenLastCalledWith(false)
  expect(screen.queryByText('12.345')).toBeNull()
  expect(screen.getByText(i18n.t('auth.signInCta'))).toBeTruthy()
})
