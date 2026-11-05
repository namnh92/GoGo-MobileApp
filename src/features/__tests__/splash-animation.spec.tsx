import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, screen } from '@testing-library/react-native'
import { Dimensions, StyleSheet } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import { renderScreen } from './harness'

const mockRouter = { replace: jest.fn() }
let mockSessionStatus = 'anonymous'
let mockReduced = false
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockSessionStatus }) }))
jest.mock('@/shared/ui/feedback', () => ({
  ...jest.requireActual('@/shared/ui/feedback'),
  useReducedMotion: () => mockReduced,
}))
import { labelFontUnits } from '@/features/onboarding/splash-map.view'
import Splash, { SPLASH_MIN_MS } from '@/features/onboarding/splash.view'

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  mockSessionStatus = 'user'
  mockReduced = false
  jest.useFakeTimers()
})
afterEach(() => { jest.useRealTimers() })

const opacityOf = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style).opacity

describe('splash minimum time', () => {
  it('holds for the minimum even when the app is ready, then takes the existing destination', async () => {
    await renderScreen(<Splash />)
    await act(async () => { jest.advanceTimersByTime(SPLASH_MIN_MS - 100) })
    expect(mockRouter.replace).not.toHaveBeenCalled()
    await act(async () => { jest.advanceTimersByTime(100) })
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
    expect(mockRouter.replace).toHaveBeenCalledTimes(1)
  })

  it('still waits for session hydration after the minimum', async () => {
    mockSessionStatus = 'hydrating'
    const view = await renderScreen(<Splash />)
    await act(async () => { jest.advanceTimersByTime(SPLASH_MIN_MS + 1000) })
    expect(mockRouter.replace).not.toHaveBeenCalled()
    mockSessionStatus = 'anonymous'
    await view.rerender(<Splash />)
    await act(async () => { await Promise.resolve() })
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding')
  })

  it('shows the line through i18n', async () => {
    await renderScreen(<Splash />)
    expect(screen.getByText('Gợi ý điểm đến cho bạn')).toBeTruthy()
  })
})

const coverWidth = (id: string) =>
  (getAnimatedStyle(screen.getByTestId(id, { includeHiddenElements: true })) as { width: string }).width

describe('splash reveal', () => {
  it('covers the logo, wordmark and line at first, then uncovers them left to right', async () => {
    await renderScreen(<Splash />)
    expect(coverWidth('splash-reveal-logo')).toBe('100%')
    expect(coverWidth('splash-reveal-line')).toBe('100%')
    await act(async () => { jest.advanceTimersByTime(900) })
    const mid = parseFloat(coverWidth('splash-reveal-logo'))
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(100)
    await act(async () => { jest.advanceTimersByTime(700) })
    expect(coverWidth('splash-reveal-logo')).toBe('0%')
    expect(coverWidth('splash-reveal-line')).toBe('0%')
  })

  it('keeps the text in the tree at its final layout while covered', async () => {
    await renderScreen(<Splash />)
    expect(screen.getByText('Gợi ý điểm đến cho bạn')).toBeTruthy()
    expect(screen.getByText('GoGo')).toBeTruthy()
  })
})

describe('splash map fit', () => {
  const mapWidthFor = async (width: number, height: number) => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 2, fontScale: 1 })
    await renderScreen(<Splash />)
    const style = StyleSheet.flatten(screen.getByTestId('splash-map', { includeHiddenElements: true }).props.style)
    return { w: style.width as number, h: style.height as number }
  }

  it.each([
    ['a small phone', 320, 568],
    ['a large phone', 430, 932],
  ])('fills %s inside the margins and keeps the aspect ratio', async (_name, width, height) => {
    const { w, h } = await mapWidthFor(width, height)
    expect(w).toBeLessThanOrEqual(width - 48)
    expect(h).toBeLessThan(height - 48 - 96)
    expect(w / h).toBeCloseTo(223 / 349, 1)
    // As large as the margins allow: one of the two limits is reached.
    expect(w >= width - 48 - 1 || h >= height - 48 - 96 - 130).toBe(true)
  })

  it.each([180, 242, 342, 400])('draws no label under the caption size on a %i px map', width => {
    expect(labelFontUnits(width) * (width / 223)).toBeGreaterThanOrEqual(11 - 0.001)
  })
})

describe('splash reduced motion', () => {
  it('shows the final state at once and adds no delay', async () => {
    mockReduced = true
    await renderScreen(<Splash />)
    expect(coverWidth('splash-reveal-logo')).toBe('0%')
    expect(coverWidth('splash-reveal-line')).toBe('0%')
    expect(opacityOf('splash-pin-hcm')).toBe(1)
    await act(async () => { jest.advanceTimersByTime(0) })
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
  })
})
