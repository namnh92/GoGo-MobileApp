import { act, fireEvent, within } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import { renderScreen } from '../../__tests__/harness'
import { themes, type AppTheme } from '@/shared/ui/theme'
import { useRoomStore } from '@/shared/store/roomStore'
import i18n from '@/shared/i18n'

jest.mock('expo-router', () => ({ useFocusEffect: () => undefined, useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))

// Evaluate real style factories in each mode instead of the default mock's frozen Light theme.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => {
  const evaluate = () => typeof factory === 'function' ? factory(currentTheme, runtime) : factory
  return new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
    get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(evaluate(), key),
  })
})
const CreateType = jest.requireActual<typeof import('../create-type.view')>('../create-type.view').default
const { CheckboxRow } = jest.requireActual<typeof import('@/shared/ui/checkbox-row.view')>('@/shared/ui/checkbox-row.view')
const { TimeWheel } = jest.requireActual<typeof import('@/shared/ui/time-wheel.view')>('@/shared/ui/time-wheel.view')

it.each([
  ['orange', 'vi'], ['orangeDark', 'vi'], ['orange', 'en'], ['orangeDark', 'en'],
] as const)('uses AppToken roles for selection, checkboxes and wheels in %s / %s', async (themeName, locale) => {
  currentTheme = themes[themeName]
  useRoomStore.getState().resetDraft()
  await act(async () => { await i18n.changeLanguage(locale) })
  const pick = jest.fn()
  const view = await renderScreen(<View><CreateType /><CheckboxRow label="Choice" checked onPress={pick} /><TimeWheel value="19:15" onChange={pick} /></View>)
  const selected = view.getAllByRole('radio').find(node => node.props.accessibilityState.selected)!
  expect(StyleSheet.flatten(selected.props.style).borderColor).toBe(currentTheme.accent.primary)
  expect(StyleSheet.flatten(view.getByRole('checkbox', { name: 'Choice' }).props.style)).toMatchObject({
    backgroundColor: currentTheme.surface.subtle, borderColor: currentTheme.accent.text,
  })
  const hour = view.getByTestId('time-wheel-hours-19')
  expect(StyleSheet.flatten(within(hour).getByText('19').props.style)).toMatchObject({ color: currentTheme.accent.onSoft, fontFamily: currentTheme.type.discoveryHeading.fontFamily })
  expect(hour.props.accessibilityState.selected).toBe(true)
  await fireEvent(view.getByRole('adjustable', { name: i18n.t('createTime.minutes') }), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
  expect(pick).toHaveBeenCalledWith('19:16')
  await act(async () => { await i18n.changeLanguage('vi') })
})
