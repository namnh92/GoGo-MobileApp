import { cleanup, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { api } from '@/shared/api/client'
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

const provider = () => ({
  source: 'google_places', fetchedAt: '2026-11-09T00:00:00Z', name: 'Snapshot café', addressShort: 'Snapshot address',
  attributions: ['Google Maps'], googleMapsUri: 'https://maps.google.com/?cid=123',
  googleRating: 4.7, googleRatingCount: 123,
  openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 0, closeMinute: 1440, isOvernight: false })),
  photo: { url: '/v1/places/google-provider-photo/ChIJtest578', provider: 'google', attribution: 'Reference credit', authorAttributions: [], googleMapsUri: null },
})

beforeEach(() => {
  jest.useFakeTimers()
  mockSubmission = undefined
  mockItem = { id: 's1', status: 'pending', name: 'Submitted café', addressShort: 'Submitted address', createdAt: '2026-11-09T00:00:00Z', providerDisplay: provider() }
  jest.spyOn(api, 'get').mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'cGhvdG8=', authorAttributions: [{ displayName: 'Proxy photographer', uri: 'https://example.com/author' }] }] })
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
  UnistylesSheet.configure({ themes })
})

it('renders pending/rejected snapshot facts and authoritative proxy photo credits in light mode', async () => {
  const view = await renderScreen(<MyContributionsScreen />)
  expect(StyleSheet.flatten(screen.getByTestId('place-google-rating').props.style).backgroundColor).toBe(themes.orange.surface.container)
  expect(screen.getByLabelText('★ 4,7 (123) Google')).toBeTruthy()
  expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
  expect(screen.getByTestId('import-candidate-photo').props.source).toEqual([{ uri: 'data:image/jpeg;base64,cGhvdG8=', cacheKey: 'data:image/jpeg;base64,cGhvdG8=' }])
  expect(api.get).toHaveBeenCalledWith('/places/google-provider-photo/ChIJtest578', expect.objectContaining({ anonymous: true }))
  expect(screen.getByTestId('import-photo-credit').props.accessibilityLabel).toContain('Proxy photographer')
  expect(screen.queryByText('Reference credit')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Google Maps' })).toBeNull()
  expect(screen.queryByTestId('place-gogo-rating')).toBeNull()
  expect(screen.queryByText('Xác minh')).toBeNull()
  expect(screen.queryByTestId('material-icon-verified', { includeHiddenElements: true })).toBeNull()
  mockItem = { ...mockItem, status: 'rejected', rejectionReason: 'incorrect_location' }
  await view.rerender(<MyContributionsScreen />)
  expect(screen.getByText('Bị từ chối')).toBeTruthy()
  expect(screen.getByTestId('place-google-rating')).toBeTruthy()
  expect(screen.getByTestId('import-candidate-photo')).toBeTruthy()
})

it('omits a null Google rating and empty hours without claiming closed', async () => {
  mockItem.providerDisplay = { ...provider(), googleRating: null, openingHours: [], photo: undefined }
  await renderScreen(<MyContributionsScreen />)
  expect(screen.queryByTestId('place-google-rating')).toBeNull()
  expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  expect(api.get).not.toHaveBeenCalled()
})

it('lets hydrated submission facts replace list facts even when hydration is no longer needed', async () => {
  mockSubmission = { ...mockItem, name: 'Hydrated café', addressShort: 'Hydrated address', providerDisplay: { ...provider(), googleRating: null, openingHours: [], photo: undefined } }
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
