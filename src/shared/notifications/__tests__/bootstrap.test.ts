import { afterEach, describe, expect, it, vi } from 'vitest'

const extra: Record<string, unknown> = {}
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra } } } }))
vi.mock('react-native-onesignal', () => ({ OneSignal: {} }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('react-native-tenjin', () => ({ default: {} }))

afterEach(() => {
  for (const k of Object.keys(extra)) delete extra[k]
  vi.restoreAllMocks()
  vi.resetModules()
})

/**
 * Review finding F4. The initializers already refuse to take the app down when
 * a provider fails; their callers used to throw from inside a useEffect with no
 * error boundary above, which is the one startup path that was not isolated.
 */
describe('bootstrap callers survive missing configuration', () => {
  it('the push bootstrap warns instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initializePushSdk } = await import('../bootstrap')
    expect(() => initializePushSdk()).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('push_sdk_unavailable'))
  })

  it('an empty App ID is missing configuration, not configuration', async () => {
    extra.oneSignalAppId = ''
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initializePushSdk } = await import('../bootstrap')
    expect(() => initializePushSdk()).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  it('the acquisition bootstrap warns instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initializeAcquisitionSdk } = await import('@/shared/acquisition/bootstrap')
    expect(() => initializeAcquisitionSdk()).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('acquisition_sdk_unavailable'))
  })
})
