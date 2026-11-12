import { describe, expect, it } from 'vitest'
import { canSuggestPlaces, recenterSeedIndex, seedIndex } from './room-seeds.model'

describe('seed permissions (FR-ROOM-010; owner 2026-11-12)', () => {
  it('allows only hosts until BE#878 enables members', () => {
    expect(canSuggestPlaces('host')).toBe(true)
    expect(canSuggestPlaces('member')).toBe(false)
    expect(canSuggestPlaces('member', true)).toBe(true)
    expect(canSuggestPlaces(undefined, true)).toBe(false)
  })
  it.each([false, true])('never allows guests with member capability=%s', capability => {
    expect(canSuggestPlaces('guest', capability)).toBe(false)
  })
})

describe('seed row virtual indices', () => {
  it.each([1, 2, 3])('wraps both directions and recenters without changing the seed for N=%i', count => {
    expect(seedIndex(count, count)).toBe(0)
    expect(seedIndex(-1, count)).toBe(count - 1)
    for (let index = -3 * count; index <= 3 * count; index++) {
      const real = seedIndex(index, count)!
      expect(real).toBeGreaterThanOrEqual(0)
      expect(real).toBeLessThan(count)
      expect(seedIndex(index + count, count)).toBe(real)
      expect(seedIndex(index - count, count)).toBe(real)
      const centered = recenterSeedIndex(index, count)
      expect(centered).toBe(count === 1 ? 0 : count + real)
      expect(seedIndex(centered, count)).toBe(real)
      expect(seedIndex(centered + 1, count)).toBe(seedIndex(index + 1, count))
      expect(seedIndex(centered - 1, count)).toBe(seedIndex(index - 1, count))
    }
  })
  it('has no seed for an empty row', () => {
    expect(seedIndex(0, 0)).toBeNull()
    expect(recenterSeedIndex(0, 0)).toBe(0)
  })
})
