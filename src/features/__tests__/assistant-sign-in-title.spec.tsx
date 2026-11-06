import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#378 acceptance: reached from GoGo AI ("Đăng nhập" on the
 * signed-out prompt, `next=assistant`), sign-in still said "Đăng nhập để tạo
 * phòng" — the person came to use the assistant, not to create a room. Every
 * other entry keeps the existing title.
 */

const mockParams: { value: { next?: string } } = { value: {} }

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), push: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams.value,
}))

jest.mock('@/shared/analytics', () => ({
  track: jest.fn(),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ signIn: jest.fn(), signUp: jest.fn() }),
}))

import SignInScreen from '@/features/auth/sign-in.view'

it('says the sign-in is for GoGo AI when reached from the assistant', async () => {
  mockParams.value = { next: 'assistant' }
  const screen = await renderScreen(<SignInScreen />)
  expect(screen.getByText('Đăng nhập\nđể dùng GoGo AI')).toBeTruthy()
  expect(screen.queryByText('Đăng nhập để tạo phòng')).toBeNull()
})

it('keeps the room title for every other entry', async () => {
  mockParams.value = {}
  const screen = await renderScreen(<SignInScreen />)
  expect(screen.getByText('Đăng nhập để tạo phòng')).toBeTruthy()
})
