import { describe, expect, it, vi } from 'vitest'
import { createAreaController, type AreaDependencies } from './area-controller'
import { loadCurrentArea, saveCurrentArea } from '@/shared/storage/current-area'
import { defaultDiscoveryArea, scopeFor, scopeSearchParams } from './discovery-scope'
import { locatedAreaOptions } from '@/shared/administrative/located-area'
import { shouldPersistQuery } from '@/shared/api/persist-policy'

const AREA = { datasetVersion: 'v1', provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: null, communeName: null }
const OTHER = { ...AREA, provinceCode: '01', provinceName: 'Thành phố Hà Nội' }
function setup(overrides: Partial<AreaDependencies> = {}) {
  const deps = {
    load: vi.fn(async () => null), save: vi.fn(async () => {}), permission: vi.fn(async () => 'granted'),
    position: vi.fn(async () => ({ status: 'granted' as const, lat: 10.77, lng: 106.7, label: null })),
    locate: vi.fn(async () => AREA),
    fallback: vi.fn(async () => ({ status: 'ready' as const, source: 'default_area' as const, area: AREA })),
    ...overrides,
  }
  return { deps, app: createAreaController(deps) }
}

describe('app-wide current area', () => {
  it('deduplicates concurrent startup and never reads GPS for unchanged foreground permission', async () => {
    const { app, deps } = setup()
    await Promise.all([app.initialize(), app.initialize(), app.initialize()])
    await app.initialize()
    await Promise.all([app.permissionChanged(), app.permissionChanged()])
    expect(deps.position).toHaveBeenCalledExactlyOnceWith(false)
    expect(deps.locate).toHaveBeenCalledTimes(1)
    expect(app.store.getState().area).toEqual(AREA)
    expect(scopeSearchParams(app.store.getState().scope)).toEqual({ lat: 10.77, lng: 106.7 })
  })

  it('publishes a manual choice to all subscribers immediately and persists across launches', async () => {
    await saveCurrentArea(null)
    const { app } = setup({ load: loadCurrentArea, save: saveCurrentArea })
    await app.initialize()
    const home = vi.fn(), search = vi.fn(), create = vi.fn()
    const unsubscribe = [home, search, create].map(listener => app.store.subscribe(state => listener(state.area)))
    app.store.getState().setArea(OTHER)
    for (const listener of [home, search, create]) expect(listener).toHaveBeenLastCalledWith(OTHER)
    await app.flushed()
    expect(await loadCurrentArea()).toEqual({ area: OTHER, manual: true })
    const next = setup({ load: loadCurrentArea })
    await next.app.initialize()
    expect(next.deps.position).not.toHaveBeenCalled()
    expect(next.app.store.getState().scope).toEqual({ status: 'ready', source: 'selected_area', area: OTHER })
    unsubscribe.forEach(stop => stop())
    await saveCurrentArea(null)
  })

  it.each([true, false])('keeps a saved area with denied permission (manual=%s)', async manual => {
    const { app, deps } = setup({ load: async () => ({ area: OTHER, manual }), permission: async () => 'denied', position: async () => ({ status: 'denied' }) })
    await app.initialize()
    expect(app.store.getState().scope).toEqual({ status: 'ready', source: 'selected_area', area: OTHER })
    expect(deps.locate).not.toHaveBeenCalled()
    expect(deps.fallback).not.toHaveBeenCalled()
  })

  it.each(['no area', 'offline'] as const)('removes the saved manual override when GPS locate returns %s, and reads GPS on relaunch', async failure => {
    await saveCurrentArea({ area: OTHER, manual: true })
    const save = vi.fn(saveCurrentArea)
    const { app } = setup({
      load: loadCurrentArea, save,
      locate: async () => { if (failure === 'offline') throw new Error('offline'); return null },
    })
    try {
      await app.initialize()
      await app.request()
      await app.flushed()
      expect(app.store.getState()).toMatchObject({ area: null, manual: false, scope: { status: 'ready', source: 'gps' } })
      expect(await loadCurrentArea()).toBeNull()
      expect(JSON.stringify(save.mock.calls)).not.toMatch(/"lat"|"lng"/)

      const next = setup({ load: loadCurrentArea })
      await next.app.initialize()
      expect(next.deps.position).toHaveBeenCalledExactlyOnceWith(false)
      expect(next.app.store.getState()).toMatchObject({ manual: false, scope: { source: 'gps' } })
    } finally {
      await saveCurrentArea(null)
    }
  })

  it('keeps a newer manual choice on disk when an older GPS locate completes without an area', async () => {
    await saveCurrentArea({ area: AREA, manual: true })
    let finish!: (area: null) => void
    const { app } = setup({ load: loadCurrentArea, save: saveCurrentArea, locate: () => new Promise(resolve => { finish = resolve }) })
    try {
      await app.initialize()
      const request = app.request()
      await vi.waitFor(() => expect(finish).toBeDefined())
      app.store.getState().setArea(OTHER)
      finish(null)
      await request
      await app.flushed()
      expect(app.store.getState()).toMatchObject({ area: OTHER, manual: true, scope: { source: 'selected_area' } })
      expect(await loadCurrentArea()).toEqual({ area: OTHER, manual: true })
    } finally {
      await saveCurrentArea(null)
    }
  })

  it('falls back with denied permission and no saved choice, without administrative locate', async () => {
    const { app, deps } = setup({ permission: async () => 'denied', position: async () => ({ status: 'denied' }) })
    await app.initialize()
    expect(app.store.getState().scope).toEqual({ status: 'ready', source: 'default_area', area: AREA })
    expect(deps.locate).not.toHaveBeenCalled()
    expect(deps.fallback).toHaveBeenCalledTimes(1)
  })

  it('re-resolves only for an explicit request or actual permission change', async () => {
    let permission = 'denied'
    const { app, deps } = setup({ permission: async () => permission, position: vi.fn<AreaDependencies['position']>(async () => permission === 'granted' ? { status: 'granted', lat: 1, lng: 2, label: null } : { status: 'denied' }) })
    await app.initialize()
    await app.permissionChanged()
    expect(deps.position).toHaveBeenCalledTimes(1)
    permission = 'granted'
    await app.permissionChanged()
    expect(deps.position).toHaveBeenCalledTimes(2)
    expect(deps.locate).toHaveBeenCalledTimes(1)
    await app.request()
    expect(deps.position).toHaveBeenLastCalledWith(true)
    expect(deps.locate).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 1, lng: 2 }), true)
    await app.permissionChanged()
    expect(deps.position).toHaveBeenCalledTimes(3)
  })

  it('does not let slow startup overwrite a newer manual choice', async () => {
    let finish!: (area: typeof AREA) => void
    const { app } = setup({ locate: () => new Promise(resolve => { finish = resolve }) })
    const startup = app.initialize()
    await vi.waitFor(() => expect(finish).toBeDefined())
    app.store.getState().setArea(OTHER)
    finish(AREA)
    await startup
    expect(app.store.getState().scope).toEqual({ status: 'ready', source: 'selected_area', area: OTHER })
  })

  it('retries failed fallback data without another GPS read', async () => {
    const fallback = vi.fn<AreaDependencies['fallback']>().mockResolvedValueOnce({ status: 'unavailable', error: new Error('offline'), offline: true }).mockResolvedValue({ status: 'ready', source: 'default_area', area: AREA })
    const { app, deps } = setup({ position: async () => ({ status: 'unavailable' }), fallback })
    await app.initialize()
    await app.retry()
    expect(deps.locate).not.toHaveBeenCalled()
    expect(app.store.getState().area).toEqual(AREA)
    expect(fallback).toHaveBeenCalledTimes(2)
  })

  it('keeps locate in a long-lived, non-persisted Query cache', () => {
    const options = locatedAreaOptions({ lat: 1, lng: 2 })
    expect(options.staleTime).toBeGreaterThanOrEqual(24 * 60 * 60_000)
    expect(shouldPersistQuery(options.queryKey)).toBe(false)
  })

  it('preserves canonical profile/default resolution and excludes stale profiles', () => {
    expect(scopeFor(null, { ...OTHER, status: 'current' }, false)).toEqual({ status: 'ready', source: 'profile_area', area: OTHER })
    expect(scopeFor(null, { ...OTHER, status: 'needs_reselection' }, false)).toMatchObject({ source: 'none', reason: 'area_needs_reselection' })
    expect(defaultDiscoveryArea('v2', [{ code: 'source', name: 'Hồ Chí Minh', fullName: AREA.provinceName, isCurrent: true, status: 'ACTIVE', level: 'PROVINCE' } as never])).toMatchObject({ datasetVersion: 'v2', provinceCode: 'source' })
  })
})
