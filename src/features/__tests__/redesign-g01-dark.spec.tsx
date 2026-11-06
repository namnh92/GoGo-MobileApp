import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: jest.fn(async () => undefined) } }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'hydrating', signIn: jest.fn(), signUp: jest.fn() }) }))
UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>
// Module transforms belong to setup, outside the 5s rendering assertion budget.
const Splash = jest.requireActual<typeof import('@/features/onboarding/splash.view')>('@/features/onboarding/splash.view').default
const Onboarding = jest.requireActual<typeof import('@/features/onboarding/onboarding.view')>('@/features/onboarding/onboarding.view').default
const SignIn = jest.requireActual<typeof import('@/features/auth/sign-in.view')>('@/features/auth/sign-in.view').default

it('renders splash and each onboarding slide with S70-derived dark canvas and art', async () => {
  await render(<Splash />)
  const splashStyle = jest.requireActual<typeof import('@/features/onboarding/splash.style')>('@/features/onboarding/splash.style').styles
  expect(splashStyle.root.backgroundColor).toBe('#181715')
  expect(screen.getByText('Gợi ý điểm đến cho bạn')).toBeTruthy()
  await screen.unmount()
  await render(<Onboarding />)
  expect(screen.getByText('Đỡ mất nửa tiếng hỏi đi đâu?')).toBeTruthy()
  await fireEvent.press(screen.getByText('Tiếp theo'))
  expect(screen.getByText('Mỗi người chọn riêng')).toBeTruthy()
  await fireEvent.press(screen.getByText('Tiếp theo'))
  expect(screen.getByText('Nhận ngay một buổi date hoàn chỉnh')).toBeTruthy()
  const card = jest.requireActual<typeof import('@/shared/ui/card.style')>('@/shared/ui/card.style').styles
  expect(card.stitch.backgroundColor).toBe('#222222')
  expect(card.stitchLow.backgroundColor).toBe('#2A2A2A')
})
it('renders both auth modes and nested inputs in dark', async () => {
  await render(<SignIn />)
  const input = screen.getByLabelText('Email')
  expect(flat(input.props.style).color).toBe('#E6E6E6')
  const field = jest.requireActual<typeof import('@/shared/ui/labelled-input.style')>('@/shared/ui/labelled-input.style').styles
  expect(field.shell.backgroundColor).toBe('#222222')
  expect(field.row.backgroundColor).toBe('#2A2A2A')
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký' }))
  expect(screen.getByLabelText('Tên hiển thị')).toBeTruthy()
  expect(screen.getByTestId('password-requirements')).toBeTruthy()
})
