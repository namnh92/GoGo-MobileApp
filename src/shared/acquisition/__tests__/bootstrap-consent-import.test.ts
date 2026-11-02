import { afterEach, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#370 (Astra A-F-01) — a withdrawal while the lazy Adjust import
 * is pending. The import lands afterwards; the start it belonged to is retired,
 * so no SDK is initialised for someone who just said no.
 */

const state = vi.hoisted(() => {
  let open!: () => void
  const gate = new Promise<void>(resolve => {
    open = resolve
  })
  return { calls: [] as string[], gate, open, disk: new Map<string, string>() }
})

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
  default: Object.fromEntries(['initialize', 'setAppStore', 'optIn', 'optOut', 'connect'].map(name => [name, () => {}])),
}))
vi.mock('react-native-adjust', async () => {
  await state.gate
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    disableDeferredDeeplinkOpening() {}
    setAttConsentWaitingInterval() {}
    setDeferredDeeplinkCallback() {}
    setAttributionCallback() {}
  }
  return {
    Adjust: {
      initSdk: () => state.calls.push('adjust.initSdk'),
      enable: () => state.calls.push('adjust.enable'),
      disable: () => state.calls.push('adjust.disable'),
    },
    AdjustConfig,
  }
})
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => false, onStored: () => () => {} },
  ensureInstallScope: async () => {},
}))
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => async () => {} }))

afterEach(() => vi.restoreAllMocks())

it('withdrawal during the import: nothing is initialised when it lands, and a later grant starts once', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  state.disk.set(
    'gogo.consent.tracking.v1',
    JSON.stringify({ status: 'granted', at: '2026-11-02T00:00:00.000Z', disclosure: 'android-consent-v1' }),
  )
  const { initializeAcquisitionSdk, setAcquisitionConsent } = await import('../bootstrap')
  initializeAcquisitionSdk()
  await new Promise(resolve => setTimeout(resolve, 10))
  setAcquisitionConsent(false)
  expect(state.calls).toEqual([])

  state.open()
  await vi.waitFor(() => {
    expect(warn.mock.calls.map(([event]) => event)).toContain('acquisition_start_stale:adjust')
  })
  expect(state.calls).toEqual([])

  setAcquisitionConsent(true)
  await vi.waitFor(() => expect(state.calls).toEqual(['adjust.initSdk', 'adjust.enable']))
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(state.calls).toEqual(['adjust.initSdk', 'adjust.enable'])
})
