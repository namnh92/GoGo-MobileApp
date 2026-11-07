import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { afterEach, expect, it, vi } from 'vitest'

import { retainTaxonomies } from '../persist-policy'
import { queryPersister } from '../query-client'
import { assertSessionGeneration, clearSession, getSessionGeneration, persistSession } from '../session'
import { createPendingDeepLinkStore } from '@/shared/acquisition/pending-deep-link'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))
afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); await clearSession(); await queryPersister.removeClient() })

it('drops a throttled A cache write after sign-out removes its persisted data', async () => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  vi.useFakeTimers()
  const saved: PersistedClient = { buster: 'test', timestamp: Date.now(), clientState: { queries: [], mutations: [] } }
  await queryPersister.persistClient(saved)
  const delayed = queryPersister.persistClient({ ...saved, buster: 'late-A' })
  await vi.advanceTimersByTimeAsync(0)
  await clearSession()
  await queryPersister.removeClient()
  await vi.advanceTimersByTimeAsync(2_000)
  await delayed
  expect(await AsyncStorage.getItem('gogo.query-cache')).toBeNull()
})

it('never restores paused mutations whose original session lifetime ended at process exit', async () => {
  const saved = { buster: 'test', timestamp: Date.now(), clientState: { queries: [], mutations: [{ mutationKey: ['save-A'], state: { isPaused: true } }] } } as unknown as PersistedClient
  const persister = retainTaxonomies({
    persistClient: vi.fn(), removeClient: vi.fn(), restoreClient: vi.fn(async () => saved),
  })
  expect((await persister.restoreClient())?.clientState.mutations).toEqual([])
})

it('drains A native cache removal before allowing B cache writes', async () => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  vi.useFakeTimers()
  const saved: PersistedClient = { buster: 'A', timestamp: Date.now(), clientState: { queries: [], mutations: [] } }
  const initial = queryPersister.persistClient(saved)
  await vi.advanceTimersByTimeAsync(5_000)
  await initial
  let entered!: () => void
  let release!: () => void
  const started = new Promise<void>(resolve => { entered = resolve })
  const held = new Promise<void>(resolve => { release = resolve })
  const remove = AsyncStorage.removeItem
  vi.spyOn(AsyncStorage, 'removeItem').mockImplementationOnce(async key => {
    entered()
    await held
    await remove(key)
  })
  const cleanup = queryPersister.removeClient()
  await started
  await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600_000 })
  const writeB = queryPersister.persistClient({ ...saved, buster: 'B' })
  await vi.advanceTimersByTimeAsync(2_000)
  release()
  await Promise.all([cleanup, writeB])
  expect(JSON.parse((await AsyncStorage.getItem('gogo.query-cache')) ?? 'null')).toMatchObject({ buster: 'B' })
})

it.each(['queued', 'reading'] as const)('cancels A deferred-link cleanup while %s, before retirement or deletion', async stage => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  const values = new Map<string, string>()
  const storage = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { values.set(key, value) }),
    remove: vi.fn(async (key: string) => { values.delete(key) }),
  }
  const store = createPendingDeepLinkStore({ storage })
  await store.remember('https://go-dev.gogo.id.vn/places/11111111-1111-4111-8111-111111111111')
  storage.set.mockClear()
  let entered!: () => void
  let release!: () => void
  const started = new Promise<void>(resolve => { entered = resolve })
  const held = new Promise<void>(resolve => { release = resolve })
  storage.get.mockImplementationOnce(async key => { entered(); await held; return values.get(key) ?? null })
  const preceding = stage === 'queued' ? store.hasPending() : undefined
  const epoch = getSessionGeneration()
  const cleanup = store.clear({ assert: () => assertSessionGeneration(epoch) }).catch(error => error)
  await started
  await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600_000 })
  release()
  await preceding
  expect(await cleanup).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(storage.set).not.toHaveBeenCalled()
  expect(storage.remove).not.toHaveBeenCalled()
})
