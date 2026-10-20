import { afterEach, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#367 (PR #369 Astra F-01) — the Adjust wrapper builds a
 * NativeEventEmitter while it is imported. A build whose native side is
 * missing must lose Adjust, not the launch: the SDK is loaded only on the
 * guarded path, and a load that throws settles as unavailable.
 */

const extra: Record<string, unknown> = { tenjinAndroidSdkKey: 'key', adjustAndroidAppToken: 'abcdEFGH1234' }
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra, scheme: 'gogo-dev' } } } }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('react-native-tenjin', () => ({ default: {} }))
vi.mock('react-native-adjust', () => {
  throw new Error('Invariant Violation: `new NativeEventEmitter()` requires a non-null argument.')
})
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => false },
  ensureInstallScope: async () => {},
}))
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => async () => {} }))

afterEach(() => vi.restoreAllMocks())

it('a native module that fails to load costs Adjust, not the launch', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
  expect(() => initializeAcquisitionSdk()).not.toThrow()
  await expect(deferredLinkSettled()).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith('acquisition_adjust_unavailable')
})
