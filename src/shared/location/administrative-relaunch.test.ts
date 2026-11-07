import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { shouldPersistQuery } from '@/shared/api/persist-policy'

const mocks = vi.hoisted(() => ({ get: vi.fn(), load: vi.fn(async (): Promise<unknown> => null), position: vi.fn(async () => ({ status: 'denied' })) }))
vi.mock('@/shared/api/client', () => ({ api: { get: mocks.get } }))
vi.mock('./native-location', () => ({ currentPermission: async () => 'denied', readCurrentLocation: mocks.position }))
vi.mock('@/shared/storage/current-area', () => ({ loadCurrentArea: mocks.load, saveCurrentArea: async () => {} }))

const province = { code: '79', fullName: 'Thành phố Hồ Chí Minh', name: 'Hồ Chí Minh', unitType: 'PROVINCE', level: 'PROVINCE', status: 'ACTIVE', isCurrent: true, effectiveFrom: '2025-07-01' }
const commune = { ...province, code: '00001', parentCode: '79', fullName: 'Phường Một', unitType: 'WARD', level: 'COMMUNE' }
const clients: QueryClient[] = []
function newClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  return client
}
beforeEach(async () => {
  vi.resetModules()
  mocks.get.mockReset()
  mocks.load.mockResolvedValue(null)
  mocks.position.mockClear()
  await AsyncStorage.clear()
  mocks.get.mockImplementation(async (path: string) => path === '/administrative/version'
    ? { datasetVersion: 'v1' }
    : { datasetVersion: 'v1', items: path.endsWith('/communes') ? [commune] : [province], nextCursor: null, total: 1 })
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.useRealTimers() })

it('checks version once per launch and restores provinces/communes without requests when unchanged', async () => {
  const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'gogo.query-cache', throttleTime: 0 })
  const persistOptions = { persister, buster: 'test', maxAge: 24 * 60 * 60_000 }
  const first = newClient()
  const launch = await import('./app-area')
  const { administrativeUnitsOptions } = await import('@/shared/administrative/query-options')
  await Promise.all([launch.initializeAppArea(first, null), launch.initializeAppArea(first, null)])
  await first.fetchQuery(administrativeUnitsOptions('v1', '79'))
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual([
    '/administrative/version', '/administrative/provinces', '/administrative/provinces/{provinceCode}/communes',
  ])
  // Installed react-query/persist-client use different patch versions of query-core;
  // their private QueryClient types differ although persistence is runtime-compatible.
  type PersistenceClient = Parameters<typeof persistQueryClientSave>[0]['queryClient']
  await persistQueryClientSave({ ...persistOptions, queryClient: first as unknown as PersistenceClient, dehydrateOptions: {
    shouldDehydrateQuery: query => query.state.data !== undefined && shouldPersistQuery(query.queryKey),
  } })
  expect(await AsyncStorage.getItem('gogo.query-cache')).toContain('administrative')
  first.clear()

  // A new app module and QueryClient represent a new process, with only disk surviving.
  vi.resetModules()
  mocks.get.mockClear()
  const second = newClient()
  await persistQueryClientRestore({ ...persistOptions, queryClient: second as unknown as PersistenceClient })
  const relaunched = await import('./app-area')
  const options = await import('@/shared/administrative/query-options')
  await relaunched.initializeAppArea(second, null)
  expect(await second.fetchQuery(options.administrativeUnitsOptions('v1'))).toEqual([province])
  expect(await second.fetchQuery(options.administrativeUnitsOptions('v1', '79'))).toEqual([commune])

  vi.useFakeTimers()
  await vi.advanceTimersByTimeAsync(6 * 60_000)
  await relaunched.initializeAppArea(second, null)
  await relaunched.appArea.permissionChanged()
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual(['/administrative/version'])
})

it('checks the version even with a saved manual area, without requesting GPS', async () => {
  mocks.load.mockResolvedValue({ manual: true, area: { datasetVersion: 'v1', provinceCode: '79', provinceName: province.fullName, communeCode: null, communeName: null } })
  const { initializeAppArea } = await import('./app-area')
  await initializeAppArea(newClient(), null)
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual(['/administrative/version'])
  expect(mocks.position).not.toHaveBeenCalled()
})

it('loads the new snapshot when the startup version changes', async () => {
  const client = newClient()
  client.setQueryData(['administrative', 'version'], { datasetVersion: 'old' })
  client.setQueryData(['administrative', 'old', 'provinces'], [province])
  const { initializeAppArea } = await import('./app-area')
  await initializeAppArea(client, null)
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual(['/administrative/version', '/administrative/provinces'])
  expect(client.getQueryData(['administrative', 'v1', 'provinces'])).toEqual([province])
})

it('keeps an offline startup responsive using the restored snapshot', async () => {
  const { onlineManager } = await import('@tanstack/react-query')
  const client = newClient()
  client.setQueryData(['administrative', 'version'], { datasetVersion: 'v1' })
  client.setQueryData(['administrative', 'v1', 'provinces'], [province])
  onlineManager.setOnline(false)
  try {
    const { initializeAppArea, useAppAreaStore } = await import('./app-area')
    await initializeAppArea(client, null)
    expect(useAppAreaStore.getState().scope).toMatchObject({ status: 'ready', source: 'default_area' })
    expect(mocks.get).not.toHaveBeenCalled()
  } finally {
    client.clear()
    onlineManager.setOnline(true)
  }
})

it('does not automatically retry a failed version check; an explicit fallback retry can recover', async () => {
  mocks.get.mockRejectedValueOnce(new Error('unavailable'))
  const { initializeAppArea, retryAppArea, useAppAreaStore } = await import('./app-area')
  await initializeAppArea(newClient(), null)
  expect(useAppAreaStore.getState().scope.status).toBe('unavailable')
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual(['/administrative/version'])
  await retryAppArea()
  expect(useAppAreaStore.getState().scope).toMatchObject({ status: 'ready', source: 'default_area' })
  expect(mocks.get.mock.calls.map(([path]) => path)).toEqual(['/administrative/version', '/administrative/version', '/administrative/provinces'])
})
