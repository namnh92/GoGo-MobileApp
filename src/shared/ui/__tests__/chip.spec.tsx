import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { ChipVariant } from '../chip.view'
import { themes, type AppTheme } from '../theme'
import { touchTarget } from '../tokens'

const flat = (node: { props: { style?: any } }) => StyleSheet.flatten(node.props.style)
const variants: ChipVariant[] = ['default', 'selected', 'disabled', 'info', 'positive', 'warning']
const appearances = ['default', 'discovery', 'mood', 'soft', 'raised'] as const

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
const { FollowUps } = jest.requireActual<typeof import('@/features/assistant/follow-ups.view')>('@/features/assistant/follow-ups.view')
afterEach(() => { currentTheme = themes.orange })

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => [1, 3, 5].map(i => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i]!, 0)
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (hi! + 0.05) / (lo! + 0.05)
}

it.each(Object.entries(themes))('keeps idle and selected chip text at AA in every appearance in %s', async (_name, theme) => {
  currentTheme = theme
  const view = await render(<Chip label="Filter" testID="chip" />)
  for (const appearance of appearances) {
    await view.rerender(<Chip label="Filter" testID="chip" appearance={appearance} />)
    const idleFill = flat(screen.getByTestId('chip')).backgroundColor
    expect(contrast(flat(screen.getByText('Filter')).color, idleFill)).toBeGreaterThanOrEqual(4.5)
    await view.rerender(<Chip label="Filter" testID="chip" appearance={appearance} variant="selected" />)
    const selectedFill = flat(screen.getByTestId('chip')).backgroundColor
    expect(selectedFill).not.toBe(idleFill)
    expect(contrast(flat(screen.getByText('Filter')).color, selectedFill)).toBeGreaterThanOrEqual(4.5)
  }
})

it.each(appearances)('reserves a 44pt layout target for interactive %s chips, including short labels', async appearance => {
  const view = await render(<Chip label="A" appearance={appearance} onPress={jest.fn()} />)
  for (const variant of variants) {
    await view.rerender(<Chip label="A" appearance={appearance} variant={variant} onPress={jest.fn()} />)
    const host = flat(screen.getByRole('button', { name: 'A', disabled: variant === 'disabled' }))
    expect(host.minHeight).toBeGreaterThanOrEqual(touchTarget.min)
    expect(host.minWidth).toBeGreaterThanOrEqual(touchTarget.min)
    expect(host.height).toBeUndefined()
    expect(host.maxHeight).toBeUndefined()
  }
})

it('gives an independent removal action its own 44pt layout target', async () => {
  await render(<Chip label="Place" onRemove={jest.fn()} removeAccessibilityLabel="Remove place" />)
  const remove = flat(screen.getByRole('button', { name: 'Remove place' }))
  expect(remove.minWidth).toBeGreaterThanOrEqual(touchTarget.min)
  expect(remove.minHeight).toBeGreaterThanOrEqual(touchTarget.min)
  expect(remove.width).toBeUndefined()
  expect(remove.height).toBeUndefined()
})

it('keeps assistant quick replies at 44pt in a single wrapping row without relying on hitSlop', async () => {
  const onSelect = jest.fn()
  await render(<FollowUps items={[{ label: 'A', text: 'one' }, { label: 'B', text: 'two', accent: true }]} onSelect={onSelect} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(2)
  // Walk the rendered parents to the actual flex row. No native Yoga layout
  // runs in Jest: assert the layout constraints that make its one-row height >=44.
  let row = buttons[0]!.parent
  while (row && flat(row)?.flexDirection !== 'row') row = row.parent
  expect(row).not.toBeNull()
  expect(flat(row!).flexWrap).toBe('wrap')
  expect(flat(row!).height).toBeUndefined()
  expect(flat(row!).maxHeight).toBeUndefined()
  for (const button of buttons) {
    expect(flat(button).minHeight).toBeGreaterThanOrEqual(touchTarget.min)
    expect(flat(button).minWidth).toBeGreaterThanOrEqual(touchTarget.min)
  }
  await fireEvent.press(buttons[0]!)
  expect(onSelect).toHaveBeenCalledWith('one')
})

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
        disabled: appearance === 'raised' ? [theme.redesign.card, theme.redesign.secondary] : [theme.surface.subtle, theme.text.secondary],
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
it.each(appearances)('retains selection when disabled and never dispatches its action in %s', async appearance => {
  const onPress = jest.fn()
  await render(<Chip label="Selected" appearance={appearance} variant="selected" disabled onPress={onPress} />)
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
