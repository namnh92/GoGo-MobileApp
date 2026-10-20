import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * GoGo-MobileApp#367 (PR #369 Astra F-06) — loading the SDK must not hold the
 * resume. A development build fetches the lazily imported wrapper as a split
 * bundle; if that request stalls, the sink's own events — window end, another
 * writer's link — still have to release `deferredLinkSettled()`.
 */

const extra: Record<string, unknown> = { tenjinAndroidSdkKey: 'key', adjustAndroidAppToken: 'abcdEFGH1234' }
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra, scheme: 'gogo-dev' } } } }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { Adjust: {} } }))
vi.mock('react-native-tenjin', () => ({ default: {} }))
// The import never completes.
vi.mock('react-native-adjust', () => new Promise(() => {}))
const pending = { value: false }
const storedListeners = vi.hoisted(() => new Set<(source?: string) => void>())
vi.mock('../pending-deep-links', () => ({
  pendingDeepLinks: {
    hasPending: async () => pending.value,
    onStored: (listener: (source?: string) => void) => {
      storedListeners.add(listener)
      return () => storedListeners.delete(listener)
    },
  },
  ensureInstallScope: async () => {},
}))
vi.mock('../deferred-link', () => ({ createDeferredLinkCollector: () => async () => {} }))

afterEach(() => {
  pending.value = false
  storedListeners.clear()
  vi.restoreAllMocks()
  vi.resetModules()
  vi.useRealTimers()
})

describe('Adjust SDK loading does not hold settlement (Astra F-06)', () => {
  it('the window end releases the resume while the import is still pending', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    let settled = false
    void deferredLinkSettled().then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    expect(warn).toHaveBeenCalledWith('acquisition_adjust_window_ended')
  })

  it('another writer winning releases the resume while the import is still pending', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deferredLinkSettled, initializeAcquisitionSdk } = await import('../bootstrap')
    initializeAcquisitionSdk()
    let settled = false
    void deferredLinkSettled().then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(settled).toBe(false)
    pending.value = true
    for (const listener of storedListeners) listener('tenjin')
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(true)
  })
})
