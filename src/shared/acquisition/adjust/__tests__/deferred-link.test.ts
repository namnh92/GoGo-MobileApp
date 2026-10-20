import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDeferredLinkCollector } from '../../deferred-link'
import { createPendingDeepLinkStore } from '../../pending-deep-link'
import { createDeferredLinkResume } from '../../resume'
import { ADJUST_WINDOW_MS, createAdjustDeferredLinkSink } from '../deferred-link'

/**
 * GoGo-MobileApp#367 — Adjust as the second writer (shape D2, U-2…U-5, U-10):
 * both callback shapes, the store's gate, one launch window, first writer
 * wins, and `settled` for the resume.
 */

const SHARE = 'https://go-dev.gogo.id.vn/l/abc123'

function storage() {
  const cells = new Map<string, string>()
  return {
    get: async (k: string) => cells.get(k) ?? null,
    set: async (k: string, v: string) => void cells.set(k, v),
    remove: async (k: string) => void cells.delete(k),
  }
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

afterEach(() => vi.useRealTimers())

describe('Adjust deferred-link sink', () => {
  it.each([[SHARE], [{ deeplink: SHARE }]])('stores a GoGo link from either callback shape (%#)', async payload => {
    const store = createPendingDeepLinkStore({ storage: storage() })
    const sink = createAdjustDeferredLinkSink({ store, windowMs: 1_000 })
    sink.onDeferredLink(payload)
    await sink.settled()
    expect(await store.take()).toEqual({ kind: 'shareSlug', slug: 'abc123' })
  })

  it('drops what is not a GoGo link, and an unreadable payload', async () => {
    const events: string[] = []
    const store = createPendingDeepLinkStore({ storage: storage(), report: e => events.push(e) })
    const sink = createAdjustDeferredLinkSink({ store, windowMs: 1_000, report: e => events.push(e) })
    sink.onDeferredLink({ deeplink: 'https://app.adjust.com/abc123?adj_t=x' })
    await sink.settled()
    expect(await store.take()).toBeNull()

    const other = createAdjustDeferredLinkSink({ store, windowMs: 1_000, report: e => events.push(e) })
    other.onDeferredLink({ nothing: true })
    await other.settled()
    expect(events).toContain('deferred_link_discarded:unparseable:adjust')
  })

  it('U-10: the window is 70 s on iOS and 10 s on Android', () => {
    expect(ADJUST_WINDOW_MS).toEqual({ ios: 70_000, android: 10_000 })
  })

  it('settles at the end of the window, and a report after it is late', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const store = createPendingDeepLinkStore({ storage: storage() })
    const sink = createAdjustDeferredLinkSink({ store, windowMs: 10_000, report: e => events.push(e) })
    let settled = false
    void sink.settled().then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    sink.onDeferredLink(SHARE)
    await flush()
    expect(events).toEqual(['acquisition_adjust_window_ended', 'deferred_link_ignored:late:adjust'])
    expect(await store.take()).toBeNull()
  })

  it('an attribution with no link settles after the grace; a link inside the grace still lands', async () => {
    vi.useFakeTimers()
    const store = createPendingDeepLinkStore({ storage: storage() })
    const quiet = createAdjustDeferredLinkSink({ store, windowMs: 70_000, graceMs: 2_000 })
    let settled = false
    void quiet.settled().then(() => { settled = true })
    quiet.onAttribution()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)

    const late = createAdjustDeferredLinkSink({ store, windowMs: 70_000, graceMs: 2_000 })
    late.onAttribution()
    await vi.advanceTimersByTimeAsync(1_000)
    late.onDeferredLink(SHARE)
    await vi.advanceTimersByTimeAsync(0)
    await late.settled()
    expect(await store.take()).toEqual({ kind: 'shareSlug', slug: 'abc123' })
  })

  it('a second report in the same launch is late', async () => {
    const events: string[] = []
    const store = createPendingDeepLinkStore({ storage: storage() })
    const sink = createAdjustDeferredLinkSink({ store, windowMs: 1_000, report: e => events.push(e) })
    sink.onDeferredLink(SHARE)
    sink.onDeferredLink('https://go-dev.gogo.id.vn/l/def456')
    await sink.settled()
    expect(events).toContain('deferred_link_ignored:late:adjust')
    expect(await store.take()).toEqual({ kind: 'shareSlug', slug: 'abc123' })
  })

  it('U-5: Tenjin first, Adjust second — first writer wins, the resume opens once', async () => {
    const shared = storage()
    const store = createPendingDeepLinkStore({ storage: shared })
    await createDeferredLinkCollector({
      sdk: { getAttributionInfo: ok => ok({ deferred_deeplink_url: SHARE }) },
      store,
    })()
    const sink = createAdjustDeferredLinkSink({ store, windowMs: 1_000 })
    sink.onDeferredLink({ deeplink: 'https://go-dev.gogo.id.vn/l/def456' })
    const opened: unknown[] = []
    await createDeferredLinkResume({
      store,
      settled: () => sink.settled(),
      initialUrl: async () => null,
      open: action => opened.push(action),
    })()
    expect(opened).toEqual([{ kind: 'shareSlug', slug: 'abc123' }])
  })

  it('skip() settles at once', async () => {
    const sink = createAdjustDeferredLinkSink({ store: { remember: async () => true }, windowMs: 70_000 })
    sink.skip('acquisition_adjust_off')
    await expect(sink.settled()).resolves.toBeUndefined()
  })

  it('reports reason codes only, never the link', async () => {
    const events: string[] = []
    const store = createPendingDeepLinkStore({ storage: storage(), report: e => events.push(e) })
    const sink = createAdjustDeferredLinkSink({ store, windowMs: 1_000, report: e => events.push(e) })
    sink.onDeferredLink(SHARE)
    await sink.settled()
    sink.onDeferredLink(SHARE)
    for (const event of events) expect(event).not.toContain('abc123')
  })
})
