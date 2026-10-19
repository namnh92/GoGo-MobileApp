import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#364 (Sol F-08) — the bootstrap's chain: install reset, then
 * collection, and `settled` resolving either way. A failed reset must stop the
 * collector from writing into a previous install's state, and must be
 * readable by the resume once `settled` has resolved.
 */

const extra: Record<string, unknown> = { tenjinAndroidSdkKey: 'key' }
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra } } } }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('react-native-tenjin', () => ({ default: {} }))

const scope = { outcome: () => Promise.resolve() }
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: {},
  ensureInstallScope: () => scope.outcome(),
}))

const collect = vi.fn(async () => {})
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => collect }))

afterEach(() => {
  collect.mockClear()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('acquisition bootstrap', () => {
  it('F-08: a failed install reset collects nothing and is readable after settled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.reject(new Error('keychain delete failed'))
    const { deferredLinkSettled, initializeAcquisitionSdk, installScoped } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await expect(deferredLinkSettled()).resolves.toBeUndefined()
    expect(collect).not.toHaveBeenCalled()
    expect(installScoped()).toBe(false)
    expect(warn).toHaveBeenCalledWith('deferred_link_install_scope_failed')
  })

  it('collects after a successful reset', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.resolve()
    const { deferredLinkSettled, initializeAcquisitionSdk, installScoped } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await deferredLinkSettled()
    expect(collect).toHaveBeenCalledTimes(1)
    expect(installScoped()).toBe(true)
  })
})
