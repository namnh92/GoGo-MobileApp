import { focusManager, onlineManager } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'

import { NetworkError } from '../errors'
import { createQueryClient } from '../query-client'
import { clearSession, persistSession, type Session } from '../session'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))

const A: Session = { kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 }
const B: Session = { ...A, userId: 'B', accessToken: 'B' }
afterEach(async () => { focusManager.setFocused(true); onlineManager.setOnline(true); vi.useRealTimers(); await clearSession() })

it.each(['backoff', 'unfocused', 'offline', 'serial queue', 'onMutate wait'] as const)('drops A mutation in %s without replay or callbacks under B', async scenario => {
  await persistSession(A)
  vi.useFakeTimers()
  const client = createQueryClient()
  client.mount()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const mutationFn = vi.fn(async () => { throw new NetworkError() })
  const onSuccess = vi.fn()
  const onError = vi.fn()
  const onSettled = vi.fn()
  if (scenario === 'offline') onlineManager.setOnline(false)
  if (scenario === 'unfocused') focusManager.setFocused(false)
  const first = scenario === 'serial queue' ? client.getMutationCache().build(client, {
    scope: { id: 'serial' }, mutationFn: () => held,
  }).execute(undefined).catch(error => error) : null
  const mutation = client.getMutationCache().build(client, {
    mutationFn, onSuccess, onError, onSettled,
    ...(scenario === 'offline' ? { networkMode: 'online' as const } : {}),
    ...(scenario === 'serial queue' ? { scope: { id: 'serial' } } : {}),
    ...(scenario === 'onMutate wait' ? { onMutate: () => held } : {}),
  })
  const result = mutation.execute(undefined).catch(error => error)
  await vi.advanceTimersByTimeAsync(scenario === 'unfocused' ? 10_000 : 0)
  const before = mutationFn.mock.calls.length
  await persistSession(B)
  const dropped = client.getMutationCache().getAll().length
  release()
  focusManager.setFocused(true)
  onlineManager.setOnline(true)
  await vi.advanceTimersByTimeAsync(60_000)
  expect(await result).toMatchObject({ message: expect.stringContaining('Session changed') })
  await first
  expect(dropped).toBe(0)
  expect(mutationFn).toHaveBeenCalledTimes(before)
  expect(onSuccess).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
  expect(onSettled).not.toHaveBeenCalled()
  client.unmount()
  client.clear()
})

it('cancels an A query retry without issuing its queryFn for B', async () => {
  await persistSession(A)
  vi.useFakeTimers()
  const client = createQueryClient()
  const queryFn = vi.fn(async () => { throw new NetworkError() })
  const result = client.fetchQuery({ queryKey: ['me'], queryFn }).catch(error => error)
  await vi.advanceTimersByTimeAsync(0)
  await persistSession(B)
  await vi.advanceTimersByTimeAsync(60_000)
  await result
  expect(queryFn).toHaveBeenCalledTimes(1)
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  client.clear()
})
