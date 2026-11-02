import { describe, expect, it, vi } from 'vitest'

import { createTenjinInitializer } from '../initialize'

describe('Tenjin initialization', () => {
  it('connects once after initialization and refuses a changed environment', () => {
    const calls: string[] = []
    const sdk = {
      initialize: vi.fn(() => calls.push('initialize')),
      setAppStore: vi.fn(() => calls.push('setAppStore')),
      optIn: vi.fn(),
      connect: vi.fn(() => calls.push('connect')),
    }
    const initialize = createTenjinInitializer(sdk)
    initialize('dev-key')
    initialize('dev-key')
    // setAppStore must land between the two: connect is the call that
    // carries source_app_store.
    expect(calls).toEqual(['initialize', 'setAppStore', 'connect'])
    expect(() => initialize('prod-key')).toThrow(/environment/)
    expect(sdk.initialize).toHaveBeenCalledTimes(1)
  })

  it('rejects missing config before calling native code', () => {
    const sdk = { initialize: vi.fn(), setAppStore: vi.fn(), optIn: vi.fn(), connect: vi.fn() }
    expect(() => createTenjinInitializer(sdk)(' ')).toThrow(/required/)
    expect(sdk.initialize).not.toHaveBeenCalled()
  })

  it('isolates provider failure from app startup and allows a later retry', () => {
    const unavailable = vi.fn()
    const sdk = {
      initialize: vi.fn(),
      setAppStore: vi.fn(),
      optIn: vi.fn(),
      connect: vi.fn().mockImplementationOnce(() => { throw new Error('provider payload') }),
    }
    const initialize = createTenjinInitializer(sdk, unavailable)
    expect(() => initialize('dev-key')).not.toThrow()
    expect(unavailable).toHaveBeenCalledWith()
    initialize('dev-key')
    expect(sdk.connect).toHaveBeenCalledTimes(2)
  })

  it('names the store explicitly rather than leaving it unspecified', () => {
    // The DEV device run logged "Unable to load app store type from manifest"
    // and sent source_app_store=unspecified on every connect.
    const sdk = { initialize: vi.fn(), setAppStore: vi.fn(), optIn: vi.fn(), connect: vi.fn() }
    createTenjinInitializer(sdk, () => {}, 'googleplay')('dev-key')
    expect(sdk.setAppStore).toHaveBeenCalledWith('googleplay')
  })
})

describe('Android opt-in (#370)', () => {
  it('says so itself before every connect, since an earlier opt-out may outlive a launch', () => {
    const order: string[] = []
    const record = (name: string) => () => void order.push(name)
    const initialize = createTenjinInitializer(
      { initialize: record('initialize'), setAppStore: record('setAppStore'), optIn: record('optIn'), connect: record('connect') },
      () => {},
      'googleplay',
      true,
    )
    initialize('key')
    expect(order).toEqual(['initialize', 'setAppStore', 'optIn', 'connect'])
  })

  it('iOS order is untouched', () => {
    const order: string[] = []
    const record = (name: string) => () => void order.push(name)
    createTenjinInitializer({ initialize: record('initialize'), setAppStore: record('setAppStore'), optIn: record('optIn'), connect: record('connect') })('key')
    expect(order).toEqual(['initialize', 'setAppStore', 'connect'])
  })
})

describe('says whether it started (#370 F-03)', () => {
  const sdk = (connect: () => void) => ({ initialize: () => {}, setAppStore: () => {}, optIn: () => {}, connect })

  it('true once connected, and again for the same key', () => {
    const initialize = createTenjinInitializer(sdk(() => {}))
    expect(initialize('key')).toBe(true)
    expect(initialize('key')).toBe(true)
  })

  it('false when the provider failed', () => {
    const initialize = createTenjinInitializer(sdk(() => { throw new Error('provider') }))
    expect(initialize('key')).toBe(false)
  })
})
