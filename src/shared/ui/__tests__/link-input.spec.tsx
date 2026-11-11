import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import '@/shared/i18n'
import { themes, type AppTheme } from '../theme'

let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const { LinkInput } = jest.requireActual<typeof import('../link-input.view')>('../link-input.view')

it.each(['orange', 'orangeDark'] as const)('renders the import surface, truncation, editor and accessible clear control (%s)', async name => {
  currentTheme = themes[name]
  const onChangeText = jest.fn()
  const onClear = jest.fn()
  const onFocus = jest.fn()
  const onBlur = jest.fn()
  const value = 'https://maps.app.goo.gl/' + 'long-link'.repeat(50)
  const props = { testID: 'input', displayTestID: 'display', value, onChangeText, onClear, onFocus, onBlur }
  const view = await render(<LinkInput {...props} />)
  const input = screen.getByTestId('input')
  expect(input.props).toMatchObject({ value, multiline: false, numberOfLines: 1, scrollEnabled: true, placeholderTextColor: currentTheme.border.outline })
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ height: 52, paddingLeft: 40, paddingRight: 48, paddingVertical: 0, backgroundColor: currentTheme.surface.low, borderColor: currentTheme.border.neutral, color: currentTheme.surface.low })
  expect(screen.getByTestId('material-icon-location', { includeHiddenElements: true })).toBeTruthy()
  expect(screen.getByText(value, { includeHiddenElements: true }).props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' })
  const display = screen.getByTestId('display', { includeHiddenElements: true })
  expect(display.props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' })
  const clear = screen.getByRole('button', { name: 'Xóa liên kết' })
  expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 44, height: 44, top: 4, right: 0 })
  const disc = clear.children[0]
  if (typeof disc === 'string') throw new Error('Expected the round clear-button surface')
  expect(StyleSheet.flatten(disc.props.style).backgroundColor).toBe(currentTheme.surface.highest)
  await fireEvent.press(clear)
  expect(onClear).toHaveBeenCalledTimes(1)
  await fireEvent(input, 'focus', {})
  expect(onFocus).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('display', { includeHiddenElements: true })).toBeNull()
  expect(StyleSheet.flatten(screen.getByTestId('input').props.style)).toMatchObject({ color: currentTheme.text.primary })
  await fireEvent.changeText(input, value + '/edited')
  expect(onChangeText).toHaveBeenCalledWith(value + '/edited')
  await fireEvent(input, 'blur', {})
  expect(onBlur).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('display', { includeHiddenElements: true })).toBeTruthy()
  await view.rerender(<LinkInput {...props} error editable={false} />)
  expect(screen.getByRole('button', { name: 'Xóa liên kết' })).toBeDisabled()
  expect(StyleSheet.flatten(screen.getByTestId('input').props.style).borderColor).toBe(currentTheme.status.danger)
  await fireEvent.press(screen.getByRole('button', { name: 'Xóa liên kết' }))
  expect(onClear).toHaveBeenCalledTimes(1)
  await view.rerender(<LinkInput {...props} value="" />)
  expect(screen.queryByRole('button', { name: 'Xóa liên kết' })).toBeNull()
  expect(screen.queryByTestId('display', { includeHiddenElements: true })).toBeNull()
})
