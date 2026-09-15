import { onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAppStateToQueryClient } from '../query-client'

type State = { type?: string; isConnected: boolean | null; isInternetReachable?: boolean | null }
type Read = { resolve: (state: State) => void; reject: (error: unknown) => void }

const network = vi.hoisted(() => ({
  listener: null as null | ((state: State) => void),
  /** Every `getNetworkStateAsync` call, in order; the first is the launch seed. */
  reads: [] as Read[],
  appState: null as null | ((status: string) => void),
  os: 'android',
}))

// Hoisted by Vitest above the import of `query-client`, which reaches React
// Native only for AppState, Platform and expo-network; all are native, so all
// are faked here.
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn((_event: string, listener: (status: string) => void) => {
      network.appState = listener
      return { remove: vi.fn() }
    }),
  },
  Platform: {
    get OS() {
      return network.os
    },
  },
}))
vi.mock('expo-network', () => ({
  addNetworkStateListener: vi.fn((listener: (state: State) => void) => {
    network.listener = listener
    return { remove: vi.fn() }
  }),
  getNetworkStateAsync: vi.fn(
    () =>
      new Promise<State>((resolve, reject) => {
        network.reads.push({ resolve, reject })
      }),
  ),
}))

const ONLINE: State = { isConnected: true, isInternetReachable: true }
const OFFLINE: State = { isConnected: false, isInternetReachable: false }
/** What Android reads once airplane mode has taken the network away. */
const NONE: State = { type: 'NONE', isConnected: false, isInternetReachable: false }
/** Airplane mode reported while the lost Wi-Fi is still the active network (Samsung SM-A226B). */
const STALE_WIFI: State = { type: 'WIFI', isConnected: true, isInternetReachable: true }

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
    network.reads = []
    network.appState = null
    network.os = 'android'
    teardown = bindAppStateToQueryClient()
  })

  afterEach(() => {
    teardown()
    onlineManager.setOnline(true)
  })

  it('seeds the state from the initial read when no event has arrived', async () => {
    network.reads[0]!.resolve(OFFLINE)
    await settle()
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('ignores a late offline read once the listener reported online', async () => {
    network.listener!(ONLINE)
    network.reads[0]!.resolve(OFFLINE)
    await settle()
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('ignores a late online read once the listener reported offline', async () => {
    network.listener!(OFFLINE)
    network.reads[0]!.resolve(ONLINE)
    await settle()
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('does not force online when the read fails after the listener reported offline', async () => {
    network.listener!(OFFLINE)
    network.reads[0]!.reject(new Error('timeout'))
    await settle()
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('assumes online when the read fails and nothing else has spoken', async () => {
    onlineManager.setOnline(false)
    network.reads[0]!.reject(new Error('timeout'))
    await settle()
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('keeps following the listener after the initial read', async () => {
    network.reads[0]!.resolve(ONLINE)
    await settle()
    network.listener!(OFFLINE)
    expect(onlineManager.isOnline()).toBe(false)
    network.listener!({ isConnected: true, isInternetReachable: null })
    expect(onlineManager.isOnline()).toBe(true)
  })
})

/**
 * GoGo-MobileApp#253, LOCAL retest on a Samsung SM-A226B: in 3 of 11 airplane
 * toggles the app never went offline. The last change before the network went
 * away was either `UNKNOWN` with `isConnected: false` but
 * `isInternetReachable: true`, or the lost Wi-Fi still reported as connected,
 * and no later change corrected it.
 */
describe('bindAppStateToQueryClient × stale Android network changes', () => {
  let teardown: () => void

  beforeEach(async () => {
    vi.useFakeTimers()
    onlineManager.setOnline(true)
    network.listener = null
    network.reads = []
    network.appState = null
    network.os = 'android'
    teardown = bindAppStateToQueryClient()
    network.reads[0]!.resolve(ONLINE)
    await vi.advanceTimersByTimeAsync(0)
  })

  afterEach(() => {
    teardown()
    vi.useRealTimers()
    onlineManager.setOnline(true)
  })

  it('goes offline on a change with no connection, even one that still claims the internet is reachable', () => {
    network.listener!({ type: 'UNKNOWN', isConnected: false, isInternetReachable: true })
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('reads again after a stale change and goes offline once the network is gone', async () => {
    network.listener!(STALE_WIFI)
    expect(onlineManager.isOnline()).toBe(true)

    await vi.advanceTimersByTimeAsync(1000)
    expect(network.reads).toHaveLength(2)
    network.reads[1]!.resolve(NONE)
    await vi.advanceTimersByTimeAsync(0)
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('reads a second time when the first read is still stale', async () => {
    network.listener!(STALE_WIFI)
    await vi.advanceTimersByTimeAsync(1000)
    expect(network.reads).toHaveLength(2)
    network.reads[1]!.resolve(STALE_WIFI)

    await vi.advanceTimersByTimeAsync(3000)
    expect(network.reads).toHaveLength(3)
    network.reads[2]!.resolve(NONE)
    await vi.advanceTimersByTimeAsync(0)
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('drops a read that a newer change overtook', async () => {
    network.listener!(NONE)
    await vi.advanceTimersByTimeAsync(1000)
    expect(network.reads).toHaveLength(2)

    network.listener!(STALE_WIFI)
    network.reads[1]!.resolve(NONE)
    await vi.advanceTimersByTimeAsync(0)
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('stops reading once the app has torn the binding down', async () => {
    network.listener!(STALE_WIFI)
    teardown()
    await vi.advanceTimersByTimeAsync(5000)
    expect(network.reads).toHaveLength(1)
    teardown = () => undefined
  })

  it('reads again when the app returns to the foreground', async () => {
    network.appState!('background')
    network.appState!('active')
    expect(network.reads).toHaveLength(2)
    network.reads[1]!.resolve(NONE)
    await vi.advanceTimersByTimeAsync(0)
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('does not read again on iOS, where a read can time out and report offline', async () => {
    teardown()
    network.reads = []
    network.os = 'ios'
    teardown = bindAppStateToQueryClient()
    network.listener!(ONLINE)
    network.appState!('active')
    await vi.advanceTimersByTimeAsync(5000)
    expect(network.reads).toHaveLength(1)
    expect(onlineManager.isOnline()).toBe(true)
  })
})
