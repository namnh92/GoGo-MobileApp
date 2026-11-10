import { fireEvent, within } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import type { PlaceDetail } from '@/shared/api/types'
import { loaded as mockLoaded, renderScreen } from './harness'

let mockPrices: PlaceDetail['prices'] = undefined
beforeEach(() => { mockPrices = undefined })
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  // `canGoBack` is part of the real router and the back control now asks it
  // first (#268): without it the screen has no way out of a cold start.
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockLoaded({ id: 'place-1', name: 'Quán thử', photos: [], prices: mockPrices }),
  usePlaceReviews: () => mockLoaded({ pages: [{ source: 'gogo', order: 'latest', reviews: [], items: [] }], pageParams: [undefined] }),
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'

it('uses one vertical scroll for gallery and content while back/actions stay reachable', async () => {
  const view = await renderScreen(<PlaceDetailScreen />)
  const scroll = view.getByTestId('place-detail-scroll')
  expect(within(scroll).getByText('Quán thử')).toBeTruthy()
  expect(scroll.props.snapToEnd).toBe(false)
  expect(view.getByText('Quán thử')).toBeTruthy()
  await fireEvent.press(view.getByLabelText('Quay lại'))
  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(view.getByText('Chỉ đường')).toBeTruthy()
})


it.each<{ prices: PlaceDetail['prices'] }>([{ prices: undefined }, { prices: [] }, { prices: [{ priceMin: 45000, priceMax: 90000 }] }])('omits the whole detail price row when amount or unit is unknown (%j)', async ({ prices }) => {
  mockPrices = prices
  const view = await renderScreen(<PlaceDetailScreen />)
  expect(view.queryByTestId('place-detail-price')).toBeNull()
  expect(view.queryByText('Chưa có thông tin giá')).toBeNull()
})

it.each(['per_person', 'per_item', 'per_hour', 'per_night'] as const)('retains the unit for a known detail price (%s)', async unit => {
  mockPrices = [{ priceMin: 45000, priceMax: 90000, currency: 'VND', confidence: 1, unit }]
  const view = await renderScreen(<PlaceDetailScreen />)
  expect(view.getByTestId('place-detail-price')).toBeTruthy()
  expect(within(view.getByTestId('place-detail-price')).getByText('45k–90k', { exact: false })).toBeTruthy()
  expect(within(view.getByTestId('place-detail-price')).getByText(i18n.t(`price.unit.${unit}`).replace(/^\//, ''))).toBeTruthy()
})
