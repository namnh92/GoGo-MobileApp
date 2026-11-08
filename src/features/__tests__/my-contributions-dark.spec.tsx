import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import { onAccent } from '@/shared/ui/tokens'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'

UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
const MyContributionsScreen = jest.requireActual<typeof import('../contributions/my-contributions.view')>('../contributions/my-contributions.view').default
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 0, more: false }) }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: () => ({}), useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [{ id: 's1', name: 'Real submission', status: 'pending', createdAt: '2026-11-07T00:00:00Z' }] }] }, refetch: jest.fn() }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), usePlaceDetail: () => ({ data: undefined }), useSaved: () => ({ data: [] }), useToggleSaved: () => ({}), useMyReviews: () => ({ data: [], refetch: jest.fn() }) }))

type Node = { props: { fill?: { payload?: number } }; children: (Node | string)[] }
const fills = (node: Node): (number | undefined)[] => [node.props.fill?.payload,
  ...node.children.flatMap(child => typeof child === 'string' ? [] : fills(child))]

// Keep FlatList's delayed cell update inside act, including under suite load.
beforeEach(() => { jest.useFakeTimers() })
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
  UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
  await act(async () => { await i18n.changeLanguage('vi') })
})

it.each(Object.entries(themes))('resolves the add-place FAB icon to onAccent in %s', async (name, theme) => {
  // The Unistyles mock serves the first configured theme to useUnistyles.
  // Exercise the real MaterialIcon resolver in each light/dark accent palette.
  UnistylesSheet.configure({ themes: { [name]: theme } as unknown as typeof themes })
  await renderScreen(<MyContributionsScreen />)
  const iconFills = () => {
    const fab = screen.getByTestId('contributions-add-fab')
    const icon = within(fab).getByTestId('material-icon-plus', { includeHiddenElements: true })
    return fills(icon as unknown as Node)
  }
  expect(theme.accent.onAccent).toBe(onAccent)
  expect(iconFills()).toContain(processColor(theme.accent.onAccent))

  // A distinct value distinguishes the semantic role from coincidentally
  // white tokens or a hardcoded white fill.
  const foreground = '#FEFEFE'
  const probe = { ...theme, accent: { ...theme.accent, onAccent: foreground } }
  UnistylesSheet.configure({ themes: { [name]: probe } as unknown as typeof themes })
  await screen.rerender(<MyContributionsScreen />)
  expect(iconFills()).toContain(processColor(foreground))
})

it('keeps English controls and empty review actions readable with dark tokens', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  await renderScreen(<MyContributionsScreen />)
  const selected = screen.getByRole('tab', { name: /Places/ })
  expect(StyleSheet.flatten(selected.props.style).backgroundColor).toBe(themes.orangeDark.accent.primary)
  expect(StyleSheet.flatten(screen.getByText('Places (1)').props.style).color).toBe(themes.orangeDark.accent.onAccent)
  const chip = screen.getByRole('button', { name: 'All (1)' })
  expect(StyleSheet.flatten(chip.queryAll(node => node.type === 'View')[0].props.style).backgroundColor).toBe(themes.orangeDark.accent.primary)
  expect(StyleSheet.flatten(screen.getByText('All (1)').props.style).color).toBe(themes.orangeDark.accent.onAccent)
  expect(screen.getByText('Only approved, public places can be saved.')).toBeTruthy()
  const fab = screen.getByRole('button', { name: 'Add a new place' })
  expect(StyleSheet.flatten(fab.props.style).backgroundColor).toBe(themes.orangeDark.accent.primary)
  const icon = screen.getByTestId('material-icon-plus', { includeHiddenElements: true })
  expect(fills(icon as unknown as Node)).toContain(processColor(themes.orangeDark.accent.onAccent))
  await fireEvent.press(screen.getByRole('tab', { name: /Reviews/ }))
  expect(screen.getByText('You have not written any reviews yet')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Explore places' })).toBeTruthy()
})
