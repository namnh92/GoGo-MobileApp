import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'

import AssistantRoute from '@/app/assistant'
import SignInScreen from '@/features/auth/sign-in.view'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'
import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { assistantIsNew, useAssistantIntroStore } from '@/shared/store/assistantIntroStore'
import { ToastProvider } from '@/shared/ui/toast.view'

/** Signing in replaces the inactive assistant; returning opens a full-screen card. */

// expo-router's matcher module imports `expect/build/matchers`, which this jest cannot load.
jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('@/shared/analytics', () => ({ track: () => {} }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

const USER = '11111111-1111-4111-8111-111111111111'

/** A session that re-renders its readers when it changes, like the real provider. */
const mockSession = {
  value: { status: 'signedOut', session: null } as { status: string; session: unknown },
  listeners: new Set<() => void>(),
}
function setSession(value: { status: string; session: unknown }) {
  mockSession.value = value
  mockSession.listeners.forEach(listener => listener())
}
const mockSignIn = jest.fn()
jest.mock('@/shared/providers/session-provider', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react')
  const subscribe = (listener: () => void) => {
    mockSession.listeners.add(listener)
    return () => {
      mockSession.listeners.delete(listener)
    }
  }
  return {
    useSession: () => ({
      ...useSyncExternalStore(subscribe, () => mockSession.value),
      signIn: (...args: unknown[]) => mockSignIn(...args),
      signUp: jest.fn(),
    }),
  }
})

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

let client: QueryClient
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  useAssistantIntroStore.setState({ accounts: {} })
  mockSession.value = { status: 'signedOut', session: null }
  mockSignIn.mockReset()
  setAssistantBackend(createMockAssistantBackend({ speed: 0, actor: () => (mockSession.value.status === 'user' ? 'user' : 'guest') }))
})

function app() {
  return {
    _layout: () => (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="assistant" options={{ presentation: 'card' }} />
          </Stack>
        </ToastProvider>
      </QueryClientProvider>
    ),
    '(tabs)/_layout': () => <Stack />,
    '(tabs)/index': () => <Text>home</Text>,
    assistant: AssistantRoute,
    'auth/sign-in': SignInScreen,
  }
}

type View = ReturnType<typeof renderRouter>
let nav: View

/** The root stack's route names, bottom to top. */
function rootStack(): string[] {
  // expo-router wraps the app's root Stack in its own `__root` route.
  const root = nav.getRouterState()?.routes[0]?.state
  return (root?.routes ?? []).map(route => route.name)
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}

async function openAssistantSignedOut() {
  nav = renderRouter(app(), { initialUrl: '/' })
  await nav
  // `renderRouter` turns fake timers on; the scripted backend runs on real ones.
  jest.useRealTimers()
  await waitFor(() => expect(screen.getByText('home')).toBeTruthy())
  await act(async () => {
    router.push('/assistant')
  })
  await waitFor(() => expect(screen.getByText('Đăng nhập để dùng GoGo AI')).toBeTruthy())
  expect(rootStack()).toEqual(['(tabs)', 'assistant'])
}

it('"Đăng nhập" replaces the assistant with sign-in on the root stack', async () => {
  await openAssistantSignedOut()
  await press(screen.getByRole('button', { name: 'Đăng nhập' }))
  await waitFor(() => expect(nav.getPathname()).toBe('/auth/sign-in'))
  expect(rootStack()).toEqual(['(tabs)', 'auth/sign-in'])
})

it('the session turning `user` while sign-in is on screen does not clear the "New" badge', async () => {
  await openAssistantSignedOut()
  await press(screen.getByRole('button', { name: 'Đăng nhập' }))
  await waitFor(() => expect(nav.getPathname()).toBe('/auth/sign-in'))
  // The session lands before sign-in navigates (the provider updates first).
  await act(async () => {
    setSession({ status: 'user', session: { kind: 'user', userId: USER } })
  })
  expect(assistantIsNew(useAssistantIntroStore.getState().accounts[USER])).toBe(true)
})

it('after signing in, GoGo AI opens signed in as a card over Home', async () => {
  mockSignIn.mockImplementation(async () => {
    setSession({ status: 'user', session: { kind: 'user', userId: USER } })
  })
  await openAssistantSignedOut()
  await press(screen.getByRole('button', { name: 'Đăng nhập' }))
  await waitFor(() => expect(nav.getPathname()).toBe('/auth/sign-in'))
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('Email'), 'an@example.com')
  })
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'correct horse battery')
  })
  await press(screen.getAllByRole('button', { name: 'Đăng nhập' }).at(-1)!)
  await waitFor(() => expect(nav.getPathname()).toBe('/assistant'))
  expect(rootStack()).toEqual(['(tabs)', 'assistant'])
  await waitFor(() => expect(screen.getByPlaceholderText('Hỏi GoGo bất cứ điều gì…')).toBeTruthy())
  // Seen signed in: now the badge goes.
  expect(assistantIsNew(useAssistantIntroStore.getState().accounts[USER])).toBe(false)
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 60))
  })
})
