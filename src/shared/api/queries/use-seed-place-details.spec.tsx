import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useSeedPlaceDetails } from './use-places'
import { queryKeys } from '../query-keys'

const mockPlace = jest.fn()
jest.mock('../endpoints/places', () => ({ getPlaceDetail: (id: string) => mockPlace(id) }))

it('shares cached seed details and refreshes only current seeds, including failed details', async () => {
  mockPlace.mockImplementation(async (id: string) => {
    if (id === 'failed') throw new Error('Detail unavailable')
    return { id, name: id }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, rerender, unmount } = await renderHook(
    ({ seeds }: { seeds: Parameters<typeof useSeedPlaceDetails>[0] }) => useSeedPlaceDetails(seeds),
    { wrapper, initialProps: { seeds: [{ placeId: 'old' }, { placeId: 'failed' }, { placeId: 'old' }, {}] } },
  )
  await waitFor(() => {
    expect(result.current.byPlaceId.get('old')?.isSuccess).toBe(true)
    expect(result.current.byPlaceId.get('failed')?.isError).toBe(true)
  })
  expect(mockPlace).toHaveBeenCalledTimes(2)
  expect(client.getQueryData(queryKeys.place('old'))).toEqual({ id: 'old', name: 'old' })

  await rerender({ seeds: [{ placeId: 'current' }, { placeId: 'failed' }] })
  await waitFor(() => expect(result.current.byPlaceId.get('current')?.isSuccess).toBe(true))
  expect(result.current.byPlaceId.has('old')).toBe(false)
  mockPlace.mockClear()
  mockPlace.mockImplementation(async (id: string) => ({ id, name: `Refreshed ${id}` }))
  await act(async () => { await result.current.refetchAll() })
  await waitFor(() => expect(result.current.byPlaceId.get('failed')?.data?.name).toBe('Refreshed failed'))
  expect(mockPlace.mock.calls).toEqual([['current'], ['failed']])
  expect(client.getQueryData(queryKeys.place('current'))).toEqual({ id: 'current', name: 'Refreshed current' })
  await unmount()
  client.clear()
})
