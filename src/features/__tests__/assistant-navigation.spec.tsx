import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'

import '@/shared/i18n'

import AssistantRoute from '@/app/assistant'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'
import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { useAssistantDraftStore } from '@/shared/store/assistantDraftStore'
import { ToastProvider } from '@/shared/ui/toast.view'

jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

it('pushes place, plan and confirmed room onto the root stack and returns to the mounted conversation', async () => {
  useAssistantDraftStore.getState().reset()
  const backend = createMockAssistantBackend({ speed: 0, actor: () => 'user' })
  backend.listMessages = async conversationId => ({
    conversationCredits: { creditsUsed: 0, creditsReserved: 0, pendingTurns: 0, state: 'settled', asOf: '2026-11-11T00:00:00Z' },
    nextCursor: null,
    items: [{
      id: 'reply', conversationId, role: 'assistant', status: 'completed',
      text: 'Retained answer', createdAt: '2026-11-10T01:00:00Z',
      cards: [
        { kind: 'place', placeId: 'place-627', available: true, facts: { name: 'Navigation café' } },
        { kind: 'plan', planId: 'plan-627', roomId: 'room-627', available: true, facts: { roomTitle: 'Navigation plan' } },
      ],
      proposals: [{
        id: 'proposal-627', kind: 'create_room', status: 'confirmed', values: [],
        createdAt: '2026-11-10T01:00:00Z', expiresAt: '2026-11-11T01:00:00Z',
        result: {
          proposalId: 'proposal-627', kind: 'create_room', confirmedAt: '2026-11-10T01:00:00Z',
          resource: { type: 'room', id: 'room-627' }, savedValues: [],
        },
      }],
    }],
  })
  setAssistantBackend(backend)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const nav = renderRouter({
    _layout: () => <QueryClientProvider client={client}><ToastProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="assistant" options={{ presentation: 'card' }} /></Stack></ToastProvider></QueryClientProvider>,
    index: () => <Text>Home</Text>,
    assistant: AssistantRoute,
    'places/[placeId]': () => <Text>Place destination</Text>,
    'plans/[planId]/index': () => <Text>Plan destination</Text>,
    'room/[roomId]/index': () => <Text>Room destination</Text>,
  }, { initialUrl: '/' })
  await nav
  jest.useRealTimers()
  await act(async () => router.push('/assistant'))
  await fireEvent.press(await screen.findByTestId('assistant-history'))
  await fireEvent.press(await screen.findByText('Quán cà phê yên tĩnh ở Quận 3'))
  await screen.findByText('Retained answer')
  const thread = screen.getByTestId('assistant-thread')
  await fireEvent.changeText(screen.getByPlaceholderText('Hỏi GoGo bất cứ điều gì…'), 'Retained draft')

  for (const [target, button] of [
    ['/places/place-627', () => screen.getByText('Navigation café')],
    ['/plans/plan-627', () => screen.getAllByRole('button', { name: 'Mở kế hoạch' })[0]!],
    ['/room/room-627', () => screen.getAllByRole('button', { name: 'Mở kế hoạch' })[1]!],
  ] as const) {
    await act(async () => { await fireEvent.press(button()) })
    await waitFor(() => expect(nav.getPathname()).toBe(target))
    const routes = nav.getRouterState()?.routes[0]?.state?.routes ?? []
    expect(routes.map(route => route.name)).toEqual(['index', 'assistant', target.startsWith('/places') ? 'places/[placeId]' : target.startsWith('/plans') ? 'plans/[planId]/index' : 'room/[roomId]/index'])
    await act(async () => router.back())
    await waitFor(() => expect(nav.getPathname()).toBe('/assistant'))
    expect(screen.getByText('Retained answer')).toBeTruthy()
    expect(screen.getByPlaceholderText('Hỏi GoGo bất cứ điều gì…').props.value).toBe('Retained draft')
    // The same list instance retains its native scroll offset across push/back.
    expect(screen.getByTestId('assistant-thread')).toBe(thread)
    expect(screen.queryByTestId('sheet-backdrop', { includeHiddenElements: true })).toBeNull()
  }
  client.clear()
})
