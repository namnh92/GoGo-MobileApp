import { within } from '@testing-library/react-native'

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
  const strip = view.getByTestId('place-detail-facts')

  expect(within(strip).queryByText('—')).toBeNull()
  expect(within(strip).queryByText('thời gian ghé')).toBeNull()
  // The facts that do exist still render, with one divider between them.
  expect(within(strip).getByText('Chưa có đánh giá')).toBeTruthy()
  expect(within(strip).getAllByTestId('place-detail-fact-divider')).toHaveLength(1)
})

it('shows the visit time with its caption when the place has one', async () => {
  mockDetail.value = { ...PLACE, avgVisitMinutes: 45, rating: 4.5 }
  const view = await renderScreen(<PlaceDetailScreen />)
  const strip = view.getByTestId('place-detail-facts')

  expect(within(strip).getByText('45 phút')).toBeTruthy()
  expect(within(strip).getByText('thời gian ghé')).toBeTruthy()
  expect(within(strip).getByText('★ 4.5')).toBeTruthy()
  expect(within(strip).getAllByTestId('place-detail-fact-divider')).toHaveLength(2)
})
