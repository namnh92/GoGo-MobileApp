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
})
