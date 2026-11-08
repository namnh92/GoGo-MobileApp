const mockTrack = jest.fn()
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { Appearance, View } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { ThemeAccentCard } from '@/features/account/theme-accent.view'
import { ACCENT_PREFERENCE_KEY } from '@/shared/theme/accent-preference'
import { ACCENTS, themes, themeName, type Mode } from '@/shared/ui/theme'
import { renderScreen } from './harness'

const runtime = UnistylesRuntime as unknown as { themeName?: string; setTheme: (name: string) => void }
let setTheme: jest.SpyInstance
let scoped: jest.SpyInstance
beforeEach(async () => {
  scoped = jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)
  await AsyncStorage.clear()
  mockTrack.mockReset()
  runtime.themeName = undefined
  setTheme = jest.spyOn(runtime, 'setTheme').mockImplementation(name => { runtime.themeName = name })
})
afterEach(() => { scoped.mockRestore(); setTheme.mockRestore(); runtime.themeName = undefined })
const selected = (accent: string) => screen.getByTestId(`theme-swatch-${accent}`).props.accessibilityState?.selected
const apply = () => fireEvent.press(screen.getByRole('button', { name: 'Áp dụng màu chủ đề' }))

it('shows four labelled swatches and a noninteractive illustrative preview', async () => {
  await renderScreen(<ThemeAccentCard />)
  expect(ACCENTS.map(accent => screen.getByTestId(`theme-swatch-${accent}`).props.accessibilityLabel)).toEqual(['Cam', 'Xanh lá', 'Xanh dương', 'Tím'])
  expect(selected('orange')).toBe(true)
  expect(within(screen.getByTestId('theme-preview')).queryAllByRole('button')).toHaveLength(0)
  expect(screen.getByText('Mô phỏng giao diện · Không tương tác')).toBeTruthy()
})
it('selecting only previews; Apply persists and changes the running theme', async () => {
  await renderScreen(<ThemeAccentCard />)
  await fireEvent.press(screen.getByTestId('theme-swatch-green'))
  expect(selected('green')).toBe(true)
  expect(setTheme).not.toHaveBeenCalled()
  expect(scoped.mock.calls.at(-1)?.[0].name).toBe('green')
  await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBeNull()
  await apply()
  expect(setTheme).toHaveBeenCalledWith('green')
  expect(mockTrack).toHaveBeenCalledWith('theme_accent_changed', { accent: 'green' })
  await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBe('green')
  expect(screen.getByText('Đã cập nhật màu chủ đề')).toBeTruthy()
})
it('leaving without Apply does not change the stored or running theme', async () => {
  const view = await renderScreen(<ThemeAccentCard />)
  await fireEvent.press(screen.getByTestId('theme-swatch-purple'))
  await view.unmount()
  expect(setTheme).not.toHaveBeenCalled()
  await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBeNull()
})
it('follows late bootstrap and discards a draft made over an older theme', async () => {
  const view = await renderScreen(<ThemeAccentCard />)
  await fireEvent.press(screen.getByTestId('theme-swatch-green'))
  runtime.themeName = 'blueDark'
  await view.rerender(<ThemeAccentCard />)
  expect(selected('blue')).toBe(true)
  expect(selected('green')).toBe(false)
})
it('reports storage errors, retains the draft, and allows retry', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'))
  await renderScreen(<ThemeAccentCard />)
  await fireEvent.press(screen.getByTestId('theme-swatch-purple'))
  await apply()
  expect(screen.getByText('Chưa lưu được màu chủ đề. Thử lại nhé.')).toBeTruthy()
  expect(setTheme).not.toHaveBeenCalled()
  expect(mockTrack).not.toHaveBeenCalled()
  expect(selected('purple')).toBe(true)
  await fireEvent.press(screen.getAllByRole('button', { name: 'Đóng' })[0])
  await apply()
  expect(setTheme).toHaveBeenCalledWith('purple')
  await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBe('purple')
})

// Keep the real Text/Icon implementations: the Unistyles hook deliberately
// retains the applied theme snapshot while ScopedTheme changes its native scope.
describe.each<Mode>(['light', 'dark'])('preview tokens in %s mode', mode => {
  let hook: jest.SpyInstance
  let appearance: jest.SpyInstance
  beforeEach(() => {
    const appliedName = themeName('orange', mode)
    runtime.themeName = appliedName
    hook = jest.spyOn(jest.requireMock('react-native-unistyles'), 'useUnistyles')
      .mockReturnValue({ theme: themes[appliedName], rt: runtime })
    appearance = jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(mode)
    scoped.mockImplementation(({ children, name }) => <View testID={`scope-${name}`}>{children}</View>)
  })
  afterEach(() => { hook.mockRestore(); appearance.mockRestore() })

  it.each(ACCENTS)('resolves %s preview strokes and text without applying it', async accent => {
    await renderScreen(<ThemeAccentCard />)
    // Exercise updates on the same mounted preview, including returning to orange.
    for (const next of [accent === 'green' ? 'purple' : 'green', accent]) {
      await fireEvent.press(screen.getByTestId(`theme-swatch-${next}`))
    }
    const preview = within(screen.getByTestId('theme-preview'))
    const expected = themes[themeName(accent, mode)]
    expect(preview.getByTestId('icon-map-pin').props.stroke).toBe(expected.accent.onSoft)
    expect(preview.getAllByTestId('icon-bookmark')[0].props.stroke).toBe(expected.accent.text)
    expect(preview.getByTestId('icon-share').props.stroke).toBe(expected.accent.onSoft)
    expect(preview.getByText('Chia sẻ kèo')).toHaveStyle({ color: expected.accent.onSoft })
    expect(preview.getByTestId('icon-calendar').props.stroke).toBe(expected.accent.text)
    expect(preview.getByText('Kế hoạch')).toHaveStyle({ color: expected.accent.text })
    expect(preview.getByTestId('icon-arrow-right').props.stroke).toBe(expected.accent.onAccent)
    expect(preview.getByTestId('icon-info').props.stroke).toBe(expected.text.primary)
    // The dot uses a Unistyles style, so it must sit inside the native scope too.
    expect(within(screen.getByTestId(`scope-${themeName(accent, mode)}`)).getByTestId('theme-preview-live-dot')).toBeTruthy()
    // Jest has no native style switching. Check the real style factory against
    // the scope's palette as well as the rendered scope boundary above.
    const create = jest.spyOn(jest.requireMock('react-native-unistyles').StyleSheet, 'create')
    jest.isolateModules(() => { jest.requireActual('../account/theme-accent.style') })
    const factory = create.mock.calls[0][0] as (theme: typeof expected) => Record<string, { backgroundColor?: string }>
    create.mockRestore()
    const scopedStyles = factory(expected)
    expect(scopedStyles.liveDot.backgroundColor).toBe(expected.accent.primary)
    expect(scopedStyles.activeDot.backgroundColor).toBe(expected.accent.primary)
    expect(scopedStyles.samplePrimary.backgroundColor).toBe(expected.accent.primary)
    expect(scopedStyles.sampleIcon.backgroundColor).toBe(expected.accent.soft)
    expect(scopedStyles.sampleSecondary.backgroundColor).toBe(expected.accent.soft)
    expect(screen.getByRole('button', { name: 'Áp dụng màu chủ đề' })).toBeTruthy()
    expect(setTheme).not.toHaveBeenCalled()
    expect(runtime.themeName).toBe(themeName('orange', mode))
    await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBeNull()
  })
})
