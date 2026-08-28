import { describe, expect, it } from 'vitest'

import { shouldPersistQuery } from '../persist-policy'
import { queryKeys } from '../query-keys'

/**
 * APP-007: "plan đọc được khi mạng chập chờn". What survives a restart is
 * decided entirely by this predicate, so the policy needs pinning — both halves
 * of it. Persisting too little breaks the active date on a bad connection;
 * persisting too much shows stale search results as if they were fresh, and
 * keeps another member's room data on the device longer than it should be.
 */
describe('shouldPersistQuery', () => {
  it('keeps the plan the active date runs on', () => {
    expect(shouldPersistQuery(queryKeys.plan('plan-1'))).toBe(true)
  })

  it('keeps the room and its members, so the lobby reads offline', () => {
    expect(shouldPersistQuery(queryKeys.room('room-1'))).toBe(true)
    expect(shouldPersistQuery(queryKeys.roomMembers('room-1'))).toBe(true)
  })

  it('keeps the place summaries a plan stop points at', () => {
    expect(shouldPersistQuery(queryKeys.place('place-1'))).toBe(true)
  })

  it('keeps the signed-in profile and saved list', () => {
    expect(shouldPersistQuery(queryKeys.me())).toBe(true)
    expect(shouldPersistQuery(queryKeys.saved())).toBe(true)
  })

  it('drops place search — a stale hit is worse than a spinner', () => {
    // The real shape, taken from queryKeys.placeSearch. An earlier version of
    // this test invented `['places','list','search',…]`, which made a predicate
    // that read the wrong index look correct; the device cache showed search
    // results being persisted anyway.
    expect(shouldPersistQuery(queryKeys.placeSearch({ q: 'cafe' } as never))).toBe(false)
    expect(shouldPersistQuery(['places', 'search', { q: 'cafe' }])).toBe(false)
  })

  it('drops anything outside the allowed roots', () => {
    expect(shouldPersistQuery(['suggestions', 'room-1'])).toBe(false)
    expect(shouldPersistQuery(['taxonomies'])).toBe(false)
    expect(shouldPersistQuery(['notifications'])).toBe(false)
  })

  it('ignores a key whose root is not a string rather than persisting it', () => {
    expect(shouldPersistQuery([{ weird: true }, 'x'])).toBe(false)
    expect(shouldPersistQuery([])).toBe(false)
  })
})
