import { act, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#379 (AI-APP-002) — the GoGo AI float button over the four
 * tabs: where it sits, what it is called, how it changes on scroll, where it
 * hides, the Home coachmark and the "New" badge, and the feature gate.
 */

const mockPush = jest.fn()
const mockNav = { pathname: '/', focused: true, keyboard: false, gate: true }
const mockSession: { status: string; session: { kind: string; userId?: string } | null } = {
  status: 'user',
  session: { kind: 'user', userId: 'u1' },
}

jest.mock('expo-router', () => {
  // The navigator itself is not under test: the float button is drawn beside it.
  const Tabs = function Tabs() {
    return null
  }
  Tabs.Screen = function TabsScreen() {
    return null
  }
  return {
    Tabs,
    usePathname: () => mockNav.pathname,
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
  }
})
jest.mock('@/shared/hooks/use-screen-focused', () => ({ useScreenFocused: () => mockNav.focused }))
jest.mock('@/shared/ui/keyboard', () => ({ useKeyboardVisible: () => mockNav.keyboard }))
// The gate reads `env.assistantEntry` (#379); `undefined` follows the dev flavour (on).
jest.mock('@/shared/config/env', () => {
  const actual = jest.requireActual('@/shared/config/env')
  // A getter, read when the gate is asked — not copied once when the mock is built.
  const env = { ...actual.env }
  Object.defineProperty(env, 'assistantEntry', { get: () => (mockNav?.gate === false ? 'off' : undefined) })
  return { env }
})
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))

const mockRooms = {
  data: { pages: [{ items: [{ id: 'a', title: 'Kèo thứ bảy', status: 'collecting', type: 'group', participantCount: 4 }] }] },
  isPending: false, isError: false, isFetching: false, isFetchingNextPage: false,
  hasNextPage: false, isFetchNextPageError: false, error: null, dataUpdatedAt: 0,
  fetchNextPage: jest.fn(), refetch: jest.fn(),
}
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: () => mockRooms }))

import TabsLayout from '@/app/(tabs)/_layout'
import PlansScreen from '@/features/tabs/plans.view'

const OPEN = 'Mở GoGo AI'
// Tab bar 50 + safe area 34 (jest.setup) — the bar the button sits 16pt above.
const BAR = 50 + 34

beforeEach(() => {
  mockPush.mockReset()
  Object.assign(mockNav, { pathname: '/', focused: true, keyboard: false, gate: true })
  mockSession.status = 'user'
  mockSession.session = { kind: 'user', userId: 'u1' }
})

describe('float button on the tabs', () => {
  it.each(['/', '/plans', '/saved', '/profile'])('%s: bottom-right, 20pt in, 16pt above the tab bar, named "Open GoGo AI"', async pathname => {
    mockNav.pathname = pathname
    const view = await renderScreen(<TabsLayout />)
    const fab = view.getByRole('button', { name: OPEN })
    expect(fab).toBeTruthy()
    const dock = StyleSheet.flatten(view.getByTestId('assistant-fab-dock').props.style)
    expect(dock).toMatchObject({ position: 'absolute', right: 20, bottom: BAR + 16 })
    // A 56pt accent circle with the white bubble glyph.
    expect(StyleSheet.flatten(fab.props.style)).toMatchObject({ height: 56, minWidth: 56 })
    expect(view.getByTestId('assistant-glyph-inverted')).toBeTruthy()
  })

  it('opens GoGo AI', async () => {
    const view = await renderScreen(<TabsLayout />)
    await fireEvent.press(view.getByRole('button', { name: OPEN }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/assistant' })
  })

  it('is extended with "Ask GoGo AI" at the top, and collapses to its circle after 24pt of scroll', async () => {
    mockNav.pathname = '/plans'
    const view = await renderScreen(
      <>
        <PlansScreen />
        <TabsLayout />
      </>,
    )
    expect(view.getByText('Hỏi GoGo AI')).toBeTruthy()
    const list = view.getByTestId('plans-list')
    await act(async () => {
      await fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 20 } } })
    })
    expect(view.getByText('Hỏi GoGo AI')).toBeTruthy()
    await act(async () => {
      await fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 25 } } })
    })
    expect(view.queryByText('Hỏi GoGo AI')).toBeNull()
    expect(view.getByRole('button', { name: OPEN })).toBeTruthy()
    // Back at the top, extended again.
    await act(async () => {
      await fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 0 } } })
    })
    expect(view.getByText('Hỏi GoGo AI')).toBeTruthy()
  })

  it('lists pad their end so the last item scrolls clear of it: tab bar + 16 + 56 + 16', async () => {
    const view = await renderScreen(<PlansScreen />)
    const list = view.getByTestId('plans-list')
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom).toBe(BAR + 16 + 56 + 16)
  })
})

describe('where it hides', () => {
  async function shownThen(change: () => void) {
    const view = await renderScreen(<TabsLayout />)
    expect(view.getByRole('button', { name: OPEN })).toBeTruthy()
    change()
    await view.rerender(<TabsLayout />)
    return view
  }

  it.each(['/room/abc', '/places/p1', '/create/type', '/assistant'])('off the four tabs (%s)', async pathname => {
    const view = await shownThen(() => (mockNav.pathname = pathname))
    expect(view.queryByRole('button', { name: OPEN })).toBeNull()
  })

  it('while a screen is pushed over the tabs — place or plan detail, voting, or GoGo AI itself', async () => {
    const view = await shownThen(() => (mockNav.focused = false))
    expect(view.queryByRole('button', { name: OPEN })).toBeNull()
  })

  it('while the keyboard is up, and back when it goes', async () => {
    const view = await shownThen(() => (mockNav.keyboard = true))
    expect(view.queryByRole('button', { name: OPEN })).toBeNull()
    mockNav.keyboard = false
    await view.rerender(<TabsLayout />)
    expect(view.getByRole('button', { name: OPEN })).toBeTruthy()
  })
})

describe('feature gate (off until the assistant API exists)', () => {
  it('on in this build (dev): the button is there', async () => {
    const view = await renderScreen(<TabsLayout />)
    expect(view.getByRole('button', { name: OPEN })).toBeTruthy()
  })

  it('with the gate off there is no button, and lists keep their old inset', async () => {
    mockNav.gate = false
    const view = await renderScreen(
      <>
        <PlansScreen />
        <TabsLayout />
      </>,
    )
    expect(view.queryByRole('button', { name: OPEN })).toBeNull()
    const list = view.getByTestId('plans-list')
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom).toBe(BAR + 24)
  })
})
