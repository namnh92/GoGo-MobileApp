import { act, fireEvent, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { themes } from '@/shared/ui/theme'
import { renderScreen } from './harness'
import SubmissionDetailScreen from '../contributions/submission-detail.view'

const mockRouter = { back: jest.fn(), push: jest.fn() }
const mockRetry = jest.fn()
const mockOpen = jest.fn()
let mockQuery: any
let mockOnline = true
let mockId: string | undefined = 's1'
let mockSession = 'user'
const mockHook = jest.fn()
const labels = (entries: [string, string][]) => entries.map(([key, label]) => ({ key, labels: { vi: label } }))
const mockTaxonomy = { data: { kinds: {
  category: labels([['cafe', 'Cà phê']]), mood: labels([['quiet', 'Yên tĩnh']]), suitability: labels([['work', 'Làm việc']]),
  amenity: labels(Array.from({ length: 7 }, (_, i) => [`amenity-${i}`, `Tiện ích ${i}`])), checkin_tag: labels([['kind', 'Thân thiện']]),
} } }
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ submissionId: mockId }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockSession }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => mockOnline, currentOfflineSpell: () => 99 }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: (...args: unknown[]) => { mockHook(...args); return mockQuery } }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useTaxonomies: () => mockTaxonomy }))
jest.mock('@/shared/navigation/external-links', () => ({ openWebsite: (url: string) => mockOpen(url) }))
const fixture = () => ({
  id: 's1', status: 'pending', createdAt: '2026-11-07T03:00:00Z', updatedAt: '2026-11-07T03:00:00Z',
  name: 'Quán của tôi', addressShort: 'Hà Nội', categoryKey: 'cafe', providerStatus: 'ok',
  photo: { id: 'photo', url: 'https://cdn.example.com/photo.jpg', source: 'google', attribution: 'Google Maps', authorAttributions: [{ displayName: 'Tác giả' }] },
  providerDisplay: { source: 'google_places', fetchedAt: '2026-11-07T03:00:00Z', name: 'Quán của tôi', addressShort: 'Hà Nội', googleRating: 4.4, googleRatingCount: 123,
    googleMapsUri: 'https://maps.google.com/?cid=123', attributions: ['Google Maps'], openingHours: [{ dayOfWeek: 5, openMinute: 480, closeMinute: 1380, isOvernight: false }] },
  contribution: { verificationStatus: 'unverified', note: 'Ghi chú riêng', enrichment: {
    price: { min: 50000, max: 100000, currency: 'VND', unit: 'per_person' }, purposeKeys: ['work'], vibeKeys: ['quiet', 'unknown'],
    amenities: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`amenity-${i}`, i !== 6])),
    service: { rating: 4, chipKeys: ['kind'] }, space: { rating: 5, chipKeys: [] }, recommendedDishes: 'Cà phê trứng', visitTips: 'Ghé sáng sớm',
  } },
})

export function submissionDetailCases(dark = false) {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-13T05:00:00Z') })
    jest.clearAllMocks()
    mockOnline = true; mockId = 's1'; mockSession = 'user'
    mockQuery = { data: fixture(), isPending: false, isError: false, refetch: mockRetry }
  })
  afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers() }); jest.useRealTimers() })
  it('renders private pending facts, taxonomy and owner experience without a priority badge', async () => {
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.getByText('Hồ sơ đóng góp')).toBeTruthy()
    expect(screen.getByText('Đang chờ GoGo duyệt')).toBeTruthy()
    expect(screen.getByText(/Bạn gửi ngày 07\/11\/2026/)).toBeTruthy()
    expect(screen.queryByText(/Ưu tiên duyệt/)).toBeNull()
    expect(screen.getByTestId('place-google-rating')).toBeTruthy()
    expect(screen.getAllByText('Hôm nay: 08:00–23:00')).toHaveLength(2)
    for (const label of ['Bạn đã bổ sung', 'Dữ liệu cá nhân', '50k–100k /người', 'Làm việc', '✓ Yên tĩnh', 'Phục vụ ★4/5', 'Không gian ★5/5', 'Thân thiện', '“Cà phê trứng”', '“Ghé sáng sớm”', '“Ghi chú riêng”']) expect(screen.getByText(label)).toBeTruthy()
    expect(screen.queryByText(/unknown/)).toBeNull()
    expect(screen.getAllByText(/Google/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/GoGo Credit/)).toBeNull()
    expect(screen.queryByTestId('app-tab-dock')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Mở Google Maps' }))
    expect(mockOpen).toHaveBeenCalledWith('https://maps.google.com/?cid=123')
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }))
    expect(mockRouter.back).toHaveBeenCalled()
    const banner = StyleSheet.flatten(screen.getByTestId('submission-status-banner').props.style)
    expect(banner.backgroundColor).toBe((dark ? themes.orangeDark : themes.orange).status.warningSoft)
  })
  it('limits true amenities to five and expands the remaining rows', async () => {
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.queryByText('Tiện ích 5')).toBeNull()
    expect(screen.queryByText('Tiện ích 6')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Xem tất cả' }))
    expect(screen.getByText('Tiện ích 5')).toBeTruthy()
    expect(screen.queryByText('Tiện ích 6')).toBeNull()
  })
  it('hides empty contribution/provider rows and uses the shared no-photo hero', async () => {
    mockQuery.data = { id: 's1', status: 'pending', createdAt: '2026-11-07T03:00:00Z' }
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.queryByTestId('submission-contribution')).toBeNull()
    expect(screen.queryByTestId('submission-experience')).toBeNull()
    expect(screen.queryByTestId('place-google-rating')).toBeNull()
    expect(screen.queryByTestId('submission-hours')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mở Google Maps' })).toBeNull()
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  })
  it.each(['budget_exhausted', 'deferred'])('keeps user input while hiding unavailable provider facts: %s', async status => {
    mockQuery.data.providerStatus = status
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.queryByTestId('place-google-rating')).toBeNull()
    expect(screen.queryByTestId('submission-hours')).toBeNull()
    expect(screen.getByText('Phục vụ ★4/5')).toBeTruthy()
    expect(screen.getByText('Thông tin địa điểm sẽ hiện khi GoGo lấy được dữ liệu')).toBeTruthy()
  })
  it('hides each absent experience row and unknown-scope prices without hiding valid input', async () => {
    mockQuery.data.contribution = { verificationStatus: 'unverified', enrichment: {
      price: { min: 50000, max: 100000, currency: 'VND', unit: 'unsupported' },
      service: { rating: 3, chipKeys: ['missing'] }, recommendedDishes: '   ', visitTips: 'Ghé buổi tối',
    } }
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.queryByText('Mức giá thực tế')).toBeNull()
    expect(screen.queryByText('Mục đích phù hợp')).toBeNull()
    expect(screen.queryByText('Tiện ích đã xác nhận')).toBeNull()
    expect(screen.queryByText('Món nên thử')).toBeNull()
    expect(screen.queryByText(/Không gian ★/)).toBeNull()
    expect(screen.getByText('Phục vụ ★3/5')).toBeTruthy()
    expect(screen.getByText('“Ghé buổi tối”')).toBeTruthy()
  })
  it.each([['free', 'Miễn phí'], ['per_group', '50k–100k · tổng nhóm']])('retains the explicit price unit %s', async (unit, label) => {
    mockQuery.data.contribution.enrichment.price.unit = unit
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.getByText(label)).toBeTruthy()
  })
  it('uses the stored cover credit once on one line and removes it when the photo fails', async () => {
    const view = await renderScreen(<SubmissionDetailScreen />)
    const credit = screen.getByTestId('saved-photo-attribution')
    expect(credit.props.numberOfLines).toBe(1)
    expect(credit.props.accessibilityLabel).toBe('Ảnh: Tác giả · Google Maps')
    await fireEvent(screen.getByTestId('place-photo-image'), 'error', { nativeEvent: { error: 'failed' } })
    expect(screen.queryByTestId('saved-photo-attribution')).toBeNull()
    await view.rerender(<SubmissionDetailScreen />)
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  })
  it('renders rejected reason and deadline without promising wallet credit', async () => {
    mockQuery.data.status = 'rejected'; mockQuery.data.rejectionReason = 'incorrect_location'; mockQuery.data.updateDeadline = '2026-11-20T03:00:00Z'
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.getByText('Bị từ chối')).toBeTruthy()
    expect(screen.getByText('Sai vị trí')).toBeTruthy()
    expect(screen.getByText('Hạn bổ sung: 20/11/2026')).toBeTruthy()
    expect(screen.queryByText(/GoGo Credit/)).toBeNull()
    expect(StyleSheet.flatten(screen.getByTestId('submission-status-banner').props.style).backgroundColor).toBe((dark ? themes.orangeDark : themes.orange).status.dangerSoft)
  })
  it('hides rejected photos once their deadline has elapsed', async () => {
    mockQuery.data.status = 'rejected'; mockQuery.data.updateDeadline = '2026-11-01T00:00:00Z'
    await renderScreen(<SubmissionDetailScreen />)
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByTestId('saved-photo-attribution')).toBeNull()
  })
  it('renders a matching skeleton, offline and retryable error states', async () => {
    mockQuery = { data: undefined, isPending: true, refetch: mockRetry }
    const view = await renderScreen(<SubmissionDetailScreen />)
    expect(screen.getByTestId('submission-detail-loading')).toBeTruthy()
    mockOnline = false
    await view.rerender(<SubmissionDetailScreen />)
    expect(screen.queryByTestId('submission-detail-loading')).toBeNull()
    expect(screen.getByText('Không có kết nối')).toBeTruthy()
    mockOnline = true; mockQuery.isError = true; mockQuery.error = new NetworkError('offline')
    await view.rerender(<SubmissionDetailScreen />)
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
    expect(mockRetry).toHaveBeenCalledTimes(1)
    mockQuery.error = new ApiError(429, { code: 'RATE_LIMITED', message: 'private' })
    await view.rerender(<SubmissionDetailScreen />)
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
    expect(screen.queryByText('private')).toBeNull()
  })
  it('handles not-found and the unauthenticated route', async () => {
    mockQuery = { isError: true, error: new ApiError(404, { code: 'NOT_FOUND', message: 'gone' }) }
    const view = await renderScreen(<SubmissionDetailScreen />)
    expect(screen.getByText('Không tìm thấy hồ sơ đóng góp')).toBeTruthy()
    mockSession = 'guest'
    await view.rerender(<SubmissionDetailScreen />)
    expect(mockHook).toHaveBeenLastCalledWith({ id: 's1' }, false)
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy()
  })
}
