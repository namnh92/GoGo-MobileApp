import { act, cleanup, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { api } from '@/shared/api/client'
import i18n from '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import { renderScreen } from './harness'
import MyContributionsScreen from '../contributions/my-contributions.view'

let mockItem: any
let mockSubmission: any
const mockCanonical = { id: 'canonical', name: 'Canonical café', rating: 3.2, ratingCount: 12, photos: [{ url: 'https://example.com/canonical.jpg' }] }
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 0, more: false }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({
  useMyPlaceSubmission: () => ({ data: mockSubmission }),
  useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [mockItem] }] }, refetch: jest.fn() }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: (id?: string) => ({ data: id ? mockCanonical : undefined }),
  useSaved: () => ({ data: [] }), useToggleSaved: () => ({}), useMyReviews: () => ({ data: [] }),
}))

const photo = { id: 'cover', url: 'https://cdn.example.com/cover.jpg', source: 'google', attribution: 'Google Maps', authorAttributions: [{ displayName: 'CDN photographer', uri: 'https://example.com/author' }], googleMapsUri: 'https://maps.google.com/?cid=123' }

const provider = () => ({
  source: 'google_places', fetchedAt: '2026-11-09T00:00:00Z', name: 'Snapshot café', addressShort: 'Snapshot address',
  attributions: ['Google Maps'], googleMapsUri: 'https://maps.google.com/?cid=123',
  googleRating: 4.7, googleRatingCount: 123,
  openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 0, closeMinute: 1440, isOvernight: false })),
  photo: { url: '/v1/places/google-provider-photo/ChIJtest578', provider: 'google', attribution: 'Reference credit', authorAttributions: [], googleMapsUri: null },
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-09T00:00:00Z'))
  mockSubmission = undefined
  mockItem = { id: 's1', status: 'pending', name: 'Submitted café', addressShort: 'Submitted address', createdAt: '2026-11-09T00:00:00Z', photo, providerDisplay: provider() }
  jest.spyOn(api, 'get').mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'cGhvdG8=', authorAttributions: [{ displayName: 'Proxy photographer', uri: 'https://example.com/author' }] }] })
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
  await act(async () => { await i18n.changeLanguage('vi') })
  UnistylesSheet.configure({ themes })
})

it('renders pending/rejected snapshot facts and stored CDN photo credits in light mode', async () => {
  const view = await renderScreen(<MyContributionsScreen />)
  expect(StyleSheet.flatten(screen.getByTestId('place-google-rating').props.style).backgroundColor).toBe(themes.orange.surface.container)
  expect(screen.getByLabelText('★ 4,7 (123) Google')).toBeTruthy()
  expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
  expect(screen.getByTestId('place-photo-image').props.source).toEqual([{ uri: photo.url, cacheKey: photo.url }])
  expect(api.get).not.toHaveBeenCalled()
  expect(screen.getByTestId('place-photo-image').props.cachePolicy).toBe('memory-disk')
  expect(screen.getByTestId('saved-photo-attribution').props.accessibilityLabel).toContain('Ảnh: CDN photographer · Google Maps')
  expect(screen.queryByText('Reference credit')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Google Maps' })).toBeNull()
  expect(screen.queryByTestId('place-gogo-rating')).toBeNull()
  expect(screen.queryByText('Xác minh')).toBeNull()
  expect(screen.queryByTestId('material-icon-verified', { includeHiddenElements: true })).toBeNull()
  mockItem = { ...mockItem, status: 'rejected', updateDeadline: '2026-11-09T02:00:00Z', rejectionReason: 'incorrect_location' }
  await view.rerender(<MyContributionsScreen />)
  expect(screen.getByText('Bị từ chối')).toBeTruthy()
  expect(screen.getByTestId('place-google-rating')).toBeTruthy()
  expect(screen.getByTestId('place-photo-image')).toBeTruthy()
})

it('omits a null Google rating and empty hours without claiming closed', async () => {
  mockItem.photo = undefined
  mockItem.providerDisplay = { ...provider(), googleRating: null, openingHours: [], photo: undefined }
  await renderScreen(<MyContributionsScreen />)
  expect(screen.queryByTestId('place-google-rating')).toBeNull()
  expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
  expect(screen.queryByTestId('place-photo-image')).toBeNull()
  expect(api.get).not.toHaveBeenCalled()
})

it('lets hydrated submission facts replace list facts even when hydration is no longer needed', async () => {
  mockSubmission = { ...mockItem, name: 'Hydrated café', addressShort: 'Hydrated address', photo, providerDisplay: { ...provider(), googleRating: null, openingHours: [], photo: undefined } }
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getByText('Hydrated café')).toBeTruthy()
  expect(screen.getByText('Hydrated address')).toBeTruthy()
  expect(screen.queryByTestId('place-google-rating')).toBeNull()
  expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
  expect(api.get).not.toHaveBeenCalled()
})

it.each(['approved', 'merged'])('keeps %s on canonical detail instead of snapshot facts', async status => {
  mockItem = { ...mockItem, status, placeId: 'canonical' }
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getByTestId('place-card-name').props.children).toBe('Canonical café')
  expect(screen.getByLabelText('★ 3,2 (12) Google')).toBeTruthy()
  expect(screen.queryByTestId('import-preview-card')).toBeNull()
  expect(api.get).not.toHaveBeenCalled()
})

it.each(['vi', 'en'])('expires a rejected CDN photo and displays the update deadline in %s', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  mockItem = { ...mockItem, status: 'rejected', updateDeadline: '2026-11-09T02:00:00Z' }
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getByText(locale === 'vi' ? 'Còn 2 giờ để cập nhật' : '2 hours left to update')).toBeTruthy()
  expect(screen.getByTestId('place-photo-image')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(2 * 60 * 60 * 1000) })
  expect(screen.getByText(locale === 'vi' ? 'Đã hết thời hạn cập nhật' : 'The update window has expired')).toBeTruthy()
  expect(screen.queryByTestId('place-photo-image')).toBeNull()
  expect(screen.queryByTestId('contribution-photo-credit')).toBeNull()
  expect(api.get).not.toHaveBeenCalled()
})

it('uses the stored photo supplied by submission detail hydration', async () => {
  mockItem.photo = undefined
  mockItem.providerStatus = 'deferred'
  mockSubmission = { ...mockItem, photo }
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getByTestId('place-photo-image').props.source).toEqual([{ uri: photo.url, cacheKey: photo.url }])
  expect(api.get).not.toHaveBeenCalled()
})
