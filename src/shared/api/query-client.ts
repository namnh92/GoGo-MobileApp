import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query'
import * as Network from 'expo-network'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import { isRetryable, isUnauthorized } from './errors'
import { shouldPersistQuery } from './persist-policy'
import { queryKeys } from './query-keys'
import { forgetRoomSteps } from '@/shared/navigation/room-steps'

const MAX_RETRIES = 3

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Room, suggestion and plan state changes on other devices; a short
        // stale window keeps screens fresh without hammering the API.
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryable(error),
        retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000),
        // A 401 that survived the client's refresh means the session is gone —
        // refetching on focus would only produce more 401s.
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Mutations carry an Idempotency-Key, so retrying a transport failure
        // cannot double-apply the intent.
        retry: (failureCount, error) =>
          failureCount < 2 && isRetryable(error) && !isUnauthorized(error),
        retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10_000),
      },
    },
  })
}

/**
 * GoGo-MobileApp#253 — on Android a change can be read while the lost network
 * is still the active one: airplane mode arrives as `UNKNOWN` with
 * `isConnected: false` but `isInternetReachable: true`. No connection means
 * offline, whatever reachability still says.
 */
export function isNetworkOnline(state: Pick<Network.NetworkState, 'isConnected' | 'isInternetReachable'>): boolean {
  if (state.isConnected === false) return false
  return Boolean(state.isInternetReachable ?? state.isConnected)
}

/**
 * GoGo-MobileApp#253 — after a change, Android re-reads the network at these
 * delays. A change can be reported stale (airplane mode read as the Wi-Fi it
 * just lost) with no later event to correct it, which left the app online.
 */
export const NETWORK_CONFIRM_DELAYS_MS = [1000, 4000] as const

/**
 * React Native has no window focus/online events — TanStack Query needs both
 * wired manually or `refetchOnWindowFocus` / `refetchOnReconnect` never fire.
 * Returns a teardown for the app root.
 */
export function bindAppStateToQueryClient(): () => void {
  // iOS reports changes reliably, and its one-off read can time out and report
  // offline, so only Android confirms a change by reading again.
  const confirmsChanges = Platform.OS === 'android'
  let confirmations: ReturnType<typeof setTimeout>[] = []

  // The listener is the live source. The one-off read below only seeds the
  // state until the first event: on iOS it can time out (reporting offline) or
  // resolve after a newer event, and applying it then would pause every query
  // and raise a false offline signal at launch (GoGo-MobileApp#253).
  let sawEvent = false
  // Bumped by every event, so a re-read that a newer event overtook is dropped.
  let generation = 0

  function reread() {
    const startedAt = generation
    void Network.getNetworkStateAsync()
      .then(state => {
        if (generation === startedAt) onlineManager.setOnline(isNetworkOnline(state))
      })
      .catch(() => undefined)
  }

  const appStateSub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active')
    // A change while in the background may never have been reported.
    if (status === 'active' && confirmsChanges) reread()
  })

  const networkSub = Network.addNetworkStateListener(state => {
    sawEvent = true
    generation += 1
    onlineManager.setOnline(isNetworkOnline(state))
    if (!confirmsChanges) return
    confirmations.forEach(clearTimeout)
    confirmations = NETWORK_CONFIRM_DELAYS_MS.map(delay => setTimeout(reread, delay))
  })

  void Network.getNetworkStateAsync()
    .then(state => {
      if (!sawEvent) onlineManager.setOnline(isNetworkOnline(state))
    })
    .catch(() => {
      if (!sawEvent) onlineManager.setOnline(true)
    })

  return () => {
    appStateSub.remove()
    networkSub.remove()
    confirmations.forEach(clearTimeout)
  }
}

export { shouldPersistQuery }

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'gogo.query-cache',
  throttleTime: 2000,
})

/**
 * Logout must leave no room data behind (RULE-MOB-OFFLINE). Clears the
 * in-memory cache and the persisted copy.
 */
export async function purgeCachedUserData(queryClient: QueryClient): Promise<void> {
  // Which rooms' runs and plans were already shown belongs to the account too:
  // the next one to sign in on this device has seen none of them (#198).
  forgetRoomSteps()
  queryClient.removeQueries({ queryKey: queryKeys.rooms() })
  queryClient.removeQueries({ queryKey: ['plans'] })
  queryClient.removeQueries({ queryKey: ['me'] })
  queryClient.clear()
  await queryPersister.removeClient()
}
