import { describe, expect, it } from 'vitest'

import {
  PENDING_DEEP_LINK_KEY,
  PENDING_DEEP_LINK_TTL_MS,
  createPendingDeepLinkStore,
  type PendingDeepLinkStorage,
} from '../pending-deep-link'

const PLACE_A = '11111111-1111-4111-8111-111111111111'
const PLACE_B = '22222222-2222-4222-8222-222222222222'
const PLAN = '33333333-3333-4333-8333-333333333333'

function memoryStorage(): PendingDeepLinkStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>()
  return {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  }
}

describe('deferred deep link survives the install and resumes once', () => {
  it('stores a link the SDK reported after install, and resumes it', async () => {
    const storage = memoryStorage()
    const store = createPendingDeepLinkStore({ storage })
    expect(await store.remember(`https://go-dev.gogo.id.vn/places/${PLACE_A}`)).toBe(true)
    expect(await store.take()).toEqual({ kind: 'place', placeId: PLACE_A })
  })

  it('resumes exactly once — a second reader gets nothing', async () => {
    // The race this prevents: a resume firing while cold-start navigation is
    // still settling, and the user being sent to the same screen twice.
    const storage = memoryStorage()
    const store = createPendingDeepLinkStore({ storage })
    await store.remember(`gogo-dev://plan/${PLAN}`)
    expect(await store.take()).toEqual({ kind: 'plan', planId: PLAN })
    expect(await store.take()).toBeNull()
    expect(storage.dump()).toEqual({})
  })

  it('first writer wins: a second report does not overwrite a pending one', async () => {
    const storage = memoryStorage()
    const events: string[] = []
    const store = createPendingDeepLinkStore({ storage, report: (e) => events.push(e) })
    await store.remember(`gogo-dev://place/${PLACE_A}`)
    expect(await store.remember(`gogo-dev://place/${PLACE_B}`)).toBe(false)
    expect(await store.take()).toEqual({ kind: 'place', placeId: PLACE_A })
    expect(events).toContain('deferred_link_ignored:already_pending')
  })

  it('discards an unroutable URL instead of storing something that always fails', async () => {
    const storage = memoryStorage()
    const store = createPendingDeepLinkStore({ storage })
    for (const bad of ['', null, undefined, 'not a url', 'gogo-dev://nonsense/x/y/z', 'gogo-dev://place/not-a-uuid']) {
      expect(await store.remember(bad)).toBe(false)
    }
    expect(storage.dump()).toEqual({})
  })

  it('expires: an install attributed last week is history, not an intention', async () => {
    const storage = memoryStorage()
    let clock = 1_000_000
    const events: string[] = []
    const store = createPendingDeepLinkStore({
      storage,
      now: () => clock,
      report: (e) => events.push(e),
    })
    await store.remember(`gogo-dev://place/${PLACE_A}`)
    clock += PENDING_DEEP_LINK_TTL_MS + 1
    expect(await store.take()).toBeNull()
    expect(events).toContain('deferred_link_expired')
    expect(storage.dump()).toEqual({})
  })

  it('resumes right up to the deadline', async () => {
    const storage = memoryStorage()
    let clock = 1_000_000
    const store = createPendingDeepLinkStore({ storage, now: () => clock })
    await store.remember(`gogo-dev://place/${PLACE_A}`)
    clock += PENDING_DEEP_LINK_TTL_MS
    expect(await store.take()).toEqual({ kind: 'place', placeId: PLACE_A })
  })

  it('clears unreadable storage rather than failing on it forever', async () => {
    const storage = memoryStorage()
    await storage.set(PENDING_DEEP_LINK_KEY, '{ not json')
    const store = createPendingDeepLinkStore({ storage })
    expect(await store.take()).toBeNull()
    expect(storage.dump()).toEqual({})
  })

  it('stores the parsed action, never the raw URL — a ROOM_INVITE slug is a credential', async () => {
    const storage = memoryStorage()
    const store = createPendingDeepLinkStore({ storage })
    await store.remember('https://go-dev.gogo.id.vn/l/Af82XcAf82XcAf82XcAf82')
    const raw = storage.dump()[PENDING_DEEP_LINK_KEY]!
    expect(raw).not.toContain('https://')
    expect(JSON.parse(raw).action).toEqual({ kind: 'shareSlug', slug: 'Af82XcAf82XcAf82XcAf82' })
  })

  it('reports reason codes only, never the link itself', async () => {
    const storage = memoryStorage()
    const events: string[] = []
    const store = createPendingDeepLinkStore({ storage, report: (e) => events.push(e) })
    await store.remember('https://go-dev.gogo.id.vn/l/Af82XcAf82XcAf82XcAf82')
    await store.take()
    for (const e of events) expect(e).not.toContain('Af82Xc')
  })

  it('clear() drops another person’s pending intent at sign-out', async () => {
    const storage = memoryStorage()
    const store = createPendingDeepLinkStore({ storage })
    await store.remember(`gogo-dev://plan/${PLAN}`)
    await store.clear()
    expect(await store.take()).toBeNull()
  })
})
