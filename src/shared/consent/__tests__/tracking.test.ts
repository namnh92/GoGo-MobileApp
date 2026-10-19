import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTrackingConsent, type TrackingLibrary } from '../tracking'

vi.mock('expo-tracking-transparency', () => ({}))

/** GoGo-MobileApp#366 — AC-A2.3: status mapping, no throw, reason codes only. */

function lib(over: Partial<TrackingLibrary> = {}): TrackingLibrary {
  return {
    isAvailable: () => true,
    getTrackingPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestTrackingPermissionsAsync: async () => ({ status: 'granted' }),
    ...over,
  }
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
      const consent = createTrackingConsent({ lib: lib({ requestTrackingPermissionsAsync: async () => ({ status: raw }) }) })
      expect(await consent.request()).toBe(expected)
    }
  })

  it('is unavailable where ATT does not exist, and settled from the start', async () => {
    const consent = createTrackingConsent({ lib: lib({ isAvailable: () => false }) })
    expect(await consent.status()).toBe('unavailable')
    expect(await consent.request()).toBe('unavailable')
    await expect(consent.settled()).resolves.toBeUndefined()
  })

  it('a failing read or request is undetermined, never a throw', async () => {
    const consent = createTrackingConsent({
      lib: lib({
        getTrackingPermissionsAsync: async () => { throw new Error('native') },
        requestTrackingPermissionsAsync: async () => { throw new Error('not active') },
      }),
    })
    expect(await consent.status()).toBe('undetermined')
    expect(await consent.request()).toBe('undetermined')
  })

  it('reports reason codes only', async () => {
    const events: string[] = []
    const consent = createTrackingConsent({ lib: lib(), report: e => events.push(e) })
    await consent.request()
    consent.later()
    expect(events).toEqual(['consent_tracking:granted', 'consent_tracking:later'])
  })

  it('settles on the answer, and is bounded when no answer comes', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const consent = createTrackingConsent({ lib: lib(), report: e => events.push(e), settleTimeoutMs: 1_000 })
    let settled = false
    void consent.settled().then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    expect(events).toContain('consent_tracking:settle_timed_out')
  })
})
