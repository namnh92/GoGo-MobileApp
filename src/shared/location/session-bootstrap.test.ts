import { QueryObserver } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'

import { createQueryClient, purgeCachedUserData } from '@/shared/api/query-client'
import { clearSession, persistSession } from '@/shared/api/session'
import { administrativeVersionOptions } from '@/shared/administrative/query-options'
import { initializeAppArea, useAppAreaStore } from './app-area'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))
vi.mock('./native-location', () => ({ currentPermission: async () => 'denied', readCurrentLocation: async () => ({ status: 'denied' }) }))

const clients: ReturnType<typeof createQueryClient>[] = []
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
afterEach(async () => {
  clients.splice(0).forEach(client => client.clear())
  vi.restoreAllMocks()
  await clearSession()
})

it('F-01: a cancelled initial version check restarts across login/logout and settles startup and disabled picker observers', async () => {
  const client = createQueryClient()
  clients.push(client)
  const replies: ((response: Response) => void)[] = []
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { replies.push(resolve) }))
  const picker = new QueryObserver(client, { ...administrativeVersionOptions, enabled: false })
  const unsubscribe = picker.subscribe(() => {})
  let settled = false
  const startup = initializeAppArea(client, null).then(() => { settled = true })
  try {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
    await purgeCachedUserData(client)
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await clearSession()
    await purgeCachedUserData(client)
    expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    replies[0](json({ datasetVersion: 'late-anonymous' }))
    replies[1](json({ datasetVersion: 'late-A' }))
    replies[2](json({ datasetVersion: 'v1' }))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
    replies[3](json({ datasetVersion: 'v1', items: [{ code: '79', fullName: 'Thành phố Hồ Chí Minh', name: 'Hồ Chí Minh', unitType: 'PROVINCE', level: 'PROVINCE', status: 'ACTIVE', isCurrent: true, effectiveFrom: '2025-07-01' }], nextCursor: null }))
    await vi.waitFor(() => expect(settled).toBe(true))
    await startup
    expect(picker.getCurrentResult()).toMatchObject({ status: 'success', fetchStatus: 'idle', data: { datasetVersion: 'v1' } })
    expect(useAppAreaStore.getState().scope).toMatchObject({ status: 'ready', source: 'default_area' })
    const reopened = new QueryObserver(client, { ...administrativeVersionOptions, enabled: false })
    expect(reopened.getCurrentResult().isPending).toBe(false)
    reopened.destroy()
    expect(fetch).toHaveBeenCalledTimes(4)
  } finally { unsubscribe(); picker.destroy() }
})
