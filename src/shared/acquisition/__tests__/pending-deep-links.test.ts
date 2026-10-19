import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { INSTALL_MARKER_KEY } from '../install-scope'
import { PENDING_DEEP_LINK_KEY } from '../pending-deep-link'
import { ensureInstallScope, pendingDeepLinks } from '../pending-deep-links'

/**
 * GoGo-MobileApp#364 (Sol F-05, F-08) — the store and the install reset as the
 * app wires them, over the real `secure-store.ts`, with the native module made
 * to fail. The lenient read and delete that protect app start must not let a
 * sign-out or an install reset report a success that did not happen.
 */

/** The native module, failing on command. Values live here between calls. */
const { keychain, fail } = vi.hoisted(() => ({
  keychain: new Map<string, string>(),
  fail: { read: false, remove: false, removeSilently: false },
}))

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
  getItemAsync: async (key: string) => {
    if (fail.read) throw new Error('keychain read failed')
    return keychain.get(key) ?? null
  },
  setItemAsync: async (key: string, value: string) => {
    keychain.set(key, value)
  },
  deleteItemAsync: async (key: string) => {
    if (fail.remove) throw new Error('keychain delete failed')
    if (!fail.removeSilently) keychain.delete(key)
  },
}))

const SHARE = 'https://go-dev.gogo.id.vn/l/abc123'

beforeEach(async () => {
  keychain.clear()
  await AsyncStorage.clear()
  fail.read = fail.remove = fail.removeSilently = false
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('clear() at sign-out', () => {
  it('F-05: rejects when the delete fails and the check cannot read', async () => {
    await pendingDeepLinks.remember(SHARE)
    fail.remove = true
    fail.read = true
    await expect(pendingDeepLinks.clear()).rejects.toThrow()
    expect(keychain.has(PENDING_DEEP_LINK_KEY)).toBe(true)
  })

  it('F-05: rejects when the delete returns without deleting and the check cannot read', async () => {
    await pendingDeepLinks.remember(SHARE)
    fail.removeSilently = true
    fail.read = true
    await expect(pendingDeepLinks.clear()).rejects.toThrow()
    expect(keychain.has(PENDING_DEEP_LINK_KEY)).toBe(true)
  })

  it('resolves once the entry is really gone', async () => {
    await pendingDeepLinks.remember(SHARE)
    await expect(pendingDeepLinks.clear()).resolves.toBeUndefined()
    expect(keychain.has(PENDING_DEEP_LINK_KEY)).toBe(false)
  })
})

describe('install reset', () => {
  it('F-08: a delete that fails leaves the marker absent and rejects', async () => {
    keychain.set(PENDING_DEEP_LINK_KEY, JSON.stringify({ action: { kind: 'profile' }, storedAt: 1 }))
    fail.remove = true
    await expect(ensureInstallScope()).rejects.toThrow()
    expect(await AsyncStorage.getItem(INSTALL_MARKER_KEY)).toBeNull()
    expect(keychain.has(PENDING_DEEP_LINK_KEY)).toBe(true)
  })

  it('F-08: a delete that returns without deleting leaves the marker absent and rejects', async () => {
    keychain.set(PENDING_DEEP_LINK_KEY, JSON.stringify({ action: { kind: 'profile' }, storedAt: 1 }))
    fail.removeSilently = true
    await expect(ensureInstallScope()).rejects.toThrow()
    expect(await AsyncStorage.getItem(INSTALL_MARKER_KEY)).toBeNull()
  })

  it('writes the marker once both entries are verified gone', async () => {
    keychain.set(PENDING_DEEP_LINK_KEY, 'x')
    await expect(ensureInstallScope()).resolves.toBeUndefined()
    expect(await AsyncStorage.getItem(INSTALL_MARKER_KEY)).toBe('1')
    expect(keychain.size).toBe(0)
  })
})
