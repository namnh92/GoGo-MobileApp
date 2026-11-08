import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { ChipVariant } from '../chip.view'
import { themes, type AppTheme } from '../theme'

const flat = (node: { props: { style?: any } }) => StyleSheet.flatten(node.props.style)
const variants: ChipVariant[] = ['default', 'selected', 'disabled', 'info', 'positive', 'warning']
const appearances = ['default', 'discovery', 'mood', 'soft'] as const

// Stock Unistyles mocks freeze stylesheet factories at import. Evaluate the real
// factories per theme, as accent-foreground.spec does; native switching is outside Jest.
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
const { Chip } = jest.requireActual<typeof import('../chip.view')>('../chip.view')
afterEach(() => { currentTheme = themes.orange })

it.each(Object.entries(themes))('keeps every variant single-line and selected heavier without a check in %s', async (name, theme) => {
  currentTheme = theme
  const view = await render(<Chip label="Long label" />)
  for (const appearance of appearances) {
    for (const variant of variants) {
      await view.rerender(<Chip label="Long label" testID="chip" variant={variant} appearance={appearance} />)
      const label = screen.getByText('Long label')
      expect(label.props.numberOfLines).toBe(1)
      expect(label.props.ellipsizeMode).toBe('tail')
      expect(flat(label).fontFamily).toBe(variant === 'selected' ? theme.type.introLabel.fontFamily : theme.type.introSmall.fontFamily)
      expect(theme.type.introLabel.fontFamily).not.toBe(theme.type.introSmall.fontFamily)
      expect(screen.getByTestId('chip').props.accessibilityState).toEqual({ selected: variant === 'selected', disabled: variant === 'disabled' })
      expect(screen.queryByText(/✓/)).toBeNull()
      const semantic = {
        disabled: [theme.surface.subtle, theme.text.secondary],
        info: [theme.status.infoSoft, theme.status.infoText],
        positive: [theme.status.successSoft, theme.status.successText],
        warning: [theme.status.warningSoft, theme.status.warningText],
      }
      if (variant in semantic) {
        const [fill, foreground] = semantic[variant as keyof typeof semantic]
        expect(flat(screen.getByTestId('chip')).backgroundColor).toBe(fill)
        expect(flat(label).color).toBe(foreground)
      }
    }
    await view.rerender(<Chip label="Long label" testID="chip" variant="default" appearance={appearance} />)
    const idle = flat(screen.getByTestId('chip')).backgroundColor
    await view.rerender(<Chip label="Long label" testID="chip" variant="selected" appearance={appearance} />)
    expect(flat(screen.getByTestId('chip')).backgroundColor).not.toBe(idle)
  }
})
it('retains selection when disabled and never dispatches its action', async () => {
  const onPress = jest.fn()
  await render(<Chip label="Selected" variant="selected" disabled onPress={onPress} />)
  const chip = screen.getByRole('button', { name: 'Selected' })
  expect(chip.props.accessibilityState).toEqual({ selected: true, disabled: true })
  await fireEvent.press(chip)
  expect(onPress).not.toHaveBeenCalled()
})
it('dispatches press and the separate remove action with their accessible labels', async () => {
  const onPress = jest.fn(), onRemove = jest.fn()
  await render(<><Chip label="Filter" onPress={onPress} /><Chip label="About place" onRemove={onRemove} removeAccessibilityLabel="Remove place" /></>)
  await fireEvent.press(screen.getByRole('button', { name: 'Filter' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Remove place' }))
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onRemove).toHaveBeenCalledTimes(1)
})
