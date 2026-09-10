import { describe, expect, it, vi } from 'vitest'

import {
  createOneSignalInitializer,
  retryInitialization,
  type PushStartupResult,
} from '../initialize'

describe('OneSignal bootstrap', () => {
  it('initializes once across repeat mounts, with logging/location collection off', async () => {
    const sdk = { initialize: vi.fn(), Debug: { setLogLevel: vi.fn() }, Location: { setShared: vi.fn() }, Notifications: { getPermissionAsync: vi.fn(async () => false) } }
    const initialize = createOneSignalInitializer(sdk)
    await Promise.all([initialize('dev-app'), initialize('dev-app')])
    expect(sdk.initialize).toHaveBeenCalledExactlyOnceWith('dev-app')
    expect(sdk.Debug.setLogLevel).toHaveBeenCalledWith(0)
    expect(sdk.Location.setShared).toHaveBeenCalledWith(false)
    expect(() => initialize('prod-app')).toThrow(/cannot change/)
  })

  it('isolates a native SDK failure from app startup and allows a later retry', async () => {
    const unavailable = vi.fn()
    const sdk = {
      initialize: vi.fn().mockImplementationOnce(() => {
        throw new Error('provider payload')
      }),
      Debug: { setLogLevel: vi.fn() },
      Location: { setShared: vi.fn() }, Notifications: { getPermissionAsync: vi.fn(async () => false) },
    }
    const initialize = createOneSignalInitializer(sdk, unavailable)
    await expect(initialize('dev-app')).resolves.toBe(false)
    expect(unavailable).toHaveBeenCalledWith()
    await expect(initialize('dev-app')).resolves.toBe(true)
    expect(sdk.initialize).toHaveBeenCalledTimes(2)
  })

  it('still refuses a missing App ID before touching native code', () => {
    const sdk = { initialize: vi.fn(), Debug: { setLogLevel: vi.fn() }, Location: { setShared: vi.fn() }, Notifications: { getPermissionAsync: vi.fn(async () => false) } }
    expect(() => createOneSignalInitializer(sdk)('')).toThrow(/missing/)
    expect(sdk.initialize).not.toHaveBeenCalled()
  })
})

it('waits for the native initialization queue before allowing identity startup', async () => {
  let acknowledge!: (value: boolean) => void
  const nativeReady = new Promise<boolean>(resolve => { acknowledge = resolve })
  const sdk = {
    initialize: vi.fn(), Debug: { setLogLevel: vi.fn() }, Location: { setShared: vi.fn() },
    Notifications: { getPermissionAsync: vi.fn(() => nativeReady) },
  }
  const startIdentity = vi.fn()
  const initialize = createOneSignalInitializer(sdk)
  const pending = initialize('dev-app').then(ready => { if (ready) startIdentity() })
  await Promise.resolve()
  expect(sdk.initialize).toHaveBeenCalledTimes(1)
  expect(startIdentity).not.toHaveBeenCalled()
  acknowledge(false) // A denied permission still means SDK initialization completed.
  await pending
  expect(startIdentity).toHaveBeenCalledTimes(1)
})

it('retries transient initialization failures with a finite backoff', async () => {
  const initialize = vi.fn<() => Promise<PushStartupResult>>()
    .mockResolvedValueOnce('unavailable')
    .mockResolvedValueOnce('unavailable')
    .mockResolvedValueOnce('ready')
  const sleep = vi.fn(async () => {})

  await expect(retryInitialization(initialize, { attempts: 3, delayMs: 10, sleep })).resolves.toBe('ready')
  expect(initialize).toHaveBeenCalledTimes(3)
  expect(sleep).toHaveBeenNthCalledWith(1, 10)
  expect(sleep).toHaveBeenNthCalledWith(2, 20)
})

// A binary with no App ID will not grow one by being asked again: retrying it
// only spends startup time and repeats the same warning in a dev client.
it('does not retry a build that carries no push configuration', async () => {
  const initialize = vi.fn<() => Promise<PushStartupResult>>().mockResolvedValue('unconfigured')
  const sleep = vi.fn(async () => {})

  await expect(retryInitialization(initialize, { attempts: 3, delayMs: 10, sleep })).resolves.toBe(
    'unconfigured',
  )
  expect(initialize).toHaveBeenCalledTimes(1)
  expect(sleep).not.toHaveBeenCalled()
})

it('gives up after the last attempt rather than looping forever', async () => {
  const initialize = vi.fn<() => Promise<PushStartupResult>>().mockResolvedValue('unavailable')
  const sleep = vi.fn(async () => {})

  await expect(retryInitialization(initialize, { attempts: 2, delayMs: 10, sleep })).resolves.toBe(
    'unavailable',
  )
  expect(initialize).toHaveBeenCalledTimes(2)
  expect(sleep).toHaveBeenCalledTimes(1)
})
