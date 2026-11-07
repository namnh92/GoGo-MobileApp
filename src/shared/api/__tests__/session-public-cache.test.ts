import { afterEach, expect, it, vi } from 'vitest'

import { api } from '../client'
import { createQueryClient, purgeCachedUserData } from '../query-client'
import { clearSession, persistSession } from '../session'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))

afterEach(async () => { vi.restoreAllMocks(); await clearSession() })

it.each(['administrative', 'taxonomies'])('keeps %s snapshots, cancels late A responses and allows fresh fetches under B', async root => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  const client = createQueryClient()
  const queryKey = [root, 'version']
  const snapshot = { version: 'cached' }
  client.setQueryData(queryKey, snapshot)
  const original = client.getQueryCache().find({ queryKey })
  let release!: (response: Response) => void
  const late = new Promise<Response>(resolve => { release = resolve })
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => late)
  const options = { queryKey, staleTime: 0, queryFn: () => api.get(`/${root}`, { anonymous: true }) }
  const pending = client.fetchQuery(options).catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

  await clearSession()
  await purgeCachedUserData(client)
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
  release(new Response(JSON.stringify({ version: 'late-A' }), { status: 200, headers: { 'content-type': 'application/json' } }))
  await pending
  expect(client.getQueryCache().find({ queryKey })).toBe(original)
  expect(client.getQueryData(queryKey)).toEqual(snapshot)

  await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600_000 })
  await purgeCachedUserData(client)
  fetch.mockResolvedValue(new Response(JSON.stringify({ version: 'fresh-B' }), { status: 200, headers: { 'content-type': 'application/json' } }))
  await expect(client.fetchQuery(options)).resolves.toEqual({ version: 'fresh-B' })
  expect(client.getQueryCache().find({ queryKey })).toBe(original)
  client.clear()
})
