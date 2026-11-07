import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { queryKeys } from '../query-keys'
import type { SavedItem } from '../types'
import { useToggleSaved } from './use-me'

const mockSave = jest.fn()
const mockUnsave = jest.fn()
jest.mock('../endpoints/me', () => ({
  ...jest.requireActual('../endpoints/me'),
  saveItem: (...args: unknown[]) => mockSave(...args),
  unsaveItem: (...args: unknown[]) => mockUnsave(...args),
}))

function deferred() {
  let resolve: () => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const key = queryKeys.saved()
const item: SavedItem = {
  targetType: 'place', targetId: 'canonical', savedAt: '2026-11-07T00:00:00.000Z',
  area: { scope: 'unknown', datasetVersion: null, provinceCode: null, provinceName: null, communeCode: null, communeName: null },
}
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(() => {
  jest.resetAllMocks()
  mockSave.mockResolvedValue(undefined)
  mockUnsave.mockResolvedValue(undefined)
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  client.setQueryData(key, [item])
})
afterEach(() => client.clear())

it.each([false, true])('waits for a pending removal before confirming quick-save, even if removal fails (%s)', async removalFails => {
  const removal = deferred()
  const save = deferred()
  const calls: string[] = []
  let serverSaved = true
  mockUnsave.mockImplementation(async () => {
    calls.push('DELETE')
    await removal.promise
    serverSaved = false
  })
  mockSave.mockImplementation(async () => {
    calls.push('PUT')
    await save.promise
    serverSaved = true
  })
  const { result } = await renderHook(() => ({ remove: useToggleSaved(), quick: useToggleSaved() }), { wrapper })
  await act(async () => { result.current.remove.mutate({ type: 'place', id: 'canonical', saved: true }) })
  await waitFor(() => expect(mockUnsave).toHaveBeenCalledTimes(1))
  await act(async () => { result.current.quick.mutate({ type: 'place', id: 'canonical', saved: false }) })
  const callsWhileRemoving = [...calls]
  await act(async () => {
    if (removalFails) removal.reject(new Error('offline'))
    else removal.resolve()
  })
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
  expect(result.current.quick.isSuccess).toBe(false)
  await act(async () => { save.resolve() })
  await waitFor(() => expect(result.current.quick.isSuccess).toBe(true))
  expect(callsWhileRemoving).toEqual(['DELETE'])
  expect(calls).toEqual(['DELETE', 'PUT'])
  expect(serverSaved).toBe(true)
  expect(client.getQueryData<SavedItem[]>(key)?.map(entry => entry.targetId)).toEqual(['canonical'])
})

it('serializes a later removal behind a pending PUT across hook instances', async () => {
  const save = deferred()
  mockSave.mockReturnValue(save.promise)
  const { result } = await renderHook(() => ({ quick: useToggleSaved(), remove: useToggleSaved() }), { wrapper })
  await act(async () => { result.current.quick.mutate({ type: 'place', id: 'canonical', saved: false }) })
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
  await act(async () => { result.current.remove.mutate({ type: 'place', id: 'canonical', saved: true }) })
  const removalsWhileSaving = mockUnsave.mock.calls.length
  await act(async () => { save.resolve() })
  await waitFor(() => expect(result.current.remove.isSuccess).toBe(true))
  expect(removalsWhileSaving).toBe(0)
  expect(client.getQueryData(key)).toEqual([])
})

it('holds the per-place turn through automatic retries before allowing PUT', async () => {
  client.setDefaultOptions({ mutations: { retry: 1, retryDelay: 0, gcTime: Infinity } })
  const firstRemoval = deferred()
  const retriedRemoval = deferred()
  mockUnsave.mockReturnValueOnce(firstRemoval.promise).mockReturnValueOnce(retriedRemoval.promise)
  const { result } = await renderHook(() => ({ remove: useToggleSaved(), quick: useToggleSaved() }), { wrapper })
  await act(async () => { result.current.remove.mutate({ type: 'place', id: 'canonical', saved: true }) })
  await waitFor(() => expect(mockUnsave).toHaveBeenCalledTimes(1))
  await act(async () => { result.current.quick.mutate({ type: 'place', id: 'canonical', saved: false }) })
  await act(async () => { firstRemoval.reject(new Error('temporary failure')) })
  await waitFor(() => expect(mockUnsave).toHaveBeenCalledTimes(2))
  const savesDuringRetry = mockSave.mock.calls.length
  await act(async () => { retriedRemoval.resolve() })
  await waitFor(() => expect(result.current.quick.isSuccess).toBe(true))
  expect(savesDuringRetry).toBe(0)
  expect(mockSave).toHaveBeenCalledTimes(1)
  expect(client.getQueryData<SavedItem[]>(key)?.map(entry => entry.targetId)).toEqual(['canonical'])
})

it('confirms an already saved place without duplicating it or replacing its metadata', async () => {
  const { result } = await renderHook(() => useToggleSaved(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ type: 'place', id: 'canonical', saved: false }) })
  expect(mockSave).toHaveBeenCalledWith('place', 'canonical')
  expect(client.getQueryData(key)).toEqual([item])
})

it('lets other places save independently and preserves them when an earlier removal rolls back', async () => {
  const removal = deferred()
  mockUnsave.mockReturnValue(removal.promise)
  const { result } = await renderHook(() => ({ remove: useToggleSaved(), other: useToggleSaved() }), { wrapper })
  await act(async () => { result.current.remove.mutate({ type: 'place', id: 'canonical', saved: true }) })
  await waitFor(() => expect(mockUnsave).toHaveBeenCalledTimes(1))
  await act(async () => { await result.current.other.mutateAsync({ type: 'place', id: 'other', saved: false }) })
  expect(mockSave).toHaveBeenCalledWith('place', 'other')
  await act(async () => { removal.reject(new Error('offline')) })
  await waitFor(() => expect(result.current.remove.isError).toBe(true))
  expect(client.getQueryData<SavedItem[]>(key)?.map(entry => entry.targetId).sort()).toEqual(['canonical', 'other'])
})
