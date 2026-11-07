import { create } from 'zustand'
import type { AdministrativeSelection } from '@/shared/administrative/snapshot'
import type { DiscoveryScope } from './discovery-scope'
import type { LocationState } from './native-location'

export type SavedArea = { area: AdministrativeSelection; manual: boolean }
export type AreaDependencies = {
  load: () => Promise<SavedArea | null>
  save: (value: SavedArea | null) => Promise<void>
  permission: () => Promise<string>
  position: (explicit: boolean) => Promise<LocationState>
  locate: (position: { lat: number; lng: number }, explicit: boolean) => Promise<AdministrativeSelection | null>
  fallback: () => Promise<DiscoveryScope>
}

/** One controller per app process. No consumer mounts trigger work. Coordinates stay in memory. */
export function createAreaController(deps: AreaDependencies) {
  let revision = 0
  let initialized: Promise<void> | undefined
  let running: Promise<LocationState> | undefined
  let permission: string | undefined
  let writes = Promise.resolve()
  const persist = (value: SavedArea | null) => {
    writes = writes.then(() => deps.save(value)).catch(() => {})
  }
  const store = create<{
    area: AdministrativeSelection | null
    manual: boolean
    scope: DiscoveryScope
    location: LocationState
    setArea: (area: AdministrativeSelection | null) => void
  }>(set => ({
    area: null, manual: false, scope: { status: 'resolving' }, location: { status: 'idle' },
    setArea: area => {
      revision++ // A slow GPS or hydration result must not replace a manual tap.
      set({ area, manual: !!area, location: { status: 'idle' }, scope: area ? { status: 'ready', source: 'selected_area', area } : { status: 'ready', source: 'none', reason: 'no_area' } })
      persist(area ? { area, manual: true } : null)
    },
  }))

  function resolve(explicit: boolean): Promise<LocationState> {
    if (running) return running
    const currentRevision = revision
    running = (async () => {
      store.setState({ location: { status: 'asking' } })
      const result = await deps.position(explicit)
      permission = await deps.permission()
      if (currentRevision !== revision) return result
      store.setState({ location: result })
      if (result.status === 'granted') {
        let area: AdministrativeSelection | null = null
        try { area = await deps.locate(result, explicit) } catch { /* Keep GPS useful offline. */ }
        if (currentRevision !== revision) return result
        store.setState({ area, manual: false, scope: { status: 'ready', source: 'gps', position: { lat: result.lat, lng: result.lng } } })
        persist(area ? { area, manual: false } : null)
      } else {
        const saved = store.getState().area
        const scope = saved ? { status: 'ready' as const, source: 'selected_area' as const, area: saved } : await deps.fallback()
        if (currentRevision !== revision) return result
        const area = scope.status === 'ready' && 'area' in scope ? scope.area : saved
        store.setState({ area, scope })
        if (area) persist({ area, manual: store.getState().manual })
      }
      return result
    })().catch(error => {
      if (currentRevision === revision) store.setState({ location: { status: 'unavailable' }, scope: { status: 'unavailable', error, offline: false } })
      return { status: 'unavailable' } as LocationState
    }).finally(() => { running = undefined })
    return running
  }

  function initialize() {
    initialized ??= (async () => {
      const currentRevision = revision
      const saved = await deps.load().catch(() => null)
      permission = await deps.permission()
      if (currentRevision !== revision) return
      if (saved) {
        store.setState({ area: saved.area, manual: saved.manual })
        if (saved.manual) {
          store.setState({ scope: { status: 'ready', source: 'selected_area', area: saved.area } })
          return
        }
      }
      await resolve(false)
    })()
    return initialized
  }
  async function permissionChanged() {
    await initialize()
    const next = await deps.permission()
    if (next === permission) return
    permission = next
    await resolve(false)
  }
  async function request() {
    await initialize()
    return resolve(true)
  }
  async function retry() {
    // Retry the fallback data without silently requesting another GPS fix.
    if (store.getState().scope.status !== 'unavailable') return
    const currentRevision = revision
    const scope = await deps.fallback()
    if (currentRevision === revision) {
      const area = scope.status === 'ready' && 'area' in scope ? scope.area : null
      store.setState({ scope, area })
      if (area) persist({ area, manual: false })
    }
  }
  return { store, initialize, permissionChanged, request, retry, flushed: () => writes }
}
