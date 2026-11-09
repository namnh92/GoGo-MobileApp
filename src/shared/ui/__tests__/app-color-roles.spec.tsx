import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import '@/shared/i18n'
import { themes, type AppTheme } from '../theme'
import { resolveColor } from '../text'

let current: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: current, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => {
  const evaluate = () => typeof factory === 'function' ? factory(current, runtime) : factory
  return new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
    get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(evaluate(), key),
  })
})
const { Chip } = jest.requireActual<typeof import('../chip.view')>('../chip.view')
const { styles: input } = jest.requireActual<typeof import('@/features/place-import/import.style')>('@/features/place-import/import.style')
const { styles: wizard } = jest.requireActual<typeof import('@/features/place-import/contribution-wizard.style')>('@/features/place-import/contribution-wizard.style')
const { styles: saved } = jest.requireActual<typeof import('@/features/tabs/saved-city.style')>('@/features/tabs/saved-city.style')
const { styles: notification } = jest.requireActual<typeof import('../header-notification-button.style')>('../header-notification-button.style')
const { styles: home } = jest.requireActual<typeof import('@/features/home/home.style')>('@/features/home/home.style')

function contrast(a: string, b: string) {
  const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe.each(Object.entries(themes))('%s real accent bindings (#556)', (_name, theme) => {
  beforeEach(() => { current = theme })
  it('updates formerly fixed orange fills, outlines, text, dots and washes', () => {
    expect(input.inputPrimary.backgroundColor).toBe(theme.accent.primaryMuted)
    expect(input.photoPicker.borderColor).toBe(theme.accent.text)
    expect(input.benefitIcon.backgroundColor).toBe(theme.accent.container)
    expect(saved.activeDot.backgroundColor).toBe(theme.accent.primary)
    expect(notification.unreadDot.backgroundColor).toBe(theme.accent.primary)
    expect(home.heroPrimary.backgroundColor).toBe(theme.accent.primaryDeep)
    expect(resolveColor(theme, 'accent.textMuted')).toBe(theme.accent.textMuted)
    expect(wizard.stepNumber.backgroundColor).toBe(theme.accent.soft)
  })
  it.each(['mood', 'discovery', 'soft'] as const)('renders selected %s chips with the chosen accent and AA text', async appearance => {
    await render(<Chip label="Selected role" appearance={appearance} variant="selected" onPress={jest.fn()} />)
    const label = screen.getByText('Selected role')
    const foreground = StyleSheet.flatten(label.props.style).color
    const background = StyleSheet.flatten(label.parent!.props.style).backgroundColor
    const expected = appearance === 'mood' || theme.mode === 'dark' ? theme.accent.selected : appearance === 'soft' ? theme.accent.soft : theme.accent.container
    expect(background).toBe(expected)
    expect(foreground).toBe(theme.accent.onSoft)
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })
})
