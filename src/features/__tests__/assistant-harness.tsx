import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react-native'

import '@/shared/i18n'
import { setAssistantBackend, type AssistantBackend } from '@/shared/api/assistant-backend'
import { useAssistantDraftStore } from '@/shared/store/assistantDraftStore'
import { useAssistantIntroStore } from '@/shared/store/assistantIntroStore'
import { ToastProvider } from '@/shared/ui/toast.view'
import { createMockAssistantBackend, type MockAssistantOptions } from '@/data/assistant/mock-backend'

/**
 * Shared setup for the GoGo AI screen specs (GoGo-MobileApp#378). The screens
 * run against the same scripted backend a dev build uses (`src/data/assistant`)
 * at speed 0, wrapped in a spy so a spec can read exactly what was sent —
 * the context, the Idempotency-Key, the edited values.
 */
export type SpyBackend = AssistantBackend & { calls: { name: string; args: unknown[] }[] }

export function spyOn(backend: AssistantBackend): SpyBackend {
  const calls: { name: string; args: unknown[] }[] = []
  const spied = { calls } as SpyBackend
  for (const [name, fn] of Object.entries(backend)) {
    ;(spied as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      calls.push({ name, args })
      return (fn as (...a: unknown[]) => unknown)(...args)
    }
  }
  return spied
}

export function installBackend(options: MockAssistantOptions = {}): SpyBackend {
  const backend = spyOn(createMockAssistantBackend({ speed: 0, actor: () => 'user', ...options }))
  setAssistantBackend(backend)
  return backend
}

export function callsTo(backend: SpyBackend, name: string): unknown[][] {
  return backend.calls.filter(call => call.name === name).map(call => call.args)
}

let client: QueryClient

export function resetAssistantSpecState() {
  useAssistantDraftStore.getState().reset()
  useAssistantIntroStore.setState({ accounts: {} })
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
}

// TanStack's notifications inside the act that caused them (#133).
export function syncTanstackNotifications() {
  beforeAll(() => notifyManager.setScheduler(callback => callback()))
  afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
}

export async function renderAssistant(element: React.ReactElement) {
  await render(
    <QueryClientProvider client={client}>
      <ToastProvider>{element}</ToastProvider>
    </QueryClientProvider>,
  )
  return screen
}

/**
 * Lets the scripted reply run to its end inside `act`: the frames after the
 * one a spec waited for, the status refetch a finished reply triggers.
 */
export async function settle(ms = 60) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms))
  })
}
