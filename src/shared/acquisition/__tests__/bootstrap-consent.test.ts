import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#370 (shape D3, D3a, D4, D5) — what the answer does to the SDKs
 * on Android. The consent modules are the real ones on a fake disk; only the
 * vendors and the install reset are fakes, recording what reached them.
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
  default: Object.fromEntries(
    ['initialize', 'setAppStore', 'optIn', 'optOut', 'connect'].map(name => [
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
    setDeferredDeeplinkCallback(callback: (payload: unknown) => void) {
      state.deferred = callback
    }
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
const stored = (status: string) =>
  state.disk.set(KEY, JSON.stringify({ status, at: '2026-11-02T00:00:00.000Z', disclosure: 'android-consent-v1' }))

const START = ['tenjin.initialize', 'tenjin.setAppStore', 'tenjin.optIn', 'tenjin.connect', 'tenjin.collect', 'adjust.initSdk', 'adjust.enable']

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
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('before the answer', () => {
  it('nothing starts and the settle waits, however long', async () => {
    const { deferredLinkSettled, installScoped } = await launch()
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(state.calls).toEqual([])
    expect(settled.done).toBe(false)
    // The install reset is not a vendor call, and does not wait.
    expect(installScoped()).toBe(true)
  })
})

describe('the answer', () => {
  it('granted in the sheet starts both, in order, from that moment', async () => {
    const { deferredLinkSettled, trackingConsent } = await launch()
    await vi.advanceTimersByTimeAsync(60_000)
    trackingConsent.answer('granted')
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(START)
    // The Adjust window opened at the answer, not at launch 60 s ago.
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(9_000)
    expect(settled.done).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(settled.done).toBe(true)
    expect(warned()).toContain('consent_tracking:granted')
  })

  it('a stored grant starts without any sheet', async () => {
    stored('granted')
    await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(START)
    expect(warned()).toContain('consent_tracking:stored:granted')
  })

  it.each([
    ['denied in the sheet', (c: { answer(s: 'denied'): void; later(): void }) => c.answer('denied'), 'consent_denied'],
    ['"Để sau"', (c: { answer(s: 'denied'): void; later(): void }) => c.later(), 'consent_later'],
  ])('%s starts nothing, and the settle resolves', async (_label, decide, reason) => {
    const { deferredLinkSettled, trackingConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    decide(trackingConsent)
    await expect(deferredLinkSettled()).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.calls).toEqual([])
    expect(warned()).toEqual(expect.arrayContaining([`acquisition_skipped:${reason}`, `acquisition_adjust_skipped:${reason}`]))
  })

  it('a stored denial starts nothing, and the settle resolves', async () => {
    stored('denied')
    const { deferredLinkSettled } = await launch()
    await expect(deferredLinkSettled()).resolves.toBeUndefined()
    expect(state.calls).toEqual([])
  })

  it('a second bootstrap starts nothing twice', async () => {
    stored('granted')
    const { initializeAcquisitionSdk } = await launch()
    initializeAcquisitionSdk()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(START)
  })
})

describe('the Settings switch', () => {
  it('off stops what started, on brings it back without a second start', async () => {
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    state.calls.length = 0
    setAcquisitionConsent(false)
    expect(state.calls).toEqual(['tenjin.optOut', 'adjust.disable'])
    expect(warned()).toContain('consent_tracking:settings:off')
    state.calls.length = 0
    setAcquisitionConsent(true)
    expect(state.calls).toEqual(['tenjin.optIn', 'adjust.enable'])
    expect(warned()).toContain('consent_tracking:settings:on')
  })

  it('off persists the denial before the vendors are told, and the next launch stays off', async () => {
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    setAcquisitionConsent(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(JSON.parse(state.disk.get(KEY)!).status).toBe('denied')
    vi.resetModules()
    state.calls.length = 0
    await launch()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.calls).toEqual([])
  })

  it('on after a denial starts them, this launch', async () => {
    stored('denied')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual([])
    setAcquisitionConsent(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).toEqual(START)
  })

  it('on before the sheet ever came is an answer: it starts, and the question is over', async () => {
    const { setAcquisitionConsent, deferredLinkSettled, trackingConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    setAcquisitionConsent(true)
    await vi.advanceTimersByTimeAsync(10_000)
    // Started once, not again by the chain that was waiting for this answer.
    expect(state.calls).toEqual(START)
    await expect(deferredLinkSettled()).resolves.toBeUndefined()
    await expect(trackingConsent.settled()).resolves.toBeUndefined()
  })

  it('on→off→on in one tick ends started and enabled, Adjust once', async () => {
    stored('denied')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    setAcquisitionConsent(true)
    setAcquisitionConsent(false)
    setAcquisitionConsent(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls.filter(c => c === 'adjust.initSdk')).toHaveLength(1)
    expect(state.calls.filter(c => c === 'tenjin.connect')).toHaveLength(1)
    expect(state.calls.at(-1)).toBe('adjust.enable')
    expect(state.calls).not.toContain('adjust.disable')
  })

  it('withdrawal during the install reset: the waiting start is retired', async () => {
    let finishReset!: () => void
    state.scope = () => new Promise<void>(resolve => { finishReset = resolve })
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    // Tenjin connected straight away, as it does today; collection and Adjust wait on the reset.
    expect(state.calls).toEqual(['tenjin.initialize', 'tenjin.setAppStore', 'tenjin.optIn', 'tenjin.connect'])
    setAcquisitionConsent(false)
    finishReset()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls).not.toContain('tenjin.collect')
    expect(state.calls).not.toContain('adjust.initSdk')
    expect(warned()).toContain('acquisition_start_stale:adjust')
  })

  it('F-03: a Tenjin start that failed is retried by the next yes, not just opted in', async () => {
    state.connectThrows = true
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls.filter(c => c === 'tenjin.connect')).toHaveLength(1)
    state.connectThrows = false
    setAcquisitionConsent(false)
    state.calls.length = 0
    setAcquisitionConsent(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.calls.filter(c => c === 'tenjin.connect')).toHaveLength(1)
  })

  it('F-03: a Tenjin that never started is not told to opt out', async () => {
    state.connectThrows = true
    stored('granted')
    const { setAcquisitionConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    state.calls.length = 0
    setAcquisitionConsent(false)
    expect(state.calls).not.toContain('tenjin.optOut')
  })

  it('a failed start can be followed by a real one', async () => {
    let failReset!: (error: Error) => void
    state.scope = () => new Promise<void>((_resolve, reject) => { failReset = reject })
    stored('granted')
    const { setAcquisitionConsent, installScoped } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    failReset(new Error('keychain'))
    await vi.advanceTimersByTimeAsync(0)
    expect(installScoped()).toBe(false)
    expect(state.calls).not.toContain('adjust.initSdk')
    setAcquisitionConsent(false)
    setAcquisitionConsent(true)
    await vi.advanceTimersByTimeAsync(0)
    // Still this launch's failed reset: no store to collect into, Adjust skipped; Tenjin back on.
    expect(state.calls.at(-1)).toBe('tenjin.optIn')
    expect(warned()).toContain('acquisition_adjust_skipped:install_scope_failed')
  })
})

describe('bounds (D3a)', () => {
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

  it('a hasPending that never answers: the settle gives up 20 s after the decision, and the resume reads nothing', async () => {
    let answer!: (value: boolean) => void
    state.hasPending = () => new Promise<boolean>(resolve => { answer = resolve })
    const { deferredLinkSettled, installScoped, trackingConsent } = await launch()
    await vi.advanceTimersByTimeAsync(60_000)
    trackingConsent.answer('granted')
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
    const { deferredLinkSettled, installScoped, trackingConsent } = await launch()
    await vi.advanceTimersByTimeAsync(0)
    trackingConsent.answer('granted')
    await vi.advanceTimersByTimeAsync(0)
    state.deferred?.({ deeplink: 'gogo-dev://room/abc' })
    const settled = watch(deferredLinkSettled())
    await vi.advanceTimersByTimeAsync(20_000)
    expect(settled.done).toBe(true)
    expect(installScoped()).toBe(false)
  })
})
