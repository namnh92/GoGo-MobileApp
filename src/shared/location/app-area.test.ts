import { onlineManager, QueryClient } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { appArea, initializeAppArea, useAppAreaStore } from './app-area'

const native = vi.hoisted(() => ({ permission: 'granted', read: vi.fn(), save: vi.fn(async () => {}) }))
vi.mock('./native-location', () => ({
  currentPermission: async () => native.permission,
  readCurrentLocation: async (explicit: boolean) => {
    native.read(explicit)
    return native.permission === 'granted' ? { status: 'granted', lat: 10.77, lng: 106.7, label: null } : { status: 'denied' }
  },
}))
vi.mock('@/shared/storage/current-area', () => ({ loadCurrentArea: async () => null, saveCurrentArea: native.save }))

it('wires startup to one query-backed locate, and invalidates only on explicit location requests', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const get = vi.spyOn(api, 'get').mockResolvedValue({ datasetVersion: 'published', area: { scope: 'province', provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: null, communeName: null } })
  try {
    await Promise.all([initializeAppArea(client, null), initializeAppArea(client, null)])
    expect(native.read).toHaveBeenCalledExactlyOnceWith(false)
    expect(get).toHaveBeenCalledExactlyOnceWith('/administrative/locate', { query: { lat: 10.77, lng: 106.7 }, anonymous: true })
    expect(useAppAreaStore.getState().area).toEqual({ datasetVersion: 'published', provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: null, communeName: null })
    await appArea.permissionChanged()
    await initializeAppArea(client, null)
    expect(get).toHaveBeenCalledTimes(1)
    await appArea.request()
    expect(native.read).toHaveBeenLastCalledWith(true)
    expect(get).toHaveBeenCalledTimes(2)
    native.permission = 'denied'
    await appArea.permissionChanged()
    expect(get).toHaveBeenCalledTimes(2)
    expect(useAppAreaStore.getState().scope).toMatchObject({ source: 'selected_area', area: { provinceCode: '79' } })
    native.permission = 'granted'
    onlineManager.setOnline(false)
    await appArea.request()
    expect(useAppAreaStore.getState().scope).toMatchObject({ status: 'ready', source: 'gps' })
    expect(get).toHaveBeenCalledTimes(2)
    await appArea.flushed()
    expect(JSON.stringify(native.save.mock.calls)).not.toMatch(/"lat"|"lng"/)
  } finally {
    onlineManager.setOnline(true)
    get.mockRestore()
    client.clear()
  }
})
