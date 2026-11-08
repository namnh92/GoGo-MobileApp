import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import { themes, type AppTheme } from '@/shared/ui/theme'
import i18n from '@/shared/i18n'

// Evaluate the actual shared styles in both modes; the stock mock freezes them at import.
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
const { ContributionChoices } = jest.requireActual<typeof import('@/features/place-import/contribution-choices.view')>('@/features/place-import/contribution-choices.view')

it.each(['orange', 'orangeDark'] as const)('uses shared default and selected chips for purpose choices in %s', async themeName => {
  currentTheme = themes[themeName]
  const options = ['Cặp đôi', 'Sống ảo check-in', 'Lên món nhanh', 'Nhân viên thân thiện', ...Array.from({ length: 9 }, (_, i) => `Option ${i}`)]
    .map((label, i) => ({ key: `choice-${i}`, labels: { vi: label, en: label } }))
  const onChange = jest.fn()
  const view = await render(<ContributionChoices options={options} selected={[]} onChange={onChange} title="Choices" disabled={false} />)
  const bodyStyle = (label: string) => StyleSheet.flatten(screen.getByText(label).parent!.props.style)
  for (const label of options.slice(0, 4).map(option => option.labels.vi)) {
    expect(bodyStyle(label)).toMatchObject({ borderWidth: 1, borderColor: currentTheme.border.hairline, backgroundColor: currentTheme.surface.card })
    expect(bodyStyle(label)).toEqual(bodyStyle('+7 khác'))
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Cặp đôi' }))
  expect(onChange).toHaveBeenCalledWith(['choice-0'])
  await view.rerender(<ContributionChoices options={options} selected={['choice-0', 'choice-2']} onChange={onChange} title="Choices" disabled={false} />)
  for (const label of ['Cặp đôi', 'Lên món nhanh']) {
    expect(bodyStyle(label)).toMatchObject({ borderWidth: 1, borderColor: currentTheme.accent.primary, backgroundColor: currentTheme.accent.primary })
    expect(screen.getByRole('button', { name: label }).props.accessibilityState.selected).toBe(true)
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Cặp đôi' }))
  expect(onChange).toHaveBeenLastCalledWith(['choice-2'])
})


it.each([
  ['orange', 'vi', 'Tất cả'],
  ['orangeDark', 'vi', 'Tất cả'],
  ['orange', 'en', 'All'],
  ['orangeDark', 'en', 'All'],
] as const)('opens all amenities from a compact header action in %s / %s', async (themeName, locale, label) => {
  currentTheme = themes[themeName]
  await i18n.changeLanguage(locale)
  const options = Array.from({ length: 11 }, (_, i) => ({ key: `amenity-${i}`, labels: { vi: `Tiện ích ${i}`, en: `Amenity ${i}` } }))
  const onChange = jest.fn()
  await render(<ContributionChoices options={options} selected={[]} onChange={onChange} title="Amenities" checklist disabled={false}
    renderHeader={action => <View testID="amenity-header" style={{ minHeight: 44 }}>{action}</View>} />)
  const action = screen.getByRole('button', { name: i18n.t('placeWizard.allChoices', { title: 'Amenities', count: 11 }) })
  expect(action.parent!.props.testID).toBe('amenity-header')
  expect(screen.queryByText(i18n.t('placeWizard.allChoices', { title: 'Amenities', count: 11 }))).toBeNull()
  const text = screen.getByText(label)
  expect(StyleSheet.flatten(text.props.style).color).toBe(currentTheme.accent.text)
  const style = StyleSheet.flatten(action.props.style)
  expect(style.minWidth + 2 * action.props.hitSlop).toBeGreaterThanOrEqual(44)
  expect(style.minHeight + 2 * action.props.hitSlop).toBeGreaterThanOrEqual(44)
  expect(screen.getAllByRole('checkbox')).toHaveLength(5)
  const row = screen.getAllByRole('checkbox')[0]
  expect(StyleSheet.flatten(row.props.style).backgroundColor).toBe(currentTheme.surface.subtle)
  expect(StyleSheet.flatten(within(row).getByText(options[0].labels[locale]).props.style).color).toBe(currentTheme.text.primary)
  await fireEvent.press(action)
  expect(within(screen.getByTestId('contribution-choices-sheet')).getAllByRole('checkbox')).toHaveLength(11)
  await fireEvent.press(screen.getByRole('checkbox', { name: options[10].labels[locale] }))
  expect(onChange).toHaveBeenCalledWith(['amenity-10'])
  await act(async () => { await i18n.changeLanguage('vi') })
})

it.each([
  ['orange', 'vi'], ['orangeDark', 'vi'], ['orange', 'en'], ['orangeDark', 'en'],
] as const)('keeps max-three checklist choices removable and explains locked rows in %s / %s', async (themeName, locale) => {
  currentTheme = themes[themeName]
  await i18n.changeLanguage(locale)
  const options = Array.from({ length: 8 }, (_, i) => ({ key: `vibe-${i}`, labels: { vi: `Vibe ${i}`, en: `Vibe ${i}` } }))
  const onChange = jest.fn()
  const selected = ['vibe-0', 'vibe-1', 'vibe-2']
  const view = await render(<ContributionChoices options={options} selected={selected} onChange={onChange}
    title="Vibes" checklist max={3} disabled={false} renderHeader={action => action} />)
  const locked = screen.getByRole('checkbox', { name: 'Vibe 3' })
  expect(locked.props.accessibilityState.disabled).toBe(true)
  expect(locked.props.accessibilityHint).toBe(i18n.t('placeWizard.selectionLimitHint', { max: 3 }))
  await fireEvent.press(locked)
  expect(onChange).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Vibe 0' }))
  expect(onChange).toHaveBeenLastCalledWith(['vibe-1', 'vibe-2'])
  await view.rerender(<ContributionChoices options={options} selected={['vibe-1', 'vibe-2']} onChange={onChange}
    title="Vibes" checklist max={3} disabled={false} renderHeader={action => action} />)
  expect(screen.getByRole('checkbox', { name: 'Vibe 3' }).props.accessibilityState.disabled).toBe(false)
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Vibe 3' }))
  expect(onChange).toHaveBeenLastCalledWith(['vibe-1', 'vibe-2', 'vibe-3'])
  await act(async () => { await i18n.changeLanguage('vi') })
})
