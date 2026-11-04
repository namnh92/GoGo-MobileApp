import { within } from '@testing-library/react-native'

import i18n from '@/shared/i18n'

import { loaded as mockLoaded, renderScreen } from './harness'

/**
 * GoGo-MobileApp#414 — three screens print a date with a bare
 * `toLocaleDateString(language)`, so the string comes from the running ICU's
 * CLDR. Measured identical on CLDR 48 (Node 22) and 49 (Node 26): it stays on
 * Intl and is pinned exactly here, at the call site, so the next CLDR that moves
 * it fails. 9 October, not 10 September: the pin also holds the day/month order.
 */

// Every date below is built from local parts at noon: the same calendar day in any time zone.

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMyReviews: () =>
    mockLoaded([{ id: 'review-1', placeId: 'place-1', rating: 5, status: 'published', text: 'Ngon', createdAt: new Date(2026, 9, 9, 12).toISOString() }]),
  useUpdateReview: () => ({ mutateAsync: jest.fn(), isPending: false }),
  usePlaceDetail: () =>
    mockLoaded({ id: 'place-1', name: 'Quán thử', photos: [], freshnessCheckedAt: new Date(2026, 9, 9, 12).toISOString() }),
  usePlaceReviews: () =>
    mockLoaded({
      source: 'gogo',
      order: 'latest',
      reviews: [{ id: 'review-1', rating: 5, createdAt: new Date(2026, 9, 9, 12).toISOString(), text: 'Ngon', author: { displayName: 'Người viết' }, helpfulCount: 0 }],
    }),
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'
import MyReviewsScreen from '@/features/review/my-reviews.view'

afterEach(async () => {
  await i18n.changeLanguage('vi')
})

it.each([
  ['vi', '9/10/2026'],
  ['en', '10/9/2026'],
])('my reviews prints the written date exactly in %s', async (language, label) => {
  await i18n.changeLanguage(language)
  const view = await renderScreen(<MyReviewsScreen />)
  expect(view.getByText(label)).toBeTruthy()
})

it.each([
  ['vi', 'Viết ngày 9/10/2026'],
  ['en', 'Written 10/9/2026'],
])('a place review prints its written date exactly in %s', async (language, label) => {
  await i18n.changeLanguage(language)
  const view = await renderScreen(<PlaceDetailScreen />)
  expect(within(view.getByTestId('place-reviews')).getByText(label)).toBeTruthy()
})

it.each([
  ['vi', 'Kiểm tra lần cuối 9/10/2026'],
  ['en', 'Last checked 10/9/2026'],
])('place detail prints its last-checked date exactly in %s', async (language, label) => {
  await i18n.changeLanguage(language)
  const view = await renderScreen(<PlaceDetailScreen />)
  expect(view.getByText(label)).toBeTruthy()
})
