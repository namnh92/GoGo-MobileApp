jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [], nextCursor: null }] } }) }))
import { fireEvent, within } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'

/**
 * GoGo-MobileApp#379 (AI-APP-002) — the contextual ways into GoGo AI: the
 * "Questions about this place?" card behind the feature gate. Profile uses
 * the floating button only (owner #529, 2026-11-08), without a duplicate Help row.
 */

const mockPush = jest.fn()
const mockGate = { on: true }

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
// The gate reads `env.assistantEntry` (#379); `undefined` follows the dev flavour (on).
jest.mock('@/shared/config/env', () => {
  const actual = jest.requireActual('@/shared/config/env')
  // A getter, read when the gate is asked — not copied once when the mock is built.
  const env = { ...actual.env }
  Object.defineProperty(env, 'assistantEntry', { get: () => (mockGate?.on === false ? 'off' : undefined) })
  return { env }
})
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' }, signOut: jest.fn() }),
}))
jest.mock('@/shared/api', () => {
  const idle = { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() }
  return {
    ...jest.requireActual('@/shared/api'),
    useTaxonomies: () => ({ data: { kinds: {} } }),
    useMyRooms: () => ({ data: { pages: [] }, hasNextPage: false }),
    useMe: () => idle,
    useMyReviews: () => idle,
    useNotificationSettings: () => idle,
    usePlaceDetail: () => mockLoaded({ id: 'place-1', name: 'Nhà Lá Café', photos: [] }),
    usePlaceProviderPhotos: () => ({ data: undefined }),
  usePlaceReviews: () => mockLoaded({ pages: [{ source: 'gogo', order: 'latest', reviews: [], items: [] }], pageParams: [undefined] }),
    useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
    useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
    useSaved: () => mockLoaded([]),
    useToggleSaved: () => ({ mutate: jest.fn() }),
    useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
  }
})

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'
import ProfileScreen from '@/features/tabs/profile.view'

beforeEach(() => {
  mockPush.mockReset()
  mockGate.on = true
})

describe('place detail: "Questions about this place?"', () => {
  it('offers three fixed starter questions under the key facts', async () => {
    const view = await renderScreen(<PlaceDetailScreen />)
    const card = view.getByTestId('assistant-place-card')
    expect(within(card).getByText('Thắc mắc về địa điểm này?')).toBeTruthy()
    const questions = ['Cuối tuần có mở khuya không?', 'Có hợp ngân sách của mình không?', 'Chỗ tương tự gần đây']
    for (const question of questions) expect(within(card).getByRole('button', { name: question })).toBeTruthy()
  })

  it('a question opens GoGo AI with the place attached and the question carried along', async () => {
    const view = await renderScreen(<PlaceDetailScreen />)
    await fireEvent.press(view.getByRole('button', { name: 'Có hợp ngân sách của mình không?' }))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/assistant',
      params: { placeId: 'place-1', placeName: 'Nhà Lá Café', question: 'Có hợp ngân sách của mình không?' },
    })
  })

  it('the card head opens it with the place only', async () => {
    const view = await renderScreen(<PlaceDetailScreen />)
    await fireEvent.press(view.getByRole('button', { name: /^Thắc mắc về địa điểm này\?/ }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/assistant', params: { placeId: 'place-1', placeName: 'Nhà Lá Café' } })
  })

  it('is not there with the gate off', async () => {
    mockGate.on = false
    const view = await renderScreen(<PlaceDetailScreen />)
    expect(view.queryByTestId('assistant-place-card')).toBeNull()
    expect(view.queryByText('Thắc mắc về địa điểm này?')).toBeNull()
  })
})

describe('Profile uses the floating GoGo AI entry only (owner #529, 2026-11-08)', () => {
  it.each([true, false])('omits the duplicate Help section with the feature gate %s', async on => {
    mockGate.on = on
    const view = await renderScreen(<ProfileScreen />)
    expect(view.queryByTestId('profile-help-assistant')).toBeNull()
    expect(view.queryByText('Trợ giúp')).toBeNull()
    expect(view.queryByText('GoGo AI')).toBeNull()
  })
})
