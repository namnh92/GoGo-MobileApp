import { act } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'
import DefaultsScreen from '@/features/account/defaults-screen.view'
import ThemeScreen from '@/features/account/theme-screen.view'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/account/theme-accent.view', () => ({ ThemeAccentCard: () => null }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ isPending: true, data: undefined }),
}))

it.each([
  ['vi', DefaultsScreen, 'Mặc định khi tạo kèo'],
  ['en', DefaultsScreen, 'Defaults for a new date'],
  ['vi', ThemeScreen, 'Màu chủ đề'],
  ['en', ThemeScreen, 'Theme colour'],
] as const)('renders the visible %s screen title (%#)', async (locale, Screen, title) => {
  await act(async () => { await i18n.changeLanguage(locale) })
  try {
    const view = await renderScreen(<Screen />)
    expect(view.getByRole('header', { name: title }).props.children).toBe(title)
  } finally {
    await act(async () => { await i18n.changeLanguage('vi') })
  }
})
