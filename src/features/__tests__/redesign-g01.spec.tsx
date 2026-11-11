import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themes } from '@/shared/ui/theme'
import { renderScreen } from './harness'

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }
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
it('opens recovery and shows requirements in registration only', async () => {
  await renderScreen(<SignIn />)
  const expectHeader = (title: string) => {
    const back = screen.getByRole('button', { name: 'Quay lại' })
    const label = within(back.parent!).getByText(title)
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ textAlign: 'left', color: themes.orange.text.primary })
    expect(StyleSheet.flatten(label.parent!.parent!.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
    expect(StyleSheet.flatten(back.parent!.props.style)).toMatchObject({ minHeight: 56, gap: 8 })
  }
  expectHeader('Đăng nhập')
  expect(screen.queryByText('Auth Phone Entry')).toBeNull()
  expect(screen.queryByTestId('password-requirements')).toBeNull()
  const forgot = screen.getByRole('link', { name: 'Quên?' })
  expect(forgot.props.accessibilityState.disabled).not.toBe(true)
  await fireEvent.press(forgot)
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/auth/forgot-password', params: {} })
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký' }))
  expectHeader('Đăng ký')
  expect(screen.getByTestId('password-requirements')).toBeTruthy()
  expect(screen.queryByText('Quên?')).toBeNull()
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'Abcdef1!')
  for (const rule of ['length', 'upper', 'lower', 'digit', 'special']) {
    expect(screen.getByTestId(`password-requirement-${rule}`).props.accessibilityLabel).toMatch(/^Đã đạt:/)
  }
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng nhập' }))
  expect(screen.queryByTestId('password-requirements')).toBeNull()
})
