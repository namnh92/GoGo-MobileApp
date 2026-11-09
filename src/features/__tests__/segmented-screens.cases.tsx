import { cleanup, fireEvent, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import { renderScreen } from './harness'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useFocusEffect: () => undefined, useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 0, more: false }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true, useWaitingForNetwork: () => false }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: () => ({}), useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [] }] }, refetch: jest.fn() }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: () => ({ data: { pages: [{ items: [] }] } }), useMyReviews: () => ({ data: [] }) }))

export function segmentedScreensCases(name: 'orange' | 'orangeDark') {
  const theme = themes[name]
  UnistylesSheet.configure({ themes: { [name]: theme } as unknown as typeof themes })
  const PlansScreen = jest.requireActual<typeof import('../tabs/plans.view')>('../tabs/plans.view').default
  const MyContributionsScreen = jest.requireActual<typeof import('../contributions/my-contributions.view')>('../contributions/my-contributions.view').default

  afterEach(async () => { await cleanup() })
  it(`uses the same SegmentedTabs surfaces and labels on both screens in ${name}`, async () => {
    await renderScreen(<PlansScreen />)
    const track = StyleSheet.flatten(screen.getByTestId('segmented-tabs').props.style)
    const selected = StyleSheet.flatten(screen.getByRole('tab', { name: 'Sắp tới' }).props.style)
    const type = StyleSheet.flatten(screen.getByText('Sắp tới').props.style)
    expect(track.backgroundColor).toBe(theme.surface.subtle)
    expect(selected.backgroundColor).toBe(theme.accent.primary)
    await fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử' }))
    expect(screen.getByRole('tab', { name: 'Lịch sử' }).props.accessibilityState.selected).toBe(true)
    await cleanup()

    await renderScreen(<MyContributionsScreen />)
    expect(StyleSheet.flatten(screen.getByTestId('segmented-tabs').props.style)).toEqual(track)
    expect(StyleSheet.flatten(screen.getByRole('tab', { name: 'Địa điểm (0)' }).props.style)).toEqual(selected)
    expect(StyleSheet.flatten(screen.getByText('Địa điểm (0)').props.style)).toEqual(type)
    expect(StyleSheet.flatten(screen.getByText('Đánh giá (0)').props.style).color).toBe(theme.text.secondary)
    await fireEvent.press(screen.getByRole('tab', { name: 'Đánh giá (0)' }))
    expect(screen.getByRole('tab', { name: 'Đánh giá (0)' }).props.accessibilityState.selected).toBe(true)
  })
}
