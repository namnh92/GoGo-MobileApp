import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#404 (ADR 0014, shape D9, R-01) — the regression: on Android
 * both SDKs start at launch and the advertising ID stays back until a yes. An
 * empty or stored device, the real bootstrap and consent modules, and fakes
 * that only record what reached the vendors.
 *
 * The trace is asserted after a deadline, never after the bootstrap settles: on
 * the build this replaces, the bootstrap waits for an answer that never comes,
 * and the test has to fail on its assertion, not time out.
 */

const state = vi.hoisted(() => ({
  tenjin: [] as string[],
  adjust: [] as string[],
  config: [] as string[],
  disk: new Map<string, string>(),
}))
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { tenjinAndroidSdkKey: 'key', adjustAndroidAppToken: 'abcdEFGH1234', flavor: 'dev' }, scheme: 'gogo-dev' } },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { Adjust: {} } }))
vi.mock('expo-tracking-transparency', () => ({ isAvailable: () => true }))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => state.disk.get(key) ?? null,
    setItem: async (key: string, value: string) => void state.disk.set(key, value),
    removeItem: async (key: string) => void state.disk.delete(key),
  },
}))
vi.mock('react-native-tenjin', () => ({
  default: {
    initialize: () => state.tenjin.push('initialize'),
    setAppStore: () => state.tenjin.push('setAppStore'),
    optIn: () => state.tenjin.push('optIn'),
    optOut: () => state.tenjin.push('optOut'),
    optOutParams: (params: string[]) => state.tenjin.push(`optOutParams(${params.join(',')})`),
    connect: () => state.tenjin.push('connect'),
    getAttributionInfo: () => state.tenjin.push('getAttributionInfo'),
  },
}))
vi.mock('react-native-adjust', () => {
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    disableDeferredDeeplinkOpening() { state.config.push('disableDeferredDeeplinkOpening') }
    setAttConsentWaitingInterval() { state.config.push('setAttConsentWaitingInterval') }
    setDeferredDeeplinkCallback() { state.config.push('setDeferredDeeplinkCallback') }
    setAttributionCallback() { state.config.push('setAttributionCallback') }
    disableAndroidIdReading() { state.config.push('disableAndroidIdReading') }
    disableGoogleAdIdReading() { state.config.push('disableGoogleAdIdReading') }
  }
  return {
    Adjust: {
      initSdk: () => state.adjust.push('initSdk'),
      enable: () => state.adjust.push('enable'),
      disable: () => state.adjust.push('disable'),
    },
    AdjustConfig,
  }
})
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => false, onStored: () => () => {}, remember: async () => true },
  ensureInstallScope: async () => {},
}))

const KEY = 'gogo.consent.tracking.v1'
const EXISTING_CONFIG = [
  'disableDeferredDeeplinkOpening',
  'setAttConsentWaitingInterval',
  'setDeferredDeeplinkCallback',
  'setAttributionCallback',
]

/** Long enough for every start; independent of whether the bootstrap settled. */
const observe = () => new Promise(resolve => setTimeout(resolve, 100))

afterEach(() => {
  state.tenjin.length = 0
  state.adjust.length = 0
  state.config.length = 0
  state.disk.clear()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('Android starts both SDKs at launch', () => {
  it('no answer: everything starts, without the advertising ID, and nothing follows', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await observe()
    expect(state.tenjin).toEqual([
      'initialize',
      'setAppStore',
      'optIn',
      'optOutParams(advertising_id,ad_id_local)',
      'connect',
      'getAttributionInfo',
    ])
    expect(state.adjust).toEqual(['initSdk', 'enable'])
    expect(state.config).toEqual([...EXISTING_CONFIG, 'disableAndroidIdReading', 'disableGoogleAdIdReading'])
  })

  it('a stored yes: the same start, with the advertising ID and never the Android ID', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { CONSENT_DISCLOSURE } = await import('@/shared/consent/consent-store')
    state.disk.set(KEY, JSON.stringify({ status: 'granted', at: '2026-11-03T00:00:00.000Z', disclosure: CONSENT_DISCLOSURE }))
    const { initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await observe()
    expect(state.tenjin).toEqual(['initialize', 'setAppStore', 'optIn', 'connect', 'getAttributionInfo'])
    expect(state.adjust).toEqual(['initSdk', 'enable'])
    expect(state.config).toEqual([...EXISTING_CONFIG, 'disableAndroidIdReading'])
  })

  it('the settle does not wait for an answer (window end, on the head only)', async () => {
    vi.useFakeTimers()
    try {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
      initializeAcquisitionSdk()
      let done = false
      void deferredLinkSettled().then(() => { done = true })
      await vi.advanceTimersByTimeAsync(20_000)
      expect(done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
