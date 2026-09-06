import { describe, expect, it, vi } from 'vitest'

import { createTenjinInitializer } from '../initialize'

describe('Tenjin initialization', () => {
  it('connects once after initialization and refuses a changed environment', () => {
    const calls: string[] = []
    const sdk = { initialize: vi.fn(() => calls.push('initialize')), connect: vi.fn(() => calls.push('connect')) }
    const initialize = createTenjinInitializer(sdk)
    initialize('dev-key')
    initialize('dev-key')
    expect(calls).toEqual(['initialize', 'connect'])
    expect(() => initialize('prod-key')).toThrow(/environment/)
    expect(sdk.initialize).toHaveBeenCalledTimes(1)
  })

  it('rejects missing config before calling native code', () => {
    const sdk = { initialize: vi.fn(), connect: vi.fn() }
    expect(() => createTenjinInitializer(sdk)(' ')).toThrow(/required/)
    expect(sdk.initialize).not.toHaveBeenCalled()
  })

  it('isolates provider failure from app startup and allows a later retry', () => {
    const unavailable = vi.fn()
    const sdk = { initialize: vi.fn(), connect: vi.fn().mockImplementationOnce(() => { throw new Error('provider payload') }) }
    const initialize = createTenjinInitializer(sdk, unavailable)
    expect(() => initialize('dev-key')).not.toThrow()
    expect(unavailable).toHaveBeenCalledWith()
    initialize('dev-key')
    expect(sdk.connect).toHaveBeenCalledTimes(2)
  })
})
