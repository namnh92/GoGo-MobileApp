import { act, renderHook } from '@testing-library/react-native'
import { createAreaController } from '@/shared/location/area-controller'
import { useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { AppAreaProvider } from '@/shared/providers/app-area-provider'
import type { ReactNode } from 'react'

const AREA = { datasetVersion: 'v1', provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: null, communeName: null }
const mockPosition = jest.fn(async () => ({ status: 'granted' as const, lat: 10.77, lng: 106.7, label: null }))
const mockLocate = jest.fn(async () => AREA)
const mockController = createAreaController({
  load: async () => null, save: async () => {}, permission: async () => 'granted', position: mockPosition,
  locate: mockLocate, fallback: async () => ({ status: 'ready', source: 'default_area', area: AREA }),
})
let mockForeground: ((active: boolean) => void) | undefined
jest.mock('@/shared/location/app-area', () => ({
  useAppAreaStore: (selector: never) => mockController.store(selector),
  initializeAppArea: () => mockController.initialize(),
  appArea: { permissionChanged: () => mockController.permissionChanged() },
  retryAppArea: () => mockController.retry(),
}))
let mockRestoring = false
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => null, useIsRestoring: () => mockRestoring }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'anonymous' }) }))
jest.mock('@/shared/api', () => ({ useMe: () => ({ isPending: false }) }))
jest.mock('@/shared/api/realtime/app-activity', () => ({
  appActivity: { subscribe: (listener: (active: boolean) => void) => { mockForeground = listener; return () => { mockForeground = undefined } } },
}))

it('resolves once from the root; all mounted and remounted consumers share changes without GPS reads', async () => {
  const wrapper = ({ children }: { children: ReactNode }) => <AppAreaProvider>{children}</AppAreaProvider>
  mockRestoring = true
  const first = await renderHook(() => ({ home: useDiscoveryScope(), search: useDiscoveryScope(), saved: useDiscoveryScope() }), { wrapper })
  expect(mockPosition).not.toHaveBeenCalled()
  mockRestoring = false
  await first.rerender({})
  await act(async () => { await mockController.initialize() })
  expect(mockPosition).toHaveBeenCalledTimes(1)
  expect(mockLocate).toHaveBeenCalledTimes(1)
  expect(first.result.current.home.scope).toBe(first.result.current.search.scope)
  expect(first.result.current.home.scope).toBe(first.result.current.saved.scope)
  await act(async () => { mockForeground?.(true); await mockController.permissionChanged() })
  expect(mockPosition).toHaveBeenCalledTimes(1)
  const other = { ...AREA, provinceCode: '01', provinceName: 'Thành phố Hà Nội' }
  await act(async () => mockController.store.getState().setArea(other))
  for (const consumer of Object.values(first.result.current)) expect(consumer.scope).toEqual({ status: 'ready', source: 'selected_area', area: other })
  await first.unmount()
  const remounted = await renderHook(useDiscoveryScope, { wrapper })
  expect(remounted.result.current.scope).toEqual({ status: 'ready', source: 'selected_area', area: other })
  expect(mockPosition).toHaveBeenCalledTimes(1)
  expect(mockLocate).toHaveBeenCalledTimes(1)
})
