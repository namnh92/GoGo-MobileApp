import { describe, expect, it } from 'vitest'

import type { DeepLinkAction } from '@/shared/navigation/deep-link'

import { createInstallScope, INSTALL_MARKER_KEY } from '../install-scope'
import { createPendingDeepLinkStore, PENDING_DEEP_LINK_KEY } from '../pending-deep-link'
import { createDeferredLinkResume } from '../resume'

/**
 * GoGo-MobileApp#364 (Sol F-06) — the iOS Keychain survives an uninstall, app
 * storage does not. Two maps stand in for them across a simulated reinstall.
 */

const A = 'https://go-dev.gogo.id.vn/l/aaaa1111'
const B = 'https://go-dev.gogo.id.vn/l/bbbb2222'

function map() {
  const cells = new Map<string, string>()
  return {
    get: async (k: string) => cells.get(k) ?? null,
    set: async (k: string, v: string) => void cells.set(k, v),
    remove: async (k: string) => void cells.delete(k),
    cells,
  }
}

async function openedAfter(keychain: ReturnType<typeof map>, app: ReturnType<typeof map>, link: string) {
  await createInstallScope({ secure: keychain, app })()
  const store = createPendingDeepLinkStore({ storage: keychain })
  const stored = await store.remember(link)
  const opened: DeepLinkAction[] = []
  await createDeferredLinkResume({
    store,
    settled: async () => {},
    initialUrl: async () => null,
    open: (action) => opened.push(action),
  })()
  return { stored, opened }
}

/** First install: link A collected but never opened (pending), then A opened on a later launch. */
async function previousInstall() {
  const keychain = map()
  const app = map()
  await openedAfter(keychain, app, A)
  await createPendingDeepLinkStore({ storage: keychain }).remember(B)
  // Uninstall: app storage is gone, the Keychain is not.
  return keychain
}

describe('install scope', () => {
  it('a reinstall from the same invite opens it again', async () => {
    const keychain = await previousInstall()
    const { opened } = await openedAfter(keychain, map(), A)
    expect(opened).toEqual([{ kind: 'shareSlug', slug: 'aaaa1111' }])
  })

  it('a reinstall from a new invite is not blocked by the old pending link', async () => {
    const keychain = await previousInstall()
    const { stored, opened } = await openedAfter(keychain, map(), 'https://go-dev.gogo.id.vn/l/cccc3333')
    expect(stored).toBe(true)
    expect(opened).toEqual([{ kind: 'shareSlug', slug: 'cccc3333' }])
  })

  it('an ordinary launch keeps what is pending', async () => {
    const keychain = map()
    const app = map()
    await createInstallScope({ secure: keychain, app })()
    await createPendingDeepLinkStore({ storage: keychain }).remember(A)
    await createInstallScope({ secure: keychain, app })()
    expect(keychain.cells.has(PENDING_DEEP_LINK_KEY)).toBe(true)
    expect(app.cells.get(INSTALL_MARKER_KEY)).toBeDefined()
  })
})
