import { within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { loaded as mockLoaded, renderScreen } from './harness'

/**
 * #255, RULE-CORE-015 — a fact with no data is left out of the strip, never
 * drawn as a dash: "—" where a visit time belongs reads as broken to some
 * people and as "no time needed" to others.
 */

const mockDetail: { value: Record<string, unknown> } = { value: {} }

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockLoaded(mockDetail.value),
  usePlaceReviews: () => mockLoaded({ source: 'gogo', order: 'latest', reviews: [] }),
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'

const PLACE = { id: 'place-1', name: 'Quán thử', photos: [] }

it('leaves the visit-time fact out when the place has none', async () => {
  mockDetail.value = { ...PLACE, avgVisitMinutes: null }
  const view = await renderScreen(<PlaceDetailScreen />)
  const card = within(view.getByTestId('place-detail-info'))

  expect(card.queryByText('—')).toBeNull()
  expect(card.queryByText('Thời gian ghé gợi ý')).toBeNull()
  // The facts that do exist still render: no rating is said in words.
  expect(within(view.getByTestId('place-detail-facts')).getByText('Chưa có đánh giá')).toBeTruthy()
})

it('shows the visit time with its caption when the place has one', async () => {
  mockDetail.value = { ...PLACE, avgVisitMinutes: 45, rating: 4.5 }
  const view = await renderScreen(<PlaceDetailScreen />)
  const card = within(view.getByTestId('place-detail-info'))

  expect(card.getByText('45 phút')).toBeTruthy()
  expect(card.getByText('Thời gian ghé gợi ý')).toBeTruthy()
  expect(within(view.getByTestId('place-detail-facts')).getByText('★ 4.5')).toBeTruthy()
})

it('draws price, the two rating sources and the AI card as separate blocks, with a gap before the card', async () => {
  mockDetail.value = { ...PLACE, rating: 4.5, ratingCount: 1280 }
  const view = await renderScreen(<PlaceDetailScreen />)
  const facts = within(view.getByTestId('place-detail-facts'))
  expect(facts.getByText('(1.280)')).toBeTruthy()
  expect(facts.getByText('GoGo')).toBeTruthy()
  expect(view.getByTestId('place-detail-action-bar')).toBeTruthy()
  // One bar in the footer: the directions action lives in the info card.
  expect(within(view.getByTestId('place-detail-action-bar')).queryByText('Chỉ đường')).toBeNull()
  expect(within(view.getByTestId('place-detail-info')).getByText('Chỉ đường')).toBeTruthy()
})

it('draws a short placeholder, not a tall empty hero, when the place has no photo', async () => {
  mockDetail.value = { ...PLACE }
  const none = StyleSheet.flatten((await renderScreen(<PlaceDetailScreen />)).getByTestId('place-detail-gallery').props.style)
  mockDetail.value = { ...PLACE, photos: [{ id: 'p1', url: 'https://example.test/a.jpg' }] }
  const some = StyleSheet.flatten((await renderScreen(<PlaceDetailScreen />)).getByTestId('place-detail-gallery').props.style)
  expect(none.height).toBeLessThan(some.height)
})
