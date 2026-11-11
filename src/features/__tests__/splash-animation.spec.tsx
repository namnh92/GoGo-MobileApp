import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { Dimensions, StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { getAnimatedStyle } from 'react-native-reanimated'

import { renderScreen } from './harness'

// Record loop creation while retaining Reanimated's real Jest animation runtime.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated')
  return { __esModule: true, ...actual, withRepeat: jest.fn(actual.withRepeat) }
})

const mockRouter = { replace: jest.fn() }
let mockSessionStatus = 'anonymous'
let mockReduced = false
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockSessionStatus }) }))
jest.mock('@/shared/ui/feedback', () => ({
  ...jest.requireActual('@/shared/ui/feedback'),
  useReducedMotion: () => mockReduced,
}))
import { motion } from '@/shared/ui/tokens'
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
  it('uses the owner-approved slower splash timings', () => {
    expect(motion).toMatchObject({
      mapReveal: 525, pinDrop: 375, pinFirstDelay: 525, pinStep: 300,
      brandDelay: 1500, brandReveal: 675, markerBounce: 600, ripple: 900,
      splashHold: 2250,
    })
    expect(SPLASH_MIN_MS).toBe(2250)
    expect(motion.brandDelay + motion.brandReveal).toBeLessThan(SPLASH_MIN_MS)
  })

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
  it('shows the logo at t=0 without a reveal while the line keeps its delayed reveal', async () => {
    await renderScreen(<Splash />)
    expect(screen.getByTestId('splash-logo')).toBeVisible()
    expect(screen.queryByTestId('splash-reveal-logo', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId('splash-logo').parent).toBe(screen.getByTestId('splash-brand'))
    expect(revealOpacity('splash-reveal-line')).toBe(0)
    await act(async () => { jest.advanceTimersByTime(motion.brandDelay - 50) })
    expect(screen.getByTestId('splash-logo')).toBeVisible()
    expect(revealOpacity('splash-reveal-line')).toBe(0)
    await act(async () => { jest.advanceTimersByTime(50 + motion.brandReveal / 2) })
    const mid = revealOpacity('splash-reveal-line')
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    await act(async () => { jest.advanceTimersByTime(motion.brandReveal / 2 + 50) })
    expect(screen.getByTestId('splash-logo')).toBeVisible()
    expect(revealOpacity('splash-reveal-line')).toBe(1)
  })

  it('keeps the text in the tree at its final layout while covered', async () => {
    await renderScreen(<Splash />)
    expect(screen.getByText('Gợi ý điểm đến cho bạn')).toBeTruthy()
    expect(screen.getByTestId('splash-logo-wordmark')).toBeTruthy()
  })
})

describe('splash option B slot', () => {
  it('starts all seven option B loops at t=0 and keeps them while splash remains visible', async () => {
    const repeat = jest.mocked(Reanimated.withRepeat)
    mockSessionStatus = 'hydrating'
    try {
      await renderScreen(<Splash />)
      expect(screen.getByTestId('splash-logo')).toBeVisible()
      expect(screen.getByTestId('splash-logo-loop')).toBeTruthy()
      expect(screen.getByTestId('splash-logo-beam')).toBeTruthy()
      expect(screen.getAllByTestId(/splash-logo-star-/)).toHaveLength(2)
      expect(screen.getAllByTestId(/splash-logo-dot-/)).toHaveLength(3)
      expect(repeat.mock.calls.filter(call => call[2] === false)).toHaveLength(7)
      for (const call of repeat.mock.calls) expect(call[1]).toBe(-1)
      await act(async () => { jest.advanceTimersByTime(SPLASH_MIN_MS + 3000) })
      expect(screen.getByTestId('splash-logo-loop')).toBeTruthy()
      expect(mockRouter.replace).not.toHaveBeenCalled()
    } finally { repeat.mockClear() }
  })

  it('mounts no logo loops with reduced motion, including a live preference change', async () => {
    const repeat = jest.mocked(Reanimated.withRepeat)
    mockSessionStatus = 'hydrating'
    mockReduced = true
    try {
      const view = await renderScreen(<Splash />)
      expect(repeat).not.toHaveBeenCalled()
      expect(screen.queryByTestId('splash-logo-loop')).toBeNull()
      mockReduced = false
      await view.rerender(<Splash />)
      expect(repeat.mock.calls.filter(call => call[2] === false)).toHaveLength(7)
      repeat.mockClear()
      mockReduced = true
      await view.rerender(<Splash />)
      expect(screen.queryByTestId('splash-logo-loop')).toBeNull()
      expect(repeat).not.toHaveBeenCalled()
      expect(screen.getAllByTestId(/splash-logo-dot-/)).toHaveLength(3)
    } finally { repeat.mockClear() }
  })

  it('renders the 120-point square brand lockup below the Vietnam map', async () => {
    await renderScreen(<Splash />)
    const logo = screen.getByTestId('splash-logo-wordmark')
    expect(logo.props.height).toBe(120)
    expect(logo.props.width).toBe(120)
    const brand = StyleSheet.flatten(screen.getByTestId('splash-brand').props.style)
    expect(brand.marginTop).toBe(32)
  })
})

describe('splash map fit', () => {
  const mapWidthFor = async (width: number, height: number, fontScale = 1) => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 2, fontScale })
    await renderScreen(<Splash />)
    const style = StyleSheet.flatten(screen.getByTestId('splash-map', { includeHiddenElements: true }).props.style)
    return { w: style.width as number, h: style.height as number }
  }

  it.each([[320, 568, 172], [393, 852, 150], [390, 884, 150], [430, 400, 142]])('maximizes the map after measuring the %s×%s viewport and brand', async (width, height, brandHeight) => {
    await mapWidthFor(width, height)
    const layout = { x: 0, y: 0, width: width - 48, height: height - 48 }
    const parent = screen.queryByTestId('splash-layout', { includeHiddenElements: true })
    if (parent) await fireEvent(parent, 'layout', { nativeEvent: { layout } })
    await fireEvent(screen.getByTestId('splash-brand'), 'layout', { nativeEvent: { layout: { ...layout, height: brandHeight } } })
    const style = StyleSheet.flatten(screen.getByTestId('splash-map', { includeHiddenElements: true }).props.style)
    // 0.25 SVG unit stroke reserve on every edge; 5.1-unit pin-drop overhang above the viewBox.
    const expected = Math.min(layout.width / 223.5, (layout.height - brandHeight - 32) / 354.6)
    expect(style.width).toBeCloseTo(223 * expected)
    expect(style.height).toBeCloseTo(349 * expected)
    expect(style.width).toBeGreaterThan(0)
    expect(style.width / style.height).toBeCloseTo(223 / 349)
    expect(style.height + brandHeight + 32 + 5.6 * expected).toBeLessThanOrEqual(layout.height + 0.01)
  })

  it.each([100, 220, 300])('keeps a nonzero map when a short window measures a %s-point brand', async brandHeight => {
    await mapWidthFor(393, 300, 3)
    const layout = { x: 0, y: 0, width: 345, height: 252 }
    await fireEvent(screen.getByTestId('splash-layout'), 'layout', { nativeEvent: { layout } })
    await fireEvent(screen.getByTestId('splash-brand'), 'layout', { nativeEvent: { layout: { ...layout, height: brandHeight } } })
    const map = StyleSheet.flatten(screen.getByTestId('splash-map', { includeHiddenElements: true }).props.style)
    expect(map.width).toBeCloseTo(111.5)
    expect(map.height).toBeCloseTo(174.5)
    expect(map.width / map.height).toBeCloseTo(223 / 349)
    expect(screen.getByTestId('splash-layout').props.scrollEnabled).toBeUndefined()
  })

  it.each([180, 242, 342, 400])('uses the approved 9-unit map-label token on a %i px map', width => {
    expect(labelFontUnits(width)).toBe(9)
  })
})

describe('splash reduced motion', () => {
  it('shows the final state at once and adds no delay', async () => {
    mockReduced = true
    await renderScreen(<Splash />)
    expect(screen.getByTestId('splash-logo')).toBeVisible()
    expect(screen.queryByTestId('splash-reveal-logo', { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByTestId('splash-logo-loop')).toBeNull()
    expect(revealOpacity('splash-reveal-line')).toBe(1)
    expect(opacityOf('splash-pin-hcm')).toBe(1)
    expect(screen.getAllByTestId(/splash-logo-dot-/)).toHaveLength(3)
    await act(async () => { jest.advanceTimersByTime(0) })
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
  })
})
