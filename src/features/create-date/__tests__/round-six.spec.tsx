import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactElement } from 'react'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { AccessibilityInfo, Alert, Linking, StyleSheet } from 'react-native'
import { loaded as mockLoaded, renderScreen as baseRenderScreen } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import { useAppAreaStore as mockAreaStore } from '@/shared/location/app-area'
import type { LocationState } from '@/shared/location/native-location'
import CreateType from '../create-type.view'
import GroupSetup from '../group-setup.view'
import CreateTime from '../create-time.view'
import CreateBudget from '../create-budget.view'
import CreateMood from '../create-mood.view'
import { TimePickerSheet } from '../time-picker-sheet.view'
import { DiscoveryLocationSheet } from '@/features/search/discovery-location.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { useWizardModalStore } from '../wizard-modal'

jest.mock('@/shared/ui/result-sheet.view', () => {
  const actual = jest.requireActual<typeof import('@/shared/ui/result-sheet.view')>('@/shared/ui/result-sheet.view')
  return { ...actual, ResultSheet: jest.fn(actual.ResultSheet) }
})
const mockResult = jest.mocked(ResultSheet)
let mockContent: ReactElement
let mockStep = 'type'
function wizard(element: ReactElement) {
  mockContent = element
  mockStep = element.type === GroupSetup ? 'group-setup' : element.type === CreateTime ? 'time' : element.type === CreateBudget ? 'budget' : element.type === CreateMood ? 'mood' : 'type'
  const path = resolve(__dirname, '../../../app/create/_layout.tsx')
  if (!existsSync(path)) return element // same regression file runs on dc52c94
  const Layout = jest.requireActual(path).default
  return <Layout />
}
const renderScreen = (element: ReactElement) => baseRenderScreen(wizard(element))

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
  function Modal({ visible = true, onDismiss, onShow, onRequestClose, children }: { onRequestClose?: () => void; visible?: boolean; onDismiss?: () => void; onShow?: () => void; children?: React.ReactNode }) {
    const id = React.useRef(++nextId).current
    const [shown, setShown] = React.useState(false)
    const dismissed = React.useRef(onDismiss)
    dismissed.current = onDismiss
    React.useLayoutEffect(() => {
      if (visible && !shown) {
        if (mockPresenter.presented.size) { mockPresenter.refused.push(id); return }
        mockPresenter.presented.add(id); setShown(true); onShow?.()
      } else if (!visible && shown) {
        const timer = setTimeout(() => { mockPresenter.presented.delete(id); setShown(false); dismissed.current?.() }, 5)
        return () => clearTimeout(timer)
      }
    }, [visible, shown, id, onShow])
    React.useEffect(() => () => { mockPresenter.presented.delete(id); dismissed.current?.() }, [id])
    return shown && visible ? React.createElement(View, { testID: 'native-modal', onRequestClose }, children) : null
  }
  return { __esModule: true, default: Modal }
})
const mockFocusEffects = new Map<() => void | (() => void), void | (() => void)>()
const mockFocus: { current?: () => void | (() => void); blur?: () => void } = {}
const mockDismiss = jest.fn()
const mockSave = jest.fn(async () => {})
const mockClear = jest.fn(async () => {})
jest.mock('@/shared/store/savedRoomDraft', () => ({
  saveRoomDraft: () => mockSave(), clearSavedRoomDraft: () => mockClear(),
}))
const mockRefresh = jest.fn<Promise<LocationState | undefined>, []>()
const mockRequest = jest.fn<Promise<LocationState>, []>()
jest.mock('expo-router', () => ({
  useSegments: () => ['create', mockStep],
  Stack: Object.assign(() => mockContent, { Screen: () => null }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: mockDismiss }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => {
      const cleanup = callback()
      mockFocusEffects.set(callback, cleanup)
      mockFocus.current = () => { for (const effect of mockFocusEffects.keys()) effect() }
      mockFocus.blur = () => { for (const stop of mockFocusEffects.values()) stop?.() }
      return () => { cleanup?.(); mockFocusEffects.delete(callback) }
    }, [callback])
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
  mockResult.mockClear()
  mockPresenter.presented.clear(); mockPresenter.refused = []
  mockDismiss.mockClear(); mockSave.mockReset().mockResolvedValue(); mockClear.mockReset().mockResolvedValue()
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
  expect(mockResult.mock.calls.filter(([props]) => props.visible).at(-1)?.[0].variant).toBe('error')
  expect(useWizardModalStore.getState().modals.size).toBe(1)
  const buttons = within(view.getByTestId('sheet-actions')).getAllByRole('button')
  expect(buttons.map(button => button.props.accessibilityLabel)).toEqual([cancel(), confirm()])
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
  expect(mockResult.mock.calls.filter(([props]) => props.visible).at(-1)?.[0].variant).toBe('info')
  expect(useWizardModalStore.getState().modals.size).toBe(1)
  expect(within(view.getByTestId('sheet-actions')).getAllByRole('button').map(button => button.props.accessibilityLabel)).toEqual([confirm()])
  await press(view, confirm())
  expect(view.queryByText(title())).toBeNull()
  await press(view, 'Manual province')
  await press(view, i18n.t('areaPicker.confirm'))
  expect(useRoomStore.getState().administrativeArea?.provinceCode).toBe('01')
  expect(Linking.openSettings).not.toHaveBeenCalled()
  expect(mockPresenter.refused).toEqual([])
})
it.each(['backdrop', 'back'] as const)('round 7: second sheet %s close confirms manual selection; explicit retries still recover', async close => {
  const view = await renderScreen(<CreateType />)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 0) await fireEvent.press(view.getByTestId('create-location-field'))
    await press(view, i18n.t('home.useLocation'))
    expect(view.getByText(title())).toBeTruthy()
    await press(view, cancel())
    expect(view.queryByRole('button', { name: cancel() })).toBeNull()
    if (close === 'backdrop') {
      await fireEvent.press(within(view.getByTestId('native-modal')).getByRole('button', { name: i18n.t('common.close') }))
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) })
    } else {
      await fireEvent(view.getByTestId('native-modal'), 'requestClose')
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) })
    }
    expect(view.getByRole('button', { name: 'Manual province' })).toBeTruthy()
  }
  expect(mockRequest).toHaveBeenCalledTimes(2)
  expect(Linking.openSettings).not.toHaveBeenCalled()
  expect(mockPresenter.refused).toEqual([])
})
it.each(['denied', 'unavailable'] as const)('auto %s is shown once across refocus/rerender; a new wizard session can show again', async status => {
  mockRefresh.mockResolvedValue({ status })
  const view = await renderScreen(<CreateType />)
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  await press(view, cancel()); await press(view, confirm())
  await fireEvent.press(within(view.getByTestId('discovery-location-sheet')).getByRole('button', { name: i18n.t('common.close') }))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) })
  await act(async () => { mockFocus.current?.() })
  await view.rerender(wizard(<CreateType />))
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
it('F-12 auto failure waits for area dismissal before the manual-choice flow', async () => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByTestId('create-location-field'))
  await act(async () => { resolve({ status: 'denied' }) })
  expect(view.queryByText(title())).toBeNull()
  expect(view.getByRole('button', { name: 'Manual province' })).toBeTruthy()
  expect(mockPresenter.refused).toEqual([])
  await fireEvent.press(within(view.getByTestId('discovery-location-sheet')).getByRole('button', { name: i18n.t('common.close') }))
  expect(view.queryByText(title())).toBeNull()
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  await press(view, cancel()); await press(view, confirm())
  expect(view.getByRole('button', { name: 'Manual province' })).toBeTruthy()
  expect(mockPresenter.refused).toEqual([])
})
it.each(['keep', 'discard', 'save'] as const)('F-12 delayed auto failure waits for exit prompt; %s dismisses safely', async action => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  useRoomStore.getState().patchDraft({ title: 'Weekend' })
  const view = await renderScreen(<CreateType />)
  await press(view, i18n.t('draft.close'))
  expect(view.getByText(i18n.t('draft.exitTitle'))).toBeTruthy()
  await act(async () => { resolve({ status: 'denied' }) })
  expect(view.queryByText(title())).toBeNull()
  // Checking refusals catches an attempted (but invisible) second native modal.
  expect(mockPresenter.refused).toEqual([])
  await press(view, i18n.t(action === 'keep' ? 'draft.keepEditing' : action === 'discard' ? 'draft.discard' : 'draft.saveExit'))
  if (action === 'keep') {
    expect(view.getByText(title())).toBeTruthy()
    await press(view, confirm())
    expect(Linking.openSettings).toHaveBeenCalledTimes(1)
    await act(async () => { mockFocus.current?.() })
    expect(view.queryByText(title())).toBeNull()
    expect(mockDismiss).not.toHaveBeenCalled()
  } else {
    // Router is a spy: the screen remains mounted/focused even after exit.
    expect(mockDismiss).toHaveBeenCalledWith('/(tabs)')
    expect(view.queryByText(title())).toBeNull()
    await act(async () => { mockFocus.current?.() })
    expect(view.queryByText(title())).toBeNull()
    expect(Linking.openSettings).not.toHaveBeenCalled()
  }
  expect(mockPresenter.refused).toEqual([])
})
it('F-12 pending auto failure waits for the time sheet native dismissal', async () => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  const screen = (visible: boolean) => <><CreateType /><TimePickerSheet visible={visible} initialTime="19:00" title="Time" onClose={jest.fn()} onDone={jest.fn()} testID="pending-time" /></>
  const view = await renderScreen(screen(true))
  await act(async () => { resolve({ status: 'unavailable' }) })
  expect(view.queryByText(title())).toBeNull()
  expect(mockPresenter.refused).toEqual([])
  await view.rerender(wizard(screen(false)))
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  expect(mockPresenter.refused).toEqual([])
})
it('F-12 auto failure waits for a save-draft overlay; a failed save resumes recovery', async () => {
  let resolve!: (result: LocationState) => void
  let rejectSave!: (error: Error) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  mockSave.mockReturnValue(new Promise((_, reject) => { rejectSave = reject }))
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const view = await renderScreen(<CreateType />)
  await press(view, i18n.t('draft.save'))
  expect(view.getByTestId('blocking-loading-overlay')).toBeTruthy()
  await act(async () => { resolve({ status: 'denied' }) })
  expect(view.queryByText(title())).toBeNull()
  expect(mockPresenter.refused).toEqual([])
  await act(async () => { rejectSave(new Error('save failed')) })
  await waitFor(() => expect(view.getByText(title())).toBeTruthy())
  expect(mockDismiss).not.toHaveBeenCalled()
  expect(mockPresenter.refused).toEqual([])
})
it('F-12 drops a deferred auto prompt when step 1 loses focus before dismissal', async () => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  useRoomStore.getState().patchDraft({ title: 'Weekend' })
  const view = await renderScreen(<CreateType />)
  await press(view, i18n.t('draft.close'))
  await act(async () => { resolve({ status: 'denied' }) })
  await act(async () => { mockFocus.blur?.() })
  await press(view, i18n.t('draft.keepEditing'))
  expect(view.queryByText(title())).toBeNull()
  expect(mockPresenter.refused).toEqual([])
})
it('F-12 a failed exit-save drops auto recovery but later manual failures still recover', async () => {
  let resolve!: (result: LocationState) => void
  mockRefresh.mockReturnValue(new Promise(done => { resolve = done }))
  mockSave.mockRejectedValueOnce(new Error('save failed'))
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  useRoomStore.getState().patchDraft({ title: 'Weekend' })
  const view = await renderScreen(<CreateType />)
  await press(view, i18n.t('draft.close'))
  await act(async () => { resolve({ status: 'denied' }) })
  await press(view, i18n.t('draft.saveExit'))
  expect(mockDismiss).not.toHaveBeenCalled()
  expect(view.queryByText(title())).toBeNull()
  await fireEvent.press(view.getByTestId('create-location-field'))
  await press(view, i18n.t('home.useLocation'))
  expect(view.getByText(title())).toBeTruthy()
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
    expect(keyboard.props.keyboardVerticalOffset).toBe(0) // Layout measurement arrives on a device.
    await fireEvent(chrome.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 160 } } })
    expect(view.getByTestId('create-type-keyboard').props.keyboardVerticalOffset).toBe(160)
    expect(scroll.props.onScroll).toEqual(expect.any(Function))
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
  }
})
