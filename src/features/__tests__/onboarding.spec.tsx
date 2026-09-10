import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'

const mockRouter = { replace: jest.fn() }
const mockPermission = jest.fn(async () => ({ kind: 'denied' }))
let mockSessionStatus = 'anonymous'
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: () => mockPermission() } }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockSessionStatus }) }))
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }))
import Onboarding from '@/features/onboarding/onboarding.view'
import Splash from '@/features/onboarding/splash.view'

beforeEach(async () => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await AsyncStorage.clear()
  mockSessionStatus = 'anonymous'
})

it('enters the app when the onboarding marker cannot be written', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'))
  const screen = await renderScreen(<Onboarding />)
  await fireEvent.press(screen.getByText('Bỏ qua'))
  expect(mockPermission).toHaveBeenCalledTimes(1)
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
})
afterEach(() => { jest.useRealTimers() })

it('finishes intro and enters the app even when notification permission is denied', async () => {
  const screen = await renderScreen(<Onboarding />)
  await fireEvent.press(screen.getByText('Bỏ qua'))
  expect(mockPermission).toHaveBeenCalledTimes(1)
  expect(await AsyncStorage.getItem('gogo.onboarding.v1')).toBe('1')
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
})

it.each([
  ['anonymous', null, '/onboarding'],
  ['anonymous', '1', '/(tabs)'],
  ['user', null, '/(tabs)'],
  ['guest', null, '/(tabs)'],
])('routes %s with completed intro %s to %s', async (status, completed, route) => {
  jest.useFakeTimers()
  mockSessionStatus = status as string
  if (completed) await AsyncStorage.setItem('gogo.onboarding.v1', completed)
  await renderScreen(<Splash />)
  await act(async () => { jest.advanceTimersByTime(2300) })
  expect(mockRouter.replace).toHaveBeenCalledWith(route)
  expect(mockPermission).not.toHaveBeenCalled()
  if (status === 'user' || status === 'guest') {
    expect(await AsyncStorage.getItem('gogo.onboarding.v1')).toBe('1')
  }
})

it('navigates immediately when hydration finishes after the minimum splash time', async () => {
  jest.useFakeTimers()
  mockSessionStatus = 'hydrating'
  const screen = await renderScreen(<Splash />)
  await act(async () => { jest.advanceTimersByTime(2300) })
  expect(mockRouter.replace).not.toHaveBeenCalled()

  mockSessionStatus = 'user'
  await screen.rerender(<Splash />)
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
})

it('does not navigate while credentials are hydrating', async () => {
  jest.useFakeTimers()
  mockSessionStatus = 'hydrating'
  await renderScreen(<Splash />)
  await act(async () => { jest.advanceTimersByTime(2300) })
  expect(mockRouter.replace).not.toHaveBeenCalled()
})
