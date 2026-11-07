import { onlineManager, type QueryClient } from '@tanstack/react-query'
import type { OpResponse } from '@/shared/api/types'
import { locatedAreaOptions } from '@/shared/administrative/located-area'
import { administrativeUnitsOptions, administrativeVersionOptions } from '@/shared/administrative/query-options'
import { loadCurrentArea, saveCurrentArea } from '@/shared/storage/current-area'
import { createAreaController } from './area-controller'
import { currentPermission, readCurrentLocation } from './native-location'
import { defaultDiscoveryArea, scopeFor, type ScopeArea } from './discovery-scope'

let client: QueryClient
let profile: (ScopeArea & { status: 'current' | 'needs_reselection' }) | null | undefined
let versionCheck: Promise<unknown> | undefined

function checkVersion() {
  // Force one check even when yesterday's version was restored from disk.
  return client.fetchQuery({ ...administrativeVersionOptions, staleTime: 0 }).catch(() => undefined)
}

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
      if (onlineManager.isOnline()) await versionCheck
      const version = client.getQueryData(administrativeVersionOptions.queryKey)
      if (!version) throw new Error('DEFAULT_DISCOVERY_AREA_UNAVAILABLE')
      const provinceOptions = administrativeUnitsOptions(version.datasetVersion)
      const provinces = onlineManager.isOnline() ? await client.fetchQuery(provinceOptions) : client.getQueryData(provinceOptions.queryKey)
      const area = defaultDiscoveryArea(version.datasetVersion, provinces)
      if (!area) throw new Error('DEFAULT_DISCOVERY_AREA_UNAVAILABLE')
      return { status: 'ready', source: 'default_area', area }
    } catch (error) { return { status: 'unavailable', error, offline: !onlineManager.isOnline() } }
  },
})
export const useAppAreaStore = appArea.store
export async function retryAppArea() {
  if (useAppAreaStore.getState().scope.status !== 'unavailable') return
  if (onlineManager.isOnline()) await checkVersion()
  return appArea.retry()
}

export function initializeAppArea(queryClient: QueryClient, profileArea: typeof profile) {
  client = queryClient
  profile = profileArea
  versionCheck ??= checkVersion()
  // Offline checks remain paused for reconnect; they must not block saved-area hydration.
  const area = appArea.initialize()
  return onlineManager.isOnline() ? Promise.all([versionCheck, area]).then(() => {}) : area
}
