import { act, renderHook } from '@testing-library/react-native'

/**
 * ADM-204 (#209) — the order Home looks in: a fresh position, else the account
 * area, else an honest "none"; foreground returns re-check without looping.
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

  it('says none, with the reason, when there is no usable area', async () => {
    const stale = await renderHook(() =>
      useDiscoveryScope({ profileArea: { ...AREA, status: 'needs_reselection' }, profilePending: false }),
    )
    await settle()
    expect(stale.result.current.scope).toEqual({ status: 'ready', source: 'none', reason: 'area_needs_reselection' })

    const missing = await renderHook(() => useDiscoveryScope({ profileArea: null, profilePending: false }))
    await settle()
    expect(missing.result.current.scope).toEqual({ status: 'ready', source: 'none', reason: 'no_area' })
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
