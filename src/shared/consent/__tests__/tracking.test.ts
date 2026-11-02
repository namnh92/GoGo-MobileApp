import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTrackingConsent, type TrackingLibrary } from '../tracking'

vi.mock('expo-tracking-transparency', () => ({}))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

/** GoGo-MobileApp#366 — AC-A2.3: availability, status mapping, no throw, settled means over. */

function lib(over: Partial<TrackingLibrary> = {}): TrackingLibrary {
  return {
    isAvailable: () => true,
    getTrackingPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestTrackingPermissionsAsync: async () => ({ status: 'granted' }),
    ...over,
  }
}

const ios = (over: Partial<TrackingLibrary> = {}, report?: (e: string) => void) =>
  createTrackingConsent({ lib: lib(over), platform: 'ios', report })

async function isSettled(promise: Promise<void>): Promise<boolean> {
  let done = false
  void promise.then(() => { done = true })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

afterEach(() => vi.useRealTimers())

/** #370 — Android: no system dialog, GoGo's record is the consent. */
describe('tracking consent on Android', () => {
  function fakeStore(stored: 'granted' | 'denied' | 'undetermined' = 'undetermined') {
    let value = stored
    return {
      load: vi.fn(async () => value),
      set: vi.fn((next: 'granted' | 'denied') => {
        value = next
      }),
      get: () => value,
    }
  }
  const android = (store: ReturnType<typeof fakeStore>, report?: (e: string) => void, over: Partial<TrackingLibrary> = {}) =>
    createTrackingConsent({ lib: lib(over), platform: 'android', store, report })

  it('never reads the library, which answers granted there', async () => {
    // expo-tracking-transparency 6.0.8: isAvailable() is true on Android and every read answers granted.
    const read = vi.fn(async () => ({ status: 'granted' }))
    const consent = android(fakeStore(), undefined, { getTrackingPermissionsAsync: read, requestTrackingPermissionsAsync: read })
    expect(consent.asks).toBe('app')
    expect(await consent.status()).toBe('undetermined')
    expect(await consent.request()).toBe('undetermined')
    expect(read).not.toHaveBeenCalled()
  })

  it('settled stays pending with no answer, so the resume waits for the sheet', async () => {
    vi.useFakeTimers()
    const consent = android(fakeStore())
    expect(await isSettled(consent.settled())).toBe(false)
    await consent.status()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(await isSettled(consent.settled())).toBe(false)
  })

  it.each(['granted', 'denied'] as const)('a stored %s settles at the first read and says so once', async status => {
    const events: string[] = []
    const consent = android(fakeStore(status), e => events.push(e))
    expect(await consent.status()).toBe(status)
    await consent.status()
    expect(await isSettled(consent.settled())).toBe(true)
    expect(events).toEqual([`consent_tracking:stored:${status}`])
  })

  it.each(['granted', 'denied'] as const)('answering %s records it, settles, and is not then called stored', async status => {
    const events: string[] = []
    const store = fakeStore()
    const consent = android(store, e => events.push(e))
    consent.answer(status)
    expect(store.set).toHaveBeenCalledWith(status)
    expect(await isSettled(consent.settled())).toBe(true)
    expect(await consent.status()).toBe(status)
    expect(events).toEqual([`consent_tracking:${status}`])
  })

  it('later settles without recording anything', async () => {
    const store = fakeStore()
    const events: string[] = []
    const consent = android(store, e => events.push(e))
    consent.later()
    expect(await isSettled(consent.settled())).toBe(true)
    expect(store.set).not.toHaveBeenCalled()
    expect(events).toEqual(['consent_tracking:later'])
  })
})

describe('tracking consent', () => {
  it('maps the OS answers', async () => {
    for (const [raw, expected] of [
      ['granted', 'granted'],
      ['denied', 'denied'],
      ['undetermined', 'undetermined'],
      ['something-new', 'undetermined'],
    ] as const) {
      expect(await ios({ requestTrackingPermissionsAsync: async () => ({ status: raw }) }).request()).toBe(expected)
    }
  })

  it('a platform with no question to ask is unavailable and settled from the start', async () => {
    const consent = createTrackingConsent({ lib: lib(), platform: 'web' })
    expect(consent.asks).toBe('none')
    expect(await consent.status()).toBe('unavailable')
    expect(await consent.request()).toBe('unavailable')
    expect(await isSettled(consent.settled())).toBe(true)
  })

  it('iOS asks through the system; answer() records nothing', async () => {
    const consent = ios()
    expect(consent.asks).toBe('system')
    consent.answer('granted')
    expect(await isSettled(consent.settled())).toBe(false)
  })

  it('iOS without the module is unavailable and settled', async () => {
    const consent = ios({ isAvailable: () => false })
    expect(await consent.status()).toBe('unavailable')
    expect(await isSettled(consent.settled())).toBe(true)
  })

  it('a failing read or request is undetermined, never a throw', async () => {
    const consent = ios({
      getTrackingPermissionsAsync: async () => { throw new Error('native') },
      requestTrackingPermissionsAsync: async () => { throw new Error('not active') },
    })
    expect(await consent.status()).toBe('undetermined')
    expect(await consent.request()).toBe('undetermined')
  })

  it('a status read that never answers is undetermined after the bound', async () => {
    vi.useFakeTimers()
    const consent = createTrackingConsent({
      lib: lib({ getTrackingPermissionsAsync: () => new Promise(() => {}) }),
      platform: 'ios',
      statusTimeoutMs: 1_000,
    })
    const read = consent.status()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(await read).toBe('undetermined')
  })

  it('on iOS, settled waits for an answer — no clock ends it', async () => {
    vi.useFakeTimers()
    const consent = ios()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(await isSettled(consent.settled())).toBe(false)
  })

  it('settle() ends the question', async () => {
    const consent = ios()
    expect(await isSettled(consent.settled())).toBe(false)
    consent.settle()
    expect(await isSettled(consent.settled())).toBe(true)
  })

  it('later() ends the question and says so', async () => {
    const events: string[] = []
    const consent = ios({}, e => events.push(e))
    expect(await isSettled(consent.settled())).toBe(false)
    consent.later()
    expect(await isSettled(consent.settled())).toBe(true)
    expect(events).toEqual(['consent_tracking:later'])
  })

  it('reports reason codes only', async () => {
    const events: string[] = []
    await ios({}, e => events.push(e)).request()
    expect(events).toEqual(['consent_tracking:granted'])
  })
})
