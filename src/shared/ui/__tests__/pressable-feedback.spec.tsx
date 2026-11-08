jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 1, more: false }) }))
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: { datasetVersion: 'v1' } }),
  useAdministrativeUnits: () => ({ data: [] }),
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useWaitingForNetwork: () => false, useOnlineStatus: () => true }))

import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import { themes, type AppTheme } from '../theme'
import { pressAndHold } from './press-and-hold'

let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const { AppHeader, AppHeaderAction } = jest.requireActual<typeof import('../app-header.view')>('../app-header.view')
const { SheetOptionList } = jest.requireActual<typeof import('../sheet-option-list.view')>('../sheet-option-list.view')
const { Chip } = jest.requireActual<typeof import('../primitives')>('../primitives')
const { SegmentedControl } = jest.requireActual<typeof import('../segmented-control.view')>('../segmented-control.view')
const { AdministrativePicker } = jest.requireActual<typeof import('@/shared/administrative/administrative-picker.view')>('@/shared/administrative/administrative-picker.view')
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>

describe.each(['orange', 'orangeDark'] as const)('shared pressable feedback (%s)', themeName => {
  beforeEach(() => { currentTheme = themes[themeName] })

  it.each([false, true])('actual header back/save and notification actions retain their fill (disabled=%s)', async disabled => {
    const onPress = jest.fn()
    await render(<AppHeader title="Account" backLabel="Back" onBack={onPress} backDisabled={disabled}
      rightAction={<AppHeaderAction accessibilityLabel="Save" onPress={onPress} disabled={disabled}><Text>Save</Text></AppHeaderAction>} />)
    for (const name of ['Back', 'Save']) {
      const action = screen.getByRole('button', { name })
      const resting = flat(action)
      expect(resting.backgroundColor).toBe(disabled ? currentTheme.surface.subtle : undefined)
      await pressAndHold(action)
      expect(flat(action)).toEqual(resting)
      expect(action.props.accessibilityState.disabled).toBe(disabled)
      await fireEvent.press(action)
    }
    expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 2)
    const bell = screen.getByTestId('app-header-bell')
    const resting = flat(bell)
    await pressAndHold(bell)
    expect(flat(bell)).toEqual(resting)
  })

  it.each([false, true])('sheet action rows preserve disabled styling and callbacks (disabled=%s)', async disabled => {
    const onPress = jest.fn()
    await render(<SheetOptionList options={[
      { key: 'photo', icon: 'photoLibrary', title: 'Photo', body: 'Choose', disabled, onPress },
      { key: 'remove', icon: 'close', title: 'Remove', body: 'Delete', destructive: true, disabled, onPress },
    ]} />)
    for (const name of ['Photo', 'Remove']) {
      const action = screen.getByRole('button', { name })
      const resting = flat(action)
      await pressAndHold(action)
      expect(flat(action)).toEqual(resting)
      expect(action.props.accessibilityState.disabled).toBe(disabled)
      await fireEvent.press(action)
    }
    expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 2)
  })

  it.each(['default', 'selected', 'disabled', 'info', 'positive', 'warning'] as const)('chip %s keeps its surface and border on hold', async variant => {
    await render(<Chip label="Chip" variant={variant} onPress={jest.fn()} />)
    const action = screen.getByRole('button', { name: 'Chip' })
    const surface = () => screen.getByText(/Chip$/).parent!
    const resting = flat(surface())
    await pressAndHold(action)
    expect(flat(surface())).toEqual(resting)
  })

  it.each([false, true])('segmented controls retain selected/unselected surfaces (compact=%s)', async compact => {
    await render(<SegmentedControl compact={compact} options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }]} value="one" onChange={jest.fn()} />)
    for (const name of ['One', 'Two']) {
      const resting = flat(screen.getByText(name).parent!)
      await pressAndHold(screen.getByRole('tab', { name }))
      expect(flat(screen.getByText(name).parent!)).toEqual(resting)
    }
  })

  it.each([null, { datasetVersion: 'v1', provinceCode: '79', provinceName: 'City', communeCode: null, communeName: null }])('administrative fields retain fill and disabled state (%j)', async value => {
    await render(<AdministrativePicker embedded value={value} onChange={jest.fn()} />)
    for (const action of screen.getAllByRole('button')) {
      const resting = flat(action)
      await pressAndHold(action)
      expect(flat(action)).toEqual(resting)
    }
  })
})
