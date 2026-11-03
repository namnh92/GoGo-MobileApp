import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#404 (shape D2 step 4, Astra A-F-02) — an answer while the lazy
 * Adjust import is pending. The start is never abandoned: the config takes the
 * answer that exists right before `initSdk`, so nothing has to be taken back.
 */

const state = vi.hoisted(() => {
  const state = {
    calls: [] as string[],
    disk: new Map<string, string>(),
    gate: Promise.resolve(),
    open: () => {},
    reset() {
      state.calls.length = 0
      state.disk.clear()
      state.gate = new Promise<void>(resolve => {
        state.open = resolve
      })
    },
  }
  return state
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
  default: Object.fromEntries(['initialize', 'setAppStore', 'optIn', 'optOutParams', 'connect'].map(name => [name, () => {}])),
}))
/** Registered per test: a mock's factory runs once per registration, and each race needs its own gate. */
const pendingImport = async () => {
  await state.gate
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    disableDeferredDeeplinkOpening() {}
    setAttConsentWaitingInterval() {}
    setDeferredDeeplinkCallback() {}
    setAttributionCallback() {}
    disableAndroidIdReading() {}
    disableGoogleAdIdReading() { state.calls.push('config.disableGoogleAdIdReading') }
  }
  return {
    Adjust: {
      initSdk: () => state.calls.push('adjust.initSdk'),
      enable: () => state.calls.push('adjust.enable'),
      disable: () => state.calls.push('adjust.disable'),
    },
    AdjustConfig,
  }
}

vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => false, onStored: () => () => {} },
  ensureInstallScope: async () => {},
}))
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => async () => {} }))

beforeEach(() => {
  state.reset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

async function launchDuringImport() {
  vi.doMock('react-native-adjust', pendingImport)
  const { initializeAcquisitionSdk, setAcquisitionConsent } = await import('../bootstrap')
  initializeAcquisitionSdk()
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(state.calls).toEqual([])
  return setAcquisitionConsent
}

it('a grant during the import: the config allows the ID, nothing is taken back', async () => {
  const setAcquisitionConsent = await launchDuringImport()
  setAcquisitionConsent(true)
  state.open()
  await vi.waitFor(() => expect(state.calls).toEqual(['adjust.initSdk', 'adjust.enable']))
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(state.calls).toEqual(['adjust.initSdk', 'adjust.enable'])
})

it('a denial during the import after a stored grant: the config withholds, nothing to pause', async () => {
  const { CONSENT_DISCLOSURE } = await import('@/shared/consent/consent-store')
  state.disk.set(
    'gogo.consent.tracking.v1',
    JSON.stringify({ status: 'granted', at: '2026-11-03T00:00:00.000Z', disclosure: CONSENT_DISCLOSURE }),
  )
  const setAcquisitionConsent = await launchDuringImport()
  setAcquisitionConsent(false)
  state.open()
  await vi.waitFor(() => expect(state.calls).toEqual(['config.disableGoogleAdIdReading', 'adjust.initSdk', 'adjust.enable']))
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(state.calls).toEqual(['config.disableGoogleAdIdReading', 'adjust.initSdk', 'adjust.enable'])
})
