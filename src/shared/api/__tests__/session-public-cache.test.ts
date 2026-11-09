import { afterEach, expect, it, vi } from 'vitest'

import { api } from '../client'
import { createQueryClient, purgeCachedUserData } from '../query-client'
import { clearSession, persistSession } from '../session'
import { queryKeys } from '../query-keys'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))

afterEach(async () => { vi.restoreAllMocks(); await clearSession() })

it.each([
  ['system-notifications'],
  ['administrative', 'version'],
  ['taxonomies', 'vi', 'current'],
  queryKeys.place('public-place'),
  queryKeys.planPlaceSummary('public-place'),
  ['place-provider-photos', 'public-place'],
].map(queryKey => ({ queryKey })))('keeps $queryKey snapshots, cancels late A responses and allows fresh fetches under B', async ({ queryKey }) => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  const client = createQueryClient()
  const snapshot = { version: 'cached' }
  client.setQueryData(queryKey, snapshot)
  const original = client.getQueryCache().find({ queryKey })
  let release!: (response: Response) => void
  const late = new Promise<Response>(resolve => { release = resolve })
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => late)
  const options = { queryKey, staleTime: 0, queryFn: () => api.get('/public', { anonymous: true }) }
  const pending = client.fetchQuery(options).catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

  await clearSession()
  await purgeCachedUserData(client)
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
  release(new Response(JSON.stringify({ version: 'late-A' }), { status: 200, headers: { 'content-type': 'application/json' } }))
  await pending
  expect(client.getQueryCache().find({ queryKey })).toBe(original)
  expect(client.getQueryData(queryKey)).toEqual(snapshot)
  expect(client.getQueryState(queryKey)).toMatchObject({ status: 'success', fetchStatus: 'idle' })

  await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600_000 })
  await purgeCachedUserData(client)
  fetch.mockResolvedValue(new Response(JSON.stringify({ version: 'fresh-B' }), { status: 200, headers: { 'content-type': 'application/json' } }))
  await expect(client.fetchQuery(options)).resolves.toEqual({ version: 'fresh-B' })
  expect(client.getQueryCache().find({ queryKey })).toBe(original)
  client.clear()
})

it.each([
  queryKeys.place('public-place'),
  queryKeys.planPlaceSummary('public-place'),
  ['place-provider-photos', 'public-place'],
].map(queryKey => ({ queryKey })))('F-07: retains explicitly public place cache $queryKey while purging private imports and submissions', async ({ queryKey }) => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  const client = createQueryClient()
  const snapshot = { public: true }
  client.setQueryData(queryKey, snapshot)
  const original = client.getQueryCache().find({ queryKey })
  const privateKeys = [queryKeys.placeImport('A'), queryKeys.placeImport('detail'), queryKeys.placeImport('plan-summary'), queryKeys.placeSubmission('A'), queryKeys.me(), queryKeys.saved(), queryKeys.room('A'), queryKeys.plan('A'), ['places', 'unknown-private-shape']]
  privateKeys.forEach(key => client.setQueryData(key, { private: 'A' }))
  try {
    await clearSession()
    await purgeCachedUserData(client)
    expect(client.getQueryData(queryKey)).toEqual(snapshot)
    expect(client.getQueryCache().find({ queryKey })).toBe(original)
    privateKeys.forEach(key => expect(client.getQueryState(key)).toBeUndefined())
    await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600_000 })
    await purgeCachedUserData(client)
    await expect(client.fetchQuery({ queryKey, staleTime: 0, queryFn: async () => ({ public: 'fresh-B' }) })).resolves.toEqual({ public: 'fresh-B' })
    expect(client.getQueryCache().find({ queryKey })).toBe(original)
  } finally { client.clear() }
})

it('F-01: a restarted public bootstrap read settles on a real failure and permits explicit retry', async () => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  const client = createQueryClient()
  const queryKey = ['administrative', 'version']
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue(new Response('{}', { status: 500 }))
  const options = { queryKey, retry: false, queryFn: () => api.get('/administrative/version', { anonymous: true }) }
  const pending = client.fetchQuery(options).catch(error => error)
  try {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await clearSession()
    expect(await pending).toMatchObject({ status: 500 })
    expect(client.getQueryState(queryKey)).toMatchObject({ status: 'error', fetchStatus: 'idle' })
    expect(fetch).toHaveBeenCalledTimes(2)
    fetch.mockResolvedValue(new Response('{"datasetVersion":"v1"}', { headers: { 'content-type': 'application/json' } }))
    await expect(client.fetchQuery(options)).resolves.toEqual({ datasetVersion: 'v1' })
    expect(client.getQueryState(queryKey)).toMatchObject({ status: 'success', fetchStatus: 'idle' })
  } finally { client.clear() }
})
