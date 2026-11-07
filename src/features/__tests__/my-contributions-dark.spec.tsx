import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'

UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
const MyContributionsScreen = jest.requireActual<typeof import('../contributions/my-contributions.view')>('../contributions/my-contributions.view').default
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 0, more: false }) }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: () => ({}), useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [{ id: 's1', name: 'Real submission', status: 'pending', createdAt: '2026-11-07T00:00:00Z' }] }] }, refetch: jest.fn() }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), usePlaceDetail: () => ({ data: undefined }), useSaved: () => ({ data: [] }), useToggleSaved: () => ({}), useMyReviews: () => ({ data: [], refetch: jest.fn() }) }))

afterEach(async () => { await act(async () => { await i18n.changeLanguage('vi') }) })
it('keeps English controls and empty review actions readable with dark tokens', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  await renderScreen(<MyContributionsScreen />)
  const selected = screen.getByRole('tab', { name: /Places/ })
  expect(StyleSheet.flatten(selected.props.style).backgroundColor).toBe(themes.orangeDark.accent.primary)
  expect(StyleSheet.flatten(screen.getByText('Places (1)').props.style).color).toBe(themes.orangeDark.accent.onAccent)
  const chip = screen.getByRole('button', { name: 'All (1)' })
  expect(StyleSheet.flatten(chip.props.style).backgroundColor).toBe(themes.orangeDark.text.primary)
  expect(StyleSheet.flatten(screen.getByText('All (1)').props.style).color).toBe(themes.orangeDark.surface.canvas)
  expect(screen.getByText('Only approved, public places can be saved.')).toBeTruthy()
  const fab = screen.getByRole('button', { name: 'Add a new place' })
  expect(StyleSheet.flatten(fab.props.style).backgroundColor).toBe(themes.orangeDark.accent.primary)
  const icon = screen.getByTestId('material-icon-plus', { includeHiddenElements: true })
  type Node = { props: { fill?: { payload?: number } }; children: (Node | string)[] }
  const fills = (node: Node): (number | undefined)[] => [node.props.fill?.payload,
    ...node.children.flatMap(child => typeof child === 'string' ? [] : fills(child))]
  expect(fills(icon as unknown as Node)).toContain(processColor(themes.orangeDark.accent.onAccent))
  await fireEvent.press(screen.getByRole('tab', { name: /Reviews/ }))
  expect(screen.getByText('You have not written any reviews yet')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Explore places' })).toBeTruthy()
})
