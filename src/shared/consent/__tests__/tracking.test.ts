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

  it('Android is unavailable even though the module is there, and settled from the start', async () => {
    // expo-tracking-transparency 6.0.8: isAvailable() is true on Android and every read answers granted.
    const consent = createTrackingConsent({
      lib: lib({ getTrackingPermissionsAsync: async () => ({ status: 'granted' }) }),
      platform: 'android',
    })
    expect(await consent.status()).toBe('unavailable')
    expect(await consent.request()).toBe('unavailable')
    expect(await isSettled(consent.settled())).toBe(true)
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
