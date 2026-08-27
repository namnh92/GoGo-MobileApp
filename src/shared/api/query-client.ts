import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query'
import * as Network from 'expo-network'
import { AppState, type AppStateStatus } from 'react-native'

import { isRetryable, isUnauthorized } from './errors'
import { queryKeys } from './query-keys'

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
 * React Native has no window focus/online events — TanStack Query needs both
 * wired manually or `refetchOnWindowFocus` / `refetchOnReconnect` never fire.
 * Returns a teardown for the app root.
 */
export function bindAppStateToQueryClient(): () => void {
  const appStateSub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active')
  })

  const networkSub = Network.addNetworkStateListener(state => {
    onlineManager.setOnline(Boolean(state.isInternetReachable ?? state.isConnected))
  })

  void Network.getNetworkStateAsync()
    .then(state => onlineManager.setOnline(Boolean(state.isInternetReachable ?? state.isConnected)))
    .catch(() => onlineManager.setOnline(true))

  return () => {
    appStateSub.remove()
    networkSub.remove()
  }
}

/**
 * Offline cache for the active date: the current plan and the place summaries
 * it references must stay readable with a flaky connection. Only those keys are
 * persisted — search results and suggestion runs are deliberately not.
 */
const PERSISTED_PREFIXES: readonly string[] = ['rooms', 'plans', 'places', 'me']

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'gogo.query-cache',
  throttleTime: 2000,
})

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const [root, , segment] = queryKey
  if (typeof root !== 'string' || !PERSISTED_PREFIXES.includes(root)) return false
  // Search is location- and filter-dependent; a stale hit is worse than a spinner.
  return segment !== 'search'
}

/**
 * Logout must leave no room data behind (RULE-MOB-OFFLINE). Clears the
 * in-memory cache and the persisted copy.
 */
export async function purgeCachedUserData(queryClient: QueryClient): Promise<void> {
  queryClient.removeQueries({ queryKey: queryKeys.rooms() })
  queryClient.removeQueries({ queryKey: ['plans'] })
  queryClient.removeQueries({ queryKey: ['me'] })
  queryClient.clear()
  await queryPersister.removeClient()
}
