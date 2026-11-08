import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themes, type AppTheme } from '@/shared/ui/theme'
import '@/shared/i18n'

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

it.each(['orange', 'orangeDark'] as const)('uses shared default and selected chips for purpose/service choices in %s', async themeName => {
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
