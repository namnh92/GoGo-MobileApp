import { fireEvent, within } from '@testing-library/react-native'
import { loaded as mockLoaded, renderScreen } from './harness'

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockLoaded({ id: 'place-1', name: 'Quán thử', photos: [] }),
  usePlaceReviews: () => mockLoaded({ source: 'gogo', order: 'latest', reviews: [] }),
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
