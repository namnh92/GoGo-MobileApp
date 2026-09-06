import { describe, expect, it, vi } from 'vitest'

import { createOneSignalInitializer } from '../initialize'

describe('OneSignal bootstrap', () => {
  it('initializes once across repeat mounts, with logging/location collection off', () => {
    const sdk = { initialize: vi.fn(), Debug: { setLogLevel: vi.fn() }, Location: { setShared: vi.fn() } }
    const initialize = createOneSignalInitializer(sdk)
    initialize('dev-app')
    initialize('dev-app')
    expect(sdk.initialize).toHaveBeenCalledExactlyOnceWith('dev-app')
    expect(sdk.Debug.setLogLevel).toHaveBeenCalledWith(0)
    expect(sdk.Location.setShared).toHaveBeenCalledWith(false)
    expect(() => initialize('prod-app')).toThrow(/cannot change/)
  })

  it('isolates a native SDK failure from app startup and allows a later retry', () => {
    const unavailable = vi.fn()
    const sdk = {
      initialize: vi.fn().mockImplementationOnce(() => {
        throw new Error('provider payload')
      }),
      Debug: { setLogLevel: vi.fn() },
      Location: { setShared: vi.fn() },
    }
    const initialize = createOneSignalInitializer(sdk, unavailable)
    expect(() => initialize('dev-app')).not.toThrow()
    expect(unavailable).toHaveBeenCalledWith()
    initialize('dev-app')
    expect(sdk.initialize).toHaveBeenCalledTimes(2)
  })

  it('still refuses a missing App ID before touching native code', () => {
    const sdk = { initialize: vi.fn(), Debug: { setLogLevel: vi.fn() }, Location: { setShared: vi.fn() } }
    expect(() => createOneSignalInitializer(sdk)('')).toThrow(/missing/)
    expect(sdk.initialize).not.toHaveBeenCalled()
  })
})
