import { act, fireEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { loaded as mockLoaded, renderScreen } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore, toCreateRoomBody } from '@/shared/store/roomStore'
import { styles as typeStyles } from '../create-type.style'
import { themes } from '@/shared/ui/theme'
import { WHEEL_ROW } from '@/shared/ui/time-wheel.style'
import CreateTypeScreen from '../create-type.view'
import CreateBudgetScreen from '../create-budget.view'
import CreateMoodScreen from '../create-mood.view'
import CreateTimeScreen from '../create-time.view'

// Preserve KAV's declarative configuration while rendering its children as hosts.
jest.mock('react-native', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  const mockRN = Object.create(RN)
  Object.defineProperty(mockRN, 'KeyboardAvoidingView', { value: (props: import('react-native').KeyboardAvoidingViewProps) => React.createElement(RN.View, props) })
  return mockRN
})
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ usualBudget: null }),
  useTaxonomies: () => mockLoaded({ kinds: {
    mood: ['a', 'b', 'c', 'd'].map(key => ({ key, labels: { vi: `Mood ${key}`, en: `Mood ${key}` } })),
    setting: ['inside', 'outside', 'quiet'].map(key => ({ key, labels: { vi: key, en: key } })),
    spending_style: [{ key: 'value', labels: { vi: 'Tiết kiệm', en: 'Value' } }],
  } }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: jest.fn() }),
}))

beforeEach(async () => {
  useRoomStore.getState().resetDraft()
  await act(async () => { await i18n.changeLanguage('vi') })
  jest.useFakeTimers({ now: new Date(2026, 10, 5, 10), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] })
})
afterEach(() => jest.useRealTimers())

it('removes the selected pill and pairs accent border with a bold title (#594 owner 1)', async () => {
  const view = await renderScreen(<CreateTypeScreen />)
  expect(view.queryByText('Đã chọn')).toBeNull()
  const [couple, group] = view.getAllByRole('radio')
  expect(couple.props.accessibilityState.selected).toBe(true)
  expect(StyleSheet.flatten(couple.props.style).borderColor).toBe(StyleSheet.flatten(typeStyles.optionActive).borderColor)
  expect(StyleSheet.flatten(view.getByText(i18n.t('createType.couple')).props.style).fontFamily).toBe(themes.orange.type.discoveryHeading.fontFamily)
  expect(StyleSheet.flatten(view.getByText('Nhóm bạn').props.style).fontFamily).toBe(themes.orange.type.introHeading.fontFamily)
  await fireEvent.press(group)
  expect(view.getAllByRole('radio').map(node => node.props.accessibilityState.selected)).toEqual([false, true])
  expect(view.queryByText('Đã chọn')).toBeNull()
  for (const theme of [themes.orange, themes.orangeDark]) {
    expect(theme.type.discoveryHeading.fontSize).toBe(theme.type.introHeading.fontSize)
    expect(theme.type.discoveryHeading.fontFamily).not.toBe(theme.type.introHeading.fontFamily)
  }
})

it('uses the existing focus visibility pattern with a docked CTA outside the scroll viewport (#594 owner 2)', async () => {
  const view = await renderScreen(<CreateTypeScreen />)
  const kav = view.getByTestId('create-type-keyboard')
  expect(kav.props.behavior).toBe('padding')
  const scroll = view.getByTestId('create-type-scroll')
  expect(scroll.type).toBe('RCTScrollView')
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
  expect(scroll.props.keyboardDismissMode).toBe('on-drag')
  expect(scroll.props.onContentSizeChange).toEqual(expect.any(Function))
  expect(scroll.props.onScroll).toEqual(expect.any(Function))
  expect(StyleSheet.flatten(view.getByTestId('create-footer').props.style).position).not.toBe('absolute')
  expect(within(view.getByTestId('create-type-viewport')).queryByTestId('create-footer')).toBeNull()
  expect(within(view.getByTestId('create-type-viewport')).getByLabelText('Tên kèo (không bắt buộc)').props.onFocus).toEqual(expect.any(Function))
})

it.each(['couple', 'group-host'] as const)('keeps one budget scope subtitle for %s and units on each amount (#594 owner 7)', async audience => {
  useRoomStore.getState().setAudience(audience)
  useRoomStore.getState().setBudgetMode('total')
  const view = await renderScreen(<CreateBudgetScreen />)
  expect(view.queryByText('Tổng ngân sách cho hai người')).toBeNull()
  if (audience === 'group-host') expect(view.getAllByText(i18n.t('groupSetup.groupTotal'))).toHaveLength(1)
  const unit = i18n.t(audience === 'couple' ? 'createBudget.unit.couple' : 'price.unit.per_group')
  const tier = view.getByRole('button', { name: /^300.000đ – 500.000đ / })
  expect(within(tier).getByText(`300.000đ – 500.000đ ${unit}`)).toBeTruthy()
  await fireEvent.press(tier)
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(toCreateRoomBody(useRoomStore.getState()).constraint).toMatchObject({ budgetAmount: 500_000, budgetMode: 'total' })
})

it('uses shared checkboxes, enforces max 3 with feedback, and permits deselection (#594 owner 8)', async () => {
  const view = await renderScreen(<CreateMoodScreen />)
  expect(view.getAllByRole('checkbox')).toHaveLength(8)
  for (const name of ['Mood a', 'Mood b', 'Mood c']) await fireEvent.press(view.getByRole('checkbox', { name }))
  expect(useRoomStore.getState().moodKeys).toEqual(['a', 'b', 'c'])
  const fourth = view.getByRole('checkbox', { name: 'Mood d' })
  expect(fourth.props.accessibilityState).toEqual({ checked: false, disabled: true })
  expect(view.getByText(i18n.t('placeWizard.selectionLimitHint', { max: 3 }))).toBeTruthy()
  await fireEvent.press(fourth)
  expect(useRoomStore.getState().moodKeys).toHaveLength(3)
  await fireEvent.press(view.getByRole('checkbox', { name: 'Mood a' }))
  await fireEvent.press(view.getByRole('checkbox', { name: 'Mood d' }))
  expect(useRoomStore.getState().moodKeys).toEqual(['b', 'c', 'd'])
  for (const name of ['inside', 'outside', 'quiet']) await fireEvent.press(view.getByRole('checkbox', { name }))
  expect(useRoomStore.getState().settingKeys).toEqual(['inside', 'outside'])
  await fireEvent.press(view.getByRole('checkbox', { name: 'Tiết kiệm' }))
  expect(useRoomStore.getState().spendingStyleKey).toBe('value')
  await fireEvent.press(view.getByRole('checkbox', { name: 'Tiết kiệm' }))
  expect(useRoomStore.getState().spendingStyleKey).toBeNull()
})

it('shows one week, expands/collapses with selection preserved, and removes quick date chips (#594 owner 5)', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  expect(view.getAllByTestId('date-inline-week')).toHaveLength(1)
  expect(view.queryByText('Cuối tuần này')).toBeNull()
  expect(view.queryByText('Ngày mai')).toBeNull()
  expect(view.queryByTestId('date-inline-shortcut-today')).toBeNull()
  expect(view.getByTestId('date-inline-day-2026-11-04').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(view.getByTestId('date-inline-expand'))
  expect(view.getAllByTestId('date-inline-week')).toHaveLength(6)
  await fireEvent.press(view.getByTestId('date-inline-day-2026-11-20'))
  // The chosen day is retained in the collapsed week after the draft rerenders.
  if (view.getByTestId('date-inline-expand').props.accessibilityState.expanded) await fireEvent.press(view.getByTestId('date-inline-expand'))
  expect(view.getAllByTestId('date-inline-week')).toHaveLength(1)
  expect(view.getByTestId('date-inline-day-2026-11-20').props.accessibilityState.selected).toBe(true)
})

it('aligns Other time with preset chips and stages a scroll-wheel pick until Done (#594 owner 6)', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  expect(StyleSheet.flatten(view.getByText('Giờ khác').parent!.props.style)).toEqual(StyleSheet.flatten(view.getByText('19:00').parent!.props.style))
  await fireEvent.press(view.getByTestId('date-inline-other-time'))
  const hours = view.getByTestId('start-time-sheet-wheel-hours')
  expect(hours.props.snapToInterval).toBe(WHEEL_ROW)
  await fireEvent(hours, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0, y: 22 * WHEEL_ROW } } })
  await fireEvent.press(view.getByTestId('start-time-sheet-wheel-minutes-15'))
  expect(useRoomStore.getState().startTime).toBeNull()
  const actions = within(view.getByTestId('sheet-actions')).getAllByRole('button')
  expect(actions.map(node => node.props.accessibilityLabel)).toEqual(['Huỷ', 'Xong'])
  await fireEvent.press(view.getByText('Xong'))
  expect(useRoomStore.getState().startTime).toBe('22:15')
  await fireEvent.press(view.getByTestId('date-inline-other-time'))
  await fireEvent.press(view.getByTestId('start-time-sheet-wheel-hours-23'))
  await fireEvent.press(view.getByText('Huỷ'))
  expect(useRoomStore.getState().startTime).toBe('22:15')
})

it('localizes new calendar, wheel, and checkbox controls in English', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  const view = await renderScreen(<CreateTimeScreen />)
  expect(view.getByRole('button', { name: 'Expand month calendar' })).toBeTruthy()
  await fireEvent.press(view.getByTestId('date-inline-other-time'))
  expect(view.getByRole('adjustable', { name: 'Hours' })).toBeTruthy()
  expect(view.getByRole('adjustable', { name: 'Minutes' })).toBeTruthy()
  await view.unmount()
  const mood = await renderScreen(<CreateMoodScreen />)
  expect(mood.getByRole('checkbox', { name: 'Value' })).toBeTruthy()
  await act(async () => { await i18n.changeLanguage('vi') })
})
