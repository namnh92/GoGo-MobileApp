import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import '@/shared/i18n'

const mockState = { status: 'anonymous', segments: ['onboarding'], active: true, hidden: true }
const mockRouter = { replace: jest.fn(), back: jest.fn(), canGoBack: () => false }
const mockRequest = jest.fn(async () => undefined)
const mockSignIn = jest.fn(async () => { mockState.status = 'user' })
const mockSignUp = jest.fn(async () => { mockState.status = 'user' })
let mockSettle: () => void
let mockSettlement: Promise<void>
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useSegments: () => mockState.segments, Stack: Object.assign(() => null, { Screen: () => null }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockState.status, signIn: mockSignIn, signUp: mockSignUp }) }))
jest.mock('@/shared/hooks/use-app-foreground', () => ({ useAppForeground: () => mockState.active }))
jest.mock('@/shared/ui/splash-state', () => ({ isSplashHidden: () => mockState.hidden, subscribeSplashHidden: () => () => {} }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: () => mockRequest() } }))
jest.mock('@/shared/consent/tracking', () => ({ trackingConsent: { settled: () => mockSettlement } }))
jest.mock('@/shared/consent/tracking-consent-gate', () => ({ TrackingConsentGate: () => null }))
jest.mock('@/shared/observability/bootstrap', () => ({}))
jest.mock('@/shared/observability/sentry', () => ({ wrapRoot: (component: unknown) => component }))
jest.mock('@/shared/observability/screen-tag.view', () => ({ SentryScreenTag: () => null }))
jest.mock('@/shared/observability/root-error-boundary.view', () => ({ RootErrorBoundary: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/shared/providers/app-providers', () => ({ AppProviders: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/shared/acquisition/deferred-link-resumer', () => ({ DeferredLinkResumer: () => null }))
jest.mock('@/shared/notifications/notification-click-router', () => ({ NotificationClickRouter: () => null }))
jest.mock('@/shared/notifications/device-promotions-gate', () => ({ DevicePromotionsGate: () => null }))

import RootLayout from '@/app/_layout'
import Onboarding from '@/features/onboarding/onboarding.view'
import SignIn from '@/features/auth/sign-in.view'
import { onboardingPermissionStore, ONBOARDING_PERMISSION_KEY } from '@/shared/notifications/onboarding-permission-store'

beforeEach(async () => {
  jest.clearAllMocks()
  // Clearing storage alone does not reset the singleton's launch memory.
  const token = onboardingPermissionStore.claim()
  if (token !== undefined) await onboardingPermissionStore.consume(token)
  await AsyncStorage.clear()
  Object.assign(mockState, { status: 'anonymous', segments: ['onboarding'], active: true, hidden: true })
  mockSettlement = new Promise(resolve => { mockSettle = resolve })
})

it.each(['login', 'registration'])('Start → %s → app requests once, only after explicit tracking settlement', async mode => {
  const view = await render(<><RootLayout /><Onboarding /></>)
  await fireEvent.press(screen.getByText('Tiếp theo'))
  await fireEvent.press(screen.getByText('Tiếp theo'))
  await fireEvent.press(screen.getByText('Bắt đầu'))
  expect(mockRequest).not.toHaveBeenCalled()
  mockState.segments = ['auth', 'sign-in']
  await view.rerender(<><RootLayout /><SignIn /></>)
  if (mode === 'registration') {
    await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký' }))
    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'GoGo Tester')
  }
  await fireEvent.changeText(screen.getByLabelText('Email'), 'test@example.com')
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'Abcdef1!')
  await fireEvent.press(screen.getByRole('button', { name: mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản' }))
  expect(mode === 'login' ? mockSignIn : mockSignUp).toHaveBeenCalledTimes(1)
  expect(mockRouter.replace).toHaveBeenLastCalledWith('/(tabs)')
  mockState.segments = ['(tabs)']
  await view.rerender(<RootLayout />)
  expect(mockRequest).not.toHaveBeenCalled()
  await act(async () => { mockSettle() })
  expect(mockRequest).toHaveBeenCalledTimes(1)
  await view.unmount()
  await render(<RootLayout />)
  expect(mockRequest).toHaveBeenCalledTimes(1)
})

it.each(['guest', 'skip'])('%s preserves request-before-navigation timing without creating Start intent', async path => {
  await render(<Onboarding />)
  if (path === 'guest') {
    await fireEvent.press(screen.getByText('Tiếp theo'))
    await fireEvent.press(screen.getByText('Tiếp theo'))
  }
  const order: string[] = []
  mockRequest.mockImplementationOnce(async () => {
    order.push('request')
    expect(mockRouter.replace).not.toHaveBeenCalled()
    expect(onboardingPermissionStore.snapshot()).toBe(false)
    await Promise.resolve()
    expect(mockRouter.replace).not.toHaveBeenCalled()
    order.push('settled')
  })
  mockRouter.replace.mockImplementationOnce(() => { order.push('navigation') })
  await fireEvent.press(screen.getByText(path === 'guest' ? 'Tiếp tục với tư cách khách' : 'Bỏ qua'))
  expect(order).toEqual(['request', 'settled', 'navigation'])
  expect(mockRouter.replace).toHaveBeenLastCalledWith('/(tabs)')
  expect(onboardingPermissionStore.snapshot()).toBe(false)
  expect(await AsyncStorage.getItem(ONBOARDING_PERMISSION_KEY)).toBeNull()
})
