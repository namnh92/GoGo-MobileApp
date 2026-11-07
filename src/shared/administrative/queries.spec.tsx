import { act, renderHook, waitFor } from '@testing-library/react-native'
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '@/shared/api/client'
import { createQueryClient, purgeCachedUserData } from '@/shared/api/query-client'
import { clearSession, persistSession } from '@/shared/api/session'
import { administrativeUnitsOptions, administrativeVersionOptions } from './query-options'
import { useAdministrativeUnits, useAdministrativeVersion } from './queries'

jest.mock('@/shared/api/client', () => ({ api: { get: jest.fn() } }))
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
}))

it('keeps administrative observers and reopened pickers ready across session purges without another version check', async () => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 900_000 })
  const client = createQueryClient()
  const province = { code: '79', fullName: 'Thành phố Hồ Chí Minh', name: 'Hồ Chí Minh', unitType: 'PROVINCE', level: 'PROVINCE', status: 'ACTIVE', isCurrent: true, effectiveFrom: '2025-07-01' }
  const commune = { ...province, code: '00001', parentCode: '79', fullName: 'Phường Một', unitType: 'WARD', level: 'COMMUNE' }
  const get = jest.mocked(api.get).mockReset().mockImplementation(async path => (
    path === '/administrative/version' ? { datasetVersion: 'v1' } : {
      datasetVersion: 'v1', items: path.endsWith('/communes') ? [commune] : [province], nextCursor: null,
    }
  ) as never)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const usePicker = () => {
    const version = useAdministrativeVersion()
    const provinces = useAdministrativeUnits(version.data?.datasetVersion)
    const communes = useAdministrativeUnits(version.data?.datasetVersion, '79')
    return { version, provinces, communes }
  }
  try {
    // Startup checks once; the picker observes that completed check.
    await client.fetchQuery(administrativeVersionOptions)
    await client.fetchQuery(administrativeUnitsOptions('v1'))
    await client.fetchQuery(administrativeUnitsOptions('v1', '79'))
    client.setQueryData(['taxonomies', 'vi', 'current'], { data: { version: 1 }, etag: 'v1' })
    client.setQueryData(['taxonomies', 'vi', 1], { data: { version: 1 }, etag: 'v1' })
    const publicQueries = client.getQueryCache().getAll()
    const first = await renderHook(usePicker, { wrapper })
    // Sign-in and logout both use this same purge, without restarting appArea.
    for (const boundary of ['logout', 'sign-in']) {
      for (const root of ['rooms', 'plans', 'me', 'assistant', 'places', 'location']) {
        client.setQueryData([root, boundary], { private: true })
      }
      client.getMutationCache().build(client, { mutationKey: ['me', boundary], gcTime: Infinity })
      await AsyncStorage.setItem('gogo.query-cache', JSON.stringify({ private: boundary }))
      await act(async () => {
        if (boundary === 'logout') await clearSession()
        else await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 900_000 })
        await purgeCachedUserData(client)
      })
      expect(client.getQueryCache().getAll().every(query => ['administrative', 'taxonomies'].includes(String(query.queryKey[0])))).toBe(true)
      expect(client.getMutationCache().getAll()).toEqual([])
      expect(await AsyncStorage.getItem('gogo.query-cache')).toBeNull()
      for (const query of publicQueries) expect(client.getQueryCache().find({ queryKey: query.queryKey })).toBe(query)
      expect(first.result.current.version.data?.datasetVersion).toBe('v1')
      const reopened = await renderHook(usePicker, { wrapper })
      expect(reopened.result.current.version.isPending).toBe(false)
      expect(reopened.result.current.provinces.data).toEqual([province])
      expect(reopened.result.current.communes.data).toEqual([commune])
      await reopened.unmount()
    }
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/administrative/version', '/administrative/provinces', '/administrative/provinces/{provinceCode}/communes',
    ])
    await first.unmount()
  } finally {
    client.clear()
    await clearSession()
    get.mockReset()
  }
})

it('observes the startup version across remount/focus/reconnect after five minutes, with explicit retry', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['administrative', 'version'], { datasetVersion: 'v1' })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const clock = jest.spyOn(Date, 'now')
  const now = Date.now()
  const get = jest.mocked(api.get).mockResolvedValue({ datasetVersion: 'v2' })
  try {
    const first = await renderHook(useAdministrativeVersion, { wrapper })
    expect(first.result.current.data?.datasetVersion).toBe('v1')
    await first.unmount()
    clock.mockReturnValue(now + 6 * 60_000)
    const second = await renderHook(useAdministrativeVersion, { wrapper })
    expect(second.result.current.data?.datasetVersion).toBe('v1')
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    expect(get).not.toHaveBeenCalled()
    await act(async () => { await second.result.current.refetch() })
    expect(get).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(second.result.current.data?.datasetVersion).toBe('v2'))
    await second.unmount()
  } finally {
    clock.mockRestore()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
    client.clear()
  }
})
