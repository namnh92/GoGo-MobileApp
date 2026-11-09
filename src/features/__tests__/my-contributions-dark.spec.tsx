import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import { onAccent } from '@/shared/ui/tokens'
import i18n from '@/shared/i18n'
import { api } from '@/shared/api/client'
import { renderScreen } from './harness'

let mockSnapshot: any

UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
const MyContributionsScreen = jest.requireActual<typeof import('../contributions/my-contributions.view')>('../contributions/my-contributions.view').default
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 0, more: false }) }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: () => ({}), useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [{ id: 's1', name: 'Real submission', status: 'pending', createdAt: '2026-11-07T00:00:00Z', providerDisplay: mockSnapshot }] }] }, refetch: jest.fn() }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), usePlaceDetail: () => ({ data: undefined }), useSaved: () => ({ data: [] }), useToggleSaved: () => ({}), useMyReviews: () => ({ data: [], refetch: jest.fn() }) }))

type Node = { props: { fill?: { payload?: number } }; children: (Node | string)[] }
const fills = (node: Node): (number | undefined)[] => [node.props.fill?.payload,
  ...node.children.flatMap(child => typeof child === 'string' ? [] : fills(child))]

// Keep FlatList's delayed cell update inside act, including under suite load.
beforeEach(() => { jest.useFakeTimers(); mockSnapshot = undefined })
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
  UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
  await act(async () => { await i18n.changeLanguage('vi') })
})

it.each(Object.entries(themes))('resolves the add-place CTA icon to onAccent in %s', async (name, theme) => {
  // The Unistyles mock serves the first configured theme to useUnistyles.
  // Exercise the real MaterialIcon resolver in each light/dark accent palette.
  UnistylesSheet.configure({ themes: { [name]: theme } as unknown as typeof themes })
  await renderScreen(<MyContributionsScreen />)
  const iconFills = () => {
    const fab = screen.getByRole('button', { name: i18n.t('myContributions.add') })
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
  expect(StyleSheet.flatten(chip.queryAll(node => node.type === 'View')[0].props.style).backgroundColor).toBe(themes.orangeDark.text.primary)
  expect(StyleSheet.flatten(screen.getByText('All (1)').props.style).color).toBe(themes.orangeDark.text.inverse)
  expect(screen.queryByText('Only approved, public places can be saved.')).toBeNull()
  const fab = screen.getByRole('button', { name: 'Add a new place' })
  expect(StyleSheet.flatten(fab.props.style).backgroundColor).toBe(themes.orangeDark.accent.primary)
  const icon = screen.getByTestId('material-icon-plus', { includeHiddenElements: true })
  expect(fills(icon as unknown as Node)).toContain(processColor(themes.orangeDark.accent.onAccent))
  await fireEvent.press(screen.getByRole('tab', { name: /Reviews/ }))
  expect(screen.getByText('You have not written any reviews yet')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Explore places' })).toBeTruthy()
})


it('renders snapshot rating and proxy credits while omitting hours with dark card tokens', async () => {
  mockSnapshot = {
    googleRating: 4.7, googleRatingCount: 123, attributions: ['Google Maps'],
    openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 0, closeMinute: 1440, isOvernight: false })),
    photo: { url: '/v1/places/google-provider-photo/ChIJtest578', provider: 'google' },
  }
  jest.spyOn(api, 'get').mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'cGhvdG8=', authorAttributions: [{ displayName: 'Proxy photographer' }] }] })
  await renderScreen(<MyContributionsScreen />)
  expect(StyleSheet.flatten(screen.getByTestId('place-google-rating').props.style).backgroundColor).toBe(themes.orangeDark.redesign.container)
  expect(screen.getByLabelText('★ 4,7 (123) Google')).toBeTruthy()
  expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
  expect(screen.getByTestId('import-candidate-photo').props.source).toEqual([{ uri: 'data:image/jpeg;base64,cGhvdG8=' }])
  expect(screen.getByTestId('import-photo-credit').props.accessibilityLabel).toContain('Proxy photographer')
  expect(screen.queryByText('Xác minh')).toBeNull()
})
