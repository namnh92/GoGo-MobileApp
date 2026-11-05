import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

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

describe('splash reduced motion', () => {
  it('shows the final state at once and adds no delay', async () => {
    mockReduced = true
    await renderScreen(<Splash />)
    expect(opacityOf('splash-brand')).toBe(1)
    expect(opacityOf('splash-pin-hcm')).toBe(1)
    await act(async () => { jest.advanceTimersByTime(0) })
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
  })

  it('starts the brand hidden when motion is allowed', async () => {
    await renderScreen(<Splash />)
    expect(opacityOf('splash-brand')).toBe(0)
  })
})
