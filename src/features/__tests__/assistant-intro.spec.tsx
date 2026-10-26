import { fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#379 (AI-APP-002) — introducing GoGo AI: the Home coachmark
 * (once per account, after the first plan or the third Home visit, never on
 * the first launch) and the "New" badge (until the first open).
 */

const mockPush = jest.fn()
const mockNav = { pathname: '/' }
const mockSession: { status: string; session: { kind: string; userId?: string } | null } = {
  status: 'user',
  session: { kind: 'user', userId: 'u1' },
}

jest.mock('expo-router', () => {
  const Tabs = function Tabs() {
    return null
  }
  Tabs.Screen = function TabsScreen() {
    return null
  }
  return { Tabs, usePathname: () => mockNav.pathname, useRouter: () => ({ push: mockPush }), useFocusEffect: () => undefined }
})
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))

import TabsLayout from '@/app/(tabs)/_layout'
import { fabLabelMotion } from '@/features/assistant/assistant-fab.view'
import { CURRENT_LAUNCH, useAssistantIntroStore, type AssistantIntro } from '@/shared/store/assistantIntroStore'

function intro(change: Partial<AssistantIntro> = {}): AssistantIntro {
  return {
    homeVisits: 0, planCreated: false, introduced: false, opened: false,
    chatSavedToastShown: false, firstLaunch: 'an-earlier-launch', ...change,
  }
}

beforeEach(() => {
  mockPush.mockReset()
  mockNav.pathname = '/'
  mockSession.status = 'user'
  mockSession.session = { kind: 'user', userId: 'u1' }
  useAssistantIntroStore.setState({ accounts: {} })
})

const OPEN = 'Mở GoGo AI'

it('the "Ask GoGo AI" label fades only when motion is allowed — under reduced motion it is an instant cut', () => {
  expect(fabLabelMotion(true)).toEqual({ entering: undefined, exiting: undefined })
  expect(fabLabelMotion(false).entering).toBeDefined()
  expect(fabLabelMotion(false).exiting).toBeDefined()
})

describe('"New" badge', () => {
  it('shows until this account first opens GoGo AI', async () => {
    const view = await renderScreen(<TabsLayout />)
    expect(view.getByText('Mới')).toBeTruthy()
    expect(view.getByRole('button', { name: OPEN }).props.accessibilityHint).toBe('Tính năng mới')
  })

  it('is gone once opened', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ opened: true }) } })
    const view = await renderScreen(<TabsLayout />)
    expect(view.queryByText('Mới')).toBeNull()
  })
})

describe('Home coachmark', () => {
  it('appears on the third visit to Home, pointing at the highlighted button', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ homeVisits: 2 }) } })
    const view = await renderScreen(<TabsLayout />)
    expect(useAssistantIntroStore.getState().accounts.u1?.homeVisits).toBe(3)
    expect(view.getByText('Làm quen với GoGo AI')).toBeTruthy()
    // The rest of the screen is outside the modal for VoiceOver; the button is still drawn, ringed.
    expect(view.getByTestId('assistant-fab-highlight', { includeHiddenElements: true })).toBeTruthy()
    expect(view.getByTestId('assistant-coachmark').props.accessibilityViewIsModal).toBe(true)
  })

  it('appears after the first created plan', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ planCreated: true }) } })
    const view = await renderScreen(<TabsLayout />)
    expect(view.getByText('Làm quen với GoGo AI')).toBeTruthy()
  })

  it('never on the launch the account was first seen, even after a plan', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ planCreated: true, homeVisits: 5, firstLaunch: CURRENT_LAUNCH }) } })
    const view = await renderScreen(<TabsLayout />)
    expect(view.queryByText('Làm quen với GoGo AI')).toBeNull()
  })

  it('not before the third visit, and only on Home', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ homeVisits: 1 }) } })
    const home = await renderScreen(<TabsLayout />)
    expect(home.queryByText('Làm quen với GoGo AI')).toBeNull()
    await home.unmount()

    useAssistantIntroStore.setState({ accounts: { u1: intro({ planCreated: true }) } })
    mockNav.pathname = '/plans'
    const plans = await renderScreen(<TabsLayout />)
    expect(plans.queryByText('Làm quen với GoGo AI')).toBeNull()
  })

  it('"Not now" dismisses it for good', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ planCreated: true }) } })
    const view = await renderScreen(<TabsLayout />)
    await fireEvent.press(view.getByRole('button', { name: 'Để sau' }))
    expect(view.queryByText('Làm quen với GoGo AI')).toBeNull()
    expect(useAssistantIntroStore.getState().accounts.u1?.introduced).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('"Try it" opens GoGo AI and is final too', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ planCreated: true }) } })
    const view = await renderScreen(<TabsLayout />)
    await fireEvent.press(view.getByRole('button', { name: 'Thử ngay' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/assistant' })
    expect(view.queryByText('Làm quen với GoGo AI')).toBeNull()
  })

  it('is per account: another account on the device starts from zero', async () => {
    useAssistantIntroStore.setState({ accounts: { u1: intro({ introduced: true, opened: true }) } })
    mockSession.session = { kind: 'user', userId: 'u2' }
    const view = await renderScreen(<TabsLayout />)
    expect(view.getByText('Mới')).toBeTruthy()
    expect(useAssistantIntroStore.getState().accounts.u2?.homeVisits).toBe(1)
    expect(view.queryByText('Làm quen với GoGo AI')).toBeNull()
  })

  it('a guest has no account to introduce: no coachmark, no badge', async () => {
    mockSession.status = 'guest'
    mockSession.session = { kind: 'guest' }
    const view = await renderScreen(<TabsLayout />)
    expect(view.getByRole('button', { name: OPEN })).toBeTruthy()
    expect(view.queryByText('Mới')).toBeNull()
    expect(useAssistantIntroStore.getState().accounts).toEqual({})
  })
})
