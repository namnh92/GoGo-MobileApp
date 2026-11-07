const mockTrack = jest.fn()
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { ThemeAccentCard } from '@/features/account/theme-accent.view'
import { ACCENT_PREFERENCE_KEY } from '@/shared/theme/accent-preference'
import { ACCENTS } from '@/shared/ui/theme'
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
