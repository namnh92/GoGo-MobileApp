import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#404 (ADR 0014, shape D2, D3, D3a of #370) — what the answer
 * does to the SDKs on Android. The consent modules are the real ones on a fake
 * disk; only the vendors and the install reset are fakes, recording what reached
 * them.
 */

const state = vi.hoisted(() => ({
  calls: [] as string[],
  disk: new Map<string, string>(),
  scope: (() => Promise.resolve()) as () => Promise<void>,
  hasPending: (async () => false) as () => Promise<boolean>,
  collect: (async () => {}) as () => Promise<void>,
  deferred: undefined as undefined | ((payload: unknown) => void),
  remember: (async () => true) as () => Promise<boolean>,
  connectThrows: false,
  config: [] as string[],
  adjustThrows: false,
  read: undefined as undefined | (() => Promise<string | null>),
}))

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { tenjinAndroidSdkKey: 'key', adjustAndroidAppToken: 'abcdEFGH1234', flavor: 'dev' }, scheme: 'gogo-dev' } },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { Adjust: {} } }))
vi.mock('expo-tracking-transparency', () => ({ isAvailable: () => true }))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => (state.read ? state.read() : state.disk.get(key) ?? null),
    setItem: (key: string, value: string) => {
      state.calls.push('disk.setItem')
      state.disk.set(key, value)
      return Promise.resolve()
    },
    removeItem: async (key: string) => void state.disk.delete(key),
  },
}))
vi.mock('react-native-tenjin', () => ({
  default: Object.fromEntries(
    ['initialize', 'setAppStore', 'optIn', 'optOut', 'optOutParams', 'connect'].map(name => [
      name,
      () => {
        state.calls.push(`tenjin.${name}`)
        if (name === 'connect' && state.connectThrows) throw new Error('provider')
      },
    ]),
  ),
}))
vi.mock('react-native-adjust', () => {
  class AdjustConfig {
    static EnvironmentSandbox = 'sandbox'
    static EnvironmentProduction = 'production'
    disableDeferredDeeplinkOpening() {}
    setAttConsentWaitingInterval() {}
    disableAndroidIdReading() { state.config.push('disableAndroidIdReading') }
    disableGoogleAdIdReading() { state.config.push('disableGoogleAdIdReading') }
    setDeferredDeeplinkCallback(callback: (payload: unknown) => void) {
      state.deferred = callback
    }
    setAttributionCallback() {}
  }
  return {
    Adjust: {
      initSdk: () => state.calls.push('adjust.initSdk'),
      enable: () => {
        state.calls.push('adjust.enable')
        if (state.adjustThrows) throw new Error('provider')
      },
      disable: () => {
        state.calls.push('adjust.disable')
        if (state.adjustThrows) throw new Error('provider')
      },
    },
    AdjustConfig,
  }
})
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: {
    hasPending: () => state.hasPending(),
    onStored: () => () => {},
    remember: () => state.remember(),
  },
  ensureInstallScope: () => state.scope(),
}))
vi.mock('../deferred-link', () => ({
  createDeferredLinkCollector: () => () => {
    state.calls.push('tenjin.collect')
    return state.collect()
  },
}))

const KEY = 'gogo.consent.tracking.v1'
const stored = (status: string, disclosure = 'android-consent-v2') =>
  state.disk.set(KEY, JSON.stringify({ status, at: '2026-11-03T00:00:00.000Z', disclosure }))

const TENJIN_TO_CONNECT = ['tenjin.initialize', 'tenjin.setAppStore', 'tenjin.optIn', 'tenjin.optOutParams', 'tenjin.connect']
const WITHHELD = [...TENJIN_TO_CONNECT, 'tenjin.collect', 'adjust.initSdk', 'adjust.enable']
const ALLOWED = WITHHELD.filter(call => call !== 'tenjin.optOutParams')
const ANDROID_ID_ONLY = ['disableAndroidIdReading']
const BOTH_IDS = ['disableAndroidIdReading', 'disableGoogleAdIdReading']

let warn: { mock: { calls: unknown[][] } }
const warned = () => warn.mock.calls.map(call => call[0] as string)

/** A fresh process. */
async function launch() {
  const bootstrap = await import('../bootstrap')
  const { trackingConsent } = await import('@/shared/consent/tracking')
  const { consentStore } = await import('@/shared/consent/consent-store')
  bootstrap.initializeAcquisitionSdk()
  return { ...bootstrap, trackingConsent, consentStore }
}

function watch(promise: Promise<void>) {
  const seen = { done: false }
  void promise.then(() => {
    seen.done = true
  })
  return seen
}

beforeEach(() => {
  vi.useFakeTimers()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  state.calls.length = 0
  state.disk.clear()
  state.scope = () => Promise.resolve()
  state.hasPending = async () => false
  state.collect = async () => {}
  state.deferred = undefined
  state.remember = async () => true
  state.connectThrows = false
  state.config.length = 0
  state.adjustThrows = false
  state.read = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('the launch', () => {
  it('no answer: both start withheld, the settle does not wait, and nothing follows', async () => {
    const { deferredLinkSettled, installScoped } = await launch()
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(WITHHELD)
    expect(state.config).toEqual(BOTH_IDS)
    expect(warned()).toEqual(expect.arrayContaining(['acquisition_tenjin_withhold:on', 'acquisition_adjust_withhold:on']))
    // The window opened at launch, as on iOS.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(settled.done).toBe(true)
    expect(installScoped()).toBe(true)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(state.calls).toEqual(WITHHELD)
  })

  it('a stored grant: both start with the advertising ID, never the Android ID', async () => {
    stored('granted')
    await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(ALLOWED)
    expect(state.config).toEqual(ANDROID_ID_ONLY)
    expect(warned()).toEqual(
      expect.arrayContaining(['consent_tracking:stored:granted', 'acquisition_tenjin_withhold:off', 'acquisition_adjust_withhold:off']),
    )
  })

  it('a stored denial starts withheld', async () => {
    stored('denied')
    await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(WITHHELD)
    expect(state.config).toEqual(BOTH_IDS)
    expect(warned()).toContain('consent_tracking:stored:denied')
  })

  it('a yes given to the old wording is not a yes: it starts withheld', async () => {
    stored('granted', 'android-consent-v1')
    await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(WITHHELD)
    expect(warned()).not.toContain('consent_tracking:stored:granted')
  })

  it('a second bootstrap starts nothing twice', async () => {
    stored('granted')
    const { initializeAcquisitionSdk } = await launch()
    initializeAcquisitionSdk()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(ALLOWED)
  })

  it('never tells Tenjin to opt out: that would silence the next launch too', async () => {
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    setAcquisitionConsent(false)
    setAcquisitionConsent(true)
    expect(state.calls).not.toContain('tenjin.optOut')
  })
})

describe('a change of mind on a launch that started withheld', () => {
  async function started() {
    const running = await launch()
    await vi.advanceTimersByTimeAsync(0)
    state.calls.length = 0
    return running
  }

  it('the sheet says no: no vendor call', async () => {
    const { trackingConsent } = await started()
    trackingConsent.answer('denied')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.calls).toEqual(['disk.setItem'])
    await expect(trackingConsent.settled()).resolves.toBeUndefined()
  })

  it('"Để sau": no vendor call, and the question is over for this launch', async () => {
    const { trackingConsent } = await started()
    trackingConsent.later()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.calls).toEqual([])
    await expect(trackingConsent.settled()).resolves.toBeUndefined()
  })

  it('the sheet says yes: Tenjin may send, Adjust stays as it was started', async () => {
    const { trackingConsent } = await started()
    trackingConsent.answer('granted')
    expect(state.calls).toEqual(['disk.setItem', 'tenjin.optIn'])
    expect(warned()).toEqual(expect.arrayContaining(['consent_tracking:granted', 'acquisition_tenjin_withhold:off']))
    expect(warned()).not.toContain('acquisition_adjust_paused:consent_withdrawn')
  })

  it('yes then no: Tenjin is withheld again at once, Adjust was never allowed and is not paused', async () => {
    const { setAcquisitionConsent } = await started()
    setAcquisitionConsent(true)
    setAcquisitionConsent(false)
    expect(state.calls.filter(call => call !== 'disk.setItem')).toEqual(['tenjin.optIn', 'tenjin.optOutParams'])
    expect(warned()).not.toContain('acquisition_adjust_paused:consent_withdrawn')
    expect(warned()).toEqual(expect.arrayContaining(['consent_tracking:settings:on', 'consent_tracking:settings:off']))
  })
})

describe('a change of mind on a launch that started with the ID', () => {
  async function started() {
    stored('granted')
    const running = await launch()
    await vi.advanceTimersByTimeAsync(0)
    state.calls.length = 0
    return running
  }

  it('off: the write is issued first, then Tenjin is withheld and Adjust paused in the same tick', async () => {
    const { setAcquisitionConsent } = await started()
    setAcquisitionConsent(false)
    expect(state.calls).toEqual(['disk.setItem', 'tenjin.optOutParams', 'adjust.disable'])
    expect(warned()).toEqual(expect.arrayContaining(['acquisition_tenjin_withhold:on', 'acquisition_adjust_paused:consent_withdrawn']))
  })

  it('off then on: both back, without a second start', async () => {
    const { setAcquisitionConsent } = await started()
    setAcquisitionConsent(false)
    state.calls.length = 0
    setAcquisitionConsent(true)
    expect(state.calls).toEqual(['disk.setItem', 'tenjin.optIn', 'adjust.enable'])
    expect(warned()).toContain('acquisition_adjust_resumed:consent_granted')
  })

  it('off→on→off in one tick ends withheld and paused, Adjust started once', async () => {
    const { setAcquisitionConsent } = await started()
    setAcquisitionConsent(false)
    setAcquisitionConsent(true)
    setAcquisitionConsent(false)
    await vi.advanceTimersByTimeAsync(0)
    const vendors = state.calls.filter(call => call !== 'disk.setItem')
    expect(vendors).toEqual([
      'tenjin.optOutParams',
      'adjust.disable',
      'tenjin.optIn',
      'adjust.enable',
      'tenjin.optOutParams',
      'adjust.disable',
    ])
    expect(JSON.parse(state.disk.get(KEY)!).status).toBe('denied')
  })

  it('F-01: a pause that failed is not recorded: said only once done, retried at the next store change', async () => {
    const { setAcquisitionConsent } = await started()
    state.adjustThrows = true
    setAcquisitionConsent(false)
    expect(state.calls.filter(call => call === 'adjust.disable')).toHaveLength(1)
    expect(warned()).not.toContain('acquisition_adjust_paused:consent_withdrawn')
    state.adjustThrows = false
    // The write completing is the next store change.
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls.filter(call => call === 'adjust.disable')).toHaveLength(2)
    expect(warned()).toContain('acquisition_adjust_paused:consent_withdrawn')
  })

  it('F-01: a resume that failed is not recorded either', async () => {
    const { setAcquisitionConsent } = await started()
    setAcquisitionConsent(false)
    await vi.advanceTimersByTimeAsync(0)
    state.adjustThrows = true
    setAcquisitionConsent(true)
    expect(warned()).not.toContain('acquisition_adjust_resumed:consent_granted')
    state.adjustThrows = false
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls.filter(call => call === 'adjust.enable')).toHaveLength(2)
    expect(warned()).toContain('acquisition_adjust_resumed:consent_granted')
  })

  it('the next launch starts withheld, ends the pause and connects', async () => {
    const { setAcquisitionConsent } = await started()
    setAcquisitionConsent(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(JSON.parse(state.disk.get(KEY)!).status).toBe('denied')
    vi.resetModules()
    state.calls.length = 0
    state.config.length = 0
    await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(WITHHELD)
    expect(state.config).toEqual(BOTH_IDS)
  })
})

describe('a start that did not complete', () => {
  it('a Tenjin connect that failed is told nothing later, and Adjust is unaffected', async () => {
    state.connectThrows = true
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toContain('adjust.initSdk')
    state.calls.length = 0
    setAcquisitionConsent(false)
    expect(state.calls).toEqual(['disk.setItem', 'adjust.disable'])
  })

  it('a failed reset: Tenjin runs and hears the switch, Adjust is skipped', async () => {
    state.scope = () => Promise.reject(new Error('keychain'))
    const { setAcquisitionConsent, installScoped } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(installScoped()).toBe(false)
    expect(state.calls).toEqual(TENJIN_TO_CONNECT)
    expect(warned()).toContain('acquisition_adjust_skipped:install_scope_failed')
    state.calls.length = 0
    setAcquisitionConsent(true)
    expect(state.calls).toEqual(['disk.setItem', 'tenjin.optIn'])
  })
})

describe('bounds (#370 D3a)', () => {
  it('a reset that never resolves: settles, not scoped, Tenjin starts, Adjust skipped', async () => {
    state.scope = () => new Promise<void>(() => {})
    stored('granted')
    const { deferredLinkSettled, installScoped } = await launch()
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled.done).toBe(true)
    expect(installScoped()).toBe(false)
    expect(state.calls).toEqual(['tenjin.initialize', 'tenjin.setAppStore', 'tenjin.optIn', 'tenjin.connect'])
    expect(warned()).toEqual(expect.arrayContaining(['deferred_link_install_scope_timed_out', 'acquisition_adjust_skipped:install_scope_failed']))
  })

  it('a reset resolving after its deadline stays not scoped', async () => {
    let finishReset!: () => void
    state.scope = () => new Promise<void>(resolve => { finishReset = resolve })
    stored('granted')
    const { installScoped } = await launch()
    await vi.advanceTimersByTimeAsync(5_000)
    finishReset()
    await vi.advanceTimersByTimeAsync(0)
    expect(installScoped()).toBe(false)
  })

  it('F-02: a storage read that never answers: both start withheld after its 2 s bound', async () => {
    state.read = () => new Promise<string | null>(() => {})
    await launch()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(state.calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(state.calls).toEqual(WITHHELD)
    expect(state.config).toEqual(BOTH_IDS)
  })

  it('a status read that never answers: the settle gives up 20 s from launch, and the resume reads nothing', async () => {
    const { consentStore } = await import('@/shared/consent/consent-store')
    vi.spyOn(consentStore, 'load').mockImplementation(() => new Promise(() => {}))
    const { deferredLinkSettled, installScoped } = await launch()
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(20_000)
    expect(settled.done).toBe(true)
    expect(installScoped()).toBe(false)
    expect(warned()).toContain('acquisition_settle_timed_out')
  })

  it('a hasPending that never answers: the settle gives up 20 s from launch, and the resume reads nothing', async () => {
    let answer!: (value: boolean) => void
    state.hasPending = () => new Promise<boolean>(resolve => { answer = resolve })
    const { deferredLinkSettled, installScoped } = await launch()
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(19_999)
    expect(settled.done).toBe(false)
    expect(installScoped()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled.done).toBe(true)
    expect(installScoped()).toBe(false)
    expect(warned()).toContain('acquisition_settle_timed_out')
    // A late completion re-authorises nothing.
    answer(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(installScoped()).toBe(false)
  })

  it('a remember() that never answers after a deferred link: the same bound', async () => {
    state.remember = () => new Promise<boolean>(() => {})
    const { deferredLinkSettled, installScoped } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    state.deferred?.({ deeplink: 'gogo-dev://room/abc' })
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(20_000)
    expect(settled.done).toBe(true)
    expect(installScoped()).toBe(false)
  })
})
