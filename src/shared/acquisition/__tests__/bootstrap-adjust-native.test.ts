import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#367 (PR #369 Astra F-01) — a token-enabled build whose Adjust
 * native side is missing must not evaluate the wrapper at all. The wrapper
 * builds a NativeEventEmitter while it is evaluated, and Metro reports an
 * evaluation error through `ErrorUtils.reportFatalError` before the importing
 * `catch` runs (metro-runtime `guardedLoadModule`): in a release build, a
 * crash. The fake wrapper below does what Metro would — reports fatally and
 * hands back a module anyway — so the assertion is that it was never reached.
 */

const extra: Record<string, unknown> = {
  tenjinAndroidSdkKey: 'key',
  tenjinIosSdkKey: 'key',
  adjustAndroidAppToken: 'abcdEFGH1234',
  adjustIosAppToken: 'abcdEFGH1234',
}
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra, scheme: 'gogo-dev' } } } }))
const native = vi.hoisted(() => ({ os: 'ios', modules: {} as Record<string, unknown> }))
vi.mock('react-native', () => ({
  Platform: { get OS() { return native.os } },
  get NativeModules() { return native.modules },
}))
vi.mock('react-native-tenjin', () => ({ default: {} }))
const fatal = vi.hoisted(() => ({ reports: 0, evaluated: 0, initSdk: vi.fn() }))
vi.mock('react-native-adjust', () => {
  fatal.evaluated += 1
  const metro = (globalThis as { ErrorUtils?: { reportFatalError(error: unknown): void } }).ErrorUtils
  metro?.reportFatalError(new Error('Invariant Violation: `new NativeEventEmitter()` requires a non-null argument.'))
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    disableDeferredDeeplinkOpening() {}
    setAttConsentWaitingInterval() {}
    setDeferredDeeplinkCallback() {}
    setAttributionCallback() {}
  }
  return { Adjust: { initSdk: fatal.initSdk }, AdjustConfig }
})
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => false, onStored: () => () => {} },
  ensureInstallScope: async () => {},
}))
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => async () => {} }))

;(globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
  reportFatalError: () => {
    fatal.reports += 1
  },
}

afterEach(() => {
  fatal.reports = 0
  fatal.evaluated = 0
  fatal.initSdk.mockClear()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('Adjust native preflight (Astra F-01)', () => {
  it.each([
    ['ios without the event emitter', 'ios', { Adjust: {} }],
    ['ios without any Adjust module', 'ios', {}],
    ['android without the Adjust module', 'android', {}],
  ])('%s: the wrapper is never evaluated, Adjust is unavailable, the launch goes on', async (_label, os, modules) => {
    native.os = os
    native.modules = modules
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    expect(() => initializeAcquisitionSdk()).not.toThrow()
    // The first definitive sign: the wrapper was reached (evaluated, or a
    // cached copy's `initSdk` called), or Adjust gave up. Then judge.
    const unavailable = () => warn.mock.calls.some(([event]) => event === 'acquisition_adjust_unavailable')
    await vi.waitFor(() => {
      expect(fatal.evaluated > 0 || fatal.initSdk.mock.calls.length > 0 || unavailable()).toBe(true)
    })
    expect(fatal.evaluated, 'wrapper evaluated').toBe(0)
    expect(fatal.reports, 'Metro reported a fatal evaluation error').toBe(0)
    expect(fatal.initSdk).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('acquisition_adjust_unavailable:native_missing')
    await expect(deferredLinkSettled()).resolves.toBeUndefined()
  })

  it.each([
    ['ios', { Adjust: {}, AdjustEventEmitter: {} }],
    ['android', { Adjust: {} }],
  ])('%s with its native modules present: the wrapper loads and the SDK starts', async (os, modules) => {
    native.os = os
    native.modules = modules
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    // The import is loaded off the settle chain (F-06), so it is waited for here.
    // (`initSdk` proves the wrapper was reached; vitest keeps a mocked module
    // across `resetModules`, so its evaluation count is not re-asserted here.)
    await vi.waitFor(() => expect(fatal.initSdk).toHaveBeenCalledTimes(1))
    expect(warn).not.toHaveBeenCalledWith('acquisition_adjust_unavailable:native_missing')
  })
})
