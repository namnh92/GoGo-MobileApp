import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react-native'

import '@/shared/i18n'
import { setAssistantBackend, type AssistantBackend } from '@/shared/api/assistant-backend'
import { useAssistantDraftStore } from '@/shared/store/assistantDraftStore'
import { useAssistantIntroStore } from '@/shared/store/assistantIntroStore'
import { ToastProvider } from '@/shared/ui/toast.view'
import { createMockAssistantBackend, type MockAssistantOptions } from '@/data/assistant/mock-backend'

import { scriptedTime } from './scripted-time'

/**
 * Shared setup for the GoGo AI screen specs (GoGo-MobileApp#378). The screens
 * run against the same scripted backend a dev build uses (`src/data/assistant`)
 * at speed 0, wrapped in a spy so a spec can read exactly what was sent —
 * the context, the Idempotency-Key, the edited values. A `timeout` in these
 * specs is scripted time, not a wall-clock budget (`scriptedTime`).
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

scriptedTime()

/**
 * Moves scripted time inside `act`: the frames after the one a spec waited
 * for, the status refetch a finished reply triggers.
 */
export async function settle(ms = 60) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

/** A direct call to the scripted backend: its answer sits on a timer too. */
export async function scripted<T>(call: Promise<T>): Promise<T> {
  await settle()
  return call
}

/**
 * Waits for the thing itself — no query or mutation in flight and no reply
 * being written (the composer's Stop button gone) — then one settle more.
 */
export async function settleIdle(maxRounds = 100) {
  for (let round = 0; round < maxRounds; round += 1) {
    await settle()
    const busy = client.isFetching() + client.isMutating()
    const writing = screen.queryByRole('button', { name: 'Dừng' })
    if (busy === 0 && !writing) {
      await settle()
      return
    }
  }
  throw new Error('the assistant never went idle')
}
