import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'

const mockRouter = { replace: jest.fn(), back: jest.fn(), canGoBack: () => false }
const mockPermission = jest.fn(async () => undefined)
const mockSignIn = jest.fn(async () => undefined)
const mockSignUp = jest.fn(async () => undefined)
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: () => mockPermission() } }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ signIn: mockSignIn, signUp: mockSignUp }) }))
import Onboarding from '@/features/onboarding/onboarding.view'
import SignIn from '@/features/auth/sign-in.view'

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear() })

async function lastSlide() {
  await renderScreen(<Onboarding />)
  await fireEvent.press(screen.getByText('Tiếp theo'))
  await fireEvent.press(screen.getByText('Tiếp theo'))
}
it('starts auth with the completed marker and no premature app permission request', async () => {
  await lastSlide()
  await fireEvent.press(screen.getByText('Bắt đầu'))
  expect(mockRouter.replace).toHaveBeenCalledWith('/auth/sign-in')
  expect(await AsyncStorage.getItem('gogo.onboarding.v1')).toBe('1')
  expect(mockPermission).not.toHaveBeenCalled()
})
it('goes back one slide and keeps guest completion plus notification request', async () => {
  await lastSlide()
  await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }))
  expect(screen.getByText('Mỗi người chọn riêng')).toBeTruthy()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByText('Tiếp theo'))
  await fireEvent.press(screen.getByText('Tiếp tục với tư cách khách'))
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
  expect(await AsyncStorage.getItem('gogo.onboarding.v1')).toBe('1')
  expect(mockPermission).toHaveBeenCalledTimes(1)
})
it('keeps recovery unavailable and shows requirements in registration only', async () => {
  await renderScreen(<SignIn />)
  expect(screen.queryByText('Auth Phone Entry')).toBeNull()
  expect(screen.queryByTestId('password-requirements')).toBeNull()
  const forgot = screen.getByRole('button', { name: 'Quên?' })
  expect(forgot.props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText('Khôi phục mật khẩu chưa khả dụng.')).toBeTruthy()
  await fireEvent.press(forgot)
  expect(mockRouter.replace).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký' }))
  expect(screen.getByTestId('password-requirements')).toBeTruthy()
  expect(screen.queryByText('Quên?')).toBeNull()
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'Abcdef1!')
  for (const rule of ['length', 'upper', 'lower', 'digit', 'special']) {
    expect(screen.getByTestId(`password-requirement-${rule}`).props.accessibilityLabel).toMatch(/^Đã đạt:/)
  }
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng nhập' }))
  expect(screen.queryByTestId('password-requirements')).toBeNull()
})
