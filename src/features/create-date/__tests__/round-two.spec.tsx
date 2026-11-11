import { act, fireEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { loaded as mockLoaded, renderScreen } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import GroupSetupScreen from '../group-setup.view'
import CreateMoodScreen from '../create-mood.view'
import CreateTimeScreen from '../create-time.view'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ usualBudget: null }),
  useTaxonomies: () => mockLoaded({ kinds: {
    mood: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(key => ({ key, labels: { vi: `Mood ${key}`, en: `Mood ${key}` } })),
    setting: ['inside', 'outside', 'quiet', 's4', 's5', 's6', 's7'].map(key => ({ key, labels: { vi: key, en: key } })),
    spending_style: ['value', 's2', 's3', 's4', 's5', 's6', 's7'].map(key => ({ key, labels: { vi: `Spend ${key}`, en: `Spend ${key}` } })),
  } }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: jest.fn() }),
}))
beforeEach(async () => {
  useRoomStore.getState().resetDraft()
  await act(async () => { await i18n.changeLanguage('vi') })
  jest.useFakeTimers({ now: new Date(2026, 10, 5, 10), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] })
})
afterEach(() => jest.useRealTimers())


it('round 2: keeps only the bounded stepper and live budget counts', async () => {
  useRoomStore.getState().setAudience('group-host')
  useRoomStore.getState().setParticipantCount(3)
  const view = await renderScreen(<GroupSetupScreen />)
  for (const label of ['3 – 4 người', '5 – 6 người', '7 – 10 người', 'Trên 10 người']) expect(view.queryByText(label)).toBeNull()
  expect(view.getByRole('button', { name: i18n.t('groupSetup.decrease') }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  expect(useRoomStore.getState().participantCount).toBe(4)
  expect(view.getByText(i18n.t('groupSetup.groupTotalHelp', { n: 4 }))).toBeTruthy()
  await act(async () => useRoomStore.getState().setParticipantCount(12))
  expect(view.getByRole('button', { name: i18n.t('groupSetup.increase') }).props.accessibilityState.disabled).toBe(true)
})

it.each(['vi', 'en'])('round 2: toggles the calendar through accessible double-chevron icons only (%s)', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  const view = await renderScreen(<CreateTimeScreen />)
  const button = view.getByRole('button', { name: i18n.t('createTime.expandCalendar') })
  expect(within(button).queryByText(i18n.t('createTime.expandCalendar'))).toBeNull()
  expect(within(button).getByTestId('material-icon-keyboardDoubleArrowDown', { includeHiddenElements: true })).toBeTruthy()
  const style = StyleSheet.flatten(button.props.style)
  expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44)
  expect(style.minWidth ?? style.width).toBeGreaterThanOrEqual(44)
  await fireEvent.press(button)
  expect(view.getAllByTestId('date-inline-week')).toHaveLength(6)
  expect(within(view.getByRole('button', { name: i18n.t('createTime.collapseCalendar') })).getByTestId('material-icon-keyboardDoubleArrowUp', { includeHiddenElements: true })).toBeTruthy()
})

it('round 2: removes time chips and opens the staged start wheel from Bắt đầu', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  expect(view.queryByText('Giờ khác')).toBeNull()
  for (const slot of ['17:00', '18:00', '19:00', '20:00', '21:00']) expect(view.queryByTestId(`date-inline-time-${slot}`)).toBeNull()
  await fireEvent.press(view.getByTestId('date-inline-day-2026-11-06'))
  await fireEvent.press(view.getByTestId('create-time-start-row'))
  await fireEvent.press(view.getByTestId('start-time-sheet-wheel-hours-09'))
  await fireEvent.press(view.getByTestId('start-time-sheet-wheel-minutes-15'))
  expect(useRoomStore.getState().startTime).toBeNull()
  await fireEvent.press(view.getByText('Xong'))
  expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2026-11-06', startTime: '09:15' })
})

it.each(['vi', 'en'])('round 2: caps each section, expands independently and retains selected overflow (%s)', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  const view = await renderScreen(<CreateMoodScreen />)
  expect(view.getAllByRole('checkbox')).toHaveLength(15)
  const all = locale === 'vi' ? 'Tất cả' : 'Show all'
  const collapse = locale === 'vi' ? 'Thu gọn' : 'Show less'
  expect(view.getAllByRole('button', { name: all })).toHaveLength(3)
  await fireEvent.press(view.getAllByRole('button', { name: all })[0])
  expect(view.getAllByRole('checkbox')).toHaveLength(17)
  expect(view.getAllByRole('button', { name: all })).toHaveLength(2)
  await fireEvent.press(view.getByRole('checkbox', { name: 'Mood g' }))
  await fireEvent.press(view.getByRole('button', { name: collapse }))
  expect(view.getAllByRole('checkbox')).toHaveLength(16)
  expect(view.getByRole('checkbox', { name: 'Mood g' }).props.accessibilityState.checked).toBe(true)
  expect(view.queryByRole('checkbox', { name: 'Mood f' })).toBeNull()
  await fireEvent.press(view.getByRole('checkbox', { name: 'Mood g' }))
  expect(view.queryByRole('checkbox', { name: 'Mood g' })).toBeNull()
})

it('round 2: keeps restored overflow selections visible and preserves max three after expansion', async () => {
  useRoomStore.getState().patchDraft({ moodKeys: ['g'], settingKeys: ['s7'], spendingStyleKey: 's7' })
  const view = await renderScreen(<CreateMoodScreen />)
  expect(view.getAllByRole('checkbox')).toHaveLength(18)
  for (const name of ['Mood g', 's7', 'Spend s7']) expect(view.getByRole('checkbox', { name }).props.accessibilityState.checked).toBe(true)
  await fireEvent.press(view.getAllByRole('button', { name: 'Tất cả' })[0])
  for (const name of ['Mood a', 'Mood b']) await fireEvent.press(view.getByRole('checkbox', { name }))
  expect(useRoomStore.getState().moodKeys).toEqual(['g', 'a', 'b'])
  expect(view.getByRole('checkbox', { name: 'Mood f' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(view.getByRole('checkbox', { name: 'Mood f' }))
  expect(useRoomStore.getState().moodKeys).toHaveLength(3)
  await fireEvent.press(view.getByRole('button', { name: 'Thu gọn' }))
  expect(view.getByRole('checkbox', { name: 'Mood g' }).props.accessibilityState.checked).toBe(true)
})

it.each([0, 1, 2])('round 2: expands section %s inline and collapses independently', async section => {
  const view = await renderScreen(<CreateMoodScreen />)
  await fireEvent.press(view.getAllByRole('button', { name: 'Tất cả' })[section])
  expect(view.getAllByRole('checkbox')).toHaveLength(17)
  expect(view.getAllByRole('button', { name: 'Tất cả' })).toHaveLength(2)
  await fireEvent.press(view.getByRole('button', { name: 'Thu gọn' }))
  expect(view.getAllByRole('checkbox')).toHaveLength(15)
})
