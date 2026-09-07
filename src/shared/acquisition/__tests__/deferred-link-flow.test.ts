import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDeferredLinkCollector } from '../deferred-link'
import { createPendingDeepLinkStore, PENDING_DEEP_LINK_TTL_MS } from '../pending-deep-link'

/**
 * LNK-APP-001 (#56) — collector and store together, which is where the
 * "deferred" in deferred deep link actually lives. Each half is unit-tested
 * apart; the property that matters is the seam between them surviving a
 * process restart and handing the link over exactly once.
 */

/** Stands in for the Keychain: survives a "restart", loses nothing else. */
function secureStorage() {
  const cells = new Map<string, string>()
  return {
    get: async (k: string) => cells.get(k) ?? null,
    set: async (k: string, v: string) => void cells.set(k, v),
    remove: async (k: string) => void cells.delete(k),
    /** A new store over the same bytes — a cold start. */
    cells,
  }
}

const CANONICAL = 'https://go-dev.gogo.id.vn/l/abc123'
const INVITE = 'https://go-dev.gogo.id.vn/r/CODE12345'

describe('deferred link, install to navigation', () => {
  let storage: ReturnType<typeof secureStorage>
  let now: number

  beforeEach(() => {
    storage = secureStorage()
    now = Date.parse('2026-09-07T12:00:00.000Z')
  })

  const store = () => createPendingDeepLinkStore({ storage, now: () => now })

  async function collectFrom(info: Record<string, unknown>) {
    await createDeferredLinkCollector({
      sdk: { getAttributionInfo: (ok) => ok(info) },
      store: store(),
    })()
  }

  it('survives a restart and is consumed exactly once', async () => {
    await collectFrom({ deferred_deeplink_url: CANONICAL })

    // Cold start: a different store instance over the same bytes.
    const first = await store().take()
    expect(first).toEqual({ kind: 'shareSlug', slug: 'abc123' })

    // Whatever raced the first read gets nothing — not the link a second time.
    expect(await store().take()).toBeNull()
    expect(await store().take()).toBeNull()
  })

  it('does not overwrite a link already waiting', async () => {
    // A real cold-start URL is the better signal and is handled by the normal
    // path; the SDK's report arrives afterwards and must not displace it.
    await store().remember(INVITE)
    await collectFrom({ deferred_deeplink_url: CANONICAL })

    expect(await store().take()).toEqual({ kind: 'invite', inviteCode: 'CODE12345' })
  })

  it('forgets an install that is no longer an intention', async () => {
    await collectFrom({ deferred_deeplink_url: CANONICAL })
    now += PENDING_DEEP_LINK_TTL_MS + 1
    expect(await store().take()).toBeNull()
  })

  it('stores nothing at all for an organic install', async () => {
    await collectFrom({})
    expect(storage.cells.size).toBe(0)
    expect(await store().take()).toBeNull()
  })

  it('keeps the raw URL out of storage — a slug is a credential', async () => {
    await collectFrom({ deferred_deeplink_url: INVITE })
    const written = [...storage.cells.values()].join('')
    expect(written).not.toContain('go-dev.gogo.id.vn')
    expect(written).toContain('CODE12345') // the parsed action, not the URL
    expect(written).not.toContain('https://')
  })

  it('a timeout leaves the store untouched and takeable later', async () => {
    // The emulator case: the SDK answers nothing. Whatever a cold start had
    // already stored must still be there.
    await store().remember(CANONICAL)
    await createDeferredLinkCollector({
      sdk: { getAttributionInfo: () => {} },
      store: store(),
      timeoutMs: 5,
    })()
    expect(await store().take()).toEqual({ kind: 'shareSlug', slug: 'abc123' })
  })
})
