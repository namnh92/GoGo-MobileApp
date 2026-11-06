import { act, renderHook } from '@testing-library/react-native'

/**
 * ADM-204 (#209) — the order Home looks in: a fresh position, else the account
 * area, else the published HCM default; foreground returns re-check without looping.
 */

const mockRead = { next: null as { lat: number; lng: number } | null, calls: 0 }
const mockActivity: { listener: ((active: boolean) => void) | null } = { listener: null }

jest.mock('@/shared/location/fresh-position', () => ({
  readFreshPosition: async () => {
    mockRead.calls += 1
    return mockRead.next
  },
}))
jest.mock('@/shared/api/realtime/app-activity', () => ({
  appActivity: {
    isActive: () => true,
    subscribe: (listener: (active: boolean) => void) => {
      mockActivity.listener = listener
      return () => {
        mockActivity.listener = null
      }
    },
  },
}))

// Administrative-source failure retains the explicit degraded state in older cases.
const mockAdministrative = { version: undefined as string | undefined, pending: false, failed: true, paused: false, provinces: [] as unknown[] }
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: mockAdministrative.version ? { datasetVersion: mockAdministrative.version } : undefined, isPending: mockAdministrative.pending, isError: mockAdministrative.failed, isPaused: mockAdministrative.paused }),
  useAdministrativeUnits: () => ({ data: mockAdministrative.provinces, isPending: mockAdministrative.pending, isError: mockAdministrative.failed, isPaused: mockAdministrative.paused }),
}))

import { scopeSearchParams, useDiscoveryScope } from '@/shared/location/use-discovery-scope'

const AREA = {
  datasetVersion: 'ds-2026',
  provinceCode: '79',
  provinceName: 'Thành phố Hồ Chí Minh',
  communeCode: '26734',
  communeName: 'Phường Bến Thành',
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  mockAdministrative.version = undefined
  mockAdministrative.pending = false
  mockAdministrative.failed = true
  mockAdministrative.paused = false
  mockAdministrative.provinces = []
  mockRead.next = null
  mockRead.calls = 0
  mockActivity.listener = null
})

describe('useDiscoveryScope', () => {
  it('prefers a fresh position over the account area, and never mixes them', async () => {
    mockRead.next = { lat: 10.77, lng: 106.7 }
    const { result } = await renderHook(() =>
      useDiscoveryScope({ profileArea: { ...AREA, status: 'current' }, profilePending: false }),
    )
    await settle()
    expect(result.current.scope).toEqual({ status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } })
    expect(scopeSearchParams(result.current.scope)).toEqual({ lat: 10.77, lng: 106.7 })
  })

  it('falls back to a current account area without a position', async () => {
    const { result } = await renderHook(() =>
      useDiscoveryScope({ profileArea: { ...AREA, status: 'current' }, profilePending: false }),
    )
    await settle()
    expect(result.current.scope).toEqual({ status: 'ready', source: 'profile_area', area: AREA })
    expect(scopeSearchParams(result.current.scope)).toEqual({
      datasetVersion: 'ds-2026',
      provinceCode: '79',
      communeCode: '26734',
    })
  })

  it('reports the default lookup failure instead of searching without an area', async () => {
    const stale = await renderHook(() =>
      useDiscoveryScope({ profileArea: { ...AREA, status: 'needs_reselection' }, profilePending: false }),
    )
    await settle()
    expect(stale.result.current.scope).toMatchObject({ status: 'unavailable', offline: false })

    const missing = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false }))
    await settle()
    expect(missing.result.current.scope).toMatchObject({ status: 'unavailable', offline: false })
    expect(scopeSearchParams(missing.result.current.scope)).toEqual({})
  })

  it('stays resolving while the account is still loading', async () => {
    const { result } = await renderHook(() => useDiscoveryScope({ profileArea: undefined, profilePending: true }))
    await settle()
    expect(result.current.scope).toEqual({ status: 'resolving' })
  })

  it('follows an account switch to the new account area', async () => {
    type Area = {
      datasetVersion: string
      provinceCode: string
      provinceName: string
      communeCode: string | null
      communeName: string | null
      status: 'current'
    }
    const other: Area = { ...AREA, provinceCode: '01', provinceName: 'Thành phố Hà Nội', communeCode: null, communeName: null, status: 'current' }
    let area: Area = { ...AREA, status: 'current' }
    const { result, rerender } = await renderHook(() => useDiscoveryScope({ profileArea: area, profilePending: false }))
    await settle()
    expect(scopeSearchParams(result.current.scope)).toMatchObject({ provinceCode: '79' })
    area = other
    await rerender({})
    expect(scopeSearchParams(result.current.scope)).toEqual({ datasetVersion: 'ds-2026', provinceCode: '01' })
  })

  it('re-checks on return to the app at most once a minute, and on demand', async () => {
    const { result } = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false }))
    await settle()
    expect(mockRead.calls).toBe(1)
    await act(async () => {
      mockActivity.listener?.(true)
      mockActivity.listener?.(true)
      await Promise.resolve()
    })
    expect(mockRead.calls).toBe(1)

    mockRead.next = { lat: 10.8, lng: 106.7 }
    await act(async () => {
      await result.current.recheck()
    })
    expect(mockRead.calls).toBe(2)
    expect(result.current.scope).toMatchObject({ source: 'gps' })
  })
})


describe('owner O-6 default discovery area', () => {
  function publishedCity() {
    mockAdministrative.version = 'published-2026'
    mockAdministrative.failed = false
    mockAdministrative.provinces = [{ code: 'source-code', name: 'Hồ Chí Minh', fullName: 'Thành phố Hồ Chí Minh', level: 'PROVINCE', status: 'ACTIVE', isCurrent: true }]
  }

  it.each(['denied', 'not asked', 'unavailable'])('defaults to the published HCM province without a profile area when location is %s', async () => {
    // All three outcomes of readFreshPosition are null; no permission is requested here.
    publishedCity()
    const { result } = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false }))
    await settle()
    expect(result.current.scope).toMatchObject({ source: 'default_area', area: { provinceName: 'Thành phố Hồ Chí Minh', communeCode: null } })
    expect(scopeSearchParams(result.current.scope)).toEqual({ datasetVersion: 'published-2026', provinceCode: 'source-code' })
  })

  it('prefers the profile city over HCM when location is not shared (F-08 owner decision)', async () => {
    publishedCity()
    const profileArea = { ...AREA, provinceCode: '01', provinceName: 'Thành phố Hà Nội', communeCode: null, communeName: null }
    const { result } = await renderHook(() => useDiscoveryScope({ profileArea: { ...profileArea, status: 'current' }, profilePending: false }))
    await settle()
    expect(result.current.scope).toEqual({ status: 'ready', source: 'profile_area', area: profileArea })
    expect(scopeSearchParams(result.current.scope)).toEqual({ datasetVersion: 'ds-2026', provinceCode: '01' })
  })

  it('waits for the default lookup rather than issuing an unscoped request', async () => {
    mockAdministrative.failed = false
    mockAdministrative.pending = true
    const { result } = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false }))
    await settle()
    expect(result.current.scope).toEqual({ status: 'resolving' })
  })

  it('honours an explicitly chosen area even with shared GPS', async () => {
    publishedCity()
    mockRead.next = { lat: 10.77, lng: 106.7 }
    const selectedArea = { ...AREA, provinceCode: 'other-city', communeCode: null, communeName: null }
    const { result } = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false, selectedArea }))
    await settle()
    expect(result.current.scope).toEqual({ status: 'ready', source: 'selected_area', area: selectedArea })
    expect(scopeSearchParams(result.current.scope)).not.toHaveProperty('lat')
  })
})


it('exposes an offline default lookup without permitting an unscoped request', async () => {
  mockAdministrative.failed = false
  mockAdministrative.pending = true
  mockAdministrative.paused = true
  const { result } = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false }))
  await settle()
  expect(result.current.scope).toMatchObject({ status: 'unavailable', offline: true })
  expect(scopeSearchParams(result.current.scope)).toEqual({})
})
