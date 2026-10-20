import { afterEach, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#367 (PR #369 Astra F-01) — the second line: the native
 * preflight (`bootstrap-adjust-native.test.ts`) passed, and the wrapper still
 * fails to load (a rejected split-bundle fetch, an evaluation error Metro did
 * not report). That must cost Adjust, not the launch: the SDK is loaded only
 * on the guarded path, and a load that rejects settles as unavailable.
 */

const extra: Record<string, unknown> = { tenjinAndroidSdkKey: 'key', adjustAndroidAppToken: 'abcdEFGH1234' }
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra, scheme: 'gogo-dev' } } } }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { Adjust: {} } }))
vi.mock('react-native-tenjin', () => ({ default: {} }))
vi.mock('react-native-adjust', () => {
  throw new Error('Invariant Violation: `new NativeEventEmitter()` requires a non-null argument.')
})
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => false, onStored: () => () => {} },
  ensureInstallScope: async () => {},
}))
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => async () => {} }))

afterEach(() => vi.restoreAllMocks())

it('a wrapper that fails to load costs Adjust, not the launch', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
  expect(() => initializeAcquisitionSdk()).not.toThrow()
  await expect(deferredLinkSettled()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith('acquisition_adjust_unavailable')
})
