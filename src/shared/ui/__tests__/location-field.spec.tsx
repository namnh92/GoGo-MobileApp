import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themes, type AppTheme } from '../theme'
import { type } from '../tokens'
import i18n from '@/shared/i18n'

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
const { LocationField } = jest.requireActual<typeof import('../location-field.view')>('../location-field.view')
const { styles: nameStyles } = jest.requireActual<typeof import('@/features/create-date/create-type.style')>('@/features/create-date/create-type.style')

it.each(Object.entries(themes))('uses the name-field size and semantic roles for empty and filled fields in %s', async (_name, theme) => {
  currentTheme = theme
  const onPress = jest.fn()
  const view = await render(<LocationField label={null} onPress={onPress} />)
  const field = screen.getByRole('button', { name: i18n.t('home.chooseArea') })
  const style = StyleSheet.flatten(field.props.style)
  const nameStyle = StyleSheet.flatten(nameStyles.nameInput)
  for (const key of ['minHeight', 'padding', 'borderRadius', 'borderWidth', 'borderColor', 'backgroundColor'] as const) {
    expect(style[key]).toBe(nameStyle[key])
  }
  expect(style.minHeight).toBeGreaterThanOrEqual(44)
  expect(style.width).toBe('100%')
  expect(style.backgroundColor).toBe(theme.surface.subtle)
  expect(style.borderColor).toBe(theme.border.hairline)
  const placeholder = screen.getByText(i18n.t('home.chooseArea'))
  expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({ fontSize: type.body.fontSize, color: theme.text.secondary })
  expect(placeholder.props.numberOfLines).toBe(1)
  expect(placeholder.props.ellipsizeMode).toBe('tail')
  await fireEvent.press(field)
  expect(onPress).toHaveBeenCalledTimes(1)
  const label = 'Phường Bến Thành, Thành phố Hồ Chí Minh'
  await view.rerender(<LocationField label={label} onPress={onPress} />)
  expect(StyleSheet.flatten(screen.getByText(label).props.style)).toMatchObject({ fontSize: type.body.fontSize, color: theme.text.primary })
  expect(screen.getByRole('button').props.accessibilityValue).toEqual({ text: label })
})
