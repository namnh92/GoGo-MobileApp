import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#370 (AC-2, shape D3) — the regression: on Android no MMP SDK
 * is touched until the person has answered. Nothing about the consent module
 * is faked here: an empty device, the real gate-less bootstrap, and fakes that
 * only record what reached the vendors.
 */

const calls = vi.hoisted(() => [] as string[])
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { tenjinAndroidSdkKey: 'key', adjustAndroidAppToken: 'abcdEFGH1234', flavor: 'dev' }, scheme: 'gogo-dev' } },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { Adjust: {} } }))
vi.mock('expo-tracking-transparency', () => ({ isAvailable: () => true }))
vi.mock('react-native-tenjin', () => ({
  default: {
    initialize: () => calls.push('tenjin.initialize'),
    setAppStore: () => calls.push('tenjin.setAppStore'),
    optIn: () => calls.push('tenjin.optIn'),
    connect: () => calls.push('tenjin.connect'),
    getAttributionInfo: () => calls.push('tenjin.getAttributionInfo'),
  },
}))
vi.mock('react-native-adjust', () => {
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    disableDeferredDeeplinkOpening() {}
    setAttConsentWaitingInterval() {}
    setDeferredDeeplinkCallback() {}
    setAttributionCallback() {}
  }
  return { Adjust: { initSdk: () => calls.push('adjust.initSdk'), enable: () => calls.push('adjust.enable') }, AdjustConfig }
})

afterEach(() => {
  calls.length = 0
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('Android: nothing reaches a vendor before the answer', () => {
  it('a launch with no answer starts no SDK', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(calls).toEqual([])
  })
})
