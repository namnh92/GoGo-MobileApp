import { render, screen, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import i18n from '@/shared/i18n'
import { touchTarget, spacing, tabRootSpacing } from '@/shared/ui/tokens'
import { themes, type AppTheme } from '@/shared/ui/theme'

// The shipped Unistyles Jest mock resolves styles only once. Re-evaluate the
// real factories on access so Light and Dark exercise the rendered divider.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))

const mockEmpty = { data: [], isPending: false, isError: false, refetch: jest.fn() }
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), useFocusEffect: () => undefined }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'anonymous', session: null }) }))
jest.mock('@/shared/location/use-discovery-scope', () => ({
  ...jest.requireActual('@/shared/location/use-discovery-scope'),
  useDiscoveryScope: () => ({ scope: { status: 'ready', source: 'none', reason: 'no_area' }, recheck: jest.fn() }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ ...mockEmpty, data: undefined }),
  useHomeRoom: () => ({ ...mockEmpty, data: undefined }),
  useMyRooms: () => ({ ...mockEmpty, data: { pages: [] } }),
  useTaxonomies: () => ({ ...mockEmpty, data: { kinds: {} } }),
  usePlaceSearch: () => ({ ...mockEmpty, data: { pages: [{ results: [] }] } }),
  useSaved: () => mockEmpty,
  useSavedEntries: () => ({ ...mockEmpty, entries: [] }),
  useMyReviews: () => mockEmpty,
  useNotificationSettings: () => mockEmpty,
  useToggleSaved: () => ({ mutate: jest.fn() }),
}))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmissions: () => ({ ...mockEmpty, data: { pages: [] } }) }))
const Home = jest.requireActual<typeof import('@/features/home/home.view')>('@/features/home/home.view').default
const Plans = jest.requireActual<typeof import('@/features/tabs/plans.view')>('@/features/tabs/plans.view').default
const Saved = jest.requireActual<typeof import('@/features/tabs/saved.view')>('@/features/tabs/saved.view').default
const Profile = jest.requireActual<typeof import('@/features/tabs/profile.view')>('@/features/tabs/profile.view').default
const Splash = jest.requireActual<typeof import('@/features/onboarding/splash.view')>('@/features/onboarding/splash.view').default

afterEach(() => { UnistylesSheet.configure({ themes }) })
describe.each(['orange', 'orangeDark'] as const)('official brand in %s', mode => {
  beforeEach(() => { currentTheme = themes[mode]; UnistylesSheet.configure({ themes: { [mode]: themes[mode] } as typeof themes }) })
  it.each([
    ['home', Home, 'discovery.home'], ['plans', Plans, 'plans.title'],
    ['saved', Saved, 'saved.title'], ['profile', Profile, 'g11.profileHeading'],
  ] as const)('renders compact option B with a divider and retains the %s root title and actions', async (tab, Screen, titleKey) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    let mounted = false
    try {
      await render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>)
      mounted = true
      const headerID = tab === 'home' ? 'home-header' : 'app-header'
      const header = within(screen.getByTestId(headerID))
      expect(header.queryByTestId(`${headerID}-logo-loop`)).toBeNull()
      const mark = header.getByTestId(`${headerID}-logo-compact`)
      expect(mark.props.width).toBe(32)
      expect(mark.props.height).toBe(32)
      expect(header.getByTestId(`${headerID}-logo-text`).props.fill).toEqual({ type: 0, payload: parseInt(`ff${themes[mode].text.neutralPrimary.slice(1)}`, 16) })
      expect(header.getByTestId(`${headerID}-logo-text`).props.font.fontSize * mark.props.width / 400).toBe(9)
      expect(header.queryAllByTestId(new RegExp(`${headerID}-logo-dot-`))).toHaveLength(0)
      const wordmark = header.getByTestId(`${headerID}-logo-text`).children[0]
      expect(typeof wordmark !== 'string' && wordmark.props.content).toBe('go go')
      expect(themes[mode].text.neutralPrimary).toBe(mode === 'orange' ? '#211F1C' : '#E6E6E6')
      const divider = header.getByTestId(`${headerID}-brand-divider`)
      expect(divider).toHaveStyle({ width: 1, height: 20, backgroundColor: themes[mode].border.outline })
      expect(divider.props.accessible).toBe(false)
      const styles = jest.requireActual<typeof import('@/shared/ui/app-header.style')>('@/shared/ui/app-header.style').styles
      expect(styles.row).toMatchObject({ minHeight: 56, paddingVertical: spacing[1], alignItems: 'center' })
      expect(styles.button.minHeight).toBe(touchTarget.min)
      expect(screen.getByTestId(headerID)).toHaveStyle({ paddingBottom: tabRootSpacing.headerContent })
      expect(styles.brandRow).toMatchObject({ alignItems: 'center', gap: spacing[2] })
      expect(header.getByRole('header', { name: i18n.t(titleKey) })).toBeTruthy()
      expect(header.queryByText('·')).toBeNull()
      expect(header.queryByText('GoGo')).toBeNull()
      expect(header.queryByTestId(`${headerID}-logo-mark`)).toBeNull()
      expect(header.getByRole('image', { name: 'GoGo' })).toBeTruthy()
      expect(header.getByTestId(`${tab}-bell`)).toBeTruthy()
    } finally { if (mounted) await screen.unmount(); client.clear() }
  })
  it('renders option B with theme-readable wordmark and exactly three progress dots', async () => {
    await render(<Splash />)
    expect(screen.getByTestId('splash-map')).toBeTruthy()
    for (const city of ['hanoi', 'danang', 'hcm']) expect(screen.getByTestId(`splash-pin-${city}`)).toBeTruthy()
    const logo = within(screen.getByTestId('splash-logo'))
    expect(logo.getByTestId('splash-logo-wordmark').props.width).toBe(120)
    expect(logo.getByTestId('splash-logo-wordmark').props.height).toBe(120)
    expect(logo.getByTestId('splash-logo-text').props.fill).toEqual({ type: 0, payload: parseInt(`ff${themes[mode].text.neutralPrimary.slice(1)}`, 16) })
    const span = logo.getByTestId('splash-logo-text').children[0]
    expect(typeof span !== 'string' && span.props.content).toBe('go go')
    expect(logo.getAllByTestId(/splash-logo-dot-/)).toHaveLength(3)
  })
})

it('keeps the tab-root spacing compact without stacking introductory padding', () => {
  expect(tabRootSpacing).toEqual({ headerContent: 16, section: 20, headingContent: 12 })
  const home = jest.requireActual<typeof import('@/features/home/home.style')>('@/features/home/home.style').styles
  const saved = jest.requireActual<typeof import('@/features/tabs/saved.style')>('@/features/tabs/saved.style').styles
  const profile = jest.requireActual<typeof import('@/features/tabs/profile.style')>('@/features/tabs/profile.style').styles
  const plans = jest.requireActual<typeof import('@/features/tabs/plans.style')>('@/features/tabs/plans.style').styles
  expect(home.intro).not.toHaveProperty('paddingTop')
  expect(home.intro).not.toHaveProperty('paddingBottom')
  for (const style of [home.hero, home.join, home.nearestRoom, home.suggestions]) expect(style.marginTop).toBe(20)
  expect(home.sectionHeader.marginBottom).toBe(12)
  expect(saved.linkCard).not.toHaveProperty('marginTop')
  expect(saved.list).not.toHaveProperty('paddingTop')
  expect(saved.saveLink.paddingBottom).toBe(20)
  expect(saved.groupHeader.marginBottom).toBe(12)
  expect(saved.wardHeader.minHeight).toBe(24)
  expect(saved.subgroup.marginBottom).toBe(20)
  expect(saved.lastSubgroup.marginBottom).toBe(0)
  expect(saved.group.marginBottom).toBe(20)
  for (const style of [profile.headerCard, profile.card, profile.shortcutRow, profile.settingsCard]) expect(style.marginBottom).toBe(20)
  expect(profile.groupTitle.marginBottom).toBe(12)
  expect(plans.createAction.paddingBottom).toBe(12)
})
