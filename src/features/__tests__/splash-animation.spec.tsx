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

const revealOpacity = (id: string) =>
  (getAnimatedStyle(screen.getByTestId(id, { includeHiddenElements: true })) as { opacity: number }).opacity

describe('splash reveal', () => {
  it('fades and lifts the wordmark and line after Stitch’s one-second delay', async () => {
    await renderScreen(<Splash />)
    expect(revealOpacity('splash-reveal-logo')).toBe(0)
    expect(revealOpacity('splash-reveal-line')).toBe(0)
    await act(async () => { jest.advanceTimersByTime(1200) })
    const mid = revealOpacity('splash-reveal-logo')
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    await act(async () => { jest.advanceTimersByTime(700) })
    expect(revealOpacity('splash-reveal-logo')).toBe(1)
    expect(revealOpacity('splash-reveal-line')).toBe(1)
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
  ])('fits the 200px Stitch map on %s and keeps its aspect ratio', async (_name, width, height) => {
    const { w, h } = await mapWidthFor(width, height)
    expect(w).toBeLessThanOrEqual(width - 48)
    expect(h).toBeLessThan(height - 48 - 96)
    expect(w / h).toBeCloseTo(223 / 349, 1)
    expect(w).toBeLessThanOrEqual(200)
    expect(w).toBeGreaterThan(0)
  })

  it.each([180, 242, 342, 400])('uses the approved 9-unit map-label token on a %i px map', width => {
    expect(labelFontUnits(width)).toBe(9)
  })
})

describe('splash reduced motion', () => {
  it('shows the final state at once and adds no delay', async () => {
    mockReduced = true
    await renderScreen(<Splash />)
    expect(revealOpacity('splash-reveal-logo')).toBe(1)
    expect(revealOpacity('splash-reveal-line')).toBe(1)
    expect(opacityOf('splash-pin-hcm')).toBe(1)
    await act(async () => { jest.advanceTimersByTime(0) })
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
  })
})
