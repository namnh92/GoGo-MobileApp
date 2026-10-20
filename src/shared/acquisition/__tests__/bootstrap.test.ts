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
const adjust = vi.hoisted(() => ({ initSdk: vi.fn(), configs: [] as unknown[] }))
vi.mock('react-native-adjust', () => {
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    constructor(public token: string, public environment: string) {
      adjust.configs.push(this)
    }
    disableDeferredDeeplinkOpening() {}
    setAttConsentWaitingInterval() {}
    setDeferredDeeplinkCallback() {}
    setAttributionCallback() {}
  }
  return { Adjust: { initSdk: adjust.initSdk }, AdjustConfig }
})

const scope = { outcome: () => Promise.resolve() }
const pending = { value: false }
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: { hasPending: async () => pending.value },
  ensureInstallScope: () => scope.outcome(),
}))

const collect = vi.fn(async () => {})
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => collect }))

afterEach(() => {
  collect.mockClear()
  adjust.initSdk.mockClear()
  adjust.configs.length = 0
  delete extra.adjustAndroidAppToken
  delete extra.flavor
  pending.value = false
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

  it('#367: Adjust starts after the reset with a real token, sandbox off prod', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.resolve()
    extra.adjustAndroidAppToken = 'abcdEFGH1234'
    extra.flavor = 'dev'
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await vi.advanceTimersByTimeAsync(0)
    expect(adjust.initSdk).toHaveBeenCalledTimes(1)
    expect(adjust.configs).toMatchObject([{ token: 'abcdEFGH1234', environment: 'sandbox' }])
    // No answer from Adjust: settled waits for the Android window, then resolves.
    let settled = false
    void deferredLinkSettled().then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(9_000)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(settled).toBe(true)
    vi.useRealTimers()
  })

  it.each([
    ['empty', '', 'acquisition_adjust_unavailable: rebuild with Adjust environment configuration'],
    ['off', 'off', 'acquisition_adjust_off'],
  ])('#367: %s token starts nothing and does not hold the resume', async (_label, token, event) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.resolve()
    extra.adjustAndroidAppToken = token
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await deferredLinkSettled()
    expect(adjust.initSdk).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(event)
  })

  it('#367: a failed install reset starts no Adjust either', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.reject(new Error('keychain delete failed'))
    extra.adjustAndroidAppToken = 'abcdEFGH1234'
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    await deferredLinkSettled()
    expect(adjust.initSdk).not.toHaveBeenCalled()
  })

  it('#367: a second bootstrap in the process starts Adjust once', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.resolve()
    extra.adjustAndroidAppToken = 'abcdEFGH1234'
    const { initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    initializeAcquisitionSdk()
    await vi.advanceTimersByTimeAsync(0)
    expect(adjust.initSdk).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('#367 (Astra F-03): when Tenjin has already won, the Adjust window does not hold the resume', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    scope.outcome = () => Promise.resolve()
    extra.adjustAndroidAppToken = 'abcdEFGH1234'
    collect.mockImplementation(async () => {
      pending.value = true
    })
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    let settled = false
    void deferredLinkSettled().then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(10)
    expect(settled).toBe(true)
    collect.mockImplementation(async () => {})
    vi.useRealTimers()
  })
})
