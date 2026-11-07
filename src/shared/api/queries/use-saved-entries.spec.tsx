import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useSavedEntries } from './use-me'
import { NetworkError } from '../errors'
const mockList = jest.fn()
const mockPlace = jest.fn()
const mockPlan = jest.fn()
jest.mock('../endpoints/me', () => ({ listSaved: () => mockList() }))
jest.mock('../endpoints/places', () => ({ getPlaceDetail: () => mockPlace() }))
jest.mock('../endpoints/plans', () => ({ getPlan: () => mockPlan() }))
it('ignores legacy plans without hydrating them, separates detail errors, and retries places with the list', async () => {
  const area = { scope: 'unknown', datasetVersion: null, provinceCode: null, provinceName: null, communeCode: null, communeName: null }
  const network = new NetworkError()
  mockList.mockResolvedValue([{ targetType: 'place', targetId: 'p', area }, { targetType: 'plan', targetId: 'plan', area, conditionsChanged: true }])
  mockPlace.mockRejectedValue(network)
  mockPlan.mockResolvedValue({ id: 'plan', isStale: false, stops: [] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, unmount } = await renderHook(() => useSavedEntries(), { wrapper })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.isError).toBe(false)
  expect(result.current.entries[0]?.detailError).toBe(network)
  expect(result.current.entries).toHaveLength(1)
  expect(result.current.entries[0]?.type).toBe('place')
  expect(mockPlan).not.toHaveBeenCalled()
  mockPlace.mockResolvedValue({ id: 'p', name: 'Recovered place' })
  await act(async () => { await result.current.refetch() })
  await waitFor(() => expect(result.current.entries[0]?.place?.name).toBe('Recovered place'))
  expect(mockList).toHaveBeenCalledTimes(2)
  expect(mockPlace).toHaveBeenCalledTimes(2)
  expect(mockPlan).not.toHaveBeenCalled()
  await unmount()
  client.clear()
})

it('does not expose or hydrate cached saved entries after sign-out', async () => {
  jest.clearAllMocks()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const { queryKeys } = jest.requireActual('../query-keys')
  client.setQueryData(queryKeys.saved(), [{ targetType: 'place', targetId: 'previous-user-place', area: { scope: 'unknown' } }])
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, unmount } = await renderHook(() => useSavedEntries({ enabled: false }), { wrapper })
  expect(result.current.entries).toEqual([])
  expect(mockList).not.toHaveBeenCalled()
  expect(mockPlace).not.toHaveBeenCalled()
  await unmount()
  client.clear()
})
