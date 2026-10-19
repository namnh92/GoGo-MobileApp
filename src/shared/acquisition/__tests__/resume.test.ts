import { describe, expect, it } from 'vitest'

import type { DeepLinkAction } from '@/shared/navigation/deep-link'

import { createDeferredLinkCollector } from '../deferred-link'
import { createPendingDeepLinkStore, PENDING_DEEP_LINK_TTL_MS } from '../pending-deep-link'
import { createDeferredLinkResume } from '../resume'

/**
 * GoGo-MobileApp#364 (MMP-APP-002) — the store had a writer and no reader, so
 * a deferred link was collected and never opened. These cases pin the reader
 * against the real store, the way the app wires it.
 */

const SHARE = 'https://go-dev.gogo.id.vn/l/abc123'

function secureStorage() {
  const cells = new Map<string, string>()
  return {
    get: async (k: string) => cells.get(k) ?? null,
    set: async (k: string, v: string) => void cells.set(k, v),
    remove: async (k: string) => void cells.delete(k),
  }
}

function harness(opts: { initialUrl?: string | null; now?: () => number } = {}) {
  const storage = secureStorage()
  const events: string[] = []
  const store = createPendingDeepLinkStore({ storage, now: opts.now, report: (e) => events.push(e) })
  const opened: DeepLinkAction[] = []
  const resume = () =>
    createDeferredLinkResume({
      store,
      settled: async () => {},
      initialUrl: async () => opts.initialUrl ?? null,
      open: (action) => opened.push(action),
      report: (e) => events.push(e),
    })
  return { storage, store, events, opened, resume }
}

describe('deferred link resume', () => {
  it('AC-B1: opens a pending link once, and a second ready in the same process opens nothing', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    const resume = h.resume()
    await resume()
    await resume()
    expect(h.opened).toEqual([{ kind: 'shareSlug', slug: 'abc123' }])
  })

  it('waits for this launch’s report before taking', async () => {
    const h = harness()
    let release!: () => void
    const report = new Promise<void>((r) => (release = r))
    const resume = createDeferredLinkResume({
      store: h.store,
      settled: () => report,
      initialUrl: async () => null,
      open: (action) => h.opened.push(action),
    })
    const running = resume()
    // The SDK answers after the session is already ready.
    await h.store.remember(SHARE)
    release()
    await running
    expect(h.opened).toEqual([{ kind: 'shareSlug', slug: 'abc123' }])
  })

  it('AC-B2: a launch URL wins — the pending entry is consumed, not routed on top', async () => {
    const h = harness({ initialUrl: 'https://go-dev.gogo.id.vn/r/CODE12345' })
    await h.store.remember(SHARE)
    await h.resume()()
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_skipped:cold_start_url')
    expect(await h.store.take()).toBeNull()
  })

  it('AC-B2: a scheme invite launch also wins (the native-intent rewrite applies)', async () => {
    const h = harness({ initialUrl: 'gogo-dev://room/CODE12345' })
    await h.store.remember(SHARE)
    await h.resume()()
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_skipped:cold_start_url')
  })

  it('a launch URL that is not ours does not suppress the deferred link', async () => {
    const h = harness({ initialUrl: 'exp+gogo://expo-development-client/?url=x' })
    await h.store.remember(SHARE)
    await h.resume()()
    expect(h.opened).toHaveLength(1)
  })

  it('AC-B4: an expired entry is dropped and nothing navigates', async () => {
    let clock = 1_000_000
    const h = harness({ now: () => clock })
    await h.store.remember(SHARE)
    clock += PENDING_DEEP_LINK_TTL_MS + 1
    await h.resume()()
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_expired')
  })

  it('the same report on the next launch is not opened again', async () => {
    // The attribution SDK answers with the install's attribution every time it
    // is asked. Each launch below is a new process over the same storage.
    const storage = secureStorage()
    const opened: DeepLinkAction[] = []
    for (let launch = 0; launch < 3; launch++) {
      const store = createPendingDeepLinkStore({ storage })
      await createDeferredLinkCollector({
        sdk: { getAttributionInfo: (ok) => ok({ deferred_deeplink_url: SHARE }) },
        store,
      })()
      await createDeferredLinkResume({
        store,
        settled: async () => {},
        initialUrl: async () => null,
        open: (action) => opened.push(action),
      })()
    }
    expect(opened).toEqual([{ kind: 'shareSlug', slug: 'abc123' }])
  })

  it('a different link after the first one was used is still opened', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    await h.resume()()
    await h.store.remember('https://go-dev.gogo.id.vn/l/def456')
    await h.resume()()
    expect(h.opened).toEqual([
      { kind: 'shareSlug', slug: 'abc123' },
      { kind: 'shareSlug', slug: 'def456' },
    ])
  })

  it('AC-B3: after clear() at sign-out the pending link never reaches the next person', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    await h.store.clear()
    await h.resume()()
    expect(h.opened).toEqual([])
  })

  it('F-02: a queued notification tap owns the launch — the link is consumed, not opened', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    await createDeferredLinkResume({
      store: h.store,
      settled: async () => {},
      initialUrl: async () => null,
      open: (action) => h.opened.push(action),
      launchClaimed: () => true,
      report: (e) => h.events.push(e),
    })()
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_skipped:push_launch')
    expect(await h.store.take()).toBeNull()
  })

  it('F-03: a link retired at sign-out is not brought back by the next launch’s repeat report', async () => {
    const storage = secureStorage()
    const events: string[] = []
    const collect = (store: ReturnType<typeof createPendingDeepLinkStore>) =>
      createDeferredLinkCollector({
        sdk: { getAttributionInfo: (ok) => ok({ deferred_deeplink_url: SHARE }) },
        store,
      })()
    const first = createPendingDeepLinkStore({ storage })
    await collect(first)
    await first.clear()
    // Next launch: a new process over the same storage, same report.
    const next = createPendingDeepLinkStore({ storage, report: (e) => events.push(e) })
    await collect(next)
    const opened: DeepLinkAction[] = []
    await createDeferredLinkResume({
      store: next,
      settled: async () => {},
      initialUrl: async () => null,
      open: (action) => opened.push(action),
    })()
    expect(opened).toEqual([])
    expect(events).toContain('deferred_link_ignored:already_consumed')
  })

  it('F-04: a sign-out during the wait stands the run down, and the next session resumes', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    let key: string | null = 'user:A'
    let release!: () => void
    let wait = new Promise<void>((r) => (release = r))
    const resume = createDeferredLinkResume({
      store: h.store,
      settled: () => wait,
      initialUrl: async () => null,
      open: (action) => h.opened.push(action),
      sessionKey: () => key,
      report: (e) => h.events.push(e),
    })
    const running = resume()
    key = null
    release()
    await running
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_skipped:session_changed')

    key = 'user:B'
    wait = Promise.resolve()
    await resume()
    expect(h.opened).toEqual([{ kind: 'shareSlug', slug: 'abc123' }])
    await resume()
    expect(h.opened).toHaveLength(1)
  })

  it('F-04: a session that changes after the link was taken drops it', async () => {
    let key: string | null = 'user:A'
    const opened: DeepLinkAction[] = []
    const events: string[] = []
    await createDeferredLinkResume({
      store: {
        take: async () => {
          key = 'user:B'
          return { kind: 'shareSlug', slug: 'abc123' }
        },
      },
      settled: async () => {},
      initialUrl: async () => null,
      open: (action) => opened.push(action),
      sessionKey: () => key,
      report: (e) => events.push(e),
    })()
    expect(opened).toEqual([])
    expect(events).toContain('deferred_link_dropped:session_changed')
  })

  it('F-04: a session that becomes ready during another run’s wait gets its own run', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    let key: string | null = 'user:A'
    let release!: () => void
    const wait = new Promise<void>((r) => (release = r))
    const resume = createDeferredLinkResume({
      store: h.store,
      settled: () => wait,
      initialUrl: async () => null,
      open: (action) => h.opened.push(action),
      sessionKey: () => key,
      report: (e) => h.events.push(e),
    })
    const first = resume()
    // A signs out and B signs in before the report settles: B's ready session
    // asks while A's run still holds the latch.
    key = 'user:B'
    const second = resume()
    release()
    await Promise.all([first, second])
    expect(h.events).toContain('deferred_link_skipped:session_changed')
    expect(h.opened).toEqual([{ kind: 'shareSlug', slug: 'abc123' }])
    await resume()
    expect(h.opened).toHaveLength(1)
  })

  it('F-04: a session that changes while the launch URL is read drops the link', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    let key: string | null = 'user:A'
    await createDeferredLinkResume({
      store: h.store,
      settled: async () => {},
      initialUrl: async () => {
        key = null
        return null
      },
      open: (action) => h.opened.push(action),
      sessionKey: () => key,
      report: (e) => h.events.push(e),
    })()
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_dropped:session_changed')
  })

  it('F-08: a failed install reset leaves the store alone and opens nothing', async () => {
    const h = harness()
    await h.store.remember(SHARE)
    await createDeferredLinkResume({
      store: h.store,
      settled: async () => {},
      initialUrl: async () => null,
      open: (action) => h.opened.push(action),
      installScoped: () => false,
      report: (e) => h.events.push(e),
    })()
    expect(h.opened).toEqual([])
    expect(h.events).toContain('deferred_link_skipped:install_scope_failed')
    // Not taken: the next launch's reset decides what happens to it.
    expect(await h.store.take()).toEqual({ kind: 'shareSlug', slug: 'abc123' })
  })

  it('never throws into the launch', async () => {
    const events: string[] = []
    const resume = createDeferredLinkResume({
      store: { take: async () => { throw new Error('keychain locked') } },
      settled: async () => {},
      initialUrl: async () => null,
      open: () => { throw new Error('unreachable') },
      report: (e) => events.push(e),
    })
    await expect(resume()).resolves.toBeUndefined()
    expect(events).toEqual(['deferred_link_resume_failed'])
  })

  it('reports reason codes only, never the link', async () => {
    const h = harness({ initialUrl: SHARE })
    await h.store.remember(SHARE)
    await h.resume()()
    for (const e of h.events) expect(e).not.toContain('abc123')
  })
})
