import { onlineManager, type QueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import type { OpResponse } from '@/shared/api/types'
import { locatedAreaOptions } from '@/shared/administrative/located-area'
import { loadAdministrativeSnapshot, type AdministrativeUnit } from '@/shared/administrative/snapshot'
import { loadCurrentArea, saveCurrentArea } from '@/shared/storage/current-area'
import { createAreaController } from './area-controller'
import { currentPermission, readCurrentLocation } from './native-location'
import { defaultDiscoveryArea, scopeFor, type ScopeArea } from './discovery-scope'

let client: QueryClient
let profile: (ScopeArea & { status: 'current' | 'needs_reselection' }) | null | undefined

export const appArea = createAreaController({
  load: loadCurrentArea,
  save: saveCurrentArea,
  permission: currentPermission,
  position: readCurrentLocation,
  locate: async (position, explicit) => {
    const options = locatedAreaOptions(position)
    if (explicit) await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' })
    const result = onlineManager.isOnline() ? await client.fetchQuery(options) : client.getQueryData<OpResponse<'locateAdministrativeArea'>>(options.queryKey)
    if (!result) return null
    const area = result.area
    return area.scope !== 'unknown' && area.provinceCode && area.provinceName
      ? { datasetVersion: result.datasetVersion, provinceCode: area.provinceCode, provinceName: area.provinceName, communeCode: area.communeCode, communeName: area.communeName }
      : null
  },
  fallback: async () => {
    const scope = scopeFor(null, profile, false)
    if (scope.status !== 'ready' || scope.source !== 'none') return scope
    try {
      const versionOptions = {
        queryKey: ['administrative', 'version'], staleTime: 24 * 60 * 60_000,
        queryFn: () => api.get<OpResponse<'getAdministrativeVersion'>>('/administrative/version', { anonymous: true }),
      }
      const version = onlineManager.isOnline() ? await client.fetchQuery(versionOptions) : client.getQueryData<OpResponse<'getAdministrativeVersion'>>(versionOptions.queryKey)
      if (!version) throw new Error('DEFAULT_DISCOVERY_AREA_UNAVAILABLE')
      const provinceOptions = {
        queryKey: ['administrative', version.datasetVersion, 'provinces'], staleTime: Infinity,
        queryFn: () => loadAdministrativeSnapshot(version.datasetVersion, undefined, cursor => api.get<OpResponse<'listAdministrativeProvinces'>>('/administrative/provinces', {
          query: { limit: 100, ...(cursor ? { cursor } : {}) }, anonymous: true,
        })),
      }
      const provinces = onlineManager.isOnline() ? await client.fetchQuery(provinceOptions) : client.getQueryData<AdministrativeUnit[]>(provinceOptions.queryKey)
      const area = defaultDiscoveryArea(version.datasetVersion, provinces)
      if (!area) throw new Error('DEFAULT_DISCOVERY_AREA_UNAVAILABLE')
      return { status: 'ready', source: 'default_area', area }
    } catch (error) { return { status: 'unavailable', error, offline: !onlineManager.isOnline() } }
  },
})
export const useAppAreaStore = appArea.store
export const retryAppArea = appArea.retry

export function initializeAppArea(queryClient: QueryClient, profileArea: typeof profile) {
  client = queryClient
  profile = profileArea
  return appArea.initialize()
}
