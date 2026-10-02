import { loaded, loaded as mockLoaded, roomFor, renderScreen, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#246 — the room's "Điều kiện phòng" card showed the schedule,
 * the head count and the budget, but never the room's administrative area,
 * although `RoomConstraints.administrativeArea` carries it with the labels
 * saved when it was chosen. A member had no way to check where the outing is.
 *
 * Expected labels are written from the contract fields (provinceName /
 * communeName) and the i18n copy, not from the function under test.
 *
 * Every binding a jest.mock factory touches must be `mock`-prefixed; the
 * factories are hoisted above the imports.
 */

const mockIdleMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({ code: 'ABC123' })),
  isPending: false,
  isError: false,
  error: null,
}

const mockRoom: { query: QueryLike } = { query: loaded(roomFor('couple')) }
const mockParams = { roomId: '311f5bd8-f853-4ced-af68-e04398d1451a' }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useNavigationContainerRef: () => ({ isReady: () => true }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  useRoomMembers: () => mockLoaded([]),
  useCurrentSuggestions: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useCurrentPlan: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useRoomRealtime: jest.fn(() => ({ status: 'live' })),
  useCreateRoomInvite: () => ({ ...mockIdleMutation, stored: null, forget: jest.fn() }),
  useRoomInvites: () => ({ isPending: false, isError: false, isFetching: false, status: 'success', data: [], dataUpdatedAt: 1, refetch: jest.fn() }),
  useRevokeRoomInvite: () => mockIdleMutation,
  useStartMatching: () => mockIdleMutation,
}))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

type Area = {
  datasetVersion: string
  provinceCode: string
  provinceName: string
  communeCode: string | null
  communeName: string | null
  status: 'current' | 'needs_reselection'
}

const BA_DINH: Area = {
  datasetVersion: 'ds-2026',
  provinceCode: '01',
  provinceName: 'Thành phố Hà Nội',
  communeCode: '00004',
  communeName: 'Phường Ba Đình',
  status: 'current',
}

const withArea = (administrativeArea: Area | null, audience: 'couple' | 'group-guest' = 'couple') =>
  loaded(
    roomFor(audience, {
      constraints: { budgetMode: 'total', budgetAmount: 600_000, currency: 'VND', administrativeArea },
    }),
  )

it('shows the commune and province the room is scoped to', async () => {
  mockRoom.query = withArea(BA_DINH)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText('Phường Ba Đình, Thành phố Hà Nội')).toBeTruthy()
})

it('shows the same area to a member who did not choose it', async () => {
  mockRoom.query = withArea(BA_DINH, 'group-guest')
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText('Phường Ba Đình, Thành phố Hà Nội')).toBeTruthy()
})

it('shows the province alone for a whole-province area', async () => {
  mockRoom.query = withArea({ ...BA_DINH, communeCode: null, communeName: null })
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getByText('Thành phố Hà Nội')).toBeTruthy()
})

it('says in words that the area needs choosing again after a dataset change', async () => {
  mockRoom.query = withArea({ ...BA_DINH, datasetVersion: 'ds-old', status: 'needs_reselection' })
  const view = await renderScreen(<GoGoRoomScreen />)
  // The saved labels stay; the warning is text, not colour alone.
  expect(view.getByText('Phường Ba Đình, Thành phố Hà Nội')).toBeTruthy()
  expect(view.getByText('Khu vực cần chọn lại')).toBeTruthy()
})

it('draws no area chip when the room has none', async () => {
  mockRoom.query = withArea(null)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.queryByLabelText(/Khu vực/)).toBeNull()
  expect(view.queryByText('Khu vực cần chọn lại')).toBeNull()
})
