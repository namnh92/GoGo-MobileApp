import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native'
import { dehydrate, hydrate, notifyManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { Linking } from 'react-native'

import '@/shared/i18n'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: () => undefined,
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoomRealtime: () => ({ status: 'connected' }),
}))
jest.mock('@/shared/ui/map-canvas.view', () => ({ MapCanvas: () => null }))
jest.mock('@/features/active-date/checkin-sheet.view', () => ({ CheckinSheet: () => null }))

import ActiveDateScreen from '@/features/active-date/active-date.view'

import * as places from '../endpoints/places'
import { shouldPersistQuery } from '../persist-policy'
import { usePlanStopPlaces } from '../queries/use-plans'
import { queryKeys } from '../query-keys'
import type { PlaceDetail } from '../types'

const clients: QueryClient[] = []
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

const detail: PlaceDetail = {
  id: 'place-1', name: 'Quán thử', addressText: '12 Nguyễn Huệ', lat: 10.77, lng: 106.7,
  freshnessCheckedAt: '2026-11-07T00:00:00Z',
  rating: 4.8, ratingCount: 250, gogoRating: 4.5, gogoRatingCount: 8, checkedInGroupCount: 9,
  photos: [{ id: 'photo-1', url: 'https://example.test/provider.jpg', attribution: 'provider credit', source: 'google' }],
}
const stops = [{ placeId: 'place-1' }, { placeId: 'place-1' }]

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
afterEach(() => {
  clients.splice(0).forEach(client => client.clear())
  onlineManager.setOnline(true)
  jest.restoreAllMocks()
})

it('F-03: restores active-stop identity and directions offline without provider or moderated data', async () => {
  const request = jest.spyOn(places, 'getPlaceDetail').mockResolvedValue(detail)
  const warm = harness()
  warm.client.setQueryData(queryKeys.plan('plan-1'), {
    id: 'plan-1', roomId: 'room-1', stops: [{ id: 'stop-1', placeId: 'place-1', position: 0, status: 'planned' }],
  })
  warm.client.setQueryData(queryKeys.room('room-1'), { id: 'room-1', status: 'active' })
  warm.client.setQueryData(['place-provider-photos', 'place-1'], { dataBase64: 'secret-provider-bytes' })
  const first = await renderHook(() => usePlanStopPlaces(stops), { wrapper: warm.wrapper })
  await waitFor(() => expect(first.result.current.byPlaceId.get('place-1')?.name).toBe(detail.name))
  await waitFor(() => expect(warm.client.isFetching()).toBe(0))
  expect(request).toHaveBeenCalledTimes(1)
  // Online rendering keeps the existing full-detail facts.
  expect(first.result.current.byPlaceId.get('place-1')?.gogoRating).toBe(4.5)
  const disk = JSON.parse(JSON.stringify(dehydrate(warm.client, {
    shouldDehydrateQuery: query => query.state.data !== undefined && shouldPersistQuery(query.queryKey),
  })))
  await first.unmount()
  warm.client.clear()

  onlineManager.setOnline(false)
  const cold = harness()
  hydrate(cold.client, disk)
  const restored = await renderHook(() => usePlanStopPlaces(stops), { wrapper: cold.wrapper })
  await waitFor(() => expect(restored.result.current.byPlaceId.get('place-1')).toMatchObject({
    name: detail.name, addressText: detail.addressText, lat: detail.lat, lng: detail.lng,
  }))
  expect(restored.result.current.isPending).toBe(false)
  expect(cold.client.getQueryData(queryKeys.plan('plan-1'))).toMatchObject({ stops: [{ placeId: 'place-1' }] })
  expect(cold.client.getQueryData(queryKeys.planPlaceSummary('place-1'))).toEqual({
    id: detail.id, name: detail.name, addressText: detail.addressText, lat: detail.lat, lng: detail.lng,
    freshnessCheckedAt: detail.freshnessCheckedAt,
  })
  expect(cold.client.getQueryData(queryKeys.place('place-1'))).toBeUndefined()
  const serialized = JSON.stringify(disk)
  for (const excluded of ['gogoRating', 'ratingCount', 'provider.jpg', 'provider credit', 'secret-provider-bytes']) {
    expect(serialized).not.toContain(excluded)
  }
  expect(restored.result.current.byPlaceId.get('place-1')?.gogoRating).toBeUndefined()
  expect(restored.result.current.byPlaceId.get('place-1')?.photoUrl).toBeNull()
  expect(request).toHaveBeenCalledTimes(1)

  // Exercise the actual active-date directions CTA against the restored cache.
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  const screen = await render(<QueryClientProvider client={cold.client}><ActiveDateScreen /></QueryClientProvider>)
  expect(screen.getByText('Quán thử')).toBeTruthy()
  expect(screen.getByText('12 Nguyễn Huệ')).toBeTruthy()
  await fireEvent.press(screen.getByLabelText('Chỉ đường'))
  expect(openURL).toHaveBeenCalledWith(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('12 Nguyễn Huệ')}`)
  await screen.unmount()

  request.mockResolvedValue({ ...detail, name: 'Tên mới', addressText: 'Địa chỉ mới' })
  await act(async () => { onlineManager.setOnline(true) })
  await waitFor(() => expect(restored.result.current.byPlaceId.get('place-1')?.name).toBe('Tên mới'))
  expect(restored.result.current.byPlaceId.get('place-1')?.addressText).toBe('Địa chỉ mới')
  await restored.unmount()
})

it('snapshots details already cached before the plan opens without another request', async () => {
  const request = jest.spyOn(places, 'getPlaceDetail')
  const { client, wrapper } = harness()
  client.setQueryData(queryKeys.place('place-1'), detail)
  const hook = await renderHook(() => usePlanStopPlaces(stops), { wrapper })
  await waitFor(() => expect(client.getQueryData(queryKeys.planPlaceSummary('place-1'))).toMatchObject({ name: detail.name }))
  expect(request).not.toHaveBeenCalled()
  await hook.unmount()
})
