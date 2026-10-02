const mockTrack = jest.fn()
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen } from '@testing-library/react-native'
import { UnistylesRuntime } from 'react-native-unistyles'

import { ThemeAccentCard } from '@/features/account/theme-accent.view'
import { ACCENT_PREFERENCE_KEY, readAccentPreference } from '@/shared/theme/accent-preference'
import { ACCENTS } from '@/shared/ui/theme'

import { renderScreen } from './harness'

/**
 * #297 (#293 §6) — "Màu chủ đề". A tap applies the theme at once
 * (`UnistylesRuntime.setTheme`), stores it for the next launch, and reports
 * which accent was picked. Selection is announced, not only painted: a check
 * glyph and `accessibilityState.selected` on the chosen swatch.
 */
const runtime = UnistylesRuntime as unknown as { themeName?: string; setTheme: (name: string) => void }
let setTheme: jest.SpyInstance

beforeEach(async () => {
  await AsyncStorage.clear()
  mockTrack.mockReset()
  runtime.themeName = undefined
  setTheme = jest.spyOn(runtime, 'setTheme').mockImplementation(() => {})
})

afterEach(() => {
  setTheme.mockRestore()
  runtime.themeName = undefined
})

function selected(accent: string): boolean | undefined {
  return screen.getByTestId(`theme-swatch-${accent}`).props.accessibilityState?.selected
}

describe('theme accent setting', () => {
  it('shows four labelled swatches with the helper line', async () => {
    await renderScreen(<ThemeAccentCard />)
    expect(screen.getByText('Màu chủ đề')).toBeTruthy()
    expect(screen.getByText('Áp dụng cho nút, tab và điểm nhấn trong ứng dụng.')).toBeTruthy()
    const labels = ACCENTS.map(accent => screen.getByTestId(`theme-swatch-${accent}`).props.accessibilityLabel)
    expect(labels).toEqual(['Cam', 'Xanh lá', 'Xanh dương', 'Tím'])
  })

  it('marks the active theme selected — orange when the runtime reports nothing usable', async () => {
    runtime.themeName = 'coral'
    await renderScreen(<ThemeAccentCard />)
    expect(selected('orange')).toBe(true)
    expect(ACCENTS.filter(accent => accent !== 'orange').map(selected)).toEqual([false, false, false])
  })

  it('starts on the theme the bootstrap applied', async () => {
    runtime.themeName = 'blue'
    await renderScreen(<ThemeAccentCard />)
    expect(selected('blue')).toBe(true)
    expect(selected('orange')).toBe(false)
  })

  it('follows a theme the bootstrap applies after the card mounted (#297 F-01)', async () => {
    // Opened straight into /settings/account: the card mounts before AppProviders
    // has read the saved key, so it first sees no theme.
    runtime.themeName = undefined
    await renderScreen(<ThemeAccentCard />)
    expect(selected('orange')).toBe(true)

    runtime.themeName = 'blue'
    await screen.rerender(<ThemeAccentCard />)
    expect(selected('blue')).toBe(true)
    expect(selected('orange')).toBe(false)

    // Orange is no longer the current theme, so choosing it applies it.
    await fireEvent.press(screen.getByTestId('theme-swatch-orange'))
    expect(setTheme).toHaveBeenCalledWith('orange')
  })

  it('a tap applies the theme, persists it for the next launch and fires the event', async () => {
    await renderScreen(<ThemeAccentCard />)
    await fireEvent.press(screen.getByTestId('theme-swatch-green'))

    expect(setTheme).toHaveBeenCalledTimes(1)
    expect(setTheme).toHaveBeenCalledWith('green')
    expect(mockTrack).toHaveBeenCalledWith('theme_accent_changed', { accent: 'green' })
    expect(selected('green')).toBe(true)
    expect(selected('orange')).toBe(false)

    // A restart reads the same key the bootstrap reads.
    await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBe('green')
    await expect(readAccentPreference()).resolves.toBe('green')
  })

  it('tapping the theme already on screen does nothing', async () => {
    await renderScreen(<ThemeAccentCard />)
    await fireEvent.press(screen.getByTestId('theme-swatch-orange'))
    expect(setTheme).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
    await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBeNull()
  })

  it('a failed save still applies the theme for this session', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'))
    await renderScreen(<ThemeAccentCard />)
    await fireEvent.press(screen.getByTestId('theme-swatch-purple'))
    expect(setTheme).toHaveBeenCalledWith('purple')
    expect(selected('purple')).toBe(true)
    expect(mockTrack).toHaveBeenCalledWith('theme_accent_changed', { accent: 'purple' })
  })
})
