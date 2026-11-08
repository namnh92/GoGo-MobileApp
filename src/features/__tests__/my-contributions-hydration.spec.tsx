import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'
import i18n from '@/shared/i18n'
import { shouldPersistQuery, isPublicAppQuery } from '@/shared/api/persist-policy'
import { renderScreen } from './harness'
import MyContributionsScreen from '../contributions/my-contributions.view'

const mockRouter = { back: jest.fn(), push: jest.fn() }
const mockSvgPaths: unknown[] = []
let mockItems: any[]
let client: QueryClient
let mockOnline = true
jest.mock('@/shared/ui/material-icon', () => {
  const icons = jest.requireActual('@/shared/ui/material-icon')
  return { ...icons, MaterialIcon: (props: any) => {
    const icon = icons.MaterialIcon(props)
    mockSvgPaths.push(icon.props.children.props.d)
    return icon
  } }
})
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => mockOnline, currentOfflineSpell: () => 1 }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ ...jest.requireActual('@/shared/api/queries/use-my-place-submissions'), useMyPlaceSubmissions: () => ({ data: { pages: [{ items: mockItems }] }, refetch: jest.fn() }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => ({ data: undefined }), useSaved: () => ({ data: [] }),
  useToggleSaved: () => ({}), useMyReviews: () => ({ data: [] }),
}))
const row = (id: string, status = 'pending', extra = {}) => ({ id, status, createdAt: '2026-11-07T00:00:00Z', updatedAt: '2026-11-07T00:00:00Z', ...extra })
const url = 'https://maps.google.com/?cid=123&private=not-a-title'
const display = (name = 'Hydrated café') => ({ source: 'google_places', fetchedAt: '2026-11-08T00:00:00Z', name, addressShort: 'Phường Bến Thành, TP.HCM', googleMapsUri: url, attributions: ['Google Maps'], googleRating: null, googleRatingCount: 0, openingHours: [] })
const view = () => <QueryClientProvider client={client}><MyContributionsScreen /></QueryClientProvider>
async function exhaustAutomaticRetry(read: jest.SpyInstance) {
  // Exercise the real Query retry policy without racing a wall-clock waitFor.
  await act(() => jest.advanceTimersByTimeAsync(999))
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  await act(() => jest.advanceTimersByTimeAsync(1))
  expect(read).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy()
}
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(() => {
  // FlatList schedules a 50 ms cell-batching update. Under suite load that
  // real timer can fire between assertions, outside any render/event act.
  jest.useFakeTimers()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  mockItems = [row('s1', 'pending', { providerStatus: 'deferred' })]
  mockOnline = true
  jest.clearAllMocks()
  mockSvgPaths.length = 0
})
afterEach(async () => {
  // Unmount before clearing the private cache or restoring real timers.
  await cleanup()
  client.clear()
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it.each(['pending', 'rejected'])('hydrates a deferred %s row from DETAIL, including address, Google credit and supplement URL', async status => {
  mockItems = [row('s1', status, { providerStatus: 'deferred' })]
  const read = jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], name: 'Hydrated café', addressShort: 'Phường Bến Thành, TP.HCM', providerStatus: 'ok', providerDisplay: display() })
  await renderScreen(view())
  expect(await screen.findByText('Hydrated café')).toBeTruthy()
  expect(screen.getByText('Phường Bến Thành, TP.HCM')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Google Maps' })).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(1)
  expect(read.mock.calls[0][0]).toBe('/me/place-submissions/{id}')
  expect(read.mock.calls[0][1]).toMatchObject({ pathParams: { id: 's1' } })
  if (status === 'rejected') {
    await fireEvent.press(screen.getByRole('link', { name: 'Bổ sung thông tin khác' }))
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/places/import', params: { url } })
  }
  expect(screen.queryByText('Địa điểm đã đóng góp')).toBeNull()
})

it('hydrates missing facts per ID, reuses cached details after filtering, and skips fresh/canonical rows', async () => {
  mockItems = [row('s1'), row('s2', 'rejected'), row('fresh', 'pending', { name: 'Fresh café', addressShort: 'Fresh address', providerStatus: 'ok', providerDisplay: display('Fresh café') }), row('public', 'approved', { placeId: 'p1' })]
  const read = jest.spyOn(api, 'get').mockImplementation(async (_path, options) => ({ ...row(String(options?.pathParams?.id)), name: `Café ${options?.pathParams?.id}`, addressShort: 'Real address', providerStatus: 'ok' }))
  await renderScreen(view())
  expect(await screen.findByText('Café s1')).toBeTruthy()
  expect(await screen.findByText('Café s2')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
  await fireEvent.press(screen.getByRole('button', { name: 'Đã duyệt (1)' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Tất cả (4)' }))
  expect(screen.getByText('Café s1')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
})

it.each(['budget_exhausted', 'deferred', 'unavailable', 'not_found', 'identity_mismatch', 'ok'])('shows a non-retry note for a successful DETAIL with providerStatus=%s and no snapshot', async providerStatus => {
  const read = jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], providerStatus })
  await renderScreen(view())
  expect(await screen.findByText('Thông tin địa điểm sẽ hiện khi GoGo lấy được dữ liệu')).toBeTruthy()
  expect(screen.getByText('Liên kết Google Maps đã gửi')).toBeTruthy()
  expect(screen.getByText('Gửi ngày 07/11/2026')).toBeTruthy()
  expect(screen.getByText('Đang chờ duyệt')).toBeTruthy()
  expect(screen.getByText('Đang kiểm duyệt nội dung')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
})

it.each(['budget_exhausted', 'deferred'])('preserves real list identity and cached %s DETAIL across renders and stale-age remounts', async providerStatus => {
  mockItems = [row('s1', 'pending', { providerStatus: 'deferred', name: 'Submitted café', addressShort: 'Real address', providerDisplay: display() })]
  const read = jest.spyOn(api, 'get').mockResolvedValue({ ...row('s1'), name: '', addressShort: '', providerStatus, providerDisplay: undefined })
  const rendered = await renderScreen(view())
  expect(await screen.findByText('Thông tin địa điểm sẽ hiện khi GoGo lấy được dữ liệu')).toBeTruthy()
  expect(screen.getByText('Submitted café')).toBeTruthy()
  expect(screen.getByText('Real address')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Google Maps' })).toBeTruthy()
  await rendered.rerender(view())
  // Make the ordinary one-minute cache stale without advancing the GC timer.
  jest.setSystemTime(Date.now() + 61_000)
  await fireEvent.press(screen.getByRole('button', { name: 'Đã duyệt (0)' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Tất cả (1)' }))
  expect(screen.getByText('Submitted café')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  // A changed submission is a new detail key, and can be hydrated again.
  mockItems = [{ ...mockItems[0], updatedAt: '2026-11-08T01:00:00Z' }]
  await rendered.rerender(view())
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
})

it('uses only a safe Maps hostname for an available URL without leaking tracking parameters', async () => {
  mockItems = [row('s1', 'pending', { providerStatus: 'deferred', providerDisplay: display('') })]
  jest.spyOn(api, 'get').mockResolvedValue({ ...row('s1'), providerStatus: 'budget_exhausted' })
  await renderScreen(view())
  expect(await screen.findByText('maps.google.com')).toBeTruthy()
  expect(screen.queryByText(url)).toBeNull()
  expect(screen.queryByText(/not-a-title/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
})

it.each(['budget_exhausted', 'deferred'])('keeps rejected status, reason, date and supplement link after %s without a snapshot', async providerStatus => {
  mockItems = [row('s1', 'rejected', { providerStatus: 'deferred', rejectionReason: 'incorrect_location', providerDisplay: display('') })]
  jest.spyOn(api, 'get').mockResolvedValue({ ...row('s1', 'rejected'), providerStatus })
  await renderScreen(view())
  expect(await screen.findByText('Thông tin địa điểm sẽ hiện khi GoGo lấy được dữ liệu')).toBeTruthy()
  expect(screen.getByText('maps.google.com')).toBeTruthy()
  expect(screen.getByText('Bị từ chối')).toBeTruthy()
  expect(screen.getByText('Lý do: Sai vị trí')).toBeTruthy()
  expect(screen.getByText('Gửi ngày 07/11/2026')).toBeTruthy()
  await fireEvent.press(screen.getByRole('link', { name: 'Bổ sung thông tin khác' }))
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/places/import', params: { url } })
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
})

it('renders the non-retry note in English', async () => {
  await act(() => i18n.changeLanguage('en'))
  try {
    jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], providerStatus: 'deferred' })
    await renderScreen(view())
    expect(await screen.findByText('Place information will appear when GoGo can retrieve it')).toBeTruthy()
    expect(screen.getByText('Submitted Google Maps link')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  } finally {
    await act(() => i18n.changeLanguage('vi'))
  }
})

it('omits the tab dock and renders supported SVG paths for the remaining contribution icons', async () => {
  mockItems = []
  await renderScreen(view())
  for (const name of ['Khám phá', 'Kế hoạch', 'Đã lưu', 'Cá nhân']) {
    expect(screen.queryByRole('tab', { name })).toBeNull()
  }
  expect(mockSvgPaths.length).toBeGreaterThan(0)
  for (const path of mockSvgPaths) expect(path).toEqual(expect.stringMatching(/^M/))
})

it('waits for connectivity and hydrates when the card comes online', async () => {
  mockOnline = false
  const read = jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], name: 'Online café', addressShort: 'Real address', providerStatus: 'ok' })
  const rendered = await renderScreen(view())
  expect(read).not.toHaveBeenCalled()
  mockOnline = true
  await rendered.rerender(view())
  expect(await screen.findByText('Online café')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(1)
})

it.each([400, 401, 403, 404, 408, 425, 429])('offers no retry for non-transient HTTP %s, even with a retryable envelope', async status => {
  const read = jest.spyOn(api, 'get').mockRejectedValue(new ApiError(status, { code: 'REJECTED', message: 'private diagnostic', retryable: true }))
  await renderScreen(view())
  expect(await screen.findByText(i18n.t('common.errorTitle'))).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  expect(screen.queryByText('private diagnostic')).toBeNull()
})

it.each([new NetworkError(), new TimeoutError(6000), new ApiError(503, { code: 'UNAVAILABLE', message: 'private diagnostic' })])('allows recovery with manual retry after bounded transient retries: %s', async error => {
  const read = jest.spyOn(api, 'get').mockRejectedValue(error)
  await renderScreen(view())
  await exhaustAutomaticRetry(read)
  read.mockResolvedValueOnce({ ...mockItems[0], name: 'Retried café', addressShort: 'Real address', providerStatus: 'ok' })
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Retried café')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(3)
})

it('bounds transient-error retries and does not restart them when a failed card remounts', async () => {
  const read = jest.spyOn(api, 'get').mockRejectedValue(new ApiError(503, { code: 'UNAVAILABLE', message: 'private diagnostic' }))
  await renderScreen(view())
  await exhaustAutomaticRetry(read)
  await fireEvent.press(screen.getByRole('button', { name: 'Đã duyệt (0)' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Tất cả (1)' }))
  expect(read).toHaveBeenCalledTimes(2)
})

it.each(['https://maps.google.com.evil.example/maps/abc', 'javascript:alert(1)'])('rejects unsafe fallback URI %s', async unsafeUrl => {
  const read = jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], providerStatus: 'unavailable', providerDisplay: { ...display(''), googleMapsUri: unsafeUrl } })
  await renderScreen(view())
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('Thông tin địa điểm sẽ hiện khi GoGo lấy được dữ liệu')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  expect(screen.queryByText(unsafeUrl)).toBeNull()
  expect(screen.queryByText('maps.google.com.evil.example')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Google Maps' })).toBeNull()
  expect(screen.queryByText('Địa điểm đã đóng góp')).toBeNull()
})

it('keeps private detail keys out of disk persistence and logout-surviving public caches', async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], name: 'Private café', addressShort: 'Real address', providerStatus: 'ok' })
  await renderScreen(view())
  expect(await screen.findByText('Private café')).toBeTruthy()
  const keys = client.getQueryCache().getAll().map(query => query.queryKey)
  expect(keys).toHaveLength(1)
  expect(shouldPersistQuery(keys[0]!)).toBe(false)
  expect(isPublicAppQuery(keys[0]!)).toBe(false)
})
