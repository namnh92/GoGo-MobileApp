import { onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAppStateToQueryClient } from '../query-client'

type State = { isConnected: boolean | null; isInternetReachable?: boolean | null }

const network = vi.hoisted(() => ({
  listener: null as null | ((state: State) => void),
  read: null as null | { resolve: (state: State) => void; reject: (error: unknown) => void },
}))

// Hoisted by Vitest above the import of `query-client`, which reaches React
// Native only for AppState and expo-network for connectivity; both are native,
// so both are faked here.
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}))
vi.mock('expo-network', () => ({
  addNetworkStateListener: vi.fn((listener: (state: State) => void) => {
    network.listener = listener
    return { remove: vi.fn() }
  }),
  getNetworkStateAsync: vi.fn(
    () =>
      new Promise<State>((resolve, reject) => {
        network.read = { resolve, reject }
      }),
  ),
}))

const ONLINE: State = { isConnected: true, isInternetReachable: true }
const OFFLINE: State = { isConnected: false, isInternetReachable: false }

/** Lets the initial read's `then`/`catch` run. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/**
 * GoGo-MobileApp#253 — on iOS the one-off network read at launch can time out
 * and report offline, or resolve after a newer listener event. Applying it then
 * paused every query and raised a false offline bar. The listener wins as soon
 * as it has spoken.
 */
describe('bindAppStateToQueryClient × network state', () => {
  let teardown: () => void

  beforeEach(() => {
    onlineManager.setOnline(true)
    network.listener = null
    network.read = null
    teardown = bindAppStateToQueryClient()
  })

  afterEach(() => {
    teardown()
    onlineManager.setOnline(true)
  })

  it('seeds the state from the initial read when no event has arrived', async () => {
    network.read!.resolve(OFFLINE)
    await settle()
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('ignores a late offline read once the listener reported online', async () => {
    network.listener!(ONLINE)
    network.read!.resolve(OFFLINE)
    await settle()
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('ignores a late online read once the listener reported offline', async () => {
    network.listener!(OFFLINE)
    network.read!.resolve(ONLINE)
    await settle()
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('does not force online when the read fails after the listener reported offline', async () => {
    network.listener!(OFFLINE)
    network.read!.reject(new Error('timeout'))
    await settle()
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('assumes online when the read fails and nothing else has spoken', async () => {
    onlineManager.setOnline(false)
    network.read!.reject(new Error('timeout'))
    await settle()
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('keeps following the listener after the initial read', async () => {
    network.read!.resolve(ONLINE)
    await settle()
    network.listener!(OFFLINE)
    expect(onlineManager.isOnline()).toBe(false)
    network.listener!({ isConnected: true, isInternetReachable: null })
    expect(onlineManager.isOnline()).toBe(true)
  })
})
