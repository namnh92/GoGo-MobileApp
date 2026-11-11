import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { AccessibilityInfo, Linking, StyleSheet } from 'react-native'
import { loaded as mockLoaded, renderScreen } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import { useAppAreaStore as mockAreaStore } from '@/shared/location/app-area'
import type { LocationState } from '@/shared/location/native-location'
import CreateType from '../create-type.view'
import GroupSetup from '../group-setup.view'
import CreateTime from '../create-time.view'
import CreateBudget from '../create-budget.view'
import CreateMood from '../create-mood.view'
import { DiscoveryLocationSheet } from '@/features/search/discovery-location.view'

// Preserve KAV configuration; the native renderer does not lay out a keyboard.
jest.mock('react-native', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  const mockRN = Object.create(RN)
  Object.defineProperty(mockRN, 'KeyboardAvoidingView', { value: (props: import('react-native').KeyboardAvoidingViewProps) => React.createElement(RN.View, props) })
  return mockRN
})
// Delayed native dismissal: a second Modal cannot present until the first closes.
const mockPresenter = { presented: new Set<number>(), refused: [] as number[] }
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const View = jest.requireActual('react-native/Libraries/Components/View/View').default
  let nextId = 0
  function Modal({ visible = true, onDismiss, children }: { visible?: boolean; onDismiss?: () => void; children?: React.ReactNode }) {
    const id = React.useRef(++nextId).current
    const [shown, setShown] = React.useState(false)
    const dismissed = React.useRef(onDismiss)
    dismissed.current = onDismiss
    React.useLayoutEffect(() => {
      if (visible && !shown) {
        if (mockPresenter.presented.size) { mockPresenter.refused.push(id); return }
        mockPresenter.presented.add(id); setShown(true)
      } else if (!visible && shown) {
        const timer = setTimeout(() => { mockPresenter.presented.delete(id); setShown(false); dismissed.current?.() }, 5)
        return () => clearTimeout(timer)
      }
    }, [visible, shown, id])
    React.useEffect(() => () => { mockPresenter.presented.delete(id); dismissed.current?.() }, [id])
    return shown && visible ? React.createElement(View, { testID: 'native-modal' }, children) : null
  }
  return { __esModule: true, default: Modal }
})
const mockFocus: { current?: () => void | (() => void) } = {}
const mockRefresh = jest.fn<Promise<LocationState | undefined>, []>()
const mockRequest = jest.fn<Promise<LocationState>, []>()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => { mockFocus.current = callback; return callback() }, [callback])
  },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ homeAdministrativeArea: null, usualBudget: null }),
  useTaxonomies: () => mockLoaded({ kinds: { mood: [], setting: [], spending_style: [] } }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: jest.fn() }),
}))
jest.mock('@/shared/location/use-current-location', () => ({ useCurrentLocation: () => ({
  state: mockAreaStore(state => state.location), refresh: mockRefresh, request: mockRequest,
}) }))
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockLoaded({ datasetVersion: 'ds' }),
  useAdministrativeUnits: () => mockLoaded([]),
}))
jest.mock('@/shared/administrative/administrative-picker.view', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return { AdministrativePicker: ({ onChange, onValidityChange }: { onChange: (area: unknown) => void; onValidityChange: (valid: boolean) => void }) =>
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Manual province', onPress: () => {
      onChange({ datasetVersion: 'ds', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null }); onValidityChange(true)
    } }, React.createElement(Text, null, 'Manual province')) }
})
const title = () => i18n.t('createLocation.failureTitle')
const manualTitle = () => i18n.t('createLocation.manualTitle')
const confirm = () => i18n.t('createLocation.confirm')
const cancel = () => i18n.t('common.cancel')
async function press(view: Awaited<ReturnType<typeof renderScreen>>, name: string) {
  await fireEvent.press(view.getByRole('button', { name }))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) })
}
beforeEach(async () => {
  mockPresenter.presented.clear(); mockPresenter.refused = []
  mockRefresh.mockReset().mockResolvedValue(undefined)
  mockRequest.mockReset().mockImplementation(async () => {
    mockAreaStore.setState({ location: { status: 'denied' } }); return { status: 'denied' }
  })
  jest.spyOn(Linking, 'openSettings').mockClear().mockResolvedValue()
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  useRoomStore.getState().resetDraft()
  mockAreaStore.setState({ area: null, manual: false, location: { status: 'idle' }, scope: { status: 'resolving' } })
  await act(async () => { await i18n.changeLanguage('vi') })
})
afterEach(() => jest.restoreAllMocks())

it.each([['vi', 'denied'], ['en', 'denied'], ['vi', 'unavailable'], ['en', 'unavailable']] as const)('manual failure: settings dialog has secondary left / primary right, opens Settings (%s / %s)', async (language, status) => {
  mockRequest.mockResolvedValue({ status })
  await act(async () => { await i18n.changeLanguage(language) })
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByTestId('create-location-field'))
  await press(view, i18n.t('home.useLocation'))
  expect(view.getByRole('header', { name: title() })).toBeTruthy()
  expect(view.getByText(i18n.t('createLocation.failureBody'))).toBeTruthy()
  const buttons = within(view.getByTestId('native-modal')).getAllByRole('button')
  expect(buttons.map(button => button.props.accessibilityLabel)).toEqual([cancel(), confirm()])
  expect(StyleSheet.flatten(buttons[0].parent!.parent!.props.style).flexDirection).toBe('row')
  await press(view, confirm())
  expect(Linking.openSettings).toHaveBeenCalledTimes(1)
  expect(view.queryByText(manualTitle())).toBeNull()
  expect(mockPresenter.refused).toEqual([])
})
it('manual failure: cancel → second question → confirm reopens manual fields and can apply an area', async () => {
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByTestId('create-location-field'))
  await press(view, i18n.t('home.useLocation'))
  await press(view, cancel())
  expect(view.getByRole('header', { name: manualTitle() })).toBeTruthy()
  await press(view, confirm())
  expect(view.queryByText(title())).toBeNull()
  await press(view, 'Manual province')
  await press(view, i18n.t('areaPicker.confirm'))
  expect(useRoomStore.getState().administrativeArea?.provinceCode).toBe('01')
  expect(Linking.openSettings).not.toHaveBeenCalled()
  expect(mockPresenter.refused).toEqual([])
})
it('cancel on the second question closes; each new explicit tap still shows the dialog', async () => {
  const view = await renderScreen(<CreateType />)
  for (let attempt = 0; attempt < 2; attempt++) {
    await fireEvent.press(view.getByTestId('create-location-field'))
    await press(view, i18n.t('home.useLocation'))
    expect(view.getByText(title())).toBeTruthy()
    await press(view, cancel()); await press(view, cancel())
    expect(view.queryByTestId('native-modal')).toBeNull()
  }
  expect(mockRequest).toHaveBeenCalledTimes(2)
  expect(Linking.openSettings).not.toHaveBeenCalled()
  expect(mockPresenter.refused).toEqual([])
})
it.each(['denied', 'unavailable'] as const)('auto %s is shown once across refocus/rerender; a new wizard session can show again', async status => {
  mockRefresh.mockResolvedValue({ status })
  const view = await renderScreen(<CreateType />)
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  await press(view, cancel()); await press(view, cancel())
  await act(async () => { mockFocus.current?.() })
  await view.rerender(<CreateType />)
  expect(view.queryByText(title())).toBeNull()
  expect(mockRefresh).toHaveBeenCalledTimes(2)
  await view.unmount()
  const fresh = await renderScreen(<CreateType />)
  await waitFor(() => expect(fresh.getByText(title())).toBeTruthy())
})
it('auto failure can open Settings, and returning from Settings does not repeat the popup', async () => {
  mockRefresh.mockResolvedValue({ status: 'unavailable' })
  const view = await renderScreen(<CreateType />)
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  await press(view, confirm())
  expect(Linking.openSettings).toHaveBeenCalledTimes(1)
  await act(async () => { mockFocus.current?.() })
  expect(view.queryByText(title())).toBeNull()
})
it('auto failure waits for an already open area sheet before the manual-choice flow', async () => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByTestId('create-location-field'))
  await act(async () => { resolve({ status: 'denied' }) })
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  await press(view, cancel()); await press(view, confirm())
  expect(view.getByRole('button', { name: 'Manual province' })).toBeTruthy()
  expect(mockPresenter.refused).toEqual([])
})
it('a failed Settings launch leaves an accessible inline fallback', async () => {
  jest.mocked(Linking.openSettings).mockRejectedValueOnce(new Error('settings unavailable'))
  mockRefresh.mockResolvedValue({ status: 'denied' })
  const view = await renderScreen(<CreateType />)
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  await press(view, confirm())
  const warning = view.getByText(i18n.t('notificationSettings.openSettingsFailed'))
  expect(warning.props.accessibilityLiveRegion).toBe('polite')
  expect(view.getByTestId('create-location-field')).toBeTruthy()
})
it('successful auto refresh leaves the wizard usable without a popup', async () => {
  mockRefresh.mockResolvedValue({ status: 'granted', lat: 21, lng: 105, label: 'Hà Nội' })
  const view = await renderScreen(<CreateType />)
  expect(view.queryByText(title())).toBeNull()
  expect(view.getByTestId('create-location-field')).toBeTruthy()
})
it('a late auto failure after leaving step 1 cannot show a dialog', async () => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  const view = await renderScreen(<CreateType />)
  await view.unmount()
  await act(async () => { resolve({ status: 'unavailable' }) })
  expect(mockPresenter.presented.size).toBe(0)
  expect(Linking.openSettings).not.toHaveBeenCalled()
})
it('Home/Discovery sheet keeps its inline failure fallback without a wizard popup', async () => {
  const view = await renderScreen(<DiscoveryLocationSheet visible onClose={jest.fn()} onApplied={jest.fn()} />)
  await press(view, i18n.t('home.useLocation'))
  expect(view.getByText(i18n.t('createLocation.permissionDenied'))).toBeTruthy()
  expect(view.queryByText(title())).toBeNull()
})
it.each([
  ['type', CreateType], ['group-setup', GroupSetup], ['time', CreateTime], ['budget', CreateBudget], ['mood', CreateMood],
] as const)('%s keeps navigation + progress outside a bounded scrolling body, with footer preserved', async (step, Screen) => {
  const view = await renderScreen(<Screen />)
  const chrome = view.getByTestId('wizard-chrome')
  const body = view.getByTestId('wizard-content')
  expect(chrome.parent).toBe(step === 'type' ? body.parent!.parent : body.parent)
  expect(StyleSheet.flatten(chrome.props.style).flexShrink).toBe(0)
  expect(StyleSheet.flatten(body.props.style)).toMatchObject({ flex: 1, minHeight: 0, overflow: 'hidden' })
  const scroll = view.getByTestId(`create-${step}-scroll`)
  expect(within(scroll).queryByTestId('app-header')).toBeNull()
  expect(within(scroll).queryByText(/Bước \d \/ \d/)).toBeNull()
  for (const label of [i18n.t('common.back'), i18n.t('draft.save'), i18n.t('draft.close')]) expect(within(chrome).getByRole('button', { name: label })).toBeTruthy()
  expect(within(chrome).getByTestId('app-header-bell')).toBeTruthy()
  expect(within(chrome).getByText(/Bước \d \/ \d/)).toBeTruthy()
  expect(within(scroll).queryByTestId('create-footer')).toBeNull()
  expect(view.getByTestId('create-footer')).toBeTruthy()
  if (step === 'type') {
    const keyboard = view.getByTestId('create-type-keyboard')
    expect(keyboard.props.behavior).toBe('padding')
    expect(keyboard.parent).toBe(chrome.parent) // Preserve RN's header y offset.
    expect(scroll.props.onScroll).toEqual(expect.any(Function))
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
  }
})
