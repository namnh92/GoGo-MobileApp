import { StyleSheet } from 'react-native'

import { loaded, loaded as mockLoaded, roomFor, renderScreen, type QueryLike } from './harness'
import { text } from '@/shared/ui/tokens'

/**
 * The "+" between the two avatars in a couple's lobby hero was drawn with no
 * colour, so it fell back to the platform default: near-black on a dark card.
 * It takes the theme's secondary text colour.
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

it('draws the + between the avatars in a theme text colour', async () => {
  const view = await renderScreen(<GoGoRoomScreen />)
  const plus = view.getByText('+')
  expect(StyleSheet.flatten(plus.props.style).color).toBe(text.secondary)
})
