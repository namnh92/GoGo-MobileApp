import { afterEach, describe, expect, it, vi } from 'vitest'

import { FIX_TIMEOUT_MS, MAX_FIX_AGE_MS, readFreshPosition, type LocationReader } from '../fresh-position'

const NOW = 1_800_000_000_000
const fix = (ageMs: number, lat = 10.77, lng = 106.7) => ({ coords: { latitude: lat, longitude: lng }, timestamp: NOW - ageMs })

function reader(overrides: Partial<LocationReader> = {}): LocationReader & { requested: number } {
  const base = {
    requested: 0,
    getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getLastKnownPositionAsync: async () => fix(60_000),
    getCurrentPositionAsync: async () => fix(0, 21.03, 105.85),
    Accuracy: { Balanced: 3 },
  }
  return Object.assign(base, overrides)
}

afterEach(() => vi.useRealTimers())

describe('readFreshPosition (ADM-204)', () => {
  it('uses a recent last-known fix without asking for anything', async () => {
    const location = reader()
    expect(await readFreshPosition(location, () => NOW)).toEqual({ lat: 10.77, lng: 106.7 })
    expect('requestForegroundPermissionsAsync' in location).toBe(false)
  })

  it('asks the device for a new fix when the last one is too old', async () => {
    const location = reader({ getLastKnownPositionAsync: async () => fix(MAX_FIX_AGE_MS + 1) })
    expect(await readFreshPosition(location, () => NOW)).toEqual({ lat: 21.03, lng: 105.85 })
  })

  it('gives up after the timeout instead of waiting on a slow fix', async () => {
    vi.useFakeTimers()
    const location = reader({
      getLastKnownPositionAsync: async () => null,
      getCurrentPositionAsync: () => new Promise(() => undefined),
    })
    const pending = readFreshPosition(location, () => NOW)
    await vi.advanceTimersByTimeAsync(FIX_TIMEOUT_MS)
    expect(await pending).toBeNull()
  })

  it('has no position without permission, without the module, or when the call fails', async () => {
    expect(await readFreshPosition(reader({ getForegroundPermissionsAsync: async () => ({ status: 'denied' }) }), () => NOW)).toBeNull()
    expect(await readFreshPosition(null, () => NOW)).toBeNull()
    expect(
      await readFreshPosition(reader({ getLastKnownPositionAsync: async () => { throw new Error('boom') } }), () => NOW),
    ).toBeNull()
  })

  it('refuses a new fix that is itself stale', async () => {
    const location = reader({
      getLastKnownPositionAsync: async () => null,
      getCurrentPositionAsync: async () => fix(MAX_FIX_AGE_MS + 5_000),
    })
    expect(await readFreshPosition(location, () => NOW)).toBeNull()
  })
})
