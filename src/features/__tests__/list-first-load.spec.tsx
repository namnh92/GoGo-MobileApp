import { render } from '@/shared/ui/__tests__/query-render'
import { AccessibilityInfo } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'

const mockPending = { isPending: true, isFetching: true, isError: false, isPaused: false, data: undefined, refetch: jest.fn() }
const mockMutation = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }
let mockTab = 'places'
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => ({ isReady: () => true }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: '311f5bd8-f853-4ced-af68-e04398d1451a', tab: mockTab }),
  useFocusEffect: () => undefined,
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/toast.view', () => ({ useToast: () => ({ show: jest.fn() }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 0 }) }))
jest.mock('@/shared/location/use-discovery-scope', () => ({ useDiscoveryScope: () => ({ scope: { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMyRooms: () => mockPending,
  usePlan: () => mockPending,
  usePlanStopPlaces: () => [],
  useEditPlanStops: () => mockMutation,
  useRoomRealtime: () => ({ status: 'live' }),
  useCurrentSuggestions: () => mockPending,
  useCurrentPlan: () => mockPending,
  useRoom: () => mockPending,
  useSeedPlaceDetails: () => ({ byPlaceId: new Map(), refetchAll: jest.fn() }),
  useSavedEntries: () => ({ ...mockPending, entries: [] }),
  useTaxonomies: () => ({ data: undefined }),
  useToggleSaved: () => mockMutation,
  useMyReviews: () => mockPending,
  useUpdateReview: () => mockMutation,
  useAssistantConversations: () => mockPending,
  useRenameAssistantConversation: () => mockMutation,
  useDeleteAssistantConversation: () => mockMutation,
  useRoomInvites: () => ({ ...mockPending, data: [] }),
  useRemoveRoomMember: () => mockMutation,
  useRemoveRoomSeedPlace: () => mockMutation,
  useRevokeRoomInvite: () => mockMutation,
  useCreateRoomInvite: () => mockMutation,
  useTransitionRoom: () => mockMutation,
  useUpdateRoomConstraints: () => mockMutation,
}))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmissions: () => mockPending }))

import { ProfileUpcoming } from '../tabs/profile-upcoming.view'
import Plans from '../tabs/plans.view'
import { SavedPlacesScreen } from '../tabs/saved.view'
import MyReviews from '../review/my-reviews.view'
import Contributions from '../contributions/my-contributions.view'
import PlanEdit from '../date-plan/plan-edit.view'
import GoGoRoom from '../gogo-room/gogo-room.view'
import { History } from '../assistant/history.view'
import { SystemNotificationsSection } from '../notifications/system-notifications.view'

const cases = [
  ['plans', () => <Plans />],
  ['profile upcoming rooms', () => <ProfileUpcoming enabled />],
  ['plan edit stops', () => <PlanEdit />],
  ['saved', () => <SavedPlacesScreen />],
  ['saved city', () => <SavedPlacesScreen city={{ provinceCode: '79', name: 'TP Hồ Chí Minh' }} />],
  ['my reviews', () => <MyReviews />],
  ['place contributions', () => <Contributions />],
  ['review contributions', () => { mockTab = 'reviews'; return <Contributions /> }],
  ['room lobby members', () => <GoGoRoom />],
  ['AI history', () => <History activeId={null} onBack={jest.fn()} onOpen={jest.fn()} onNewChat={jest.fn()} />],
  ['public notifications', () => <SystemNotificationsSection inbox={{ ...mockPending, status: 'supported' } as any} illustration={null} />],
] as const

describe.each(['orange', 'orangeDark'] as const)('%s page one', theme => {
  beforeEach(() => {
    mockTab = 'places'
    StyleSheet.configure({ themes: { [theme]: themes[theme] } as unknown as typeof themes })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  })
  afterEach(() => jest.restoreAllMocks())
  it.each(cases)('%s renders real skeleton blocks without a loading mark', async (_name, element) => {
    const view = await render(element())
    expect(view.getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(0)
    expect(view.queryByTestId('loading-indicator')).toBeNull()
  })
})
