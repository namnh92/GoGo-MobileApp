import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { ApiError } from '@/shared/api/errors'
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
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  mockItems = [row('s1', 'pending', { providerStatus: 'deferred' })]
  mockOnline = true
  jest.clearAllMocks()
  mockSvgPaths.length = 0
})
afterEach(() => { client.clear(); jest.restoreAllMocks() })

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

it('offers a bounded retry when DETAIL has no facts and uses only the Maps hostname as fallback', async () => {
  const read = jest.spyOn(api, 'get').mockResolvedValueOnce({ ...mockItems[0], providerStatus: 'unavailable', providerDisplay: display('') })
    .mockResolvedValueOnce({ ...mockItems[0], name: 'Recovered café', addressShort: 'Recovered address', providerStatus: 'ok', providerDisplay: display('Recovered café') })
  await renderScreen(view())
  expect(await screen.findByText('maps.google.com')).toBeTruthy()
  expect(screen.queryByText(url)).toBeNull()
  expect(screen.queryByText('Địa điểm đã đóng góp')).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Recovered café')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
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

it('does not automatically retry rate limits, and exposes a working manual retry', async () => {
  const read = jest.spyOn(api, 'get').mockRejectedValueOnce(new ApiError(429, { code: 'RATE_LIMITED', message: 'private diagnostic' }))
    .mockResolvedValueOnce({ ...mockItems[0], name: 'Retried café', addressShort: 'Real address', providerStatus: 'ok' })
  await renderScreen(view())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy())
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('private diagnostic')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Retried café')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
})

it('bounds transient-error retries and does not restart them when a failed card remounts', async () => {
  const read = jest.spyOn(api, 'get').mockRejectedValue(new ApiError(503, { code: 'UNAVAILABLE', message: 'private diagnostic' }))
  await renderScreen(view())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy(), { timeout: 4000 })
  expect(read).toHaveBeenCalledTimes(2)
  await fireEvent.press(screen.getByRole('button', { name: 'Đã duyệt (0)' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Tất cả (1)' }))
  expect(read).toHaveBeenCalledTimes(2)
})

it.each(['https://maps.google.com.evil.example/maps/abc', 'javascript:alert(1)'])('rejects unsafe fallback URI %s', async unsafeUrl => {
  const read = jest.spyOn(api, 'get').mockResolvedValue({ ...mockItems[0], providerStatus: 'unavailable', providerDisplay: { ...display(''), googleMapsUri: unsafeUrl } })
  await renderScreen(view())
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeTruthy()
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
